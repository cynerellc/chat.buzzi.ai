import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

interface TestMessageRequest {
  message: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  stream?: boolean;
}

interface TestMessageResponse {
  response: string;
  toolCalls?: { tool: string; input: unknown; output: unknown }[];
  reasoning?: string;
  tokensUsed?: number;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { agentId } = await params;

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

    // Get agent config from agentsList (first agent is primary)
    const agentsList = (agent.agentsList as { default_system_prompt: string; default_model_id: string; default_temperature: number }[]) || [];
    const primaryAgent = agentsList[0];
    const systemPrompt = primaryAgent?.default_system_prompt || "";
    const modelId = primaryAgent?.default_model_id || "gpt-5-mini";
    const temperature = primaryAgent?.default_temperature ?? 70;

    // Simulate AI response based on the agent configuration
    const simulatedResponse = generateSimulatedResponse(
      body.message,
      systemPrompt,
      behavior,
      body.conversationHistory || []
    );

    const reasoning = `Using agent "${agent.name}" with model ${modelId} at temperature ${temperature / 100}`;
    const tokensUsed = Math.floor(Math.random() * 500) + 100;

    // Handle streaming response
    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Simulate streaming by breaking the response into chunks
          const words = simulatedResponse.split(" ");

          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const content = i === 0 ? word : " " + word;

            const chunk = JSON.stringify({ type: "content", content });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));

            // Simulate typing delay (30-80ms per word)
            await new Promise((resolve) =>
              setTimeout(resolve, Math.floor(Math.random() * 50) + 30)
            );
          }

          // Send final metadata
          const doneChunk = JSON.stringify({
            type: "done",
            reasoning,
            tokensUsed,
          });
          controller.enqueue(encoder.encode(`data: ${doneChunk}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming response (fallback)
    const response: TestMessageResponse = {
      response: simulatedResponse,
      toolCalls: [],
      reasoning,
      tokensUsed,
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
