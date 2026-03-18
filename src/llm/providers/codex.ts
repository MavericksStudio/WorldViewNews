/**
 * Codex LLM provider — OpenAI-compatible endpoint.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

const codexProvider: LLMProvider = {
  id: 'codex',
  name: 'Codex',

  isAvailable(): boolean {
    return Boolean(config.CODEX_API_KEY);
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const apiKey = config.CODEX_API_KEY;
    if (!apiKey) throw new Error('CODEX_API_KEY not set');

    const maxTokens = options?.maxTokens ?? 1024;

    const messages: ChatMessage[] = [];

    if (options?.systemPrompt !== undefined) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      messages,
      max_tokens: maxTokens,
    };

    if (options?.temperature !== undefined) {
      body['temperature'] = options.temperature;
    }

    const res = await fetch('https://api.codex.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Codex API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as ChatResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error('Codex response contained no choices');
    return choice.message.content;
  },
};

llmRegistry.register(codexProvider);
export default codexProvider;
