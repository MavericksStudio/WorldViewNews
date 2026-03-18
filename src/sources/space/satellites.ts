/**
 * CelesTrak — recently launched satellites (last 30 days)
 * Endpoint: https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=json
 *
 * Returns GP (General Perturbations) orbital element sets for objects
 * catalogued in the last 30 days. No API key required.
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const FEED_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=json';

/** Orbital element set as returned by CelesTrak GP JSON */
interface GpElement {
  OBJECT_NAME: string;
  OBJECT_ID: string;        // COSPAR ID e.g. "2024-001A"
  NORAD_CAT_ID: number;
  OBJECT_TYPE: string;      // "PAYLOAD", "ROCKET BODY", "DEBRIS", "UNKNOWN"
  CLASSIFICATION_TYPE: string; // "U" = unclassified, "C" = classified
  EPOCH: string;            // ISO-8601 epoch of elements
  MEAN_MOTION: number;      // revolutions per day
  ECCENTRICITY: number;
  INCLINATION: number;      // degrees
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

/** Approximate orbital altitude from mean motion (rev/day) */
function meanMotionToAltitudeKm(mm: number): number {
  // Kepler: T = 86400/mm seconds → a = (mu * (T/2pi)^2)^(1/3)
  const MU = 398600.4418; // km^3/s^2
  const T = 86400 / mm;   // orbital period in seconds
  const a = Math.cbrt(MU * Math.pow(T / (2 * Math.PI), 2));
  return Math.round(a - 6371); // subtract Earth radius
}

/** Determine severity from object characteristics */
function objectSeverity(obj: GpElement): Severity {
  const name = obj.OBJECT_NAME.toUpperCase();
  const type = obj.OBJECT_TYPE?.toUpperCase() ?? '';

  // Classified objects or known military operators warrant 'low'
  if (obj.CLASSIFICATION_TYPE === 'C') return 'low';
  if (
    name.includes('USA-') ||
    name.includes('COSMOS') ||
    name.includes('NROL') ||
    name.includes('KH-') ||
    name.includes('ZUMA')
  ) {
    return 'low';
  }

  // Debris or rocket bodies: low
  if (type === 'ROCKET BODY' || type === 'DEBRIS') return 'low';

  return 'info';
}

/** Extract the launch year and sequence from COSPAR ID (e.g. "2024-001A") */
function parseCospar(cospar: string): { year: number; sequence: string } | null {
  const m = /^(\d{4})-(\d{3}[A-Z]*)$/.exec(cospar);
  if (!m) return null;
  return { year: parseInt(m[1], 10), sequence: m[2] };
}

const source: DataSource = {
  id: 'celestrak-recent-launches',
  name: 'CelesTrak Recent Satellite Launches',
  category: 'space',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`CelesTrak returned HTTP ${res.status}`);
    }

    // CelesTrak may return empty array [] if no objects in group
    const data = (await res.json()) as GpElement[];

    if (!Array.isArray(data)) {
      throw new Error('CelesTrak response was not a JSON array');
    }

    const items: IntelligenceItem[] = [];

    for (const obj of data) {
      const cospar = parseCospar(obj.OBJECT_ID ?? '');
      const altKm = meanMotionToAltitudeKm(obj.MEAN_MOTION);
      const epochDate = new Date(obj.EPOCH);

      const type = obj.OBJECT_TYPE ?? 'Unknown';
      const name = obj.OBJECT_NAME ?? `NORAD ${obj.NORAD_CAT_ID}`;

      const title = `[${type}] ${name} — NORAD ${obj.NORAD_CAT_ID}`;
      const description =
        `Newly catalogued object: ${name} (COSPAR ${obj.OBJECT_ID ?? 'N/A'}). ` +
        `Type: ${type}. ` +
        `Approx orbit: ${altKm > 0 ? altKm + ' km altitude' : 'suborbital/reentry'}, ` +
        `inclination ${obj.INCLINATION.toFixed(1)}°, ` +
        `period ${(1440 / obj.MEAN_MOTION).toFixed(1)} min. ` +
        (cospar ? `Launched ${cospar.year}.` : '');

      items.push({
        id: createId('celestrak', String(obj.NORAD_CAT_ID)),
        source: 'celestrak-recent-launches',
        category: 'space',
        title,
        description,
        timestamp: isNaN(epochDate.getTime()) ? new Date() : epochDate,
        severity: objectSeverity(obj),
        url: `https://celestrak.org/SATCAT/record.php?CATNR=${obj.NORAD_CAT_ID}`,
        tags: [
          'satellite',
          'space',
          'orbital',
          type.toLowerCase().replace(/\s+/g, '-'),
          ...(obj.CLASSIFICATION_TYPE === 'C' ? ['classified'] : []),
        ],
        raw: obj,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
