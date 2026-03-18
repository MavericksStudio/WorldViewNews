/**
 * Hot memory store: keeps the last N sweep results in memory for fast access.
 * Default capacity is 3 sweeps.
 */

import type { IntelligenceItem, SweepResult, SourceCategory } from '../types.js';

const DEFAULT_CAPACITY = 3;

class MemoryStore {
  private readonly results: SweepResult[] = [];
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  /** Appends a sweep result, evicting the oldest entry when over capacity. */
  store(result: SweepResult): void {
    this.results.push(result);
    if (this.results.length > this.capacity) {
      this.results.shift();
    }
  }

  /** Returns the most recent sweep result, or undefined if the store is empty. */
  getLatest(): SweepResult | undefined {
    return this.results[this.results.length - 1];
  }

  /** Returns all stored sweep results, oldest first. */
  getAll(): SweepResult[] {
    return [...this.results];
  }

  /** Returns a flattened list of all intelligence items across all stored sweeps. */
  getAllItems(): IntelligenceItem[] {
    return this.results.flatMap((r) => r.items);
  }

  /** Returns all items matching the given source category across all stored sweeps. */
  getItemsByCategory(category: SourceCategory): IntelligenceItem[] {
    return this.getAllItems().filter((item) => item.category === category);
  }

  /** Number of sweep results currently in the store. */
  get size(): number {
    return this.results.length;
  }
}

/** Singleton hot memory store shared across the application. */
export const memory = new MemoryStore();
