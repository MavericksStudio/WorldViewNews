/**
 * WorldViewNews — Entry Point
 * Wires together the sweep engine, HTTP server, SSE, and scheduler.
 */

// ── Side-effect imports (source self-registration) ──────────────────────────
import './sources/environment/usgs.js';
import './sources/environment/firms.js';
import './sources/news/rss.js';
import './sources/space/satellites.js';
import './sources/weather/openmeteo.js';

// ── Core imports ──────────────────────────────────────────────────────────────
import { config }          from './config.js';
import { logger }          from './logger.js';
import { registry }        from './sources/registry.js';
import { runSweep }        from './engine/sweep.js';
import { startScheduler, stopScheduler } from './engine/scheduler.js';
import { createServer }    from './server/http.js';
import { broadcast }       from './server/sse.js';

// ── Banner ────────────────────────────────────────────────────────────────────
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
logger.info('  WorldViewNews  v0.1.0 — Global Intelligence Monitor');
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ── Log registered sources ────────────────────────────────────────────────────
const allSources       = registry.getAll();
const availableSources = registry.getAvailable();

logger.info('sources: registered', {
  total:     allSources.length,
  available: availableSources.length,
  ids:       availableSources.map((s) => s.id),
});

// ── HTTP server ───────────────────────────────────────────────────────────────
const { start } = createServer();
const httpServer = start(config.PORT);

// ── First sweep (immediate) ───────────────────────────────────────────────────
logger.info('sweep: running initial sweep…');
runSweep()
  .then((result) => {
    logger.info('sweep: initial sweep complete', {
      items:   result.items.length,
      sources: result.sourcesSucceeded + '/' + result.sourcesQueried,
    });
    broadcast('sweep', result);
  })
  .catch((err) => {
    logger.error('sweep: initial sweep failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  });

// ── Scheduler ─────────────────────────────────────────────────────────────────
// The scheduler fires its own initial sweep — we skip that here by passing
// a custom interval and wrapping runSweep to broadcast results.
// We drive the scheduler with a wrapper that broadcasts after each sweep.
const INTERVAL_MS = config.SWEEP_INTERVAL_MS;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let sweepInFlight = false;

async function scheduledSweep(): Promise<void> {
  if (sweepInFlight) return;
  sweepInFlight = true;
  try {
    const result = await runSweep();
    broadcast('sweep', result);

    // Also broadcast an updated status payload
    const { memory } = await import('./storage/memory.js');
    broadcast('status', {
      sweepCount:  memory.getAll().length,
      itemCount:   memory.getAllItems().length,
      sourceCount: registry.getAll().length,
      lastSweepAt: result.completedAt,
    });
  } catch (err) {
    logger.error('scheduler: sweep error', {
      err: err instanceof Error ? err.message : String(err),
    });
  } finally {
    sweepInFlight = false;
  }
}

schedulerTimer = setInterval(() => {
  void scheduledSweep();
}, INTERVAL_MS);

logger.info('scheduler: started', { intervalMs: INTERVAL_MS });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string): void {
  logger.info(`process: received ${signal} — shutting down`);

  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  stopScheduler();

  httpServer.close(() => {
    logger.info('http: server closed');
    process.exit(0);
  });

  // Force exit after 5 s if connections linger
  setTimeout(() => {
    logger.warn('process: forced exit after timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
