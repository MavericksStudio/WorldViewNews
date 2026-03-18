/**
 * Anthropic LLM provider — Claude via Anthropic Messages API.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
}

const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  name: 'Anthropic (Claude)',

  isAvailable(): boolean {
    return Boolean(config.ANTHROPIC_API_KEY);
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const apiKey = config.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const model = 'claude-sonnet-4-20250514';
    const maxTokens = options?.maxTokens ?? 1024;

    const messages: AnthropicMessage[] = [
      { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages,
    };

    if (options?.systemPrompt !== undefined) {
      body['system'] = options.systemPrompt;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const textBlock = data.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('Anthropic response contained no text block');
    return textBlock.text;
  },
};

llmRegistry.register(anthropicProvider);
export default anthropicProvider;
