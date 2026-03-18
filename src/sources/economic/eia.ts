/**
 * EIA (US Energy Information Administration) — oil & gas spot prices.
 * Tracks WTI and Brent crude oil prices.
 * Requires EIA_API_KEY from https://www.eia.gov/opendata/
 * API: https://api.eia.gov/v2/petroleum/pri/spt/data/
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';
import { config } from '../../config.js';

const BASE_URL =
  'https://api.eia.gov/v2/petroleum/pri/spt/data/';

interface EiaSeries {
  seriesId:  string;
  name:      string;
  /** Alert threshold: absolute price change per period (USD) */
  alertUsd:  number;
}

const SERIES: EiaSeries[] = [
  { seriesId: 'RWTC', name: 'WTI Crude Oil (Cushing)',  alertUsd: 3  },
  { seriesId: 'RBRTE',name: 'Brent Crude Oil',           alertUsd: 3  },
];

interface EiaDataPoint {
  period:  string;
  value:   number | null;
  seriesId?:string;
}

interface EiaResponse {
  response?: {
    data?: EiaDataPoint[];
  };
}

function priceChangeToSeverity(change: number, threshold: number): Severity {
  const abs = Math.abs(change);
  if (abs >= threshold * 3) return 'high';
  if (abs >= threshold * 2) return 'medium';
  if (abs >= threshold)     return 'low';
  return 'info';
}

async function fetchEiaSeries(seriesId: string, apiKey: string): Promise<EiaDataPoint[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('api_key',              apiKey);
  url.searchParams.set('frequency',            'daily');
  url.searchParams.set('data[0]',              'value');
  url.searchParams.set('facets[series][]',     seriesId);
  url.searchParams.set('sort[0][column]',      'period');
  url.searchParams.set('sort[0][direction]',   'desc');
  url.searchParams.set('length',               '10');

  const res = await fetch(url.toString(), {
    signal:  AbortSignal.timeout(15_000),
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`EIA series ${seriesId} returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as EiaResponse;
  return data.response?.data ?? [];
}

const source: DataSource = {
  id: 'eia-energy',
  name: 'EIA Energy Prices (WTI / Brent Crude)',
  category: 'economic',
  requiresKey: true,

  isAvailable() {
    return Boolean(config.EIA_API_KEY);
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const apiKey = config.EIA_API_KEY!;
    const items: IntelligenceItem[] = [];

    await Promise.allSettled(
      SERIES.map(async (series) => {
        try {
          const data = await fetchEiaSeries(series.seriesId, apiKey);
          const valid = data.filter((d) => d.value !== null);
          if (valid.length < 2) return;

          const latest   = valid[0].value!;
          const previous = valid[1].value!;
          const change   = latest - previous;
          const severity = priceChangeToSeverity(change, series.alertUsd);
          const direction = change >= 0 ? 'up' : 'down';

          const title =
            `${series.name}: $${latest.toFixed(2)}/bbl (${change >= 0 ? '+' : ''}${change.toFixed(2)} USD)`;
          const description =
            `${series.name} spot price: $${latest.toFixed(2)} per barrel as of ${valid[0].period}. ` +
            `Previous: $${previous.toFixed(2)} (${valid[1].period}). ` +
            `Change: ${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${direction}).`;

          items.push({
            id: createId('eia', `${series.seriesId}-${valid[0].period}`),
            source: 'eia-energy',
            category: 'economic',
            title,
            description,
            timestamp: new Date(valid[0].period),
            severity,
            url: `https://www.eia.gov/petroleum/`,
            tags: [
              'economic',
              'energy',
              'eia',
              'oil',
              series.seriesId.toLowerCase(),
              direction,
            ],
            raw: { seriesId: series.seriesId, latest, previous, change },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[eia] ${series.seriesId}: ${msg}`);
        }
      }),
    );

    return items;
  },
};

registry.register(source);
export default source;
