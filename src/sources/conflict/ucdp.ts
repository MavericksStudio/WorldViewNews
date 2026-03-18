/**
 * UCDP (Uppsala Conflict Data Program) — Georeferenced Event Dataset
 * Real-time armed conflict events from Uppsala University.
 * No API key required.
 * API: https://ucdpapi.pcr.uu.se/api/gedevents/24.1
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const API_URL = 'https://ucdpapi.pcr.uu.se/api/gedevents/24.1?pagesize=100&page=0';

interface UcdpEvent {
  id: string | number;
  date_start: string;
  date_end?: string;
  year: number;
  country: string;
  region?: string;
  where_description?: string;
  latitude: number | null;
  longitude: number | null;
  best: number;       // best estimate of deaths
  low?: number;
  high?: number;
  type_of_violence: number; // 1=state-based, 2=non-state, 3=one-sided
  conflict_name?: string;
  dyad_name?: string;
  source_article?: string;
  source_headline?: string;
  source_original?: string;
}

interface UcdpResponse {
  Result: UcdpEvent[];
  TotalCount?: number;
}

const VIOLENCE_TYPES: Record<number, string> = {
  1: 'State-based conflict',
  2: 'Non-state conflict',
  3: 'One-sided violence',
};

function deathsToSeverity(deaths: number): Severity {
  if (deaths >= 25) return 'critical';
  if (deaths >= 10) return 'high';
  if (deaths >= 1)  return 'medium';
  return 'low';
}

const source: DataSource = {
  id: 'ucdp-conflict',
  name: 'UCDP Georeferenced Conflict Events',
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
      throw new Error(`UCDP returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as UcdpResponse;
    const events = data.Result ?? [];
    const items: IntelligenceItem[] = [];

    for (const evt of events) {
      const deaths = evt.best ?? 0;
      const violenceLabel = VIOLENCE_TYPES[evt.type_of_violence] ?? 'Armed violence';
      const location = evt.where_description ?? evt.country;

      const title =
        `[${violenceLabel}] ${evt.dyad_name ?? evt.conflict_name ?? location}, ${evt.country}` +
        (deaths > 0 ? ` — ${deaths} deaths` : '');

      const description =
        `${violenceLabel} in ${location}, ${evt.country}. ` +
        (evt.dyad_name ? `Parties: ${evt.dyad_name}. ` : '') +
        `Deaths: best estimate ${deaths}` +
        (evt.low !== undefined ? `, range ${evt.low}–${evt.high ?? deaths}` : '') +
        '. ' +
        (evt.source_headline ? evt.source_headline.slice(0, 250) : '');

      const lat  = evt.latitude  !== null ? evt.latitude  : NaN;
      const lon  = evt.longitude !== null ? evt.longitude : NaN;

      items.push({
        id: createId('ucdp', String(evt.id)),
        source: 'ucdp-conflict',
        category: 'conflict',
        title,
        description,
        timestamp: new Date(evt.date_start),
        location: !isNaN(lat) && !isNaN(lon)
          ? { lat, lon, name: location, country: evt.country }
          : undefined,
        severity: deathsToSeverity(deaths),
        url: 'https://ucdp.uu.se/',
        tags: [
          'conflict',
          'ucdp',
          violenceLabel.toLowerCase().replace(/\s+/g, '-'),
          evt.country.toLowerCase().replace(/\s+/g, '-'),
        ],
        raw: evt,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
