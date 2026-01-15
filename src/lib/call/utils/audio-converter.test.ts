/**
 * Audio Converter Unit Tests
 *
 * Tests for audio codec conversion, resampling, and utility functions.
 */

import { describe, expect, it, vi } from "vitest";

import {
  mulawToPCM16,
  pcm16ToMulaw,
  resamplePCM16,
  stereoToMono,
  monoToStereo,
  calculateRMS,
  isSilence,
  normalizeAudio,
} from "./audio-converter";

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate a sine wave PCM16 buffer
 */
function generateSineWave(
  frequency: number,
  sampleRate: number,
  durationMs: number,
  amplitude: number = 0.5
): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * frequency * t));
    buffer.writeInt16LE(sample, i * 2);
  }

  return buffer;
}

/**
 * Generate silence PCM16 buffer
 */
function generateSilence(sampleRate: number, durationMs: number): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  return Buffer.alloc(numSamples * 2);
}

/**
 * Generate stereo PCM16 buffer from two mono sources
 */
function generateStereo(left: Buffer, right: Buffer): Buffer {
  if (left.length !== right.length) {
    throw new Error("Left and right channels must have the same length");
  }

  const numSamples = left.length / 2;
  const stereo = Buffer.alloc(numSamples * 4);

  for (let i = 0; i < numSamples; i++) {
    stereo.writeInt16LE(left.readInt16LE(i * 2), i * 4);
    stereo.writeInt16LE(right.readInt16LE(i * 2), i * 4 + 2);
  }

  return stereo;
}

// ============================================================================
// Mulaw Conversion Tests
// ============================================================================

describe("Mulaw Conversion", () => {
  describe("mulawToPCM16", () => {
    it("should convert empty buffer", () => {
      const mulaw = Buffer.alloc(0);
      const pcm16 = mulawToPCM16(mulaw);
      expect(pcm16.length).toBe(0);
    });

    it("should double the buffer size (1 byte mulaw → 2 bytes PCM16)", () => {
      const mulaw = Buffer.alloc(100);
      const pcm16 = mulawToPCM16(mulaw);
      expect(pcm16.length).toBe(200);
    });

    it("should decode mulaw silence (0xFF) to near-zero PCM16", () => {
      const mulaw = Buffer.alloc(10, 0xff); // Mulaw silence
      const pcm16 = mulawToPCM16(mulaw);

      // All samples should be close to zero
      for (let i = 0; i < pcm16.length / 2; i++) {
        const sample = pcm16.readInt16LE(i * 2);
        expect(Math.abs(sample)).toBeLessThan(100);
      }
    });

    it("should produce valid PCM16 range (-32768 to 32767)", () => {
      // Generate various mulaw values
      const mulaw = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        mulaw[i] = i;
      }

      const pcm16 = mulawToPCM16(mulaw);

      for (let i = 0; i < pcm16.length / 2; i++) {
        const sample = pcm16.readInt16LE(i * 2);
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);
      }
    });
  });

  describe("pcm16ToMulaw", () => {
    it("should convert empty buffer", () => {
      const pcm16 = Buffer.alloc(0);
      const mulaw = pcm16ToMulaw(pcm16);
      expect(mulaw.length).toBe(0);
    });

    it("should halve the buffer size (2 bytes PCM16 → 1 byte mulaw)", () => {
      const pcm16 = Buffer.alloc(200);
      const mulaw = pcm16ToMulaw(pcm16);
      expect(mulaw.length).toBe(100);
    });

    it("should encode silence (zero) to mulaw silence", () => {
      const pcm16 = Buffer.alloc(20, 0);
      const mulaw = pcm16ToMulaw(pcm16);

      // All samples should be similar (encoding zero)
      const firstValue = mulaw[0];
      for (let i = 1; i < mulaw.length; i++) {
        expect(mulaw[i]).toBe(firstValue);
      }
    });
  });

  describe("roundtrip conversion", () => {
    it("should approximately preserve audio through PCM16 → mulaw → PCM16", () => {
      // Start with PCM16 data (sine wave)
      const originalPCM16 = generateSineWave(440, 8000, 100, 0.5);

      const mulaw = pcm16ToMulaw(originalPCM16);
      const backToPCM16 = mulawToPCM16(mulaw);

      // Calculate correlation between original and converted
      // Mulaw is lossy, so we check signal correlation not exact values
      const sampleCount = originalPCM16.length / 2;
      let sumProduct = 0;
      let sumOrigSq = 0;
      let sumConvSq = 0;

      for (let i = 0; i < sampleCount; i++) {
        const original = originalPCM16.readInt16LE(i * 2);
        const converted = backToPCM16.readInt16LE(i * 2);
        sumProduct += original * converted;
        sumOrigSq += original * original;
        sumConvSq += converted * converted;
      }

      // Calculate correlation coefficient
      const correlation = sumProduct / Math.sqrt(sumOrigSq * sumConvSq);

      // Correlation should be high (> 0.9) indicating signal shape is preserved
      expect(correlation).toBeGreaterThan(0.9);
    });
  });
});

// ============================================================================
// Sample Rate Conversion Tests
// ============================================================================

describe("Sample Rate Conversion", () => {
  describe("resamplePCM16", () => {
    it("should return same buffer if rates are equal", () => {
      const input = generateSineWave(440, 16000, 100);
      const output = resamplePCM16(input, 16000, 16000);

      expect(output).toEqual(input);
    });

    it("should downsample correctly (48kHz → 16kHz)", () => {
      const input = generateSineWave(440, 48000, 100);
      const output = resamplePCM16(input, 48000, 16000);

      // Output should be 1/3 the size
      const expectedLength = Math.floor(input.length / 2 / 3) * 2;
      expect(output.length).toBeCloseTo(expectedLength, -1);
    });

    it("should upsample correctly (16kHz → 48kHz)", () => {
      const input = generateSineWave(440, 16000, 100);
      const output = resamplePCM16(input, 16000, 48000);

      // Output should be 3x the size
      const expectedLength = Math.floor((input.length / 2) * 3) * 2;
      expect(output.length).toBeCloseTo(expectedLength, -1);
    });

    it("should maintain valid PCM16 range after resampling", () => {
      const input = generateSineWave(440, 16000, 100, 0.9);
      const output = resamplePCM16(input, 16000, 24000);

      for (let i = 0; i < output.length / 2; i++) {
        const sample = output.readInt16LE(i * 2);
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);
      }
    });

    it("should handle small buffers", () => {
      // 2 samples at 8kHz
      const input = Buffer.alloc(4);
      input.writeInt16LE(1000, 0);
      input.writeInt16LE(-1000, 2);

      const output = resamplePCM16(input, 8000, 16000);
      expect(output.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Channel Conversion Tests
// ============================================================================

describe("Channel Conversion", () => {
  describe("stereoToMono", () => {
    it("should halve the buffer size", () => {
      const left = generateSineWave(440, 16000, 100);
      const right = generateSineWave(880, 16000, 100);
      const stereo = generateStereo(left, right);

      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(stereo.length / 2);
    });

    it("should average left and right channels", () => {
      // Create stereo with known values
      const stereo = Buffer.alloc(8); // 2 samples
      stereo.writeInt16LE(1000, 0); // L1
      stereo.writeInt16LE(2000, 2); // R1
      stereo.writeInt16LE(-1000, 4); // L2
      stereo.writeInt16LE(-2000, 6); // R2

      const mono = stereoToMono(stereo);

      expect(mono.readInt16LE(0)).toBe(1500); // (1000 + 2000) / 2
      expect(mono.readInt16LE(2)).toBe(-1500); // (-1000 + -2000) / 2
    });

    it("should handle identical channels", () => {
      const mono = generateSineWave(440, 16000, 50);
      const stereo = generateStereo(mono, mono);

      const backToMono = stereoToMono(stereo);

      // Should be approximately equal to original
      for (let i = 0; i < mono.length / 2; i++) {
        const original = mono.readInt16LE(i * 2);
        const converted = backToMono.readInt16LE(i * 2);
        expect(Math.abs(original - converted)).toBeLessThan(2);
      }
    });
  });

  describe("monoToStereo", () => {
    it("should double the buffer size", () => {
      const mono = generateSineWave(440, 16000, 100);
      const stereo = monoToStereo(mono);

      expect(stereo.length).toBe(mono.length * 2);
    });

    it("should duplicate samples to both channels", () => {
      const mono = Buffer.alloc(4);
      mono.writeInt16LE(1234, 0);
      mono.writeInt16LE(-5678, 2);

      const stereo = monoToStereo(mono);

      // First sample
      expect(stereo.readInt16LE(0)).toBe(1234); // L1
      expect(stereo.readInt16LE(2)).toBe(1234); // R1
      // Second sample
      expect(stereo.readInt16LE(4)).toBe(-5678); // L2
      expect(stereo.readInt16LE(6)).toBe(-5678); // R2
    });
  });

  describe("roundtrip conversion", () => {
    it("should preserve mono audio through mono → stereo → mono", () => {
      const original = generateSineWave(440, 16000, 50);
      const stereo = monoToStereo(original);
      const backToMono = stereoToMono(stereo);

      // Should match original exactly
      expect(backToMono.length).toBe(original.length);
      for (let i = 0; i < original.length / 2; i++) {
        expect(backToMono.readInt16LE(i * 2)).toBe(original.readInt16LE(i * 2));
      }
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("Utility Functions", () => {
  describe("calculateRMS", () => {
    it("should return 0 for empty buffer", () => {
      expect(calculateRMS(Buffer.alloc(0))).toBe(0);
    });

    it("should return 0 for silence", () => {
      const silence = generateSilence(16000, 100);
      expect(calculateRMS(silence)).toBe(0);
    });

    it("should return higher value for louder audio", () => {
      const quiet = generateSineWave(440, 16000, 100, 0.1);
      const loud = generateSineWave(440, 16000, 100, 0.9);

      const quietRMS = calculateRMS(quiet);
      const loudRMS = calculateRMS(loud);

      expect(loudRMS).toBeGreaterThan(quietRMS);
    });

    it("should return value between 0 and 1 for normalized audio", () => {
      const audio = generateSineWave(440, 16000, 100, 0.5);
      const rms = calculateRMS(audio);

      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThanOrEqual(1);
    });
  });

  describe("isSilence", () => {
    it("should return true for zero-filled buffer", () => {
      const silence = generateSilence(16000, 100);
      expect(isSilence(silence)).toBe(true);
    });

    it("should return false for loud audio", () => {
      const audio = generateSineWave(440, 16000, 100, 0.5);
      expect(isSilence(audio)).toBe(false);
    });

    it("should respect custom threshold", () => {
      const quietAudio = generateSineWave(440, 16000, 100, 0.05);

      // With default threshold (0.01), should not be silence
      expect(isSilence(quietAudio, 0.01)).toBe(false);

      // With higher threshold (0.1), should be silence
      expect(isSilence(quietAudio, 0.1)).toBe(true);
    });
  });

  describe("normalizeAudio", () => {
    it("should return same buffer for silence", () => {
      const silence = generateSilence(16000, 100);
      const normalized = normalizeAudio(silence);
      expect(normalized).toEqual(silence);
    });

    it("should return same buffer if already at target", () => {
      // Generate audio with peak at exactly target
      const audio = generateSineWave(440, 16000, 100, 0.9);
      const normalized = normalizeAudio(audio, 0.9);

      // Should be essentially the same (or same reference)
      expect(normalized.length).toBe(audio.length);
    });

    it("should reduce loud audio to target level", () => {
      // Generate audio with peak above target
      const loud = generateSineWave(440, 16000, 100, 0.99);
      const normalized = normalizeAudio(loud, 0.5);

      const loudRMS = calculateRMS(loud);
      const normalizedRMS = calculateRMS(normalized);

      // Normalized should be quieter
      expect(normalizedRMS).toBeLessThan(loudRMS);
    });

    it("should not change audio already at or below target", () => {
      const quiet = generateSineWave(440, 16000, 100, 0.1);
      const normalized = normalizeAudio(quiet, 0.9);

      // Audio at 0.1 amplitude is below 0.9 target, so should remain unchanged
      expect(normalized.length).toBe(quiet.length);
    });

    it("should maintain valid PCM16 range", () => {
      const audio = generateSineWave(440, 16000, 100, 0.3);
      const normalized = normalizeAudio(audio, 0.99);

      for (let i = 0; i < normalized.length / 2; i++) {
        const sample = normalized.readInt16LE(i * 2);
        expect(sample).toBeGreaterThanOrEqual(-32768);
        expect(sample).toBeLessThanOrEqual(32767);
      }
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  it("should handle single sample buffers", () => {
    const single = Buffer.alloc(2);
    single.writeInt16LE(12345, 0);

    // Mulaw conversion
    const mulaw = pcm16ToMulaw(single);
    expect(mulaw.length).toBe(1);

    // Channel conversion
    const stereo = monoToStereo(single);
    expect(stereo.length).toBe(4);

    // RMS calculation
    const rms = calculateRMS(single);
    expect(rms).toBeGreaterThan(0);
  });

  it("should handle maximum amplitude values", () => {
    const maxPositive = Buffer.alloc(2);
    maxPositive.writeInt16LE(32767, 0);

    const maxNegative = Buffer.alloc(2);
    maxNegative.writeInt16LE(-32768, 0);

    // Should not throw
    expect(() => pcm16ToMulaw(maxPositive)).not.toThrow();
    expect(() => pcm16ToMulaw(maxNegative)).not.toThrow();
    expect(() => monoToStereo(maxPositive)).not.toThrow();
  });

  it("should handle valid stereo buffer correctly", () => {
    // Valid stereo buffer (8 bytes = 2 stereo samples)
    const stereo = Buffer.alloc(8);
    stereo.writeInt16LE(1000, 0);  // L1
    stereo.writeInt16LE(2000, 2);  // R1
    stereo.writeInt16LE(3000, 4);  // L2
    stereo.writeInt16LE(4000, 6);  // R2

    const mono = stereoToMono(stereo);
    // 8 bytes stereo = 2 samples, so mono should be 4 bytes
    expect(mono.length).toBe(4);
    expect(mono.readInt16LE(0)).toBe(1500); // (1000 + 2000) / 2
    expect(mono.readInt16LE(2)).toBe(3500); // (3000 + 4000) / 2
  });
});
