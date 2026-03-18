/**
 * Signal-based trade ideas generator — uses LLM to convert intelligence signals
 * into market analysis suggestions.
 *
 * DISCLAIMER: This is AI-generated analysis for informational purposes only.
 * It is NOT financial advice. Do not make investment decisions based solely on
 * this output. Always consult a qualified financial advisor.
 */

import type { IntelligenceItem } from '../types.js';
import { llmRegistry } from '../llm/registry.js';
import { logger } from '../logger.js';

export interface TradeIdea {
  signal: string;
  asset: string;
  direction: 'long' | 'short' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  timeframe: string;
}

/** Categories most relevant to market analysis. */
const MARKET_RELEVANT_CATEGORIES = new Set([
  'market',
  'economic',
  'conflict',
  'environment',
  'maritime',
  'aviation',
]);

function formatItemForTradePrompt(item: IntelligenceItem): string {
  const loc = item.location
    ? ` [${item.location.name}${item.location.country ? ', ' + item.location.country : ''}]`
    : '';
  return `- [${item.category.toUpperCase()}][${item.severity}]${loc} ${item.title}`;
}

/**
 * Generate trade ideas from intelligence signals using an available LLM.
 * Returns an empty array if no LLM is available or the response cannot be parsed.
 */
export async function generateTradeIdeas(items: IntelligenceItem[]): Promise<TradeIdea[]> {
  if (!llmRegistry.isAnyAvailable()) return [];

  // Filter to market-relevant items
  const relevant = items
    .filter(
      (i) =>
        MARKET_RELEVANT_CATEGORIES.has(i.category) ||
        i.tags.some((t) =>
          ['oil', 'gas', 'gold', 'commodities', 'trade', 'sanctions', 'supply-chain'].includes(t),
        ),
    )
    .slice(0, 30);

  if (relevant.length === 0) return [];

  const itemLines = relevant.map(formatItemForTradePrompt).join('\n');

  const prompt =
    `Based on the following intelligence signals, generate up to 5 trade ideas.\n` +
    `For each idea, provide a JSON object with these fields:\n` +
    `  - signal: the key intelligence signal driving this idea\n` +
    `  - asset: the specific asset (e.g., "Brent Crude Oil", "USD/JPY", "Gold", "Defense ETF (ITA)")\n` +
    `  - direction: "long", "short", or "neutral"\n` +
    `  - confidence: "low", "medium", or "high"\n` +
    `  - reasoning: 1-2 sentence explanation\n` +
    `  - timeframe: e.g., "1-3 days", "1-2 weeks", "1 month"\n\n` +
    `Return ONLY a valid JSON array of trade idea objects, nothing else.\n\n` +
    `Intelligence signals:\n${itemLines}\n\n` +
    `IMPORTANT DISCLAIMER: This is AI-generated analysis for informational purposes only and is NOT financial advice.`;

  try {
    const raw = await llmRegistry.complete(prompt, {
      maxTokens: 1024,
      systemPrompt:
        'You are a quantitative analyst generating trade ideas from geopolitical and macroeconomic intelligence signals. Always respond with valid JSON only.',
    });

    // Extract JSON array from the response (model may include extra text)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('llm: trade ideas response contained no JSON array', { raw: raw.slice(0, 200) });
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];

    const ideas: TradeIdea[] = [];
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'signal' in item &&
        'asset' in item &&
        'direction' in item &&
        'confidence' in item &&
        'reasoning' in item &&
        'timeframe' in item
      ) {
        const idea = item as Record<string, unknown>;
        const direction = idea['direction'];
        const confidence = idea['confidence'];

        if (
          (direction === 'long' || direction === 'short' || direction === 'neutral') &&
          (confidence === 'low' || confidence === 'medium' || confidence === 'high')
        ) {
          ideas.push({
            signal: String(idea['signal']),
            asset: String(idea['asset']),
            direction,
            confidence,
            reasoning: String(idea['reasoning']),
            timeframe: String(idea['timeframe']),
          });
        }
      }
    }

    return ideas;
  } catch (err) {
    logger.warn('llm: trade ideas generation failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
