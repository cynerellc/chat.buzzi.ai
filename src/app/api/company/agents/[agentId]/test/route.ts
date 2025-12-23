import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

interface TestMessageRequest {
  message: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
}

interface TestMessageResponse {
  response: string;
  toolCalls?: { tool: string; input: unknown; output: unknown }[];
  reasoning?: string;
  tokensUsed?: number;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { agentId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get the agent
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body: TestMessageRequest = await request.json();

    if (!body.message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // For now, return a simulated response
    // In production, this would call the actual AI service
    const behavior = agent.behavior as {
      greeting?: string;
      fallbackMessage?: string;
    };

    // Simulate AI response based on the agent configuration
    const simulatedResponse = generateSimulatedResponse(
      body.message,
      agent.systemPrompt,
      behavior,
      body.conversationHistory || []
    );

    const response: TestMessageResponse = {
      response: simulatedResponse,
      toolCalls: [],
      reasoning: `Using agent "${agent.name}" with model ${agent.modelId} at temperature ${agent.temperature / 100}`,
      tokensUsed: Math.floor(Math.random() * 500) + 100,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error testing agent:", error);
    return NextResponse.json(
      { error: "Failed to test agent" },
      { status: 500 }
    );
  }
}

function generateSimulatedResponse(
  message: string,
  systemPrompt: string,
  behavior: { greeting?: string; fallbackMessage?: string },
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): string {
  const lowerMessage = message.toLowerCase();

  // First message - use greeting if no history
  if (conversationHistory.length === 0 && (lowerMessage.includes("hi") || lowerMessage.includes("hello"))) {
    return behavior.greeting || "Hello! How can I help you today?";
  }

  // Simple keyword matching for demo purposes
  if (lowerMessage.includes("help")) {
    return "I'd be happy to help! Could you please provide more details about what you need assistance with?";
  }

  if (lowerMessage.includes("pricing") || lowerMessage.includes("price") || lowerMessage.includes("cost")) {
    return "I can help you with pricing information. Our pricing varies based on your needs. Would you like me to connect you with our sales team for a personalized quote?";
  }

  if (lowerMessage.includes("support") || lowerMessage.includes("issue") || lowerMessage.includes("problem")) {
    return "I'm sorry to hear you're having an issue. Let me help you resolve this. Could you describe the problem in more detail?";
  }

  if (lowerMessage.includes("human") || lowerMessage.includes("agent") || lowerMessage.includes("person")) {
    return "I understand you'd like to speak with a human agent. Let me transfer you to one of our team members who can assist you further.";
  }

  if (lowerMessage.includes("thank")) {
    return "You're welcome! Is there anything else I can help you with today?";
  }

  if (lowerMessage.includes("bye") || lowerMessage.includes("goodbye")) {
    return "Thank you for chatting with us today! If you have any more questions in the future, don't hesitate to reach out. Have a great day!";
  }

  // Default response
  return `Thank you for your message. Based on my configuration, I'm here to assist you. ${behavior.fallbackMessage ? "If I can't help, " + behavior.fallbackMessage.toLowerCase() : "How else can I help you today?"}`;
}
