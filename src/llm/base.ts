/**
 * LLM Provider base interface for WorldViewNews.
 */

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
}
