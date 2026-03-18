/**
 * Sweep orchestrator: fans out to all available sources in parallel,
 * collects results and errors, persists to memory and archive, and
 * returns a SweepResult.
 */

import { randomUUID } from 'node:crypto';
import { registry } from '../sources/registry.js';
import { logger } from '../logger.js';
import { memory } from '../storage/memory.js';
import { archive } from '../storage/archive.js';
import type { IntelligenceItem, SweepContext, SweepError, SweepResult } from '../types.js';

export async function runSweep(): Promise<SweepResult> {
  const sweepId = randomUUID();
  const startedAt = new Date();

  const sources = registry.getAvailable();

  const ctx: SweepContext = {
    sweepId,
    startedAt,
    sources: sources.map((s) => s.id),
  };

  logger.info('sweep: starting', {
    sweepId,
    sourcesAvailable: sources.length,
  });

  const outcomes = await Promise.allSettled(
    sources.map((source) => source.fetch(ctx)),
  );

  const items: IntelligenceItem[] = [];
  const errors: SweepError[] = [];
  let sourcesSucceeded = 0;

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    const source = sources[i];

    if (outcome.status === 'fulfilled') {
      items.push(...outcome.value);
      sourcesSucceeded++;
    } else {
      const sweepError: SweepError = {
        source: source!.id,
        error:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
        timestamp: new Date(),
      };
      errors.push(sweepError);
      logger.warn('sweep: source failed', {
        sweepId,
        source: source!.id,
        error: sweepError.error,
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
