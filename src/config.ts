import { z } from 'zod';

const configSchema = z.object({
  // ─── Server ─────────────────────────────────────────────────────────────────
  PORT: z.coerce.number().default(3000),

  // ─── Sweep Engine ───────────────────────────────────────────────────────────
  SWEEP_INTERVAL_MS: z.coerce.number().default(900_000),

  // ─── Logging ────────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ─── Storage ────────────────────────────────────────────────────────────────
  DATA_DIR: z.string().default('./data'),

  // ─── Conflict & Geopolitical ────────────────────────────────────────────────
  ACLED_API_KEY: z.string().optional(),
  ACLED_EMAIL:   z.string().optional(),
  GDELT_API_KEY: z.string().optional(),

  // ─── Aviation ───────────────────────────────────────────────────────────────
  OPENSKY_USERNAME: z.string().optional(),
  OPENSKY_PASSWORD: z.string().optional(),

  // ─── Maritime ─────────────────────────────────────────────────────────────
  MARINETRAFFIC_API_KEY: z.string().optional(),

  // ─── Economic & Financial ───────────────────────────────────────────────────
  FRED_API_KEY: z.string().optional(),
  EIA_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),

  // ─── Notifications: Telegram ────────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // ─── Notifications: Discord ─────────────────────────────────────────────────
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),

  // ─── LLM Providers ──────────────────────────────────────────────────────────
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  CODEX_API_KEY: z.string().optional(),
  MINIMAX_API_KEY: z.string().optional(),

  // ─── Cache / Pub-Sub ────────────────────────────────────────────────────────
  REDIS_URL: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

const result = configSchema.safeParse(process.env);

if (!result.success) {
  const formatted = result.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${formatted}`);
}

export const config: Config = result.data;
