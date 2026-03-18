/**
 * CoinGecko — top cryptocurrency market data.
 * No API key required for basic access (rate limited to 10–30 calls/min).
 * Optional COINGECKO_API_KEY for higher rate limits via their free-tier header.
 * API: https://api.coingecko.com/api/v3/coins/markets
 */

import type { DataSource } from '../base.js';
import type { IntelligenceItem, SweepContext, Severity } from '../../types.js';
import { createId } from '../base.js';
import { registry } from '../registry.js';
import { config } from '../../config.js';

const BASE_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false' +
  '&price_change_percentage=24h';

interface CoinMarket {
  id:                        string;
  symbol:                    string;
  name:                      string;
  current_price:             number;
  market_cap:                number;
  price_change_24h:          number | null;
  price_change_percentage_24h: number | null;
  market_cap_rank:           number;
  last_updated:              string;
}

function priceChangeSeverity(pctChange: number): Severity {
  const abs = Math.abs(pctChange);
  if (abs >= 20) return 'high';
  if (abs >= 10) return 'medium';
  if (abs >= 5)  return 'low';
  return 'info';
}

const source: DataSource = {
  id: 'coingecko-crypto',
  name: 'CoinGecko Cryptocurrency Markets',
  category: 'market',
  requiresKey: false,

  isAvailable() {
    return true;
  },

  async fetch(_ctx: SweepContext): Promise<IntelligenceItem[]> {
    const headers: Record<string, string> = {
      'Accept':     'application/json',
      'User-Agent': 'WorldViewNews/0.1',
    };

    if (config.COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = config.COINGECKO_API_KEY;
    }

    const res = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(15_000),
      headers,
    });

    if (!res.ok) {
      throw new Error(`CoinGecko returned HTTP ${res.status}`);
    }

    const coins = (await res.json()) as CoinMarket[];
    if (!Array.isArray(coins)) {
      throw new Error('CoinGecko response was not an array');
    }

    const items: IntelligenceItem[] = [];

    for (const coin of coins) {
      const pct = coin.price_change_percentage_24h ?? 0;
      const severity = priceChangeSeverity(pct);

      // Only create items for significant moves to avoid noise
      if (Math.abs(pct) < 5) continue;

      const direction = pct >= 0 ? 'up' : 'down';
      const change24h = coin.price_change_24h ?? 0;

      const title =
        `${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price.toLocaleString()} ` +
        `(${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% 24h)`;

      const description =
        `${coin.name} (rank #${coin.market_cap_rank}) is ${direction} ${Math.abs(pct).toFixed(1)}% in the last 24 hours. ` +
        `Current price: $${coin.current_price.toLocaleString()} USD. ` +
        `24h change: ${change24h >= 0 ? '+' : ''}$${change24h.toFixed(2)}. ` +
        `Market cap: $${(coin.market_cap / 1e9).toFixed(2)}B.`;

      items.push({
        id: createId('coingecko', `${coin.id}-${coin.last_updated}`),
        source: 'coingecko-crypto',
        category: 'market',
        title,
        description,
        timestamp: new Date(coin.last_updated),
        severity,
        url: `https://www.coingecko.com/en/coins/${coin.id}`,
        tags: [
          'market',
          'crypto',
          'coingecko',
          coin.symbol.toLowerCase(),
          direction,
        ],
        raw: coin,
      });
    }

    return items;
  },
};

registry.register(source);
export default source;
