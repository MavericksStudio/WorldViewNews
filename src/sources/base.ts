import type { IntelligenceItem, SweepContext, SourceCategory } from '../types.js';

export interface DataSource {
  readonly id: string;
  readonly name: string;
  readonly category: SourceCategory;
  readonly requiresKey: boolean;
  isAvailable(): boolean;
  fetch(ctx: SweepContext): Promise<IntelligenceItem[]>;
}

/**
 * Creates a deterministic ID for an intelligence item by combining
 * source identifier and a unique part (e.g., URL slug, hash, or UUID).
 * Non-alphanumeric characters are normalised to hyphens; output is lowercase.
 */
export function createId(source: string, uniquePart: string): string {
  const normalise = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `${normalise(source)}-${normalise(uniquePart)}`;
}
