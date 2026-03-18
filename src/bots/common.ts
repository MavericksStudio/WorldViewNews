/**
 * Shared formatting utilities for Telegram and Discord bot integrations.
 */

import { alertManager } from '../engine/alerts.js';
import { registry }     from '../sources/registry.js';
import { memory }       from '../storage/memory.js';
import type { Alert, AlertTier, IntelligenceItem, Severity, SweepResult } from '../types.js';

// ── Emoji helpers ─────────────────────────────────────────────────────────────

export function severityEmoji(severity: Severity): string {
  switch (severity) {
    case 'info':     return '🟢';
    case 'low':      return '🟡';
    case 'medium':   return '🟠';
    case 'high':     return '🔴';
    case 'critical': return '⚫';
  }
}

export function tierBadge(tier: AlertTier): string {
  switch (tier) {
    case 'FLASH':    return '🚨 FLASH';
    case 'PRIORITY': return '⚠️ PRIORITY';
    case 'ROUTINE':  return '📋 ROUTINE';
  }
}

// ── Text helpers ──────────────────────────────────────────────────────────────

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// ── Alert formatting ──────────────────────────────────────────────────────────

/**
 * Format an alert into a Markdown-compatible string suitable for Telegram
 * (MarkdownV2) or Discord (Discord Markdown).
 */
export function formatAlert(alert: Alert): string {
  const { change } = alert;
  const { item }   = change;

  const badge    = tierBadge(alert.tier);
  const sev      = severityEmoji(item.severity);
  const ts       = item.timestamp.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const location = item.location ? ` | 📍 ${item.location.name}` : '';
  const url      = item.url ? `\n🔗 ${item.url}` : '';

  return [
    `${badge} — ${sev} ${item.severity.toUpperCase()}`,
    ``,
    `*${truncate(item.title, 200)}*`,
    truncate(item.description, 400),
    ``,
    `📡 ${item.source} | 🗂 ${item.category}${location}`,
    `🕐 ${ts}`,
    `💡 ${change.reason}`,
    url,
  ]
    .filter((line) => line !== null)
    .join('\n')
    .trim();
}

// ── Sweep summary ─────────────────────────────────────────────────────────────

export function formatSweepSummary(result: SweepResult): string {
  const durationSec = Math.round(
    (result.completedAt.getTime() - result.startedAt.getTime()) / 1000,
  );
  const errorNote = result.errors.length > 0
    ? `\n⚠️ ${result.errors.length} source(s) failed`
    : '';

  return [
    `✅ *Sweep Complete*`,
    ``,
    `📦 ${result.items.length} items collected`,
    `📡 ${result.sourcesSucceeded}/${result.sourcesQueried} sources OK`,
    `⏱ ${durationSec}s elapsed`,
    `🆔 \`${result.sweepId.slice(0, 8)}\``,
    errorNote,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ── System status ─────────────────────────────────────────────────────────────

export function formatStatus(): string {
  const latest      = memory.getLatest();
  const allSources  = registry.getAll();
  const available   = registry.getAvailable();
  const stats       = alertManager.getStats();
  const totalItems  = memory.getAllItems().length;

  const lastSweep = latest
    ? latest.completedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : 'Never';

  const uptimeSec = Math.round(process.uptime());
  const uptimeStr = uptimeSec < 60
    ? `${uptimeSec}s`
    : uptimeSec < 3600
    ? `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`
    : `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

  return [
    `📊 *WorldViewNews Status*`,
    ``,
    `⏰ Uptime: ${uptimeStr}`,
    `📡 Sources: ${available.length}/${allSources.length} available`,
    `📦 Items in memory: ${totalItems}`,
    `🕐 Last sweep: ${lastSweep}`,
    ``,
    `*Alerts (all-time)*`,
    `🚨 FLASH: ${stats.flash}`,
    `⚠️ PRIORITY: ${stats.priority}`,
    `📋 ROUTINE: ${stats.routine}`,
    `   Total: ${stats.total}`,
  ].join('\n');
}

// ── Item list ─────────────────────────────────────────────────────────────────

export function formatItemList(items: IntelligenceItem[], limit: number): string {
  const slice = items.slice(0, limit);
  if (slice.length === 0) return '_No items found._';

  return slice
    .map((item, i) => {
      const sev = severityEmoji(item.severity);
      return `${i + 1}. ${sev} *${truncate(item.title, 100)}*\n   📡 ${item.source}`;
    })
    .join('\n');
}
