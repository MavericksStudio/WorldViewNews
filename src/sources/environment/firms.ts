/**
 * NASA FIRMS (Fire Information for Resource Management System)
 * Active fire / thermal anomaly data from VIIRS SNPP sensor.
 * Uses the publicly accessible 24-hour global CSV (no registration required).
 *
 * Endpoint: https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv
 *
 * CSV columns (0-indexed):
 *   latitude, longitude, brightness, scan, track, acq_date, acq_time,
 *   satellite, instrument, confidence, version, bright_ti4, bright_ti5, frp, daynight, type
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity, GeoLocation } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';

const PRIMARY_URL =
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv';

const OPEN_KEY_URL =
  'https://firms.modaps.eosdis.nasa.gov/api/area/csv/OPEN_KEY/VIIRS_SNPP_NRT/world/1';

/** Degrees threshold for grouping nearby fire detections */
const CLUSTER_DEGREES = 0.5;

interface FireRow {
  lat: number;
  lon: number;
  brightness: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  confidence: string;
  frp: number;
}

function parseCsvRows(csv: string): FireRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Detect header row and map column indices
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = {
    lat: header.indexOf('latitude'),
    lon: header.indexOf('longitude'),
    brightness: header.indexOf('brightness'),
    acqDate: header.indexOf('acq_date'),
    acqTime: header.indexOf('acq_time'),
    satellite: header.indexOf('satellite'),
    confidence: header.indexOf('confidence'),
    frp: header.indexOf('frp'),
  };

  // Fallback to positional indices if header not recognised
  if (idx.lat === -1) {
    idx.lat = 0;
    idx.lon = 1;
    idx.brightness = 2;
    idx.acqDate = 5;
    idx.acqTime = 6;
    idx.satellite = 7;
    idx.confidence = 9;
    idx.frp = 13;
  }

  const rows: FireRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 10) continue;

    const lat = parseFloat(cols[idx.lat]);
    const lon = parseFloat(cols[idx.lon]);
    if (isNaN(lat) || isNaN(lon)) continue;

    rows.push({
      lat,
      lon,
      brightness: parseFloat(cols[idx.brightness]) || 0,
      acqDate: cols[idx.acqDate]?.trim() ?? '',
      acqTime: cols[idx.acqTime]?.trim() ?? '',
      satellite: cols[idx.satellite]?.trim() ?? '',
      confidence: cols[idx.confidence]?.trim().toLowerCase() ?? '',
      frp: parseFloat(cols[idx.frp]) || 0,
    });
  }
  return rows;
}

/** Filter to high-confidence detections only */
function isHighConfidence(row: FireRow): boolean {
  const c = row.confidence;
  // Nominal/high string values
  if (c === 'high' || c === 'h' || c === 'nominal') return true;
  // Numeric: >= 80
  const num = parseFloat(c);
  if (!isNaN(num) && num >= 80) return true;
  return false;
}

function frpToSeverity(frp: number): Severity {
  if (frp > 500) return 'critical';
  if (frp > 200) return 'high';
  if (frp > 50) return 'medium';
  return 'low';
}

interface FireCluster {
  lat: number;
  lon: number;
  count: number;
  maxFrp: number;
  totalFrp: number;
  acqDate: string;
  satellite: string;
}

/** Group fire detections within CLUSTER_DEGREES into single clusters */
function clusterFires(rows: FireRow[]): FireCluster[] {
  const clusters: FireCluster[] = [];

  for (const row of rows) {
    let assigned = false;
    for (const cluster of clusters) {
      if (
        Math.abs(row.lat - cluster.lat) <= CLUSTER_DEGREES &&
        Math.abs(row.lon - cluster.lon) <= CLUSTER_DEGREES
      ) {
        // Update cluster centroid (running average)
        const n = cluster.count;
        cluster.lat = (cluster.lat * n + row.lat) / (n + 1);
        cluster.lon = (cluster.lon * n + row.lon) / (n + 1);
        cluster.count++;
        cluster.totalFrp += row.frp;
        if (row.frp > cluster.maxFrp) cluster.maxFrp = row.frp;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      clusters.push({
        lat: row.lat,
        lon: row.lon,
        count: 1,
        maxFrp: row.frp,
        totalFrp: row.frp,
        acqDate: row.acqDate,
        satellite: row.satellite,
      });
    }
  }

  return clusters;
}

const source: DataSource = {
  id: 'nasa-firms-fire',
  name: 'NASA FIRMS Active Fire (VIIRS)',
  category: 'environment',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    let csvText: string | null = null;

    // Try open-key endpoint first, fall back to direct CSV
    for (const url of [OPEN_KEY_URL, PRIMARY_URL]) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(20_000),
          headers: { 'Accept': 'text/csv,text/plain,*/*' },
        });
        if (res.ok) {
          const text = await res.text();
          // Sanity check: must look like CSV with at least a header
          if (text.includes('latitude') || text.includes('LATITUDE') || text.split('\n').length > 5) {
            csvText = text;
            break;
          }
        }
      } catch {
        // Try next URL
      }
    }

    if (!csvText) {
      throw new Error('NASA FIRMS: all endpoints failed or returned invalid data');
    }

    const allRows = parseCsvRows(csvText);
    const highConf = allRows.filter(isHighConfidence);

    if (highConf.length === 0) return [];

    const clusters = clusterFires(highConf);
    const items: IntelligenceItem[] = [];

    for (const cluster of clusters) {
      const avgFrp = cluster.totalFrp / cluster.count;
      const severity = frpToSeverity(cluster.maxFrp);

      // Build a rough location name from coordinates
      const latDir = cluster.lat >= 0 ? 'N' : 'S';
      const lonDir = cluster.lon >= 0 ? 'E' : 'W';
      const locationName =
        `${Math.abs(cluster.lat).toFixed(2)}°${latDir} ${Math.abs(cluster.lon).toFixed(2)}°${lonDir}`;

      const location: GeoLocation = {
        lat: cluster.lat,
        lon: cluster.lon,
        name: locationName,
      };

      const title =
        cluster.count === 1
          ? `Active fire detected at ${locationName}`
          : `Fire cluster (${cluster.count} detections) at ${locationName}`;

      const description =
        `${cluster.count} high-confidence VIIRS thermal detection(s) near ${locationName}. ` +
        `Max FRP: ${cluster.maxFrp.toFixed(1)} MW, Avg FRP: ${avgFrp.toFixed(1)} MW. ` +
        `Detected ${cluster.acqDate} by ${cluster.satellite}.`;

      // Use centroid coordinates as unique part for stable ID
      const uniquePart = `${cluster.lat.toFixed(2)}-${cluster.lon.toFixed(2)}-${cluster.acqDate}`;

      items.push({
        id: createId('firms', uniquePart),
        source: 'nasa-firms-fire',
        category: 'environment',
        title,
        description,
        timestamp: new Date(),
        location,
        severity,
        url: 'https://firms.modaps.eosdis.nasa.gov/map/',
        tags: ['fire', 'wildfire', 'thermal', 'nasa', 'viirs', 'firms'],
        raw: cluster,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
