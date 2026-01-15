/**
 * Audio Converter Utilities
 *
 * Provides codec conversions and sample rate transformations for call audio.
 * Supports PCM16, mulaw, and Opus formats at various sample rates.
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/utils/audio-converter.js
 */

// ============================================================================
// Constants
// ============================================================================

// Mulaw encoding/decoding tables
const MULAW_MAX = 0x1fff;
const MULAW_BIAS = 33;
const MULAW_CLIP = 32635;

// Precomputed mulaw encode table
const MULAW_ENCODE_TABLE = buildMulawEncodeTable();

// Precomputed mulaw decode table
const MULAW_DECODE_TABLE = buildMulawDecodeTable();

// ============================================================================
// Mulaw Conversion
// ============================================================================

/**
 * Convert mulaw encoded audio to PCM16
 */
export function mulawToPCM16(mulawData: Buffer): Buffer {
  const pcm16Data = Buffer.alloc(mulawData.length * 2);

  for (let i = 0; i < mulawData.length; i++) {
    const mulawSample = mulawData[i];
    if (mulawSample !== undefined) {
      const pcmSample = MULAW_DECODE_TABLE[mulawSample] ?? 0;
      pcm16Data.writeInt16LE(pcmSample, i * 2);
    }
  }

  return pcm16Data;
}

/**
 * Convert PCM16 audio to mulaw
 */
export function pcm16ToMulaw(pcm16Data: Buffer): Buffer {
  const mulawData = Buffer.alloc(pcm16Data.length / 2);

  for (let i = 0; i < pcm16Data.length / 2; i++) {
    const pcmSample = pcm16Data.readInt16LE(i * 2);
    mulawData[i] = encodeMulaw(pcmSample);
  }

  return mulawData;
}

/**
 * Encode a single PCM16 sample to mulaw
 */
function encodeMulaw(sample: number): number {
  // Get the sign bit
  const sign = sample < 0 ? 0x80 : 0;

  // Get absolute value, clipped
  let abs = Math.min(Math.abs(sample), MULAW_CLIP);

  // Add bias
  abs += MULAW_BIAS;

  // Find segment
  let segment = 7;
  for (let i = 0; i < 8; i++) {
    if (abs <= (1 << (i + 8))) {
      segment = i;
      break;
    }
  }

  // Combine segments
  const mantissa = (abs >> (segment + 3)) & 0x0f;
  const mulawByte = ~(sign | (segment << 4) | mantissa) & 0xff;

  return mulawByte;
}

/**
 * Build mulaw encode table (for optimization if needed)
 */
function buildMulawEncodeTable(): Uint8Array {
  const table = new Uint8Array(65536);
  for (let i = 0; i < 65536; i++) {
    const sample = i < 32768 ? i : i - 65536;
    table[i] = encodeMulaw(sample);
  }
  return table;
}

/**
 * Build mulaw decode table
 */
function buildMulawDecodeTable(): Int16Array {
  const table = new Int16Array(256);

  for (let i = 0; i < 256; i++) {
    const mulaw = ~i;
    const sign = mulaw & 0x80;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0f;

    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
    sample -= MULAW_BIAS;

    table[i] = sign ? -sample : sample;
  }

  return table;
}

// ============================================================================
// Opus Conversion (requires @discordjs/opus)
// ============================================================================

// Opus encoder/decoder instances are lazily loaded
let opusEncoder: ReturnType<typeof createOpusEncoder> | null = null;

interface OpusEncoder {
  encode: (buffer: Buffer) => Buffer;
  decode: (buffer: Buffer) => Buffer;
}

/**
 * Create Opus encoder/decoder
 * Requires @discordjs/opus package
 */
function createOpusEncoder(sampleRate: number = 48000, channels: number = 1): OpusEncoder | null {
  try {
    // Dynamic import to avoid build errors if opus not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpusEncoder: OpusEncoderClass } = require("@discordjs/opus");
    return new OpusEncoderClass(sampleRate, channels);
  } catch {
    console.warn(
      "[AudioConverter] @discordjs/opus not available. Opus encoding/decoding disabled."
    );
    return null;
  }
}

/**
 * Decode Opus audio to PCM16
 */
export function decodeOpus(opusData: Buffer, sampleRate: number = 48000): Buffer {
  if (!opusEncoder) {
    opusEncoder = createOpusEncoder(sampleRate, 1);
  }

  if (!opusEncoder) {
    throw new Error("Opus decoder not available. Install @discordjs/opus package.");
  }

  return opusEncoder.decode(opusData);
}

/**
 * Encode PCM16 audio to Opus
 */
export function encodeOpus(pcm16Data: Buffer, sampleRate: number = 48000): Buffer {
  if (!opusEncoder) {
    opusEncoder = createOpusEncoder(sampleRate, 1);
  }

  if (!opusEncoder) {
    throw new Error("Opus encoder not available. Install @discordjs/opus package.");
  }

  return opusEncoder.encode(pcm16Data);
}

// ============================================================================
// Sample Rate Conversion
// ============================================================================

/**
 * Resample PCM16 audio using linear interpolation
 * For production, consider using libsamplerate-js for higher quality
 */
export function resamplePCM16(
  pcm16Data: Buffer,
  inputRate: number,
  outputRate: number
): Buffer {
  if (inputRate === outputRate) {
    return pcm16Data;
  }

  const inputSamples = pcm16Data.length / 2;
  const ratio = inputRate / outputRate;
  const outputSamples = Math.floor(inputSamples / ratio);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
    const fraction = srcIndex - srcIndexFloor;

    const sample1 = pcm16Data.readInt16LE(srcIndexFloor * 2);
    const sample2 = pcm16Data.readInt16LE(srcIndexCeil * 2);

    // Linear interpolation
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), i * 2);
  }

  return output;
}

/**
 * High-quality resampling using libsamplerate-js (if available)
 * Falls back to linear interpolation if not installed
 */
export async function resamplePCM16HQ(
  pcm16Data: Buffer,
  inputRate: number,
  outputRate: number
): Promise<Buffer> {
  if (inputRate === outputRate) {
    return pcm16Data;
  }

  try {
    // Try to use libsamplerate-js for high-quality resampling
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { create } = require("@alexanderolsen/libsamplerate-js");

    const resampler = await create(1, inputRate, outputRate);

    // Convert Buffer to Float32Array
    const inputSamples = pcm16Data.length / 2;
    const floatInput = new Float32Array(inputSamples);
    for (let i = 0; i < inputSamples; i++) {
      floatInput[i] = pcm16Data.readInt16LE(i * 2) / 32768;
    }

    // Resample
    const floatOutput = resampler.full(floatInput);
    resampler.destroy();

    // Convert back to PCM16 Buffer
    const output = Buffer.alloc(floatOutput.length * 2);
    for (let i = 0; i < floatOutput.length; i++) {
      const sample = Math.max(-1, Math.min(1, floatOutput[i]));
      output.writeInt16LE(Math.round(sample * 32767), i * 2);
    }

    return output;
  } catch {
    // Fall back to linear interpolation
    console.warn(
      "[AudioConverter] libsamplerate-js not available, using linear interpolation"
    );
    return resamplePCM16(pcm16Data, inputRate, outputRate);
  }
}

// ============================================================================
// Channel Conversion
// ============================================================================

/**
 * Convert stereo PCM16 to mono by averaging channels
 */
export function stereoToMono(stereoBuffer: Buffer): Buffer {
  const sampleCount = stereoBuffer.length / 4; // 2 channels * 2 bytes per sample
  const monoBuffer = Buffer.alloc(sampleCount * 2);

  for (let i = 0; i < sampleCount; i++) {
    const left = stereoBuffer.readInt16LE(i * 4);
    const right = stereoBuffer.readInt16LE(i * 4 + 2);
    const mono = Math.round((left + right) / 2);
    monoBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, mono)), i * 2);
  }

  return monoBuffer;
}

/**
 * Convert mono PCM16 to stereo by duplicating samples
 */
export function monoToStereo(monoBuffer: Buffer): Buffer {
  const sampleCount = monoBuffer.length / 2;
  const stereoBuffer = Buffer.alloc(sampleCount * 4);

  for (let i = 0; i < sampleCount; i++) {
    const sample = monoBuffer.readInt16LE(i * 2);
    stereoBuffer.writeInt16LE(sample, i * 4); // Left channel
    stereoBuffer.writeInt16LE(sample, i * 4 + 2); // Right channel
  }

  return stereoBuffer;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate RMS (Root Mean Square) volume level
 * Returns a value between 0 and 1
 */
export function calculateRMS(pcm16Data: Buffer): number {
  if (pcm16Data.length === 0) return 0;

  const sampleCount = pcm16Data.length / 2;
  let sumSquares = 0;

  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm16Data.readInt16LE(i * 2) / 32768;
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / sampleCount);
}

/**
 * Check if audio buffer contains silence (below threshold)
 */
export function isSilence(pcm16Data: Buffer, threshold: number = 0.01): boolean {
  return calculateRMS(pcm16Data) < threshold;
}

/**
 * Normalize audio to a target peak level
 */
export function normalizeAudio(pcm16Data: Buffer, targetPeak: number = 0.9): Buffer {
  const sampleCount = pcm16Data.length / 2;

  // Find current peak
  let maxAbs = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = Math.abs(pcm16Data.readInt16LE(i * 2));
    if (sample > maxAbs) maxAbs = sample;
  }

  if (maxAbs === 0) return pcm16Data;

  // Calculate normalization factor
  const factor = (targetPeak * 32767) / maxAbs;
  if (factor >= 1) return pcm16Data; // Already at or above target

  // Apply normalization
  const normalized = Buffer.alloc(pcm16Data.length);
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm16Data.readInt16LE(i * 2);
    const newSample = Math.round(sample * factor);
    normalized.writeInt16LE(Math.max(-32768, Math.min(32767, newSample)), i * 2);
  }

  return normalized;
}

/**
 * Convert audio format for a specific provider
 */
export interface ConvertOptions {
  inputSampleRate: number;
  outputSampleRate: number;
  inputChannels?: number;
  outputChannels?: number;
}

export async function convertForProvider(
  audioData: Buffer,
  provider: "openai" | "gemini",
  options?: Partial<ConvertOptions>
): Promise<Buffer> {
  let result = audioData;

  // Default sample rates
  const defaults: Record<string, ConvertOptions> = {
    openai: { inputSampleRate: 16000, outputSampleRate: 24000, inputChannels: 1, outputChannels: 1 },
    gemini: { inputSampleRate: 24000, outputSampleRate: 16000, inputChannels: 1, outputChannels: 1 },
  };

  const providerDefaults = defaults[provider];
  if (!providerDefaults) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const config: ConvertOptions = { ...providerDefaults, ...options };

  // Convert sample rate if needed
  if (config.inputSampleRate !== config.outputSampleRate) {
    result = await resamplePCM16HQ(result, config.inputSampleRate, config.outputSampleRate);
  }

  // Convert channels if needed
  if (config.inputChannels !== config.outputChannels) {
    if (config.inputChannels === 2 && config.outputChannels === 1) {
      result = stereoToMono(result);
    } else if (config.inputChannels === 1 && config.outputChannels === 2) {
      result = monoToStereo(result);
    }
  }

  return result;
}

// ============================================================================
// WebRTC to AI Provider Conversion
// ============================================================================

/**
 * Convert WebRTC audio to AI provider format
 * Handles codec decoding, stereo to mono conversion, and resampling
 *
 * @param audioData - Raw audio data from WebRTC
 * @param codec - Source codec (PCMU, PCMA, opus, G722, L16)
 * @param inputRate - Source sample rate
 * @param outputRate - Target sample rate for AI provider
 * @returns Base64 encoded PCM16 audio at target sample rate
 */
export async function webrtcToAI(
  audioData: Buffer,
  codec: string = "PCMU",
  inputRate: number = 8000,
  outputRate: number = 24000
): Promise<string> {
  let pcm16Data: Buffer;

  // Step 1: Decode to PCM16 based on codec
  switch (codec.toUpperCase()) {
    case "PCMU":
    case "PCMA":
      // Mulaw/Alaw to PCM16
      pcm16Data = mulawToPCM16(audioData);
      break;

    case "OPUS":
      // Opus to PCM16 (stereo at 48kHz typically)
      pcm16Data = decodeOpus(audioData, inputRate);
      break;

    case "G722":
      // G.722 is typically 16kHz, treat as PCM16 for now
      // Note: Full G.722 decoding would require additional library
      pcm16Data = audioData;
      break;

    case "L16":
    case "PCM16":
      // Already PCM16
      pcm16Data = audioData;
      break;

    default:
      // Assume PCM16 for unknown codecs
      console.warn(`[AudioConverter] Unknown codec: ${codec}, assuming PCM16`);
      pcm16Data = audioData;
  }

  // Step 2: Convert stereo to mono if needed (Opus from WebRTC is often stereo)
  if (codec.toUpperCase() === "OPUS" && pcm16Data.length > 0) {
    // Check if stereo by comparing expected mono length
    const expectedMonoLength = (pcm16Data.length / 4) * 2;
    if (pcm16Data.length > expectedMonoLength * 1.5) {
      pcm16Data = stereoToMono(pcm16Data);
    }
  }

  // Step 3: Resample to target rate
  if (inputRate !== outputRate) {
    pcm16Data = await resamplePCM16HQ(pcm16Data, inputRate, outputRate);
  }

  // Step 4: Return as base64
  return pcm16Data.toString("base64");
}

/**
 * Convert WebRTC audio to OpenAI Realtime API format
 * OpenAI expects PCM16 mono at 24kHz
 *
 * @param audioData - Raw audio data from WebRTC
 * @param codec - Source codec (PCMU, PCMA, opus, etc.)
 * @param inputRate - Source sample rate (default 8000 for PCMU, 48000 for Opus)
 * @returns Base64 encoded PCM16 audio at 24kHz
 */
export async function webrtcToOpenAI(
  audioData: Buffer,
  codec: string = "PCMU",
  inputRate: number = 8000
): Promise<string> {
  return webrtcToAI(audioData, codec, inputRate, 24000);
}

/**
 * Convert WebRTC audio to Google Gemini Live API format
 * Gemini expects PCM16 mono at 16kHz
 *
 * @param audioData - Raw audio data from WebRTC
 * @param codec - Source codec (PCMU, PCMA, opus, etc.)
 * @param inputRate - Source sample rate (default 8000 for PCMU, 48000 for Opus)
 * @returns Base64 encoded PCM16 audio at 16kHz
 */
export async function webrtcToGemini(
  audioData: Buffer,
  codec: string = "PCMU",
  inputRate: number = 8000
): Promise<string> {
  return webrtcToAI(audioData, codec, inputRate, 16000);
}

/**
 * Convert AI provider audio to WebRTC format
 * AI providers output PCM16 at 24kHz (OpenAI) or 24kHz (Gemini output)
 * WebRTC typically needs 48kHz stereo for Opus encoding
 *
 * @param audioData - PCM16 audio from AI provider
 * @param inputRate - AI provider output rate (24000 for both)
 * @param outputRate - Target rate for WebRTC (48000 for Opus)
 * @param outputCodec - Target codec (opus, PCMU, etc.)
 * @returns Audio data in WebRTC-compatible format
 */
export async function aiToWebRTC(
  audioData: Buffer,
  inputRate: number = 24000,
  outputRate: number = 48000,
  outputCodec: string = "opus"
): Promise<Buffer> {
  let result = audioData;

  // Step 1: Resample if needed
  if (inputRate !== outputRate) {
    result = await resamplePCM16HQ(result, inputRate, outputRate);
  }

  // Step 2: Convert mono to stereo for WebRTC (Opus typically expects stereo)
  if (outputCodec.toLowerCase() === "opus") {
    result = monoToStereo(result);
  }

  // Step 3: Encode if needed
  switch (outputCodec.toUpperCase()) {
    case "OPUS":
      // For now, return PCM16 stereo - encoding happens at WebRTC layer
      // result = encodeOpus(result, outputRate);
      break;

    case "PCMU":
    case "PCMA":
      // Convert stereo back to mono for mulaw
      result = stereoToMono(result);
      result = pcm16ToMulaw(result);
      break;

    case "L16":
    case "PCM16":
      // Already PCM16
      break;
  }

  return result;
}
