import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots, type AgentListItem } from "@/lib/db/schema";
import { createAdkExecutor } from "@/lib/ai/execution/adk-executor";
import { createVariableContext } from "@/lib/ai/types";
import type { AgentContext } from "@/lib/ai/types";

interface RouteParams {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

interface TestMessageRequest {
  message: string;
  sessionId?: string;
  agentIdentifier?: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  debug?: boolean;
}

// Store for in-memory conversation history (test mode only)
const testConversations = new Map<string, { role: "user" | "assistant"; content: string }[]>();

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await params;

    console.log(`[TestRoute] POST request received`);
    console.log(`[TestRoute] - companyId: ${companyId}`);
    console.log(`[TestRoute] - chatbotId: ${chatbotId}`);

    // Get the chatbot
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return new Response(JSON.stringify({ error: "Chatbot not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: TestMessageRequest = await request.json();

    if (!body.message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate session ID if not provided
    const sessionId = body.sessionId || `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Get agents list
    const agentsList = (chatbot.agentsList as AgentListItem[]) || [];

    // Find the selected agent or use primary agent
    const selectedAgent = body.agentIdentifier
      ? agentsList.find(a => a.agent_identifier === body.agentIdentifier)
      : agentsList[0];

    if (!selectedAgent) {
      return new Response(JSON.stringify({ error: "No agents configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or initialize conversation history
    const history = testConversations.get(sessionId) || [];

    // Add user message to history
    history.push({ role: "user", content: body.message });

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Send agent info first
          sendEvent("agent", {
            identifier: selectedAgent.agent_identifier,
            name: selectedAgent.name,
            avatar_url: selectedAgent.avatar_url,
            designation: selectedAgent.designation,
          });

          // Send debug info if enabled
          if (body.debug !== false) {
            const modelSettings = selectedAgent.model_settings ?? { temperature: 0.7 };
            sendEvent("debug", {
              sessionId,
              chatbotId,
              agentIdentifier: selectedAgent.agent_identifier,
              model: selectedAgent.default_model_id,
              modelSettings,
              knowledgeBaseEnabled: selectedAgent.knowledge_base_enabled ?? false,
              knowledgeCategories: selectedAgent.knowledge_categories ?? [],
              historyLength: history.length,
              packageId: chatbot.packageId ?? null,
            });
          }

          // Create variable context from chatbot's variable values
          const variableValues = chatbot.variableValues as Record<string, string> | null;
          const varContext = createVariableContext(
            Object.entries(variableValues ?? {}).map(([name, value]) => ({
              name,
              value,
              variableType: name.endsWith("_KEY") || name.endsWith("_SECRET") ? "secured_variable" as const : "variable" as const,
              dataType: "string" as const,
            }))
          );

          // Build context
          const context: AgentContext = {
            conversationId: sessionId,
            companyId,
            agentId: chatbotId,
            requestId: crypto.randomUUID(),
            message: body.message,
            endUserId: "test-user",
            channel: "web",
            timestamp: new Date(),
            variables: varContext.variables,
            securedVariables: varContext.securedVariables,
          };

          // Process message with streaming using AdkExecutor
          let fullContent = "";

          // Create AdkExecutor for all chatbots (package-based execution)
          if (!chatbot.packageId) {
            sendEvent("error", { message: "Chatbot requires a package ID" });
            controller.close();
            return;
          }

          const adkExecutor = createAdkExecutor({
            chatbotId,
            companyId,
            packageId: chatbot.packageId,
            agentConfig: {
              systemPrompt: selectedAgent.default_system_prompt,
              modelId: selectedAgent.default_model_id,
              modelSettings: selectedAgent.model_settings ?? { temperature: 0.7 },
              knowledgeBaseEnabled: selectedAgent.knowledge_base_enabled ?? false,
              knowledgeCategories: selectedAgent.knowledge_categories ?? [],
            },
            agentsListConfig: agentsList,
          });

          for await (const event of adkExecutor.processMessageStream({
            message: body.message,
            sessionId,
            context,
          })) {
            switch (event.type) {
              case "thinking":
                sendEvent("thinking", event.data);
                break;
              case "tool_call":
                if (body.debug !== false) {
                  sendEvent("tool_call", event.data);
                }
                break;
              case "notification":
                // Agent handoff notification
                const notifData = event.data as {
                  message: string;
                  targetAgentId?: string;
                  targetAgentName?: string;
                  level?: string;
                };
                sendEvent("notification", notifData);
                // Also send agent info for the target agent if available
                if (notifData.targetAgentId) {
                  const targetAgent = agentsList.find(a => a.agent_identifier === notifData.targetAgentId);
                  if (targetAgent) {
                    sendEvent("agent", {
                      identifier: targetAgent.agent_identifier,
                      name: targetAgent.name,
                      avatar_url: targetAgent.avatar_url,
                      designation: targetAgent.designation,
                    });
                  }
                }
                break;
              case "delta":
                const deltaData = event.data as { content: string };
                fullContent += deltaData.content;
                sendEvent("delta", { content: deltaData.content });
                break;
              case "complete":
                const completeData = event.data as {
                  content: string;
                  metadata?: {
                    sources?: Array<{ id: string; title: string; score: number }>;
                    tokensUsed?: { inputTokens: number; outputTokens: number; totalTokens: number };
                    processingTimeMs?: number;
                    toolsUsed?: string[];
                  }
                };
                fullContent = completeData.content;

                // Add assistant response to history
                history.push({ role: "assistant", content: fullContent });
                testConversations.set(sessionId, history);

                sendEvent("complete", {
                  content: fullContent,
                  metadata: completeData.metadata,
                  sessionId,
                });
                break;
              case "error":
                sendEvent("error", event.data);
                break;
            }
          }

          // If no streaming events produced content, send a fallback
          if (!fullContent) {
            const fallbackResponse = "I apologize, but I couldn't generate a response. Please try again.";
            history.push({ role: "assistant", content: fallbackResponse });
            testConversations.set(sessionId, history);

            sendEvent("complete", {
              content: fallbackResponse,
              sessionId,
            });
          }

        } catch (error) {
          console.error("Error in test chat:", error);
          sendEvent("error", {
            message: error instanceof Error ? error.message : "An error occurred",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error testing chatbot:", error);
    return new Response(JSON.stringify({ error: "Failed to test chatbot" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// DELETE endpoint to reset conversation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (sessionId) {
      testConversations.delete(sessionId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error resetting conversation:", error);
    return new Response(JSON.stringify({ error: "Failed to reset" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
