/**
 * GDELT Global Event Database — conflict/attack/protest news articles.
 * Uses GDELT DOC 2.0 API (no API key required).
 * API: https://api.gdeltproject.org/api/v2/doc/doc
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const API_URL =
  'https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20attack%20OR%20protest&mode=ArtList&maxrecords=50&format=json';

interface GdeltArticle {
  url:       string;
  title:     string;
  seendate:  string;
  socialimage?: string;
  domain?:   string;
  language?: string;
  sourcecountry?: string;
  /** Tone: negative=conflict/tension. Range roughly -30 to +30. */
  tone?: string | number;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

function toneToSeverity(tone: number): Severity {
  // More negative tone = more conflict/tension
  if (tone <= -15) return 'high';
  if (tone <= -5)  return 'medium';
  return 'info';
}

const source: DataSource = {
  id: 'gdelt-conflict',
  name: 'GDELT Global Events (Conflict/Protest)',
  category: 'conflict',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const res = await fetch(API_URL, {
      signal:  AbortSignal.timeout(20_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`GDELT returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as GdeltResponse;
    const articles = data.articles ?? [];
    const items: IntelligenceItem[] = [];

    for (const art of articles) {
      if (!art.title || !art.url) continue;

      const toneRaw = typeof art.tone === 'string' ? parseFloat(art.tone) : (art.tone ?? 0);
      const tone    = isNaN(toneRaw) ? 0 : toneRaw;
      const severity = toneToSeverity(tone);

      const timestamp = art.seendate
        ? new Date(
            art.seendate.replace(
              /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
              '$1-$2-$3T$4:$5:$6Z',
            ),
          )
        : new Date();

      items.push({
        id: createId('gdelt', art.url),
        source: 'gdelt-conflict',
        category: 'conflict',
        title: art.title,
        description:
          `${art.title}. Source: ${art.domain ?? 'unknown'}. ` +
          (art.sourcecountry ? `Country: ${art.sourcecountry}. ` : '') +
          `Sentiment tone: ${tone.toFixed(1)}.`,
        timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
        severity,
        url: art.url,
        tags: [
          'conflict',
          'gdelt',
          ...(art.sourcecountry ? [art.sourcecountry.toLowerCase().replace(/\s+/g, '-')] : []),
          ...(art.language ? [art.language.toLowerCase()] : []),
        ],
        raw: art,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
