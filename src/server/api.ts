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
import { summaryStore } from '../storage/summaryStore.js';
import { findCorrelations } from '../analysis/correlation.js';
import { calculateCII } from '../analysis/cii.js';
import { generateTradeIdeas } from '../analysis/trade-ideas.js';
import { llmRegistry } from '../llm/registry.js';
import { summarizeSweep } from '../llm/summarizer.js';
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
    llm: {
      available: llmRegistry.isAnyAvailable(),
      providers: llmRegistry.getAvailable().map((p) => p.id),
    },
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

// ─── GET /api/v1/summary/latest ───────────────────────────────────────────────

router.get('/summary/latest', (_req: Request, res: Response) => {
  const latest = summaryStore.getLatest();
  if (!latest) {
    res.status(404).json({
      error: 'No summary available yet.',
      llmAvailable: llmRegistry.isAnyAvailable(),
    });
    return;
  }
  res.json(latest);
});

// ─── POST /api/v1/summary/generate ────────────────────────────────────────────

router.post('/summary/generate', async (_req: Request, res: Response) => {
  if (!llmRegistry.isAnyAvailable()) {
    res.status(503).json({
      error: 'No LLM provider available.',
      providers: llmRegistry.getAvailable().map((p) => p.id),
    });
    return;
  }

  const items = memory.getAllItems();
  if (items.length === 0) {
    res.status(404).json({ error: 'No items available. Wait for a sweep to complete.' });
    return;
  }

  // Build a minimal SweepResult for the summarizer
  const latest = memory.getLatest();
  if (!latest) {
    res.status(404).json({ error: 'No sweep results available yet.' });
    return;
  }

  // Call LLM directly (not through summarizeSweep which swallows errors)
  const topItems = latest.items.slice(0, 50);
  if (topItems.length === 0) {
    res.status(404).json({ error: `Latest sweep has 0 items (${latest.sourcesSucceeded}/${latest.sourcesQueried} sources succeeded).` });
    return;
  }

  const itemLines = topItems.map((it) => {
    const loc = it.location ? ` [${it.location.name}${it.location.country ? ', ' + it.location.country : ''}]` : '';
    return `- [${it.category.toUpperCase()}][${it.severity}]${loc} ${it.title}: ${it.description}`;
  }).join('\n');

  const prompt =
    `Analyze these intelligence items and provide a brief situational awareness summary (3-5 sentences).\n` +
    `Focus on the most significant events, geographic hotspots, and any concerning patterns.\n` +
    `Items from sweep ${latest.sweepId} (${latest.items.length} total, ${latest.sourcesSucceeded}/${latest.sourcesQueried} sources succeeded):\n\n` +
    itemLines;

  try {
    const summary = await llmRegistry.complete(prompt, {
      maxTokens: 512,
      systemPrompt: 'You are a professional intelligence analyst providing concise situational awareness briefings.',
    });
    summaryStore.store({ sweepId: latest.sweepId, summary, generatedAt: new Date() });
    broadcast('summary', { sweepId: latest.sweepId, summary });
    res.json({ success: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('api: summary generation failed', { error: message });
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/v1/analysis/correlations ────────────────────────────────────────

router.get('/analysis/correlations', (_req: Request, res: Response) => {
  const items = memory.getAllItems();
  const correlations = findCorrelations(items);
  res.json({
    count: correlations.length,
    correlations,
    computedAt: new Date().toISOString(),
    itemsAnalyzed: items.length,
  });
});

// ─── GET /api/v1/analysis/cii ─────────────────────────────────────────────────

router.get('/analysis/cii', (_req: Request, res: Response) => {
  const items = memory.getAllItems();
  const scores = calculateCII(items);
  res.json({
    count: scores.length,
    scores,
    computedAt: new Date().toISOString(),
    itemsAnalyzed: items.length,
  });
});

// ─── GET /api/v1/analysis/trade-ideas ─────────────────────────────────────────

router.get('/analysis/trade-ideas', async (_req: Request, res: Response) => {
  if (!llmRegistry.isAnyAvailable()) {
    res.status(503).json({
      error: 'No LLM provider available. Configure at least one LLM API key to enable trade ideas.',
      availableProviders: llmRegistry.getAvailable().map((p) => p.id),
    });
    return;
  }

  const items = memory.getAllItems();

  try {
    const ideas = await generateTradeIdeas(items);
    res.json({
      count: ideas.length,
      ideas,
      disclaimer:
        'DISCLAIMER: This is AI-generated analysis for informational purposes only. ' +
        'It is NOT financial advice. Do not make investment decisions based solely on this output.',
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('api: trade ideas generation failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Trade ideas generation failed.' });
  }
});

export { router as apiRouter };
