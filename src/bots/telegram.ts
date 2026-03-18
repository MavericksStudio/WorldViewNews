/**
 * Telegram Bot integration — long-polling, two-way communication.
 *
 * Commands:
 *   /status   — System status
 *   /sweep    — Trigger manual sweep
 *   /alerts   — Recent alerts (optionally filtered by tier: /alerts flash)
 *   /sources  — List registered sources
 *   /ask      — Placeholder for future LLM integration
 *   /help     — Show available commands
 *
 * Alert delivery tiers:
 *   FLASH    — sent immediately
 *   PRIORITY — 5-minute digest batch
 *   ROUTINE  — 24-hour digest batch
 */

import { config }      from '../config.js';
import { logger }      from '../logger.js';
import { alertManager } from '../engine/alerts.js';
import { registry }    from '../sources/registry.js';
import { runSweep }    from '../engine/sweep.js';
import {
  formatAlert,
  formatSweepSummary,
  formatStatus,
  tierBadge,
  truncate,
} from './common.js';
import type { Alert, AlertTier } from '../types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const TELEGRAM_API = 'https://api.telegram.org';
const POLL_TIMEOUT = 30; // seconds for long-polling

const PRIORITY_BATCH_MS = 5  * 60 * 1000; // 5 minutes
const ROUTINE_BATCH_MS  = 24 * 60 * 60 * 1000; // 24 hours

// ── State ─────────────────────────────────────────────────────────────────────

let polling      = false;
let offset       = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// Batching queues
const priorityQueue: Alert[] = [];
const routineQueue:  Alert[] = [];

let priorityTimer: ReturnType<typeof setTimeout> | null = null;
let routineTimer:  ReturnType<typeof setTimeout> | null = null;

// ── Low-level HTTP helper ─────────────────────────────────────────────────────

async function telegramRequest(
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const token = config.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const url = `${TELEGRAM_API}/bot${token}/${method}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json() as { ok: boolean; result?: unknown; description?: string };

  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description ?? 'unknown'}`);
  }

  return data.result;
}

// ── Public: send a message ────────────────────────────────────────────────────

export async function sendMessage(
  chatId: string,
  text: string,
  parseMode: string = 'Markdown',
): Promise<void> {
  try {
    await telegramRequest('sendMessage', {
      chat_id:    chatId,
      text:       text,
      parse_mode: parseMode,
    });
  } catch (err) {
    logger.error('telegram: sendMessage failed', {
      chatId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Alert delivery ────────────────────────────────────────────────────────────

export async function sendAlert(alert: Alert): Promise<void> {
  const chatId = config.TELEGRAM_CHAT_ID;
  if (!chatId || !config.TELEGRAM_BOT_TOKEN) return;

  switch (alert.tier) {
    case 'FLASH': {
      // Immediate delivery
      const text = `🚨 *FLASH ALERT*\n\n${formatAlert(alert)}`;
      await sendMessage(chatId, text);
      break;
    }

    case 'PRIORITY': {
      priorityQueue.push(alert);
      if (priorityTimer === null) {
        priorityTimer = setTimeout(() => {
          void flushPriorityQueue(chatId);
        }, PRIORITY_BATCH_MS);
      }
      break;
    }

    case 'ROUTINE': {
      routineQueue.push(alert);
      if (routineTimer === null) {
        routineTimer = setTimeout(() => {
          void flushRoutineQueue(chatId);
        }, ROUTINE_BATCH_MS);
      }
      break;
    }
  }
}

async function flushPriorityQueue(chatId: string): Promise<void> {
  priorityTimer = null;
  if (priorityQueue.length === 0) return;

  const batch = priorityQueue.splice(0);
  const lines = batch.map((a) => `• ${truncate(a.change.item.title, 120)}\n  💡 ${a.change.reason}`);
  const text  = `⚠️ *PRIORITY Digest* (${batch.length} alert${batch.length === 1 ? '' : 's'})\n\n${lines.join('\n\n')}`;

  await sendMessage(chatId, text);
}

async function flushRoutineQueue(chatId: string): Promise<void> {
  routineTimer = null;
  if (routineQueue.length === 0) return;

  const batch = routineQueue.splice(0);
  const lines = batch.map((a) => `• ${truncate(a.change.item.title, 120)}`);
  const text  = `📋 *ROUTINE Daily Digest* (${batch.length} update${batch.length === 1 ? '' : 's'})\n\n${lines.join('\n')}`;

  await sendMessage(chatId, text);
}

// ── Command handlers ──────────────────────────────────────────────────────────

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string };
  chat: { id: number; type: string };
  text?: string;
}

async function handleCommand(msg: TelegramMessage): Promise<void> {
  const chatId = String(msg.chat.id);
  const text   = msg.text?.trim() ?? '';

  // Extract command and argument
  const [rawCmd = '', ...argParts] = text.split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/@\S+$/, ''); // strip @botname suffix
  const arg = argParts.join(' ').toLowerCase();

  logger.debug('telegram: command received', { cmd, arg, chatId });

  switch (cmd) {
    case '/status': {
      await sendMessage(chatId, formatStatus());
      break;
    }

    case '/sweep': {
      await sendMessage(chatId, '⏳ Running sweep, please wait…');
      try {
        const result = await runSweep();
        await sendMessage(chatId, formatSweepSummary(result));
      } catch (err) {
        await sendMessage(
          chatId,
          `❌ Sweep failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      break;
    }

    case '/alerts': {
      let tier: AlertTier | undefined;
      if (arg === 'flash')    tier = 'FLASH';
      if (arg === 'priority') tier = 'PRIORITY';
      if (arg === 'routine')  tier = 'ROUTINE';

      const alerts = tier
        ? alertManager.getByTier(tier)
        : alertManager.getRecent(10);

      if (alerts.length === 0) {
        await sendMessage(chatId, '_No alerts found._');
        return;
      }

      const header = tier
        ? `${tierBadge(tier)} Alerts (last ${alerts.length})`
        : `🔔 Recent Alerts (last ${alerts.length})`;

      const lines = alerts
        .slice(0, 10)
        .map(
          (a) =>
            `${tierBadge(a.tier)} *${truncate(a.change.item.title, 100)}*\n` +
            `   ${a.change.reason} — ${a.createdAt.toISOString().slice(0, 16)} UTC`,
        );

      await sendMessage(chatId, `${header}\n\n${lines.join('\n\n')}`);
      break;
    }

    case '/sources': {
      const all       = registry.getAll();
      const available = registry.getAvailable();
      const lines     = all.map((s) => {
        const ok = available.some((a) => a.id === s.id);
        return `${ok ? '✅' : '❌'} \`${s.id}\` [${s.category}]`;
      });

      await sendMessage(
        chatId,
        `📡 *Sources* (${available.length}/${all.length} available)\n\n${lines.join('\n')}`,
      );
      break;
    }

    case '/ask': {
      if (!arg) {
        await sendMessage(chatId, '❓ Usage: `/ask <question>`');
        return;
      }
      await sendMessage(
        chatId,
        '🤖 LLM analysis is not configured yet. Stay tuned for Phase 4!',
      );
      break;
    }

    case '/help': {
      const helpText = [
        '📖 *WorldViewNews Bot Commands*',
        '',
        '`/status` — System status & uptime',
        '`/sweep` — Trigger a manual sweep now',
        '`/alerts` — Recent alerts (last 10)',
        '`/alerts flash` — FLASH alerts only',
        '`/alerts priority` — PRIORITY alerts only',
        '`/alerts routine` — ROUTINE alerts only',
        '`/sources` — List all registered sources',
        '`/ask <question>` — Ask the LLM (coming soon)',
        '`/help` — Show this message',
      ].join('\n');

      await sendMessage(chatId, helpText);
      break;
    }

    default: {
      // Ignore non-command messages silently
      if (cmd.startsWith('/')) {
        await sendMessage(chatId, `❓ Unknown command: \`${cmd}\`. Try /help`);
      }
    }
  }
}

// ── Long-polling loop ─────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  if (!polling) return;

  try {
    const updates = (await telegramRequest('getUpdates', {
      offset:  offset,
      timeout: POLL_TIMEOUT,
      allowed_updates: ['message'],
    })) as Array<{ update_id: number; message?: TelegramMessage }>;

    for (const update of updates) {
      offset = update.update_id + 1;

      if (update.message?.text?.startsWith('/')) {
        try {
          await handleCommand(update.message);
        } catch (err) {
          logger.error('telegram: command handler error', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } catch (err) {
    logger.warn('telegram: poll error', {
      err: err instanceof Error ? err.message : String(err),
    });
    // Back off briefly before retrying to avoid hammering the API on errors
    await new Promise((resolve) => { pollTimer = setTimeout(resolve, 5000); });
  }

  // Schedule next poll immediately (long-poll keeps the connection open server-side)
  if (polling) {
    pollTimer = setTimeout(() => { void poll(); }, 0);
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function startTelegram(): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN) {
    logger.info('telegram: TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  if (!config.TELEGRAM_CHAT_ID) {
    logger.warn('telegram: TELEGRAM_CHAT_ID not set — alert delivery disabled, commands still active');
  }

  // Verify token is valid by calling getMe
  try {
    const me = await telegramRequest('getMe', {}) as { username?: string };
    logger.info('telegram: bot started', { username: me.username ?? 'unknown' });
  } catch (err) {
    logger.error('telegram: failed to authenticate — bot not started', {
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  polling = true;
  void poll();
  logger.info('telegram: long-polling started');
}

export function stopTelegram(): void {
  polling = false;

  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (priorityTimer !== null) {
    clearTimeout(priorityTimer);
    priorityTimer = null;
  }
  if (routineTimer !== null) {
    clearTimeout(routineTimer);
    routineTimer = null;
  }

  logger.info('telegram: stopped');
}
