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

/**
 * Wraps native fetch with an AbortController-based timeout.
 * Throws a `DOMException` (AbortError) if the request exceeds `timeoutMs`.
 *
 * @param url       - Target URL
 * @param options   - Standard RequestInit options (optional)
 * @param timeoutMs - Milliseconds before the request is aborted (default: 30 000)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
