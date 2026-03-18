/**
 * WorldViewNews — Entry Point
 * Wires together the sweep engine, HTTP server, SSE, delta engine, and alert manager.
 */

// ── Side-effect imports (source self-registration) ──────────────────────────
import './sources/environment/usgs.js';
import './sources/environment/firms.js';
import './sources/environment/radiation.js';
import './sources/news/rss.js';
import './sources/space/satellites.js';
import './sources/weather/openmeteo.js';
import './sources/conflict/acled.js';
import './sources/conflict/gdelt.js';
import './sources/conflict/ucdp.js';
import './sources/aviation/opensky.js';
import './sources/maritime/ais.js';
import './sources/economic/fred.js';
import './sources/economic/eia.js';
import './sources/market/finnhub.js';
import './sources/market/coingecko.js';

// ── Core imports ──────────────────────────────────────────────────────────────
import { config }          from './config.js';
import { logger }          from './logger.js';
import { registry }        from './sources/registry.js';
import { runSweep }        from './engine/sweep.js';
import { startScheduler, stopScheduler } from './engine/scheduler.js';
import { deltaEngine }     from './engine/delta.js';
import { alertManager }    from './engine/alerts.js';
import { createServer }    from './server/http.js';
import { broadcast }       from './server/sse.js';
import { startTelegram, stopTelegram, sendAlert as telegramSendAlert } from './bots/telegram.js';
import { startDiscord,  stopDiscord,  sendAlert as discordSendAlert  } from './bots/discord.js';
import type { SweepResult } from './types.js';

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

// ── Bot integrations ──────────────────────────────────────────────────────────
void startTelegram();
void startDiscord();

// ── Previous sweep state for delta engine ────────────────────────────────────
let previousSweep: SweepResult | undefined;

/** Run a sweep, apply delta analysis, process alerts, broadcast SSE events. */
async function runSweepWithDelta(): Promise<SweepResult> {
  const result = await runSweep();

  // Delta analysis
  const changes = deltaEngine.analyze(result, previousSweep);
  previousSweep = result;

  if (changes.length > 0) {
    logger.info('delta: changes detected', { count: changes.length });

    // Process through alert manager (rate limiting + cooldowns)
    const alerts = alertManager.process(changes);

    if (alerts.length > 0) {
      const stats = alertManager.getStats();
      logger.info('alerts: alerts created', {
        new:      alerts.length,
        total:    stats.total,
        flash:    stats.flash,
        priority: stats.priority,
        routine:  stats.routine,
      });

      // Broadcast each alert via SSE and deliver to bots
      for (const alert of alerts) {
        broadcast('alert', alert);
        void telegramSendAlert(alert);
        void discordSendAlert(alert);
      }
    }
  }

  return result;
}

// ── First sweep (immediate) ───────────────────────────────────────────────────
logger.info('sweep: running initial sweep…');
runSweepWithDelta()
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
const INTERVAL_MS = config.SWEEP_INTERVAL_MS;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let sweepInFlight = false;

async function scheduledSweep(): Promise<void> {
  if (sweepInFlight) return;
  sweepInFlight = true;
  try {
    const result = await runSweepWithDelta();
    broadcast('sweep', result);

    // Broadcast an updated status payload
    const { memory } = await import('./storage/memory.js');
    const alertStats = alertManager.getStats();
    broadcast('status', {
      sweepCount:  memory.getAll().length,
      itemCount:   memory.getAllItems().length,
      sourceCount: registry.getAll().length,
      lastSweepAt: result.completedAt,
      alertStats,
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
  stopTelegram();
  stopDiscord();

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
