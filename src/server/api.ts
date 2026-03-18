/**
 * REST API routes for WorldViewNews.
 * All endpoints return JSON.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { registry } from '../sources/registry.js';
import { memory } from '../storage/memory.js';
import { runSweep } from '../engine/sweep.js';
import { broadcast } from './sse.js';
import type { Severity, SourceCategory } from '../types.js';
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

export { router as apiRouter };
