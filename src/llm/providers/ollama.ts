/**
 * Ollama LLM provider — local inference via Ollama.
 * Always considered available (has a default URL), but may fail if Ollama is not running.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

const ollamaProvider: LLMProvider = {
  id: 'ollama',
  name: 'Ollama (local)',

  isAvailable(): boolean {
    // Only available if explicitly enabled via OLLAMA_ENABLED=true
    // or if a non-default OLLAMA_BASE_URL was explicitly set by the user
    return process.env['OLLAMA_ENABLED'] === 'true' ||
      (process.env['OLLAMA_BASE_URL'] !== undefined && Boolean(config.OLLAMA_BASE_URL));
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const baseUrl = config.OLLAMA_BASE_URL;
    const model = process.env['OLLAMA_MODEL'] || 'gemma3';
    const url = `${baseUrl}/api/generate`;

    const body: Record<string, unknown> = {
      model,
      prompt,
      stream: false,
    };

    if (options?.systemPrompt !== undefined) {
      body['system'] = options.systemPrompt;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Ollama returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as OllamaResponse;
    return data.response;
  },
};

llmRegistry.register(ollamaProvider);
export default ollamaProvider;
