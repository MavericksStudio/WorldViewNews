/**
 * SSE (Server-Sent Events) connection manager.
 * Maintains a set of active response objects and broadcasts events to all connected clients.
 */

import type { Response } from 'express';
import { logger } from '../logger.js';

const clients = new Set<Response>();

/**
 * Registers a response as an SSE client.
 * Sets appropriate headers and removes the client when the connection closes.
 */
export function addClient(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  clients.add(res);
  logger.debug('sse: client connected', { total: clients.size });

  res.on('close', () => {
    clients.delete(res);
    logger.debug('sse: client disconnected', { total: clients.size });
  });
}

/**
 * Broadcasts an event to all connected SSE clients.
 * Clients that have already closed are silently skipped.
 */
export function broadcast(event: string, data: unknown): void {
  if (clients.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }

  logger.debug('sse: broadcast', { event, clients: clients.size });
}

/** Returns the number of currently connected SSE clients. */
export function getClientCount(): number {
  return clients.size;
}
