/**
 * MiniMax LLM provider — via MiniMax Chat Completion API.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface MinimaxMessage {
  role: 'USER' | 'BOT';
  name: string;
  content: string;
}

interface MinimaxResponse {
  choices: Array<{
    messages: Array<{ role: string; content: string }>;
    finish_reason: string;
  }>;
  reply: string;
}

const minimaxProvider: LLMProvider = {
  id: 'minimax',
  name: 'MiniMax',

  isAvailable(): boolean {
    return Boolean(config.MINIMAX_API_KEY);
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const apiKey = config.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const messages: MinimaxMessage[] = [
      { role: 'USER', name: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model: 'abab6.5s-chat',
      messages,
    };

    if (options?.maxTokens !== undefined) {
      body['tokens_to_generate'] = options.maxTokens;
    }

    if (options?.temperature !== undefined) {
      body['temperature'] = options.temperature;
    }

    const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`MiniMax API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as MinimaxResponse;

    // Try choices first, fallback to reply field
    const choice = data.choices[0];
    if (choice?.messages[0]?.content) {
      return choice.messages[0].content;
    }
    if (data.reply) {
      return data.reply;
    }

    throw new Error('MiniMax response contained no content');
  },
};

llmRegistry.register(minimaxProvider);
export default minimaxProvider;
