/**
 * Cross-stream signal correlation — detects when multiple independent sources
 * report related events (geographic proximity, temporal clustering, category spikes).
 */

import type { IntelligenceItem, SourceCategory } from '../types.js';

export interface CorrelatedGroup {
  items: IntelligenceItem[];
  score: number;    // 0-1
  reason: string;
  region?: string;
}

const GEO_RADIUS_KM = 100;
const TIME_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MIN_GROUP_SIZE = 2;

/** Haversine distance between two lat/lon points in kilometres. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Items with geographic coordinates within a recent time window. */
function geoItems(items: IntelligenceItem[]): IntelligenceItem[] {
  return items.filter((i) => i.location !== undefined);
}

/**
 * Find geographic clusters: items from different sources within GEO_RADIUS_KM
 * and TIME_WINDOW_MS of each other.
 */
function findGeoClusters(items: IntelligenceItem[]): CorrelatedGroup[] {
  const located = geoItems(items);
  const groups: CorrelatedGroup[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < located.length; i++) {
    const anchor = located[i]!;
    if (assigned.has(anchor.id)) continue;

    const cluster: IntelligenceItem[] = [anchor];
    const anchorTime = anchor.timestamp.getTime();
    const anchorLat = anchor.location!.lat;
    const anchorLon = anchor.location!.lon;

    for (let j = i + 1; j < located.length; j++) {
      const candidate = located[j]!;
      if (assigned.has(candidate.id)) continue;
      if (candidate.source === anchor.source) continue; // must be from different source

      const timeDiff = Math.abs(candidate.timestamp.getTime() - anchorTime);
      if (timeDiff > TIME_WINDOW_MS) continue;

      const dist = haversineKm(
        anchorLat,
        anchorLon,
        candidate.location!.lat,
        candidate.location!.lon,
      );
      if (dist <= GEO_RADIUS_KM) {
        cluster.push(candidate);
      }
    }

    if (cluster.length >= MIN_GROUP_SIZE) {
      const uniqueSources = new Set(cluster.map((c) => c.source)).size;
      // Score based on number of unique sources and cluster size
      const score = Math.min(1, (uniqueSources / 3) * 0.6 + (cluster.length / 5) * 0.4);

      cluster.forEach((c) => assigned.add(c.id));

      groups.push({
        items: cluster,
        score,
        reason: `${cluster.length} items from ${uniqueSources} sources within ${GEO_RADIUS_KM}km and 1h`,
        region: anchor.location!.name,
      });
    }
  }

  return groups;
}

/**
 * Find temporal category spikes: multiple categories spiking simultaneously
 * (more than 3 items in the same category within a short window).
 */
function findCategorySpikes(items: IntelligenceItem[]): CorrelatedGroup[] {
  const SPIKE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  const SPIKE_THRESHOLD = 3;

  const groups: CorrelatedGroup[] = [];

  const categoryMap: Map<SourceCategory, IntelligenceItem[]> = new Map();
  for (const item of items) {
    const bucket = categoryMap.get(item.category) ?? [];
    bucket.push(item);
    categoryMap.set(item.category, bucket);
  }

  const spikingCategories: Array<{ category: SourceCategory; items: IntelligenceItem[] }> = [];

  for (const [category, catItems] of categoryMap) {
    // Sort by time and find dense windows
    const sorted = [...catItems].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    for (let i = 0; i < sorted.length; i++) {
      const window: IntelligenceItem[] = [sorted[i]!];
      const windowStart = sorted[i]!.timestamp.getTime();

      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j]!.timestamp.getTime() - windowStart <= SPIKE_WINDOW_MS) {
          window.push(sorted[j]!);
        }
      }

      if (window.length >= SPIKE_THRESHOLD) {
        spikingCategories.push({ category, items: window });
        break; // one spike per category is enough
      }
    }
  }

  // If multiple categories are spiking simultaneously, correlate them
  if (spikingCategories.length >= 2) {
    const allSpikeItems = spikingCategories.flatMap((s) => s.items);
    const categoryNames = spikingCategories.map((s) => s.category).join(', ');
    const score = Math.min(1, 0.4 + spikingCategories.length * 0.15);

    groups.push({
      items: allSpikeItems,
      score,
      reason: `Simultaneous category spikes detected: ${categoryNames}`,
    });
  } else if (spikingCategories.length === 1) {
    // Single category spike still worth noting if severe
    const spike = spikingCategories[0]!;
    const highSeverity = spike.items.filter(
      (i) => i.severity === 'high' || i.severity === 'critical',
    );
    if (highSeverity.length >= 2) {
      groups.push({
        items: spike.items,
        score: 0.5,
        reason: `${spike.category} spike with ${highSeverity.length} high/critical items`,
      });
    }
  }

  return groups;
}

/**
 * Find correlations across all intelligence items.
 * Returns groups of correlated items with a correlation score.
 */
export function findCorrelations(items: IntelligenceItem[]): CorrelatedGroup[] {
  if (items.length < MIN_GROUP_SIZE) return [];

  const geoClusters = findGeoClusters(items);
  const categorySpikes = findCategorySpikes(items);

  const all = [...geoClusters, ...categorySpikes];

  // Sort by score descending
  return all.sort((a, b) => b.score - a.score);
}
