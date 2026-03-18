/**
 * OpenAI LLM provider — GPT via OpenAI Chat Completions API.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

const openaiProvider: LLMProvider = {
  id: 'openai',
  name: 'OpenAI (GPT)',

  isAvailable(): boolean {
    return Boolean(config.OPENAI_API_KEY);
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const apiKey = config.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const model = 'gpt-4o-mini';
    const maxTokens = options?.maxTokens ?? 1024;

    const messages: OpenAIChatMessage[] = [];

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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as OpenAIResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error('OpenAI response contained no choices');
    return choice.message.content;
  },
};

llmRegistry.register(openaiProvider);
export default openaiProvider;
