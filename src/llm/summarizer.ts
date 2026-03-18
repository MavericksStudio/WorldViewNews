/**
 * LLM-powered intelligence summarization.
 */

import type { IntelligenceItem, SweepResult } from '../types.js';
import { llmRegistry } from './registry.js';
import { logger } from '../logger.js';

function formatItem(item: IntelligenceItem): string {
  const loc = item.location ? ` [${item.location.name}${item.location.country ? ', ' + item.location.country : ''}]` : '';
  return `- [${item.category.toUpperCase()}][${item.severity}]${loc} ${item.title}: ${item.description}`;
}

/**
 * Summarize the results of a single sweep with situational awareness context.
 * Returns null if no LLM is available.
 */
export async function summarizeSweep(result: SweepResult): Promise<string | null> {
  if (!llmRegistry.isAnyAvailable()) return null;

  const items = result.items.slice(0, 50); // cap to avoid token overflow
  if (items.length === 0) return null;

  const itemLines = items.map(formatItem).join('\n');

  const prompt =
    `Analyze these intelligence items and provide a brief situational awareness summary (3-5 sentences).\n` +
    `Focus on the most significant events, geographic hotspots, and any concerning patterns.\n` +
    `Items from sweep ${result.sweepId} (${result.items.length} total, ${result.sourcesSucceeded}/${result.sourcesQueried} sources succeeded):\n\n` +
    itemLines;

  try {
    const summary = await llmRegistry.complete(prompt, {
      maxTokens: 512,
      systemPrompt: 'You are a professional intelligence analyst providing concise situational awareness briefings.',
    });
    return summary;
  } catch (err) {
    logger.warn('llm: sweep summarization failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Generate a daily intelligence digest from a collection of items.
 * Returns null if no LLM is available.
 */
export async function generateDailyDigest(items: IntelligenceItem[]): Promise<string | null> {
  if (!llmRegistry.isAnyAvailable()) return null;
  if (items.length === 0) return null;

  const topItems = items
    .sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
      return (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
    })
    .slice(0, 40);

  const itemLines = topItems.map(formatItem).join('\n');

  const prompt =
    `Create a daily intelligence digest from these items. Format it as:\n` +
    `1. EXECUTIVE SUMMARY (2-3 sentences)\n` +
    `2. KEY DEVELOPMENTS (bullet points by category)\n` +
    `3. AREAS TO WATCH\n\n` +
    `Intelligence items (${items.length} total, showing top ${topItems.length} by severity):\n\n` +
    itemLines;

  try {
    const digest = await llmRegistry.complete(prompt, {
      maxTokens: 1024,
      systemPrompt: 'You are a senior intelligence analyst preparing a daily briefing for senior leadership.',
    });
    return digest;
  } catch (err) {
    logger.warn('llm: daily digest generation failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Generate a regional briefing focused on a specific geographic region.
 * Returns null if no LLM is available.
 */
export async function generateRegionBriefing(
  items: IntelligenceItem[],
  region: string,
): Promise<string | null> {
  if (!llmRegistry.isAnyAvailable()) return null;
  if (items.length === 0) return null;

  const itemLines = items.slice(0, 40).map(formatItem).join('\n');

  const prompt =
    `Focus on items related to ${region} and provide a regional intelligence briefing.\n` +
    `Include security situation, economic indicators, environmental hazards, and any notable events.\n` +
    `Format as a structured briefing with clear sections.\n\n` +
    `Available intelligence items (${items.length} total):\n\n` +
    itemLines;

  try {
    const briefing = await llmRegistry.complete(prompt, {
      maxTokens: 768,
      systemPrompt: `You are a regional intelligence analyst specializing in ${region}. Provide focused, actionable briefings.`,
    });
    return briefing;
  } catch (err) {
    logger.warn('llm: region briefing generation failed', {
      region,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
