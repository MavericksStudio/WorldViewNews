/**
 * USGS Earthquake Hazards Program — real-time feed
 * Endpoint: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson
 * Returns M2.5+ earthquakes from the last hour. No API key required.
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson';

interface UsgsFeature {
  type: 'Feature';
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
    updated: number | null;
    url: string | null;
    detail: string | null;
    felt: number | null;
    alert: string | null;
    status: string;
    tsunami: number;
    sig: number;
    title: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
  id: string;
}

interface UsgsGeoJson {
  type: 'FeatureCollection';
  features: UsgsFeature[];
}

function magnitudeToSeverity(mag: number): Severity {
  if (mag >= 6) return 'critical';
  if (mag >= 5) return 'high';
  if (mag >= 4) return 'medium';
  return 'low';
}

const source: DataSource = {
  id: 'usgs-earthquakes',
  name: 'USGS Earthquakes (M2.5+)',
  category: 'environment',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`USGS feed returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as UsgsGeoJson;
    const items: IntelligenceItem[] = [];

    for (const feature of data.features) {
      const { properties: p, geometry, id } = feature;
      const mag = p.mag ?? 0;
      const [lon, lat, depth] = geometry.coordinates;
      const place = p.place ?? 'Unknown location';
      const timestamp = p.time ? new Date(p.time) : new Date();

      const title = `M${mag.toFixed(1)} earthquake — ${place}`;
      const description =
        `Magnitude ${mag.toFixed(1)} earthquake detected ${place}. ` +
        `Depth: ${depth.toFixed(1)} km. ` +
        (p.tsunami ? 'Tsunami watch may be in effect.' : '');

      items.push({
        id: createId('usgs', id),
        source: 'usgs-earthquakes',
        category: 'environment',
        title,
        description,
        timestamp,
        location: {
          lat,
          lon,
          name: place,
        },
        severity: magnitudeToSeverity(mag),
        url: p.url ?? undefined,
        tags: ['earthquake', 'seismic', 'usgs', ...(p.tsunami ? ['tsunami'] : [])],
        raw: feature,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
