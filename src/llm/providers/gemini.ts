/**
 * Google Gemini LLM provider — via Generative Language API.
 */

import type { LLMProvider, CompletionOptions } from '../base.js';
import { llmRegistry } from '../registry.js';
import { config } from '../../config.js';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
}

const geminiProvider: LLMProvider = {
  id: 'gemini',
  name: 'Google Gemini',

  isAvailable(): boolean {
    return Boolean(config.GEMINI_API_KEY);
  },

  async complete(prompt: string, _options?: CompletionOptions): Promise<string> {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const candidate = data.candidates[0];
    if (!candidate) throw new Error('Gemini response contained no candidates');

    const textPart = candidate.content.parts.find((p) => 'text' in p);
    if (!textPart) throw new Error('Gemini response contained no text part');
    return textPart.text;
  },
};

llmRegistry.register(geminiProvider);
export default geminiProvider;
