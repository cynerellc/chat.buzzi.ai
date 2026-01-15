/**
 * Call Execution Providers
 *
 * Exports all available real-time voice AI providers:
 * - OpenAI Realtime API (GPT-4 Realtime)
 * - Google Gemini Live API
 */

export { OpenAIRealtimeExecutor, createOpenAIRealtimeExecutor } from "./openai-realtime";
export { GeminiLiveExecutor, createGeminiLiveExecutor } from "./gemini-live";
