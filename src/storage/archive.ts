/**
 * Cold storage: persists sweep results as daily JSON files.
 * Each file is a JSON array of SweepResult objects.
 * Filename format: DATA_DIR/archives/YYYY-MM-DD.json
 */

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
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
  return `${yyyy}-${mm}-${dd}.json`;
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

/** Appends a SweepResult to today's archive file, creating it if necessary. */
export async function archive(result: SweepResult): Promise<void> {
  const dir = archivesDir();
  await mkdir(dir, { recursive: true });

  const filepath = join(dir, dateToFilename(result.startedAt));

  let existing: SweepResult[] = [];
  try {
    const raw = await readFile(filepath, 'utf-8');
    existing = JSON.parse(raw, dateReviver) as SweepResult[];
  } catch (err) {
    // File doesn't exist yet or is malformed — start fresh.
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      logger.warn('archive: could not read existing file, starting fresh', {
        filepath,
        err: String(err),
      });
    }
  }

  existing.push(result);
  await writeFile(filepath, JSON.stringify(existing, null, 2), 'utf-8');
}

/** Loads all sweep results for the given date. Returns [] if no archive exists. */
export async function loadDay(date: Date): Promise<SweepResult[]> {
  const filepath = join(archivesDir(), dateToFilename(date));
  try {
    const raw = await readFile(filepath, 'utf-8');
    return JSON.parse(raw, dateReviver) as SweepResult[];
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
      .filter((e) => /^\d{4}-\d{2}-\d{2}\.json$/.test(e))
      .map((e) => e.replace('.json', ''))
      .sort();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    logger.error('archive: failed to list days', { dir, err: String(err) });
    throw err;
  }
}
