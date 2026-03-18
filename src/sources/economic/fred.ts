/**
 * Federal Reserve Economic Data (FRED) — key economic indicators.
 * Tracks: DGS10 (10Y Treasury), UNRATE (Unemployment Rate), CPIAUCSL (CPI).
 * Requires FRED_API_KEY from https://fred.stlouisfed.org/docs/api/fred/
 * API: https://api.stlouisfed.org/fred/series/observations
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';
import { config } from '../../config.js';

const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

interface FredSeries {
  id: string;
  name: string;
  unit: string;
  /** Threshold for rate-of-change alert (absolute delta per period) */
  alertThreshold: number;
}

const TRACKED_SERIES: FredSeries[] = [
  { id: 'DGS10',    name: '10-Year Treasury Yield',         unit: '%',      alertThreshold: 0.15 },
  { id: 'UNRATE',   name: 'Unemployment Rate',              unit: '%',      alertThreshold: 0.2  },
  { id: 'CPIAUCSL', name: 'Consumer Price Index (CPI-U)',   unit: 'index',  alertThreshold: 0.5  },
];

interface FredObservation {
  date:  string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

function changeToSeverity(pctChange: number, threshold: number): Severity {
  const abs = Math.abs(pctChange);
  if (abs >= threshold * 3) return 'high';
  if (abs >= threshold * 2) return 'medium';
  if (abs >= threshold)     return 'low';
  return 'info';
}

async function fetchSeries(
  seriesId: string,
  apiKey: string,
): Promise<FredObservation[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('series_id',   seriesId);
  url.searchParams.set('api_key',     apiKey);
  url.searchParams.set('file_type',   'json');
  url.searchParams.set('sort_order',  'desc');
  url.searchParams.set('limit',       '10');

  const res = await fetch(url.toString(), {
    signal:  AbortSignal.timeout(15_000),
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`FRED series ${seriesId} returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as FredResponse;
  return data.observations ?? [];
}

const source: DataSource = {
  id: 'fred-economic',
  name: 'FRED Economic Indicators (10Y / CPI / Unemployment)',
  category: 'economic',
  requiresKey: true,

  isAvailable() {
    return Boolean(config.FRED_API_KEY);
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const apiKey = config.FRED_API_KEY!;
    const items: IntelligenceItem[] = [];

    await Promise.allSettled(
      TRACKED_SERIES.map(async (series) => {
        try {
          const obs = await fetchSeries(series.id, apiKey);
          // Filter out "." placeholder values
          const valid = obs.filter((o) => o.value !== '.' && o.value.trim() !== '');
          if (valid.length < 2) return;

          const latest   = parseFloat(valid[0].value);
          const previous = parseFloat(valid[1].value);
          if (isNaN(latest) || isNaN(previous)) return;

          const delta     = latest - previous;
          const absDelta  = Math.abs(delta);
          const severity  = changeToSeverity(absDelta, series.alertThreshold);
          const direction = delta >= 0 ? 'up' : 'down';

          const title = `${series.name}: ${latest.toFixed(2)}${series.unit} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs prior)`;
          const description =
            `${series.name} (${series.id}) latest reading: ${latest.toFixed(2)} ${series.unit} as of ${valid[0].date}. ` +
            `Previous: ${previous.toFixed(2)} ${series.unit} (${valid[1].date}). ` +
            `Change: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${series.unit} (${direction}).`;

          items.push({
            id: createId('fred', `${series.id}-${valid[0].date}`),
            source: 'fred-economic',
            category: 'economic',
            title,
            description,
            timestamp: new Date(valid[0].date),
            severity,
            url: `https://fred.stlouisfed.org/series/${series.id}`,
            tags: [
              'economic',
              'fred',
              series.id.toLowerCase(),
              direction,
            ],
            raw: { series: series.id, observations: valid.slice(0, 5) },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[fred] ${series.id}: ${msg}`);
        }
      }),
    );

    return items;
  },
};

registry.register(source);
export default source;
