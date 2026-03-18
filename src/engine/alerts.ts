/**
 * Alert Manager — processes delta changes into alerts with rate limiting and cooldowns.
 * Rate limits: 5 FLASH/hour, 20 PRIORITY/hour, 100 ROUTINE/hour.
 * Cooldown: same source+title combo won't re-alert within 30 minutes.
 * History: keeps last 1000 alerts in memory.
 */

import { randomUUID } from 'node:crypto';
import type { Alert, AlertTier, DeltaChange } from '../types.js';
import { logger } from '../logger.js';

// ── Rate limit config ─────────────────────────────────────────────────────────

const RATE_LIMITS: Record<AlertTier, number> = {
  FLASH:    5,
  PRIORITY: 20,
  ROUTINE:  100,
};

const RATE_WINDOW_MS    = 60 * 60 * 1000; // 1 hour
const COOLDOWN_MS       = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY       = 1000;

// ── Alert Manager implementation ──────────────────────────────────────────────

export interface AlertManagerInterface {
  process(changes: DeltaChange[]): Alert[];
  getRecent(limit?: number): Alert[];
  getByTier(tier: AlertTier): Alert[];
  getStats(): { total: number; flash: number; priority: number; routine: number };
}

class AlertManagerImpl implements AlertManagerInterface {
  private readonly history: Alert[] = [];

  /** Process delta changes, applying rate limits and cooldowns. */
  process(changes: DeltaChange[]): Alert[] {
    const now = new Date();
    const created: Alert[] = [];

    for (const change of changes) {
      const tier = change.tier;

      // ── Cooldown check ──────────────────────────────────────────────────
      const cooldownKey = `${change.item.source}::${change.item.title}`;
      const lastAlert = this.history
        .slice()
        .reverse()
        .find(
          (a) =>
            `${a.change.item.source}::${a.change.item.title}` === cooldownKey &&
            now.getTime() - a.createdAt.getTime() < COOLDOWN_MS,
        );

      if (lastAlert) {
        logger.debug('alerts: cooldown suppressed', { key: cooldownKey, tier });
        continue;
      }

      // ── Rate limit check ────────────────────────────────────────────────
      const windowStart = now.getTime() - RATE_WINDOW_MS;
      const recentCount = this.history.filter(
        (a) => a.tier === tier && a.createdAt.getTime() > windowStart,
      ).length;

      if (recentCount >= RATE_LIMITS[tier]) {
        logger.debug('alerts: rate limit hit', { tier, limit: RATE_LIMITS[tier] });
        continue;
      }

      // ── Create alert ────────────────────────────────────────────────────
      const alert: Alert = {
        id: randomUUID(),
        tier,
        change,
        createdAt: now,
        channels: [],
      };

      this.history.push(alert);
      created.push(alert);

      // Trim history to max size
      while (this.history.length > MAX_HISTORY) {
        this.history.shift();
      }

      logger.info('alerts: alert created', {
        id: alert.id,
        tier,
        type: change.type,
        source: change.item.source,
        title: change.item.title.slice(0, 80),
        reason: change.reason,
      });
    }

    return created;
  }

  /** Returns the most recent alerts, newest first. */
  getRecent(limit = 50): Alert[] {
    return this.history.slice(-limit).reverse();
  }

  /** Returns all alerts matching the given tier, newest first. */
  getByTier(tier: AlertTier): Alert[] {
    return this.history.filter((a) => a.tier === tier).reverse();
  }

  /** Returns aggregate statistics. */
  getStats(): { total: number; flash: number; priority: number; routine: number } {
    return {
      total:   this.history.length,
      flash:   this.history.filter((a) => a.tier === 'FLASH').length,
      priority:this.history.filter((a) => a.tier === 'PRIORITY').length,
      routine: this.history.filter((a) => a.tier === 'ROUTINE').length,
    };
  }
}

/** Singleton alert manager. */
export const alertManager: AlertManagerInterface = new AlertManagerImpl();
