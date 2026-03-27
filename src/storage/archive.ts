/**
 * Cold storage: persists sweep results as daily NDJSON files (one JSON line per sweep).
 * Filename format: DATA_DIR/archives/YYYY-MM-DD.ndjson
 *
 * Uses append-only writes to avoid reading the entire file into memory,
 * which previously caused OOM crashes on memory-constrained hosts.
 */

import { mkdir, appendFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SweepResult } from '../types.js';

function archivesDir(): string {
  return join(config.DATA_DIR, 'archives');
}

function dateToFilename(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}.ndjson`;
}

/**
 * Reviver for JSON.parse that converts ISO-8601 string values that look like
 * dates back into Date objects.
 */
function dateReviver(_key: string, value: unknown): unknown {
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
  ) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

/** Appends a SweepResult as a single JSON line to today's archive file. */
export async function archive(result: SweepResult): Promise<void> {
  const dir = archivesDir();
  await mkdir(dir, { recursive: true });

  const filepath = join(dir, dateToFilename(result.startedAt));
  await appendFile(filepath, JSON.stringify(result) + '\n', 'utf-8');
}

/** Loads all sweep results for the given date. Returns [] if no archive exists. */
export async function loadDay(date: Date): Promise<SweepResult[]> {
  const filepath = join(archivesDir(), dateToFilename(date));
  try {
    const raw = await readFile(filepath, 'utf-8');
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line, dateReviver) as SweepResult);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    logger.error('archive: failed to load day', { filepath, err: String(err) });
    throw err;
  }
}

/**
 * Returns a sorted list of available archive dates (YYYY-MM-DD strings),
 * oldest first. Returns [] if the archives directory does not exist yet.
 */
export async function listDays(): Promise<string[]> {
  const dir = archivesDir();
  try {
    const entries = await readdir(dir);
    return entries
      .filter((e) => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(e))
      .map((e) => e.replace('.ndjson', ''))
      .sort();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    logger.error('archive: failed to list days', { dir, err: String(err) });
    throw err;
  }
}
