/**
 * Widget Voice Transcription API
 *
 * POST /api/widget/[sessionId]/transcribe
 * Transcribes audio using OpenAI Whisper API
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema/conversations";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Maximum audio file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed audio MIME types
const ALLOWED_TYPES = [
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
];

interface RouteParams {
  sessionId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { sessionId } = await params;

    // Validate session - look up conversation with this sessionId
    const conversationResult = await db
      .select({ id: conversations.id, status: conversations.status })
      .from(conversations)
      .where(eq(conversations.sessionId, sessionId))
      .limit(1);

    if (conversationResult.length === 0) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const conversation = conversationResult[0];

    // Check if conversation is still active
    if (conversation?.status === "resolved" || conversation?.status === "abandoned") {
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Invalid audio format. Allowed types: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Audio file too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Convert to buffer for Whisper API
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File object compatible with OpenAI SDK
    const file = new File([buffer], audioFile.name || "recording.webm", {
      type: audioFile.type,
    });

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
    });

    // Return transcribed text
    const res = NextResponse.json({
      text: transcription.trim(),
    });

    // Set CORS headers
    const origin = request.headers.get("origin");
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return res;
  } catch (error) {
    console.error("Transcription error:", error);

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Transcription service is busy. Please try again." },
          { status: 429 }
        );
      }
      if (error.status === 400) {
        return NextResponse.json(
          { error: "Invalid audio file. Please try recording again." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  const response = new NextResponse(null, { status: 204 });
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}
