/**
 * Generate static voice preview files for all available voices
 *
 * Run with: pnpm tsx scripts/generate-voice-previews.ts
 *
 * This script generates MP3 files for:
 * - OpenAI voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse
 * - Gemini voices: Puck, Charon, Kore, Fenrir, Aoede
 *
 * Files are saved to: public/voice/{voice_name_lowercase}.mp3
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const PREVIEW_TEXT = "Hello! I'm your AI assistant. How can I help you today?";

// OpenAI standard TTS voices
const OPENAI_TTS_VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;

// OpenAI Realtime API voices (ballad, verse) - need different generation method
const OPENAI_REALTIME_VOICES = ["ballad", "verse"] as const;

// Gemini Live API voices
const GEMINI_VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"] as const;

const OUTPUT_DIR = path.join(process.cwd(), "public", "voice");

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
}

async function generateOpenAITTSVoices() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, skipping OpenAI TTS voices");
    return;
  }

  const openai = new OpenAI({ apiKey });
  console.log("\nGenerating OpenAI TTS voice previews...");

  for (const voice of OPENAI_TTS_VOICES) {
    const outputPath = path.join(OUTPUT_DIR, `${voice.toLowerCase()}.mp3`);

    if (fs.existsSync(outputPath)) {
      console.log(`  [skip] ${voice} - already exists`);
      continue;
    }

    try {
      console.log(`  [generating] ${voice}...`);

      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        input: PREVIEW_TEXT,
        response_format: "mp3",
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`  [done] ${voice} -> ${outputPath}`);
    } catch (error) {
      console.error(`  [error] ${voice}:`, error instanceof Error ? error.message : error);
    }
  }
}

async function generateOpenAIRealtimeVoices() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set, skipping OpenAI Realtime voices");
    return;
  }

  console.log("\nGenerating OpenAI Realtime voice previews...");

  // For Realtime API voices, we use the chat completions API with audio output
  const openai = new OpenAI({ apiKey });

  for (const voice of OPENAI_REALTIME_VOICES) {
    const outputPath = path.join(OUTPUT_DIR, `${voice.toLowerCase()}.mp3`);

    if (fs.existsSync(outputPath)) {
      console.log(`  [skip] ${voice} - already exists`);
      continue;
    }

    try {
      console.log(`  [generating] ${voice} (via audio model)...`);

      // Use gpt-4o-audio-preview for Realtime voices
      const response = await openai.chat.completions.create({
        model: "gpt-4o-audio-preview",
        modalities: ["text", "audio"],
        audio: { voice: voice, format: "mp3" },
        messages: [
          {
            role: "user",
            content: `Please say exactly this: "${PREVIEW_TEXT}"`,
          },
        ],
      });

      // Extract audio from response
      const audioData = response.choices[0]?.message?.audio?.data;
      if (audioData) {
        const buffer = Buffer.from(audioData, "base64");
        fs.writeFileSync(outputPath, buffer);
        console.log(`  [done] ${voice} -> ${outputPath}`);
      } else {
        console.log(`  [error] ${voice} - No audio data in response`);
      }
    } catch (error) {
      console.error(`  [error] ${voice}:`, error instanceof Error ? error.message : error);
    }
  }
}

async function generateGeminiVoices() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_API_KEY/GEMINI_API_KEY not set, skipping Gemini voices");
    return;
  }

  console.log("\nGenerating Gemini voice previews...");

  const genai = new GoogleGenAI({ apiKey });

  for (const voice of GEMINI_VOICES) {
    const outputPath = path.join(OUTPUT_DIR, `${voice.toLowerCase()}.mp3`);

    if (fs.existsSync(outputPath)) {
      console.log(`  [skip] ${voice} - already exists`);
      continue;
    }

    try {
      console.log(`  [generating] ${voice}...`);

      // Use Gemini 2.0 Flash with audio output
      const response = await genai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: `Please say exactly this: "${PREVIEW_TEXT}"` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      });

      // Extract audio from response
      const audioPart = response.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { mimeType?: string } }) => p.inlineData?.mimeType?.startsWith("audio/")
      );

      if (audioPart?.inlineData?.data) {
        const buffer = Buffer.from(audioPart.inlineData.data, "base64");
        // Convert to MP3 if needed (Gemini returns PCM/WAV)
        const mimeType = audioPart.inlineData.mimeType;
        const ext = mimeType?.includes("mp3") ? "mp3" : mimeType?.includes("wav") ? "wav" : "pcm";
        const finalPath = ext === "mp3" ? outputPath : outputPath.replace(".mp3", `.${ext}`);
        fs.writeFileSync(finalPath, buffer);
        console.log(`  [done] ${voice} -> ${finalPath}`);
      } else {
        console.log(`  [error] ${voice} - No audio data in response`);
      }
    } catch (error) {
      console.error(`  [error] ${voice}:`, error instanceof Error ? error.message : error);
    }
  }
}

async function main() {
  console.log("Voice Preview Generator");
  console.log("=======================");
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Preview text: "${PREVIEW_TEXT}"`);

  await ensureOutputDir();
  await generateOpenAITTSVoices();
  await generateOpenAIRealtimeVoices();
  await generateGeminiVoices();

  console.log("\nDone!");
  console.log("\nGenerated files:");

  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".mp3") || f.endsWith(".wav") || f.endsWith(".pcm"));
    if (files.length === 0) {
      console.log("  No audio files generated");
    } else {
      files.forEach(f => console.log(`  - ${f}`));
    }
  }
}

main().catch(console.error);
