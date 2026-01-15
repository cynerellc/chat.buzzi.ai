/**
 * Voice Preview API Route
 *
 * Generates voice samples using TTS APIs for preview in VoiceSettings.
 * Supports OpenAI and Gemini voices.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireCompanyAdmin } from "@/lib/auth/guards";

// ============================================================================
// Request Schema
// ============================================================================

const voicePreviewSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI"]),
  voice: z.string().min(1),
  text: z.string().optional().default("Hello! I'm your AI assistant. How can I help you today?"),
});

// ============================================================================
// Sample Text for Preview
// ============================================================================

const DEFAULT_PREVIEW_TEXT =
  "Hello! I'm your AI assistant. How can I help you today?";

// ============================================================================
// POST /api/company/voice-preview
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await requireCompanyAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { provider, voice, text } = voicePreviewSchema.parse(body);
    const previewText = text || DEFAULT_PREVIEW_TEXT;

    if (provider === "OPENAI") {
      // Use OpenAI TTS API
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: previewText,
          voice: voice.toLowerCase(),
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[VoicePreview] OpenAI TTS error:", error);
        return NextResponse.json(
          { error: "Failed to generate voice preview" },
          { status: 500 }
        );
      }

      // Return the audio as a blob
      const audioBuffer = await response.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    } else if (provider === "GEMINI") {
      // For Gemini, we use Google Cloud TTS or return a placeholder
      // Note: Gemini Live voices are different from standard TTS
      // For now, return an error indicating Gemini preview is not yet supported
      return NextResponse.json(
        {
          error: "Gemini voice preview is not yet supported. The voice will be used during actual calls.",
        },
        { status: 501 }
      );
    }

    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  } catch (error) {
    console.error("[VoicePreview] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
