/**
 * Discord Bot integration — webhook mode.
 *
 * Sends rich embeds via Discord Incoming Webhooks.
 * Activated when DISCORD_WEBHOOK_URL is set in config.
 * DISCORD_BOT_TOKEN is accepted for future full-bot expansion
 * but is not used in this phase (webhook-only implementation).
 *
 * Color coding:
 *   FLASH    — red    (#FF0000)
 *   PRIORITY — orange (#FF8C00)
 *   ROUTINE  — blue   (#3498DB)
 */

import { config }  from '../config.js';
import { logger }  from '../logger.js';
import {
  formatAlert,
  formatSweepSummary,
  severityEmoji,
  tierBadge,
  truncate,
} from './common.js';
import type { Alert, AlertTier, SweepResult } from '../types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscordEmbedField {
  name:   string;
  value:  string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?:       string;
  description?: string;
  color?:       number;
  fields?:      DiscordEmbedField[];
  footer?:      { text: string };
  timestamp?:   string;
}

interface WebhookPayload {
  content?: string;
  username?: string;
  embeds?: DiscordEmbed[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<AlertTier, number> = {
  FLASH:    0xFF0000,
  PRIORITY: 0xFF8C00,
  ROUTINE:  0x3498DB,
};

const BOT_USERNAME = 'WorldViewNews';

// ── State ─────────────────────────────────────────────────────────────────────

let webhookUrl: string | null = null;

// ── Core webhook sender ───────────────────────────────────────────────────────

export async function sendWebhook(
  content?: string,
  embeds?: DiscordEmbed[],
): Promise<void> {
  if (!webhookUrl) {
    logger.warn('discord: sendWebhook called but no webhook URL configured');
    return;
  }

  const payload: WebhookPayload = {
    username: BOT_USERNAME,
  };

  if (content) payload.content = content;
  if (embeds && embeds.length > 0) payload.embeds = embeds;

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    // Discord returns 204 No Content on success; nothing to parse
    logger.debug('discord: webhook delivered', {
      status: res.status,
      embeds: embeds?.length ?? 0,
    });
  } catch (err) {
    logger.error('discord: webhook delivery failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Simple text message ───────────────────────────────────────────────────────

export async function sendMessage(content: string): Promise<void> {
  await sendWebhook(content);
}

// ── Alert delivery ────────────────────────────────────────────────────────────

/**
 * Build a rich Discord embed from an Alert.
 */
function buildAlertEmbed(alert: Alert): DiscordEmbed {
  const { change } = alert;
  const { item }   = change;

  const fields: DiscordEmbedField[] = [
    {
      name:   '📡 Source',
      value:  `${item.source} (${item.category})`,
      inline: true,
    },
    {
      name:   '⚡ Severity',
      value:  `${severityEmoji(item.severity)} ${item.severity.toUpperCase()}`,
      inline: true,
    },
    {
      name:   '💡 Reason',
      value:  truncate(change.reason, 200),
      inline: false,
    },
  ];

  if (item.location) {
    fields.push({
      name:   '📍 Location',
      value:  `${item.location.name}${item.location.country ? ', ' + item.location.country : ''}`,
      inline: true,
    });
  }

  if (item.url) {
    fields.push({
      name:   '🔗 Link',
      value:  item.url,
      inline: false,
    });
  }

  if (item.tags.length > 0) {
    fields.push({
      name:   '🏷️ Tags',
      value:  item.tags.slice(0, 8).join(', '),
      inline: false,
    });
  }

  return {
    title:       truncate(item.title, 256),
    description: truncate(item.description, 500),
    color:       TIER_COLORS[alert.tier],
    fields,
    footer:      { text: `${tierBadge(alert.tier)} • ID: ${alert.id.slice(0, 8)}` },
    timestamp:   item.timestamp.toISOString(),
  };
}

export async function sendAlert(alert: Alert): Promise<void> {
  if (!webhookUrl) return;

  const embed   = buildAlertEmbed(alert);
  const content = alert.tier === 'FLASH' ? '🚨 **FLASH ALERT**' : undefined;

  await sendWebhook(content, [embed]);
}

// ── Sweep notification ────────────────────────────────────────────────────────

export async function sendSweepSummary(result: SweepResult): Promise<void> {
  if (!webhookUrl) return;

  const durationSec = Math.round(
    (result.completedAt.getTime() - result.startedAt.getTime()) / 1000,
  );

  const embed: DiscordEmbed = {
    title:       '✅ Sweep Complete',
    description: formatSweepSummary(result),
    color:       0x2ECC71,
    fields: [
      { name: '📦 Items',   value: String(result.items.length),                     inline: true },
      { name: '📡 Sources', value: `${result.sourcesSucceeded}/${result.sourcesQueried}`, inline: true },
      { name: '⏱ Duration', value: `${durationSec}s`,                              inline: true },
    ],
    timestamp: result.completedAt.toISOString(),
    footer:    { text: `Sweep ID: ${result.sweepId.slice(0, 8)}` },
  };

  await sendWebhook(undefined, [embed]);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function startDiscord(): Promise<void> {
  const url = config.DISCORD_WEBHOOK_URL;

  if (!url && !config.DISCORD_BOT_TOKEN) {
    logger.info('discord: neither DISCORD_WEBHOOK_URL nor DISCORD_BOT_TOKEN set — Discord disabled');
    return;
  }

  if (!url) {
    logger.info('discord: DISCORD_BOT_TOKEN set but no DISCORD_WEBHOOK_URL — full bot mode not yet implemented; Discord disabled');
    return;
  }

  // Validate the webhook URL looks plausible
  if (!url.startsWith('https://discord.com/api/webhooks/') && !url.startsWith('https://discordapp.com/api/webhooks/')) {
    logger.warn('discord: DISCORD_WEBHOOK_URL does not look like a valid Discord webhook URL', { url });
    // Still attempt to use it — user may know what they're doing
  }

  webhookUrl = url;
  logger.info('discord: webhook mode initialized', {
    urlPreview: url.slice(0, 50) + (url.length > 50 ? '…' : ''),
  });
}

export function stopDiscord(): void {
  webhookUrl = null;
  logger.info('discord: stopped');
}

// ── Re-export for convenience ─────────────────────────────────────────────────

export { formatAlert };
