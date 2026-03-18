# CLAUDE.md — WorldViewNews

## Project Overview

**WorldViewNews** is a unified open-source intelligence (OSINT) platform that merges two prior projects:

- **World Monitor** — TypeScript SPA with 435+ RSS feeds, dual interactive maps (globe + flat), and AI-powered summarisation
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
| Storage | JSON flat files (Phase 1), Redis optional |
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
```

## Architecture Notes

### Sweep-Based Loop
The core engine runs a configurable sweep loop (default 15 min, `SWEEP_INTERVAL_MS`). Each sweep:
1. Fans out to all registered sources concurrently
2. Collects `IntelligenceItem[]` results
3. Runs delta detection against the previous sweep snapshot
4. Emits `DeltaChange` events for significant changes
5. Triggers alert delivery to configured channels

### Source Abstraction Interface
Every data source implements `ISource`:
```typescript
interface ISource {
  readonly id: string;
  readonly category: SourceCategory;
  fetch(ctx: SweepContext): Promise<IntelligenceItem[]>;
}
```
Sources are registered in `src/sources/index.ts` and dynamically discovered.

### Inline HTML Dashboard (Phase 1)
Rather than a separate SPA, Phase 1 serves a single self-contained HTML page at `GET /` that:
- Renders a live-updating feed via SSE (`GET /events`)
- Embeds a globe.gl 3-D globe and Leaflet flat map
- Requires no build step for the frontend

### JSON Storage
`DATA_DIR` (default `./data/`) holds:
- `sweeps/YYYY-MM-DD/sweep-{id}.json` — raw sweep snapshots
- `alerts/alerts.jsonl` — append-only alert log

### Config-Gated Features
Features are enabled only when the relevant env var is present:
- **Telegram alerts** — requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
- **Discord alerts** — requires `DISCORD_WEBHOOK_URL` or `DISCORD_BOT_TOKEN`
- **LLM analysis** — requires at least one LLM key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
- **Redis pub/sub** — requires `REDIS_URL`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Application entry point — starts sweep engine + Express server |
| `src/types.ts` | Core domain types (`IntelligenceItem`, `SweepResult`, `Alert`, etc.) |
| `src/config.ts` | Zod-validated config singleton loaded from `process.env` |
| `src/logger.ts` | Structured JSON logger (writes to stderr, respects `LOG_LEVEL`) |
| `src/engine/sweeper.ts` | Sweep orchestrator — fan-out, collect, persist |
| `src/engine/delta.ts` | Delta change detection logic |
| `src/sources/index.ts` | Source registry |
| `src/sources/*.ts` | Individual OSINT source adapters |
| `src/server/index.ts` | Express app factory |
| `src/server/dashboard.ts` | Inline HTML dashboard template |
| `src/alerts/index.ts` | Alert dispatcher — routes to enabled channels |
| `src/alerts/telegram.ts` | Telegram delivery adapter |
| `src/alerts/discord.ts` | Discord delivery adapter |

## Environment Variables

See `.env.example` for a full annotated list. Required variables are `PORT`, `SWEEP_INTERVAL_MS`, `LOG_LEVEL`, and `DATA_DIR` — all have defaults and do not need to be set explicitly.
