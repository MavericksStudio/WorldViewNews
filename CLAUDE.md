# CLAUDE.md — WorldViewNews

## Project Overview

**WorldViewNews** is a unified open-source intelligence (OSINT) platform that merges two prior projects:

- **World Monitor** — TypeScript SPA with 435+ RSS feeds, dual interactive maps (globe + flat), live news TV, live webcams, and AI-powered summarisation
- **Crucix** — Local-first Node.js intelligence engine with 27 structured OSINT sources, sweep-based polling architecture, and delta change detection

The result is a single Node.js 22+ application that continuously sweeps public intelligence sources, detects meaningful changes, and surfaces alerts through an inline HTML dashboard, configurable notification bots, and optional LLM analysis.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ |
| Language | TypeScript 5.7+ (strict mode, ESM) |
| HTTP server | Express 4 |
| Validation | Zod |
| Visualization | globe.gl (3-D globe), Leaflet (flat map) |
| Live Media | YouTube IFrame embeds (18 news channels, 22 webcam feeds) |
| Storage | JSON flat files, Redis optional |
| Testing | Node.js built-in test runner (`node --test`) |
| Dev tooling | tsx (no-compile dev server) |

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (hot-reload via tsx)
npm run dev

# Type-check without emitting
npm run lint

# Compile to dist/
npm run build

# Run production build
npm start

# Run tests
npm test

# Docker
docker compose up --build
docker compose --profile with-llm up    # with Ollama
docker compose --profile with-redis up  # with Redis
```

## Architecture Notes

### Sweep-Based Loop
The core engine runs a configurable sweep loop (default 15 min, `SWEEP_INTERVAL_MS`). Each sweep:
1. Fans out to all registered sources concurrently via `Promise.allSettled()`
2. Collects `IntelligenceItem[]` results
3. Runs delta detection against the previous sweep snapshot
4. Classifies changes into alert tiers (FLASH / PRIORITY / ROUTINE)
5. Delivers alerts to configured channels (SSE, Telegram, Discord)

### Source Abstraction Interface
Every data source implements `DataSource`:
```typescript
interface DataSource {
  readonly id: string;
  readonly name: string;
  readonly category: SourceCategory;
  readonly requiresKey: boolean;
  isAvailable(): boolean;
  fetch(ctx: SweepContext): Promise<IntelligenceItem[]>;
}
```
Sources self-register via `registry.register(source)` in `src/sources/registry.ts`.

### Inline HTML Dashboard
Serves a single self-contained HTML page at `GET /` with four center views:
- **3D Globe** (globe.gl) — severity-colored intelligence points
- **2D Map** (Leaflet) — flat map with clustered markers
- **Live News** — 18 YouTube live news channels (Bloomberg, CNN, BBC, etc.)
- **Live Webcams** — 22 city webcam feeds across 5 regions (Middle East, Europe, Americas, Asia, Space)

SSE-driven real-time updates via `GET /api/v1/stream`.

### JSON Storage
`DATA_DIR` (default `./data/`) holds:
- `archives/YYYY-MM-DD.json` — daily sweep result archives

### Config-Gated Features
Features are enabled only when the relevant env var is present:
- **Telegram alerts** — requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
- **Discord alerts** — requires `DISCORD_WEBHOOK_URL` or `DISCORD_BOT_TOKEN`
- **LLM analysis** — requires at least one LLM key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) or `OLLAMA_ENABLED=true`
- **Redis cache** — requires `REDIS_URL`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — starts sweep engine + Express server |
| `src/types.ts` | Core domain types (`IntelligenceItem`, `SweepResult`, `Alert`, etc.) |
| `src/config.ts` | Zod-validated config singleton loaded from `process.env` |
| `src/logger.ts` | Structured JSON logger (writes to stderr, respects `LOG_LEVEL`) |
| `src/engine/sweep.ts` | Sweep orchestrator — fan-out, collect, persist |
| `src/engine/delta.ts` | Delta change detection + severity scoring |
| `src/engine/alerts.ts` | Alert manager — rate limiting, cooldowns, tiers |
| `src/sources/registry.ts` | Source registry (auto-discovery) |
| `src/sources/**/*.ts` | Individual OSINT source adapters (15 sources) |
| `src/server/http.ts` | Express app factory |
| `src/server/dashboard.ts` | Inline HTML dashboard (globe, map, live news, webcams) |
| `src/server/sse.ts` | SSE connection manager |
| `src/server/api.ts` | REST API routes (`/api/v1/*`) |
| `src/bots/telegram.ts` | Telegram 2-way bot (long-polling) |
| `src/bots/discord.ts` | Discord webhook delivery |
| `src/llm/registry.ts` | LLM provider chain with fallback |
| `src/llm/providers/*.ts` | 7 LLM providers (Ollama, Anthropic, OpenAI, Gemini, etc.) |
| `src/analysis/*.ts` | Correlation, CII scoring, trade ideas |

## Environment Variables

See `.env.example` for a full annotated list. Required variables are `PORT`, `SWEEP_INTERVAL_MS`, `LOG_LEVEL`, and `DATA_DIR` — all have defaults and do not need to be set explicitly.
