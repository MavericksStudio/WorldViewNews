/**
 * Finnhub — market news with sentiment.
 * Requires FINNHUB_API_KEY from https://finnhub.io/
 * API: https://finnhub.io/api/v1/news
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';
import { config } from '../../config.js';

interface FinnhubNewsItem {
  id:       number;
  category: string;
  datetime: number;  // Unix timestamp
  headline: string;
  summary:  string;
  source:   string;
  url:      string;
  image?:   string;
  related?: string;
  sentiment?:{ bearishPercent?: number; bullishPercent?: number };
}

function categoryToSeverity(category: string, sentiment: FinnhubNewsItem['sentiment']): Severity {
  if (category === 'forex' || category === 'merger') return 'medium';
  if (sentiment?.bearishPercent !== undefined && sentiment.bearishPercent > 0.7) return 'medium';
  return 'info';
}

const source: DataSource = {
  id: 'finnhub-market',
  name: 'Finnhub Market News',
  category: 'market',
  requiresKey: true,

  isAvailable() {
    return Boolean(config.FINNHUB_API_KEY);
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const token = config.FINNHUB_API_KEY!;
    const url   = `https://finnhub.io/api/v1/news?category=general&token=${token}`;

    const res = await fetch(url, {
      signal:  AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Finnhub returned HTTP ${res.status}`);
    }

    const articles = (await res.json()) as FinnhubNewsItem[];
    if (!Array.isArray(articles)) {
      throw new Error('Finnhub response was not an array');
    }

    const items: IntelligenceItem[] = [];

    for (const art of articles) {
      if (!art.headline || !art.url) continue;

      const severity = categoryToSeverity(art.category, art.sentiment);
      const timestamp = art.datetime ? new Date(art.datetime * 1000) : new Date();

      items.push({
        id: createId('finnhub', String(art.id || art.url)),
        source: 'finnhub-market',
        category: 'market',
        title: art.headline,
        description:
          (art.summary ? art.summary.slice(0, 300) : art.headline) +
          (art.source ? ` (Source: ${art.source})` : ''),
        timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
        severity,
        url: art.url,
        tags: [
          'market',
          'finnhub',
          'news',
          art.category,
          ...(art.related ? [art.related.toLowerCase().replace(/[^a-z0-9]/g, '-')] : []),
        ],
        raw: art,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
