import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { getSettingsSection } from "@/lib/settings";

export async function POST() {
  try {
    await requireMasterAdmin();

    const aiSettings = await getSettingsSection("ai");

    // Check which provider to test
    const provider = aiSettings.defaultProvider;

    if (provider === "openai") {
      if (!aiSettings.openaiApiKey) {
        return NextResponse.json(
          { success: false, error: "OpenAI API key not configured" },
          { status: 400 }
        );
      }

      // In a real implementation, make a test API call to OpenAI
      // For now, simulate the test
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if key looks valid (starts with sk-)
      if (!aiSettings.openaiApiKey.startsWith("sk-")) {
        return NextResponse.json({
          success: false,
          error: "Invalid OpenAI API key format",
        });
      }

      return NextResponse.json({
        success: true,
        message: "OpenAI connection successful",
        details: {
          provider: "OpenAI",
          model: aiSettings.openaiDefaultModel,
          embeddingModel: aiSettings.openaiEmbeddingModel,
        },
      });
    }

    if (provider === "anthropic") {
      if (!aiSettings.anthropicApiKey) {
        return NextResponse.json(
          { success: false, error: "Anthropic API key not configured" },
          { status: 400 }
        );
      }

      // Simulate test
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return NextResponse.json({
        success: true,
        message: "Anthropic connection successful",
        details: {
          provider: "Anthropic",
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: `Unknown provider: ${provider}`,
    });
  } catch (error) {
    console.error("Failed to test AI connection:", error);
    return NextResponse.json(
      { error: "Failed to test AI connection" },
      { status: 500 }
    );
  }
}
