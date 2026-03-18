import type { SourceCategory } from '../types.js';
import type { DataSource } from './base.js';

class SourceRegistry {
  private readonly sources: Map<string, DataSource> = new Map();

  /** Register a source by its id. Overwrites any existing entry with the same id. */
  register(source: DataSource): void {
    this.sources.set(source.id, source);
  }

  /** Returns all sources whose isAvailable() returns true. */
  getAvailable(): DataSource[] {
    return [...this.sources.values()].filter((s) => s.isAvailable());
  }

  /** Returns every registered source regardless of availability. */
  getAll(): DataSource[] {
    return [...this.sources.values()];
  }

  /** Look up a single source by id. */
  get(id: string): DataSource | undefined {
    return this.sources.get(id);
  }

  /** Returns all sources (registered) that belong to the given category. */
  getByCategory(category: SourceCategory): DataSource[] {
    return [...this.sources.values()].filter((s) => s.category === category);
  }

  /** Number of registered sources. */
  get size(): number {
    return this.sources.size;
  }
}

/** Singleton registry shared across the application. */
export const registry = new SourceRegistry();
