/**
 * OpenRouter LLM provider — multi-model routing via openrouter.ai.
 * Uses OpenAI-compatible chat completions format.
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

const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  name: 'OpenRouter',

  isAvailable(): boolean {
    return Boolean(config.OPENROUTER_API_KEY);
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const apiKey = config.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

    const model = 'anthropic/claude-sonnet-4-20250514';
    const maxTokens = options?.maxTokens ?? 1024;

    const messages: ChatMessage[] = [];

    if (options?.systemPrompt !== undefined) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
    };

    if (options?.temperature !== undefined) {
      body['temperature'] = options.temperature;
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'worldviewnews',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as ChatResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error('OpenRouter response contained no choices');
    return choice.message.content;
  },
};

llmRegistry.register(openrouterProvider);
export default openrouterProvider;
