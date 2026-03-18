/**
 * In-memory store for LLM-generated sweep summaries.
 * Keeps the last N summaries.
 */

export interface SweepSummary {
  sweepId: string;
  summary: string;
  generatedAt: Date;
}

const DEFAULT_CAPACITY = 10;

class SummaryStore {
  private readonly summaries: SweepSummary[] = [];
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  store(entry: SweepSummary): void {
    this.summaries.push(entry);
    if (this.summaries.length > this.capacity) {
      this.summaries.shift();
    }
  }

  getLatest(): SweepSummary | undefined {
    return this.summaries[this.summaries.length - 1];
  }

  getAll(): SweepSummary[] {
    return [...this.summaries];
  }

  getBySweepId(sweepId: string): SweepSummary | undefined {
    return this.summaries.find((s) => s.sweepId === sweepId);
  }
}

/** Singleton summary store shared across the application. */
export const summaryStore = new SummaryStore();
