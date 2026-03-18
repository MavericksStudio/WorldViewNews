/**
 * Sweep orchestrator: fans out to all available sources in parallel,
 * collects results and errors, persists to memory and archive, and
 * returns a SweepResult.
 *
 * Hardening features:
 *  - Per-source timeout (SOURCE_TIMEOUT_MS, default 30 s)
 *  - One retry on failure with exponential backoff (500 ms base, 2× multiplier)
 *  - Graceful degradation: after MAX_SOURCE_FAILURES consecutive failures a
 *    source is marked degraded and skipped for DEGRADED_SKIP_SWEEPS sweeps
 */

import { randomUUID } from 'node:crypto';
import { registry } from '../sources/registry.js';
import { logger } from '../logger.js';
import { memory } from '../storage/memory.js';
import { archive } from '../storage/archive.js';
import type { DataSource } from '../sources/base.js';
import type { IntelligenceItem, SweepContext, SweepError, SweepResult } from '../types.js';

// ── Hardening constants (override via env if needed) ──────────────────────────
const SOURCE_TIMEOUT_MS = Number(process.env['SOURCE_TIMEOUT_MS'] ?? 30_000);
const RETRY_BASE_DELAY_MS = 500;
const MAX_SOURCE_FAILURES = 3;   // consecutive failures before degraded
const DEGRADED_SKIP_SWEEPS = 5;  // how many sweeps to skip a degraded source

// ── Per-source failure state ──────────────────────────────────────────────────
interface SourceHealth {
  consecutiveFailures: number;
  degradedUntilSweep: number; // sweep counter value when degradation expires
}

const sourceHealth = new Map<string, SourceHealth>();
let sweepCounter = 0;

function getHealth(sourceId: string): SourceHealth {
  let h = sourceHealth.get(sourceId);
  if (!h) {
    h = { consecutiveFailures: 0, degradedUntilSweep: 0 };
    sourceHealth.set(sourceId, h);
  }
  return h;
}

function isDegraded(sourceId: string): boolean {
  const h = sourceHealth.get(sourceId);
  return h !== undefined && sweepCounter < h.degradedUntilSweep;
}

function recordSuccess(sourceId: string): void {
  const h = getHealth(sourceId);
  h.consecutiveFailures = 0;
}

function recordFailure(sourceId: string): void {
  const h = getHealth(sourceId);
  h.consecutiveFailures++;
  if (h.consecutiveFailures >= MAX_SOURCE_FAILURES) {
    h.degradedUntilSweep = sweepCounter + DEGRADED_SKIP_SWEEPS;
    logger.warn('sweep: source marked degraded', {
      source: sourceId,
      consecutiveFailures: h.consecutiveFailures,
      resumesAfterSweep: h.degradedUntilSweep,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a single source with a timeout guard and one automatic retry.
 * Uses AbortController to enforce SOURCE_TIMEOUT_MS per attempt.
 */
async function fetchSourceWithRetry(
  source: DataSource,
  ctx: SweepContext,
): Promise<IntelligenceItem[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

    try {
      // Pass the AbortSignal down via ctx if the source respects it, but
      // the primary guard is the abort itself bubbling up as an error.
      const items = await Promise.race([
        source.fetch(ctx),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () =>
            reject(new Error(`source "${source.id}" timed out after ${SOURCE_TIMEOUT_MS} ms`)),
          ),
        ),
      ]);
      clearTimeout(timer);
      return items;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 0) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt); // 500 ms
        logger.warn('sweep: source fetch failed, retrying', {
          source: source.id,
          attempt: attempt + 1,
          delayMs: delay,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delay);
      } else {
        throw err; // re-throw after final attempt
      }
    }
  }
  // TypeScript requires an explicit return; the loop above always returns or throws.
  throw new Error(`fetchSourceWithRetry: unreachable for source "${source.id}"`);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runSweep(): Promise<SweepResult> {
  sweepCounter++;

  const sweepId = randomUUID();
  const startedAt = new Date();

  const allSources = registry.getAvailable();

  // Filter out degraded sources and log skips
  const sources = allSources.filter((s) => {
    if (isDegraded(s.id)) {
      logger.debug('sweep: skipping degraded source', {
        source: s.id,
        resumesAfterSweep: sourceHealth.get(s.id)?.degradedUntilSweep,
      });
      return false;
    }
    return true;
  });

  const ctx: SweepContext = {
    sweepId,
    startedAt,
    sources: sources.map((s) => s.id),
  };

  logger.info('sweep: starting', {
    sweepId,
    sweepCounter,
    sourcesAvailable: allSources.length,
    sourcesActive: sources.length,
    sourcesDegraded: allSources.length - sources.length,
  });

  const outcomes = await Promise.allSettled(
    sources.map((source) => fetchSourceWithRetry(source, ctx)),
  );

  const items: IntelligenceItem[] = [];
  const errors: SweepError[] = [];
  let sourcesSucceeded = 0;

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    const source = sources[i]!;

    if (outcome.status === 'fulfilled') {
      items.push(...outcome.value);
      sourcesSucceeded++;
      recordSuccess(source.id);
    } else {
      const sweepError: SweepError = {
        source: source.id,
        error:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
        timestamp: new Date(),
      };
      errors.push(sweepError);
      recordFailure(source.id);
      logger.warn('sweep: source failed', {
        sweepId,
        source: source.id,
        error: sweepError.error,
        consecutiveFailures: sourceHealth.get(source.id)?.consecutiveFailures,
      });
    }
  }

  const completedAt = new Date();

  const result: SweepResult = {
    sweepId,
    startedAt,
    completedAt,
    items,
    errors,
    sourcesQueried: sources.length,
    sourcesSucceeded,
  };

  logger.info('sweep: completed', {
    sweepId,
    sourcesQueried: sources.length,
    sourcesSucceeded,
    itemsFound: items.length,
    errorCount: errors.length,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  });

  // Persist to hot memory and cold archive.
  memory.store(result);

  try {
    await archive(result);
  } catch (err) {
    logger.error('sweep: archive write failed', {
      sweepId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
