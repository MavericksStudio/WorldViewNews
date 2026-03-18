/**
 * Sweep scheduler: runs periodic sweeps at a configurable interval.
 * Prevents overlapping sweeps — if a sweep is still in progress when
 * the next tick fires, that tick is skipped.
 */

import { config } from '../config.js';
import { logger } from '../logger.js';
import { runSweep } from './sweep.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let sweepInProgress = false;

/** Starts the sweep scheduler. Safe to call only once; no-op if already running. */
export function startScheduler(intervalMs: number = config.SWEEP_INTERVAL_MS): void {
  if (intervalHandle !== null) {
    logger.warn('scheduler: already running, ignoring startScheduler call');
    return;
  }

  logger.info('scheduler: starting', { intervalMs });

  // Fire an initial sweep immediately, then on each interval tick.
  void executeSweep();

  intervalHandle = setInterval(() => {
    void executeSweep();
  }, intervalMs);
}

/** Stops the scheduler. Safe to call when not running. */
export function stopScheduler(): void {
  if (intervalHandle === null) {
    logger.warn('scheduler: not running, ignoring stopScheduler call');
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info('scheduler: stopped');
}

/** Returns true if the scheduler interval is active. */
export function isRunning(): boolean {
  return intervalHandle !== null;
}

async function executeSweep(): Promise<void> {
  if (sweepInProgress) {
    logger.info('scheduler: sweep already in progress, skipping tick');
    return;
  }

  sweepInProgress = true;
  try {
    await runSweep();
  } catch (err) {
    // runSweep should not throw, but guard anyway.
    logger.error('scheduler: unhandled error in sweep', {
      err: err instanceof Error ? err.message : String(err),
    });
  } finally {
    sweepInProgress = false;
  }
}
