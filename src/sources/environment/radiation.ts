/**
 * Radiation Monitoring — public radiation sensor network.
 * Uses the Safecast API (https://api.safecast.org/) which provides
 * community-collected radiation measurements globally (no key required).
 *
 * Only flags readings above background levels as notable.
 * Background: ~0.10–0.20 µSv/h; alert above 0.5 µSv/h.
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const API_URL = 'https://api.safecast.org/measurements.json?order=DESC&sort=captured_at&limit=100';

interface SafecastMeasurement {
  id:          number;
  value:       number;    // nSv/h
  unit:        string;
  latitude:    string | number;
  longitude:   string | number;
  location_name?: string;
  captured_at: string;
  device_id?:  number;
}

// Safecast uses nSv/h; convert to µSv/h for display
const NSVY_TO_USVY = 0.001;

// Alert thresholds in µSv/h
const THRESHOLD_MEDIUM   = 0.5;   // slightly elevated
const THRESHOLD_HIGH     = 1.0;   // clearly elevated
const THRESHOLD_CRITICAL = 5.0;   // evacuation zone level

function usveToSeverity(usvh: number): Severity {
  if (usvh >= THRESHOLD_CRITICAL) return 'critical';
  if (usvh >= THRESHOLD_HIGH)     return 'high';
  if (usvh >= THRESHOLD_MEDIUM)   return 'medium';
  return 'info';
}

const source: DataSource = {
  id: 'radiation-safecast',
  name: 'Safecast Radiation Monitoring',
  category: 'environment',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const res = await fetch(API_URL, {
      signal:  AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Safecast returned HTTP ${res.status}`);
    }

    const measurements = (await res.json()) as SafecastMeasurement[];
    if (!Array.isArray(measurements)) {
      throw new Error('Safecast response was not an array');
    }

    const items: IntelligenceItem[] = [];

    for (const m of measurements) {
      // Convert value — Safecast units vary; most measurements are CPM or nSv/h.
      // If unit is 'cpm', approximate 1 CPM ≈ 0.0057 µSv/h for typical background tubes.
      let usvh: number;
      const unitLower = (m.unit ?? '').toLowerCase();
      if (unitLower === 'cpm') {
        usvh = m.value * 0.0057;
      } else if (unitLower.includes('nsv') || unitLower === 'nsv/h') {
        usvh = m.value * NSVY_TO_USVY;
      } else {
        // Assume µSv/h already
        usvh = m.value;
      }

      // Only report elevated readings
      if (usvh < THRESHOLD_MEDIUM) continue;

      const severity = usveToSeverity(usvh);
      const lat = parseFloat(String(m.latitude));
      const lon = parseFloat(String(m.longitude));
      const locName = m.location_name?.trim() || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

      const title = `Elevated radiation: ${usvh.toFixed(3)} µSv/h at ${locName}`;
      const description =
        `Radiation measurement of ${usvh.toFixed(3)} µSv/h (${m.value} ${m.unit}) ` +
        `detected at ${locName}. ` +
        `Measured: ${m.captured_at}. ` +
        (usvh >= THRESHOLD_CRITICAL
          ? 'CRITICAL: Significantly above safe background levels.'
          : usvh >= THRESHOLD_HIGH
          ? 'Above typical background radiation levels.'
          : 'Mildly elevated above typical background.');

      items.push({
        id: createId('safecast', String(m.id)),
        source: 'radiation-safecast',
        category: 'environment',
        title,
        description,
        timestamp: new Date(m.captured_at),
        location: !isNaN(lat) && !isNaN(lon)
          ? { lat, lon, name: locName }
          : undefined,
        severity,
        url: `https://safecast.org/tilemap/`,
        tags: [
          'radiation',
          'nuclear',
          'environment',
          'safecast',
          severity,
        ],
        raw: { ...m, computed_usvh: usvh },
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
