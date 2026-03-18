/**
 * Express HTTP server factory.
 * Mounts the dashboard, REST API, and SSE endpoint.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDashboardHTML } from './dashboard.js';
import { apiRouter } from './api.js';
import { addClient } from './sse.js';
import { logger } from '../logger.js';

export function createServer() {
  const app = express();

  // ── CORS (allow all origins for dev) ──────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // ── Body parsing ──────────────────────────────────────────────────────
  app.use(express.json());

  // ── Dashboard ─────────────────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getDashboardHTML());
  });

  // ── SSE stream ────────────────────────────────────────────────────────
  app.get('/api/v1/stream', (req: Request, res: Response) => {
    addClient(res);
  });

  // ── REST API ──────────────────────────────────────────────────────────
  app.use('/api/v1', apiRouter);

  // ── 404 ───────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // ── Error handler ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('http: unhandled error', { message });
    res.status(500).json({ error: 'Internal server error.' });
  });

  /** Start listening on the given port. Returns the http.Server instance. */
  function start(port: number) {
    return app.listen(port, () => {
      logger.info(`http: server listening on http://localhost:${port}`);
    });
  }

  return { app, start };
}
