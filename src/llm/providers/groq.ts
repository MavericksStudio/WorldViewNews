/**
 * Groq LLM provider — free-tier inference via Groq's LPU hardware.
 * Uses OpenAI-compatible Chat Completions API.
 * Free tier: 30 RPM / 14,400 RPD for Llama 3.3 70B — more than enough for sweep summaries.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

const groqProvider: LLMProvider = {
  id: 'groq',
  name: 'Groq (LPU)',

  isAvailable(): boolean {
    return Boolean(config.GROQ_API_KEY);
  },

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const apiKey = config.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const model = process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile';
    const maxTokens = options?.maxTokens ?? 1024;

    const messages: GroqChatMessage[] = [];

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

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Groq API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as GroqResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error('Groq response contained no choices');
    return choice.message.content;
  },
};

llmRegistry.register(groqProvider);
export default groqProvider;
