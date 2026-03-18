/**
 * Country Intelligence Index (CII) — composite risk score per country.
 * Aggregates 8 signals into a 0-100 risk score (100 = highest risk).
 */

import type { IntelligenceItem } from '../types.js';

export interface CountryScore {
  country: string;
  score: number;       // 0-100 (100 = highest risk)
  signals: Record<string, number>;
  trend: 'rising' | 'falling' | 'stable';
}

/** Signal weights must sum to 1. */
const SIGNAL_WEIGHTS: Record<string, number> = {
  conflict:        0.25,
  naturalDisaster: 0.20,
  economic:        0.10,
  political:       0.10,
  environmental:   0.10,
  aviationMaritime: 0.05,
  marketVolatility: 0.10,
  newsVolume:      0.10,
};

const SEVERITY_SCORES: Record<string, number> = {
  critical: 1.0,
  high:     0.75,
  medium:   0.5,
  low:      0.25,
  info:     0.1,
};

interface CountryAccumulator {
  conflict: number[];
  naturalDisaster: number[];
  economic: number[];
  political: number[];
  environmental: number[];
  aviationMaritime: number[];
  marketVolatility: number[];
  newsVolume: number;
  itemCount: number;
}

function categorizeItem(item: IntelligenceItem): keyof CountryAccumulator | null {
  switch (item.category) {
    case 'conflict':
      return 'conflict';
    case 'environment':
      if (item.tags.some((t) => ['earthquake', 'flood', 'hurricane', 'wildfire', 'tsunami', 'volcano'].includes(t))) {
        return 'naturalDisaster';
      }
      return 'environmental';
    case 'weather':
      return 'naturalDisaster';
    case 'economic':
      return item.tags.some((t) => ['gdp', 'inflation', 'unemployment', 'debt'].includes(t))
        ? 'economic'
        : 'political';
    case 'market':
      return 'marketVolatility';
    case 'aviation':
    case 'maritime':
      return 'aviationMaritime';
    case 'news':
      return 'political';
    case 'space':
      return null; // not country-relevant by default
    default:
      return null;
  }
}

function extractCountry(item: IntelligenceItem): string | null {
  if (item.location?.country) return item.location.country;
  if (item.location?.name) {
    // Heuristic: if name looks like a country code or full name, use it
    const name = item.location.name;
    if (name.length === 2 && /^[A-Z]{2}$/.test(name)) return name;
  }
  return null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compute the Country Intelligence Index for all countries represented in the items.
 */
export function calculateCII(items: IntelligenceItem[]): CountryScore[] {
  const countryData: Map<string, CountryAccumulator> = new Map();

  for (const item of items) {
    const country = extractCountry(item);
    if (!country) continue;

    if (!countryData.has(country)) {
      countryData.set(country, {
        conflict: [],
        naturalDisaster: [],
        economic: [],
        political: [],
        environmental: [],
        aviationMaritime: [],
        marketVolatility: [],
        newsVolume: 0,
        itemCount: 0,
      });
    }

    const acc = countryData.get(country)!;
    acc.itemCount++;
    acc.newsVolume++;

    const signal = categorizeItem(item);
    if (signal === null || signal === 'newsVolume' || signal === 'itemCount') continue;

    const severityScore = SEVERITY_SCORES[item.severity] ?? 0.1;
    (acc[signal] as number[]).push(severityScore);
  }

  const scores: CountryScore[] = [];

  for (const [country, acc] of countryData) {
    // Normalize news volume: cap at 20 items = 1.0
    const normalizedNewsVolume = Math.min(acc.newsVolume / 20, 1.0);

    const signals: Record<string, number> = {
      conflict:        average(acc.conflict),
      naturalDisaster: average(acc.naturalDisaster),
      economic:        average(acc.economic),
      political:       average(acc.political),
      environmental:   average(acc.environmental),
      aviationMaritime: average(acc.aviationMaritime),
      marketVolatility: average(acc.marketVolatility),
      newsVolume:      normalizedNewsVolume,
    };

    // Weighted composite score
    let compositeScore = 0;
    for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS)) {
      compositeScore += (signals[signal] ?? 0) * weight;
    }

    // Scale to 0-100
    const scaledScore = Math.round(compositeScore * 100);

    scores.push({
      country,
      score: scaledScore,
      signals,
      trend: 'stable', // trend calculation requires historical data; stable as baseline
    });
  }

  // Sort by score descending (highest risk first)
  return scores.sort((a, b) => b.score - a.score);
}
