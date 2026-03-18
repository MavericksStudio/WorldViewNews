import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[config.LOG_LEVEL];
}

function write(level: LogLevel, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const entry: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    message,
  };

  if (data !== undefined) {
    entry['data'] = data;
  }

  process.stderr.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug(message: string, data?: unknown): void {
    write('debug', message, data);
  },
  info(message: string, data?: unknown): void {
    write('info', message, data);
  },
  warn(message: string, data?: unknown): void {
    write('warn', message, data);
  },
  error(message: string, data?: unknown): void {
    write('error', message, data);
  },
};
