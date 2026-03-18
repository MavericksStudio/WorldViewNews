/**
 * REST API routes for WorldViewNews.
 * All endpoints return JSON.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { registry } from '../sources/registry.js';
import { memory } from '../storage/memory.js';
import { runSweep } from '../engine/sweep.js';
import { alertManager } from '../engine/alerts.js';
import { broadcast } from './sse.js';
import type { Severity, SourceCategory, AlertTier } from '../types.js';
import { logger } from '../logger.js';

const router = Router();
const startedAt = Date.now();

// ─── GET /api/v1/status ───────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  const latest = memory.getLatest();
  res.json({
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    sweepCount: memory.getAll().length,
    sourceCount: registry.getAll().length,
    itemCount: memory.getAllItems().length,
    lastSweepAt: latest?.completedAt ?? null,
    alertStats: alertManager.getStats(),
  });
});

// ─── GET /api/v1/items ────────────────────────────────────────────────────────

router.get('/items', (req: Request, res: Response) => {
  let items = memory.getAllItems();

  const { category, severity, limit } = req.query;

  if (typeof category === 'string' && category.length > 0) {
    items = items.filter((i) => i.category === (category as SourceCategory));
  }

  if (typeof severity === 'string' && severity.length > 0) {
    items = items.filter((i) => i.severity === (severity as Severity));
  }

  const limitN = typeof limit === 'string' ? parseInt(limit, 10) : NaN;
  if (!isNaN(limitN) && limitN > 0) {
    items = items.slice(-limitN);
  }

  res.json(items);
});

// ─── GET /api/v1/items/geo ────────────────────────────────────────────────────

router.get('/items/geo', (_req: Request, res: Response) => {
  const geoItems = memory.getAllItems().filter((i) => i.location !== undefined);
  res.json(geoItems);
});

// ─── GET /api/v1/sources ──────────────────────────────────────────────────────

router.get('/sources', (_req: Request, res: Response) => {
  const sources = registry.getAll().map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    requiresKey: s.requiresKey,
    available: s.isAvailable(),
  }));
  res.json(sources);
});

// ─── GET /api/v1/sweep/latest ─────────────────────────────────────────────────

router.get('/sweep/latest', (_req: Request, res: Response) => {
  const latest = memory.getLatest();
  if (!latest) {
    res.status(404).json({ error: 'No sweep results available yet.' });
    return;
  }
  res.json(latest);
});

// ─── POST /api/v1/sweep/trigger ───────────────────────────────────────────────

router.post('/sweep/trigger', async (_req: Request, res: Response) => {
  logger.info('api: manual sweep triggered');
  try {
    const result = await runSweep();
    broadcast('sweep', result);
    res.json(result);
  } catch (err) {
    logger.error('api: manual sweep failed', { err: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Sweep failed.' });
  }
});

// ─── GET /api/v1/alerts ───────────────────────────────────────────────────────

router.get('/alerts', (req: Request, res: Response) => {
  const { tier, limit } = req.query;

  const limitN = typeof limit === 'string' ? parseInt(limit, 10) : 50;
  const safeLimit = !isNaN(limitN) && limitN > 0 ? limitN : 50;

  if (typeof tier === 'string' && tier.length > 0) {
    const tierUpper = tier.toUpperCase() as AlertTier;
    if (!['FLASH', 'PRIORITY', 'ROUTINE'].includes(tierUpper)) {
      res.status(400).json({ error: 'Invalid tier. Must be FLASH, PRIORITY, or ROUTINE.' });
      return;
    }
    res.json(alertManager.getByTier(tierUpper).slice(0, safeLimit));
    return;
  }

  res.json(alertManager.getRecent(safeLimit));
});

// ─── GET /api/v1/alerts/stats ─────────────────────────────────────────────────

router.get('/alerts/stats', (_req: Request, res: Response) => {
  res.json(alertManager.getStats());
});

export { router as apiRouter };
