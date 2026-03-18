/**
 * Delta Engine — detects significant changes between consecutive sweep results.
 * Identifies new items, threshold breaches, count spikes, and de-duplicates
 * semantically similar stories using Jaccard similarity on word sets.
 */

import type { DeltaChange, AlertTier, IntelligenceItem, SweepResult, Severity } from '../types.js';

// ── Jaccard similarity helpers ────────────────────────────────────────────────

/** Normalise a title to a word set for fuzzy comparison. */
function titleWordSet(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B| */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

const JACCARD_THRESHOLD = 0.6;

/** Returns true if two items are semantically similar (likely the same story). */
function areSimilar(a: IntelligenceItem, b: IntelligenceItem): boolean {
  const setA = titleWordSet(a.title);
  const setB = titleWordSet(b.title);
  return jaccard(setA, setB) >= JACCARD_THRESHOLD;
}

// ── Tier assignment ───────────────────────────────────────────────────────────

function assignTier(item: IntelligenceItem, changeType: DeltaChange['type'], magnitude?: number): AlertTier {
  const sev: Severity = item.severity;

  // FLASH: critical items, earthquake M6+, BREAKING tag
  if (sev === 'critical') return 'FLASH';
  if (item.tags.includes('BREAKING') || item.tags.includes('breaking')) return 'FLASH';
  if (item.category === 'environment' && typeof magnitude === 'number' && magnitude >= 6.0) return 'FLASH';

  // PRIORITY: high severity, large spikes
  if (sev === 'high') return 'PRIORITY';
  if (changeType === 'spike' && typeof magnitude === 'number' && magnitude >= 3) return 'PRIORITY';

  return 'ROUTINE';
}

// ── Numeric threshold config ──────────────────────────────────────────────────

interface ThresholdRule {
  /** Tag(s) that must be present on the item */
  tags?: string[];
  /** Category of the item */
  category?: string;
  /** Extract a numeric value from the item (from title / raw) */
  extract: (item: IntelligenceItem) => number | null;
  threshold: number;
  reason: (value: number) => string;
}

const THRESHOLD_RULES: ThresholdRule[] = [
  {
    tags: ['earthquake', 'seismic'],
    extract: (item) => {
      // Title format: "M5.4 earthquake — ..." or "M6.1 ..."
      const m = /M(\d+\.?\d*)/i.exec(item.title);
      return m ? parseFloat(m[1]) : null;
    },
    threshold: 6.0,
    reason: (v) => `Earthquake magnitude ${v.toFixed(1)} exceeds threshold 6.0`,
  },
];

// ── Rolling average tracking ──────────────────────────────────────────────────

/** Keyed by category, tracks item counts per sweep window. */
const categoryCountHistory: Map<string, number[]> = new Map();
const HISTORY_WINDOW = 5; // keep last 5 sweep counts

function updateCategoryHistory(category: string, count: number): void {
  const hist = categoryCountHistory.get(category) ?? [];
  hist.push(count);
  if (hist.length > HISTORY_WINDOW) hist.shift();
  categoryCountHistory.set(category, hist);
}

function rollingAverage(category: string): number {
  const hist = categoryCountHistory.get(category) ?? [];
  if (hist.length === 0) return 0;
  return hist.reduce((a, b) => a + b, 0) / hist.length;
}

// ── Delta Engine implementation ───────────────────────────────────────────────

export interface DeltaEngineInterface {
  analyze(current: SweepResult, previous: SweepResult | undefined): DeltaChange[];
}

class DeltaEngineImpl implements DeltaEngineInterface {
  analyze(current: SweepResult, previous: SweepResult | undefined): DeltaChange[] {
    const changes: DeltaChange[] = [];

    const previousIds = new Set<string>(previous?.items.map((i) => i.id) ?? []);

    // ── 1. New item detection ─────────────────────────────────────────────
    const newItems = current.items.filter((i) => !previousIds.has(i.id));

    // Semantic dedup: for each new item, check if a similar one already fired
    const dedupedNew: IntelligenceItem[] = [];
    for (const candidate of newItems) {
      const isDuplicate = dedupedNew.some((existing) => areSimilar(candidate, existing));
      if (!isDuplicate) {
        dedupedNew.push(candidate);
      }
    }

    for (const item of dedupedNew) {
      // Check numeric thresholds first — may override tier
      let thresholdFired = false;
      for (const rule of THRESHOLD_RULES) {
        if (rule.category && item.category !== rule.category) continue;
        if (rule.tags && !rule.tags.some((t) => item.tags.includes(t))) continue;

        const value = rule.extract(item);
        if (value !== null && value >= rule.threshold) {
          const tier = assignTier(item, 'threshold', value);
          changes.push({
            type: 'threshold',
            item,
            tier,
            reason: rule.reason(value),
            currentValue: value,
          });
          thresholdFired = true;
          break;
        }
      }

      if (!thresholdFired) {
        const tier = assignTier(item, 'new');
        changes.push({
          type: 'new',
          item,
          tier,
          reason: `New item detected from ${item.source}`,
        });
      }
    }

    // ── 2. Count spike detection ──────────────────────────────────────────
    const categories = [...new Set(current.items.map((i) => i.category))];

    for (const cat of categories) {
      const currentCount = current.items.filter((i) => i.category === cat).length;
      const avg = rollingAverage(cat);

      if (avg > 0 && currentCount > avg * 2) {
        const multiplier = currentCount / avg;
        // Pick the highest-severity new item from this category as representative
        const representative = dedupedNew
          .filter((i) => i.category === cat)
          .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];

        if (representative) {
          const tier: AlertTier = multiplier >= 3 ? 'PRIORITY' : 'ROUTINE';
          changes.push({
            type: 'spike',
            item: representative,
            tier,
            reason: `${cat} item count spike: ${currentCount} items (${multiplier.toFixed(1)}x average of ${avg.toFixed(0)})`,
            previousValue: avg,
            currentValue: currentCount,
          });
        }
      }

      // Update rolling history AFTER spike check
      updateCategoryHistory(cat, currentCount);
    }

    return changes;
  }
}

function severityRank(s: Severity): number {
  const ranks: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return ranks[s] ?? 0;
}

/** Singleton delta engine. */
export const deltaEngine: DeltaEngineInterface = new DeltaEngineImpl();
