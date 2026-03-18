/**
 * RSS/Atom feed aggregator.
 * Fetches all feeds from the catalog, parses XML without external libraries,
 * and returns the most recent items geo-tagged where possible.
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';
import { feeds } from '../../geo/feeds.js';
import { geoTag } from '../../geo/locations.js';
import { logger } from '../../logger.js';

const MAX_ITEMS_PER_FEED = 10;
const MAX_TOTAL_ITEMS = 100;
const FETCH_TIMEOUT_MS = 10_000;

// ─── Minimal XML helpers ──────────────────────────────────────────────────────

/** Extract the text content of the first occurrence of <tag>...</tag> */
function extractTag(xml: string, tag: string): string {
  // Match CDATA wrapped values and plain text, skipping attributes
  const pattern = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i',
  );
  const match = pattern.exec(xml);
  if (!match) return '';
  // CDATA is group 1, plain text is group 2
  return (match[1] ?? match[2] ?? '').trim();
}

/** Strip HTML tags and decode basic HTML entities */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split XML into individual <item> or <entry> blocks */
function splitItems(xml: string): string[] {
  // RSS 2.0 uses <item>, Atom uses <entry>
  const rssItems = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return rssItems.length > 0 ? rssItems : atomEntries;
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
}

function parseItems(xml: string): RssItem[] {
  const blocks = splitItems(xml);
  const results: RssItem[] = [];

  for (const block of blocks) {
    const title = cleanText(extractTag(block, 'title'));
    if (!title) continue;

    // Try <link> as text content first, then href attribute (Atom)
    let link = extractTag(block, 'link').trim();
    if (!link) {
      const hrefMatch = /<link[^>]+href="([^"]+)"/i.exec(block);
      link = hrefMatch ? hrefMatch[1] : '';
    }

    const description = cleanText(
      extractTag(block, 'description') ||
        extractTag(block, 'summary') ||
        extractTag(block, 'content'),
    );

    // Parse date: try pubDate (RSS) then updated/published (Atom)
    const rawDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated');
    const pubDate = rawDate ? new Date(rawDate) : new Date();

    results.push({ title, link, description, pubDate: isNaN(pubDate.getTime()) ? new Date() : pubDate });
  }

  return results;
}

// ─── Source implementation ────────────────────────────────────────────────────

const source: DataSource = {
  id: 'rss-aggregator',
  name: 'RSS/Atom Feed Aggregator',
  category: 'news',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const allItems: IntelligenceItem[] = [];

    await Promise.allSettled(
      feeds.map(async (feed) => {
        try {
          const res = await fetch(feed.url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
              'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*',
              'User-Agent': 'WorldViewNews/0.1 (OSINT aggregator; +https://github.com/maverickstudios/worldviewnews)',
            },
          });

          if (!res.ok) {
            logger.warn(`[rss] ${feed.name}: HTTP ${res.status}`);
            return;
          }

          const xml = await res.text();
          const parsed = parseItems(xml).slice(0, MAX_ITEMS_PER_FEED);

          for (const item of parsed) {
            const searchText = `${item.title} ${item.description}`;
            const location = geoTag(searchText);

            allItems.push({
              id: createId('rss', item.link || `${feed.name}-${item.title}`),
              source: 'rss-aggregator',
              category: 'news',
              title: item.title,
              description: item.description || item.title,
              timestamp: item.pubDate,
              location,
              severity: 'info',
              url: item.link || undefined,
              tags: ['rss', feed.category, feed.language, ...(feed.region ? [feed.region] : [])],
              raw: { feed: feed.name, feedUrl: feed.url },
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`[rss] ${feed.name}: ${msg}`);
        }
      }),
    );

    // Sort by timestamp descending, return at most MAX_TOTAL_ITEMS
    allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return allItems.slice(0, MAX_TOTAL_ITEMS);
  },
};

registry.register(source);
export default source;
