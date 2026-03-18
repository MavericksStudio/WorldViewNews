/**
 * AIS (Automatic Identification System) Marine Traffic Source.
 * Free public AIS data has severe restrictions. This implementation uses
 * the MarineTraffic API when a key is provided, and returns empty when unavailable.
 *
 * MarineTraffic API: https://www.marinetraffic.com/en/ais-api-services/
 * Requires MARINETRAFFIC_API_KEY environment variable.
 *
 * When no key is set the source is registered but isAvailable() returns false,
 * so it is silently skipped by the sweep engine.
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

// MarineTraffic key is not in the Zod config schema (added here as optional env read)
function getApiKey(): string | undefined {
  return process.env['MARINETRAFFIC_API_KEY'];
}

interface VesselPosition {
  MMSI:        string;
  IMO?:        string;
  SHIPNAME?:   string;
  SHIPTYPE?:   number;
  LATITUDE:    string | number;
  LONGITUDE:   string | number;
  SPEED?:      string | number;
  HEADING?:    string | number;
  DESTINATION?: string;
  FLAG?:       string;
  STATUS?:     number;
}

/** AIS navigation status codes of interest */
const NOTABLE_STATUS: Record<number, string> = {
  0: 'Underway using engine',
  1: 'At anchor',
  3: 'Restricted maneuverability',
  4: 'Constrained by draught',
  5: 'Moored',
  11: 'Power-driven vessel towing astern',
  14: 'AIS SART / Emergency',
  15: 'Undefined / default',
};

function statusToSeverity(status: number | undefined): Severity {
  if (status === 14) return 'high';   // AIS SART emergency
  if (status === 3 || status === 4) return 'medium';
  return 'info';
}

const source: DataSource = {
  id: 'ais-maritime',
  name: 'AIS Marine Traffic',
  category: 'maritime',
  requiresKey: true,

  isAvailable() {
    return Boolean(getApiKey());
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const apiKey = getApiKey()!;

    // MarineTraffic vessel positions API (expects JSON, type 0 = all vessel types)
    const url =
      `https://services.marinetraffic.com/api/exportvessels/v:8/${apiKey}` +
      `/timespan:60/msgtype:simple/protocol:json`;

    const res = await fetch(url, {
      signal:  AbortSignal.timeout(20_000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`MarineTraffic AIS returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as VesselPosition[] | { errors?: unknown[] };
    if (!Array.isArray(data)) {
      throw new Error('MarineTraffic AIS returned unexpected format');
    }

    const items: IntelligenceItem[] = [];

    for (const vessel of data) {
      const lat = parseFloat(String(vessel.LATITUDE));
      const lon = parseFloat(String(vessel.LONGITUDE));
      const name = vessel.SHIPNAME?.trim() || `MMSI ${vessel.MMSI}`;
      const severity = statusToSeverity(vessel.STATUS);
      const statusLabel = vessel.STATUS !== undefined
        ? (NOTABLE_STATUS[vessel.STATUS] ?? `Status ${vessel.STATUS}`)
        : 'Unknown status';

      const speed = vessel.SPEED !== undefined ? `${vessel.SPEED} knots` : 'unknown speed';
      const dest  = vessel.DESTINATION?.trim();

      items.push({
        id: createId('ais', vessel.MMSI),
        source: 'ais-maritime',
        category: 'maritime',
        title: `[${statusLabel}] ${name}${vessel.FLAG ? ` (${vessel.FLAG})` : ''}`,
        description:
          `Vessel ${name} (MMSI: ${vessel.MMSI}${vessel.IMO ? `, IMO: ${vessel.IMO}` : ''}) — ` +
          `Status: ${statusLabel}. Speed: ${speed}. ` +
          (dest ? `Destination: ${dest}.` : ''),
        timestamp: new Date(),
        location: !isNaN(lat) && !isNaN(lon)
          ? { lat, lon, name, country: vessel.FLAG ?? undefined }
          : undefined,
        severity,
        url: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${vessel.MMSI}`,
        tags: [
          'maritime',
          'ais',
          ...(vessel.FLAG ? [vessel.FLAG.toLowerCase()] : []),
          ...(vessel.STATUS === 14 ? ['emergency', 'sart'] : []),
        ],
        raw: vessel,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
