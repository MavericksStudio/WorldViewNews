/**
 * OpenSky Network — real-time aircraft state vectors.
 * No API key required for basic access (rate limited to one call per 10 seconds).
 * Filters to military/interesting aircraft by callsign pattern.
 * API: https://opensky-network.org/api/states/all
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const API_URL = 'https://opensky-network.org/api/states/all';

/** State vector field indices per OpenSky API documentation */
const FIELD = {
  icao24:        0,
  callsign:      1,
  origin_country:2,
  time_position: 3,
  last_contact:  4,
  longitude:     5,
  latitude:      6,
  baro_altitude: 7,
  on_ground:     8,
  velocity:      9,
  true_track:    10,
  vertical_rate: 11,
  sensors:       12,
  geo_altitude:  13,
  squawk:        14,
  spi:           15,
  position_source:16,
};

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

/**
 * Patterns that suggest military, government or otherwise notable aircraft.
 * Callsigns are 8 chars max, often padded with spaces.
 */
const INTERESTING_PATTERNS = [
  /^RCH/i,     // USAF Air Mobility Command
  /^REACH/i,
  /^JAKE/i,    // USAF training
  /^DOOM/i,    // USAF
  /^HAVOC/i,
  /^VIPER/i,
  /^COBRA/i,
  /^KNIFE/i,
  /^GHOST/i,
  /^MAGMA/i,   // UK special missions
  /^NATO/i,
  /^AWACS/i,
  /^SPAR/i,    // US government / VIP
  /^SAM\d/i,   // Special Air Mission (US Government)
  /^VMX/i,     // US Marine Corps
  /^VV\d/i,    // US Navy test
  /^RRR/i,     // UK Royal Air Force
  /^ICED/i,
  /^FORTE/i,
  /^GOTCH/i,
  /^RULER/i,
  /^TOPGUN/i,
  /^UAV/i,
  /^DRONE/i,
  /** Emergency squawk codes — kept as squawk check below */
];

const INTERESTING_SQUAWKS = new Set(['7500', '7600', '7700']);

function isInteresting(callsign: string | null, squawk: string | null): boolean {
  if (squawk && INTERESTING_SQUAWKS.has(squawk)) return true;
  if (!callsign) return false;
  const cs = callsign.trim().toUpperCase();
  return INTERESTING_PATTERNS.some((re) => re.test(cs));
}

function squawkLabel(squawk: string): string {
  if (squawk === '7500') return 'HIJACKING (7500)';
  if (squawk === '7600') return 'RADIO FAILURE (7600)';
  if (squawk === '7700') return 'EMERGENCY (7700)';
  return squawk;
}

const source: DataSource = {
  id: 'opensky-aviation',
  name: 'OpenSky Network (Military/Notable Aircraft)',
  category: 'aviation',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const res = await fetch(API_URL, {
      signal:  AbortSignal.timeout(20_000),
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'WorldViewNews/0.1',
      },
    });

    if (!res.ok) {
      throw new Error(`OpenSky returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as OpenSkyResponse;
    const states = data.states ?? [];
    const items: IntelligenceItem[] = [];

    for (const state of states) {
      const callsign  = (state[FIELD.callsign] as string | null)?.trim() ?? null;
      const squawk    = (state[FIELD.squawk]   as string | null) ?? null;

      if (!isInteresting(callsign, squawk)) continue;

      const icao24  = (state[FIELD.icao24]         as string | null) ?? 'unknown';
      const country = (state[FIELD.origin_country] as string | null) ?? 'Unknown';
      const lat     = state[FIELD.latitude]   as number | null;
      const lon     = state[FIELD.longitude]  as number | null;
      const altM    = state[FIELD.baro_altitude] as number | null;
      const velMs   = state[FIELD.velocity]   as number | null;
      const onGnd   = state[FIELD.on_ground]  as boolean | null;

      const altFt   = altM !== null ? Math.round(altM * 3.28084) : null;
      const velKts  = velMs !== null ? Math.round(velMs * 1.944) : null;
      const lastTs  = (state[FIELD.time_position] as number | null);
      const timestamp = lastTs ? new Date(lastTs * 1000) : new Date();

      const isEmergency = squawk ? INTERESTING_SQUAWKS.has(squawk) : false;
      const displayCallsign = callsign ?? 'Unknown callsign';

      const title = isEmergency
        ? `AIRCRAFT EMERGENCY: ${displayCallsign} (${country}) — Squawk ${squawkLabel(squawk!)}`
        : `Notable aircraft: ${displayCallsign} (${country})`;

      const description =
        `${isEmergency ? 'Emergency squawk ' + squawkLabel(squawk!) + ' declared by ' : 'Monitoring: '}` +
        `${displayCallsign} (ICAO: ${icao24}), origin: ${country}. ` +
        (altFt !== null ? `Altitude: ${altFt.toLocaleString()} ft. ` : '') +
        (velKts !== null ? `Speed: ${velKts} kts. ` : '') +
        (onGnd ? 'On ground. ' : '') +
        (squawk && !isEmergency ? `Squawk: ${squawk}.` : '');

      items.push({
        id: createId('opensky', `${icao24}-${data.time}`),
        source: 'opensky-aviation',
        category: 'aviation',
        title,
        description,
        timestamp,
        location: lat !== null && lon !== null
          ? { lat, lon, name: `${displayCallsign} position`, country }
          : undefined,
        severity: isEmergency ? 'high' : 'info',
        url: `https://opensky-network.org/aircraft-profile?icao24=${icao24}`,
        tags: [
          'aviation',
          'opensky',
          ...(isEmergency ? ['emergency', 'squawk-' + (squawk ?? '')] : ['military', 'notable']),
          country.toLowerCase().replace(/\s+/g, '-'),
        ],
        raw: state,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
