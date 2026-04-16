import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type VlmProvider = 'gemini' | 'qwen';

/**
 * Create a multimodal VLM instance based on environment configuration.
 *
 * Env vars:
 *   VLM_PROVIDER  — 'gemini' (default) or 'qwen'
 *   VLM_MODEL     — model name override
 *   GOOGLE_API_KEY — required for gemini
 *   DASHSCOPE_API_KEY — required for qwen
 */
export function createVlm(
  providerOverride?: VlmProvider,
  modelOverride?: string,
): BaseChatModel {
  const provider = providerOverride ?? (process.env.VLM_PROVIDER as VlmProvider) ?? 'gemini';

  if (provider === 'qwen') {
    const model = modelOverride ?? process.env.VLM_MODEL ?? 'qwen-vl-plus';
    return new ChatOpenAI({
      model,
      apiKey: process.env.DASHSCOPE_API_KEY,
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
      temperature: 0.2,
      maxTokens: 1024,
    });
  }

  // Default: Gemini
  const model = modelOverride ?? process.env.VLM_MODEL ?? 'gemini-2.0-flash';
  return new ChatGoogleGenerativeAI({
    model,
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });
}
