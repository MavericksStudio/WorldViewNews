/**
 * ACLED (Armed Conflict Location & Event Data Project)
 * Real-time armed conflict event data.
 * Requires ACLED_API_KEY and ACLED_EMAIL (register at https://acleddata.com/).
 * API: https://api.acleddata.com/acled/read
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';
import { config } from '../../config.js';

interface AcledEvent {
  data_id: string | number;
  event_date: string;
  event_type: string;
  sub_event_type?: string;
  actor1?: string;
  country: string;
  location: string;
  latitude: string | number;
  longitude: string | number;
  fatalities: string | number;
  notes?: string;
  source?: string;
}

interface AcledResponse {
  data: AcledEvent[];
  count: number;
}

function fatalitiestoSeverity(fatalities: number): Severity {
  if (fatalities >= 50) return 'critical';
  if (fatalities >= 10) return 'high';
  if (fatalities >= 1)  return 'medium';
  return 'low';
}

const source: DataSource = {
  id: 'acled-conflict',
  name: 'ACLED Armed Conflict Events',
  category: 'conflict',
  requiresKey: true,

  isAvailable() {
    return Boolean(config.ACLED_API_KEY && config.ACLED_EMAIL);
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const apiKey  = config.ACLED_API_KEY!;
    const email   = config.ACLED_EMAIL!;

    const today     = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const url = new URL('https://api.acleddata.com/acled/read');
    url.searchParams.set('key',               apiKey);
    url.searchParams.set('email',             email);
    url.searchParams.set('limit',             '100');
    url.searchParams.set('event_date',        fmt(today));
    url.searchParams.set('event_date_where',  `>=${fmt(yesterday)}`);
    url.searchParams.set('fields',            'data_id|event_date|event_type|sub_event_type|actor1|country|location|latitude|longitude|fatalities|notes|source');

    const res = await fetch(url.toString(), {
      signal:  AbortSignal.timeout(20_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`ACLED returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as AcledResponse;
    const events = data.data ?? [];
    const items: IntelligenceItem[] = [];

    for (const evt of events) {
      const fatalities = Number(evt.fatalities) || 0;
      const lat = parseFloat(String(evt.latitude));
      const lon = parseFloat(String(evt.longitude));
      const title = `[${evt.event_type}] ${evt.location}, ${evt.country}${fatalities > 0 ? ` — ${fatalities} fatalities` : ''}`;
      const description =
        `${evt.event_type}${evt.sub_event_type ? ` (${evt.sub_event_type})` : ''} in ${evt.location}, ${evt.country}. ` +
        (evt.actor1 ? `Actor: ${evt.actor1}. ` : '') +
        `Fatalities: ${fatalities}. ` +
        (evt.notes ? evt.notes.slice(0, 300) : '');

      items.push({
        id: createId('acled', String(evt.data_id)),
        source: 'acled-conflict',
        category: 'conflict',
        title,
        description,
        timestamp: new Date(evt.event_date),
        location: !isNaN(lat) && !isNaN(lon)
          ? { lat, lon, name: evt.location, country: evt.country }
          : undefined,
        severity: fatalitiestoSeverity(fatalities),
        url: 'https://acleddata.com/data/',
        tags: [
          'conflict',
          'acled',
          evt.event_type.toLowerCase().replace(/\s+/g, '-'),
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
