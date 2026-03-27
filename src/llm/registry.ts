/**
 * LLM Registry — provider chain with ordered fallback.
 * Tries providers in priority order: ollama → anthropic → openai → gemini → openrouter → codex → minimax
 */

import type { LLMProvider, CompletionOptions } from './base.js';
import { logger } from '../logger.js';

const PROVIDER_ORDER = [
  'ollama',
  'anthropic',
  'openai',
  'groq',
  'gemini',
  'openrouter',
  'codex',
  'minimax',
];

export interface LLMRegistry {
  register(provider: LLMProvider): void;
  getAvailable(): LLMProvider[];
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  isAnyAvailable(): boolean;
}

class LLMRegistryImpl implements LLMRegistry {
  private readonly providers: Map<string, LLMProvider> = new Map();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    logger.debug('llm: provider registered', { id: provider.id, name: provider.name });
  }

  /** Returns available providers in priority order. */
  getAvailable(): LLMProvider[] {
    const ordered: LLMProvider[] = [];

    // Add in priority order first
    for (const id of PROVIDER_ORDER) {
      const p = this.providers.get(id);
      if (p !== undefined && p.isAvailable()) {
        ordered.push(p);
      }
    }

    // Add any remaining registered providers not in the priority list
    for (const [id, p] of this.providers) {
      if (!PROVIDER_ORDER.includes(id) && p.isAvailable()) {
        ordered.push(p);
      }
    }

    return ordered;
  }

  isAnyAvailable(): boolean {
    return this.getAvailable().length > 0;
  }

  /** Tries each provider in priority order, falling back on failure. */
  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const available = this.getAvailable();

    if (available.length === 0) {
      logger.warn('llm: no provider available');
      throw new Error('No LLM provider available');
    }

    let lastError: Error | undefined;
    for (const provider of available) {
      try {
        logger.debug('llm: trying provider', { id: provider.id });
        const result = await provider.complete(prompt, options);
        logger.info('llm: completion succeeded', { provider: provider.id });
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn('llm: provider failed, trying next', {
          provider: provider.id,
          err: lastError.message,
        });
      }
    }

    logger.error('llm: all providers failed');
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message ?? 'unknown'}`);
  }
}

/** Singleton LLM registry shared across the application. */
export const llmRegistry: LLMRegistry = new LLMRegistryImpl();
