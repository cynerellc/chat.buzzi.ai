/**
 * WhatsApp Calling Webhook Handler
 *
 * Handles incoming webhook events from WhatsApp Business Calling API.
 *
 * Events handled:
 * - connect: Incoming call request with SDP offer
 * - terminate: Call ended
 * - media: Audio data (if streaming via webhook)
 *
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/calling
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { integrationAccounts, calls } from "@/lib/db/schema/calls";
import { chatbots } from "@/lib/db/schema/chatbots";
import { eq, and, isNull } from "drizzle-orm";
import { getCallRunner } from "@/lib/call/execution/call-runner";
import type { CallAiProvider } from "@/lib/call/types";

// Dynamic import to avoid loading wrtc during build
const getWhatsAppCallHandler = async () => {
  const { createWhatsAppCallHandler } = await import("@/lib/call/handlers/whatsapp-call-handler");
  return createWhatsAppCallHandler;
};

// ============================================================================
// Types
// ============================================================================

interface WhatsAppCallEvent {
  id: string;
  call_id: string;
  from: string;
  timestamp: string;
  event: "connect" | "terminate" | "media";
  call?: {
    offer?: {
      sdp: string;
    };
    termination_reason?: string;
  };
  media?: {
    payload: string;
    codec: string;
    sample_rate: number;
  };
}

interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: "whatsapp";
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        calls?: WhatsAppCallEvent[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
        }>;
      };
      field: "calls" | "messages";
    }>;
  }>;
}

interface IntegrationCredentials {
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
  whatsapp_app_secret?: string;
}

// ============================================================================
// Active Call Sessions (in-memory for quick lookup)
// ============================================================================

// Handler type from whatsapp-call-handler
import type { WhatsAppCallHandler } from "@/lib/call/handlers/whatsapp-call-handler";

const activeCallHandlers = new Map<
  string,
  {
    sessionId: string;
    handler: WhatsAppCallHandler;
  }
>();

// ============================================================================
// GET - Webhook Verification
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[WhatsAppWebhook] Verification request:", { mode, token: token?.substring(0, 10) + "..." });

  // Get verify token from environment or database
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("[WhatsAppWebhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured");
    return new NextResponse("Verification token not configured", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsAppWebhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("[WhatsAppWebhook] Verification failed");
  return new NextResponse("Forbidden", { status: 403 });
}

// ============================================================================
// POST - Incoming Webhook Events
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body for signature validation
    const body = await request.text();

    // 2. Validate signature
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (appSecret && !validateSignature(body, signature, appSecret)) {
      console.error("[WhatsAppWebhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse payload
    const payload: WhatsAppWebhookPayload = JSON.parse(body);

    // 4. Process each entry
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        // Only handle call events
        if (change.field !== "calls" || !change.value.calls) {
          continue;
        }

        const phoneNumberId = change.value.metadata.phone_number_id;

        for (const callEvent of change.value.calls) {
          await processCallEvent(phoneNumberId, callEvent);
        }
      }
    }

    // 5. Acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[WhatsAppWebhook] Error processing webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// Signature Validation
// ============================================================================

function validateSignature(
  body: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(body).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Call Event Processing
// ============================================================================

async function processCallEvent(
  phoneNumberId: string,
  callEvent: WhatsAppCallEvent
): Promise<void> {
  console.log(
    `[WhatsAppWebhook] Processing call event: ${callEvent.event} for call ${callEvent.call_id}`
  );

  switch (callEvent.event) {
    case "connect":
      await handleIncomingCall(phoneNumberId, callEvent);
      break;

    case "terminate":
      await handleCallTermination(callEvent);
      break;

    case "media":
      await handleMediaEvent(callEvent);
      break;

    default:
      console.log(`[WhatsAppWebhook] Unknown event type: ${callEvent.event}`);
  }
}

// ============================================================================
// Handle Incoming Call (connect event)
// ============================================================================

async function handleIncomingCall(
  phoneNumberId: string,
  callEvent: WhatsAppCallEvent
): Promise<void> {
  console.log(
    `[WhatsAppWebhook] Incoming call from ${callEvent.from} (call_id: ${callEvent.call_id})`
  );

  // 1. Find integration account by phone number ID
  const integrationResult = await db
    .select()
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.provider, "whatsapp"),
        eq(integrationAccounts.isActive, true),
        isNull(integrationAccounts.deletedAt)
      )
    );

  // Filter by phone number ID from credentials
  const integration = integrationResult.find((i) => {
    const creds = i.credentials as IntegrationCredentials;
    return creds.whatsapp_phone_number_id === phoneNumberId;
  });

  if (!integration) {
    console.error(
      `[WhatsAppWebhook] No integration account found for phone number ID: ${phoneNumberId}`
    );
    // Send reject call response to WhatsApp
    await rejectCall(phoneNumberId, callEvent.call_id, "no_integration");
    return;
  }

  // 2. Find chatbot linked to this integration
  // For now, we'll look for a chatbot with call enabled for this company
  const chatbotResult = await db
    .select()
    .from(chatbots)
    .where(
      and(
        eq(chatbots.companyId, integration.companyId),
        eq(chatbots.enabledCall, true),
        eq(chatbots.status, "active")
      )
    )
    .limit(1);

  const chatbot = chatbotResult[0];
  if (!chatbot) {
    console.error(
      `[WhatsAppWebhook] No call-enabled chatbot found for company: ${integration.companyId}`
    );
    await rejectCall(phoneNumberId, callEvent.call_id, "no_chatbot");
    return;
  }

  // 3. Create call session
  const callRunner = getCallRunner();
  const session = await callRunner.createSession({
    chatbotId: chatbot.id,
    companyId: integration.companyId,
    source: "whatsapp",
    fromNumber: callEvent.from,
    integrationAccountId: integration.id,
    metadata: {
      whatsapp_call_id: callEvent.call_id,
      phone_number_id: phoneNumberId,
    },
  });

  if (!session) {
    console.error("[WhatsAppWebhook] Failed to create call session");
    await rejectCall(phoneNumberId, callEvent.call_id, "session_error");
    return;
  }

  // 4. Create WhatsApp call handler (dynamically loaded to avoid wrtc at build time)
  const createWhatsAppCallHandler = await getWhatsAppCallHandler();
  const handler = createWhatsAppCallHandler(
    session.sessionId,
    session.callId,
    {
      callId: callEvent.call_id,
      phoneNumber: callEvent.from,
      sdpOffer: callEvent.call?.offer?.sdp,
      fromNumber: callEvent.from,
      integrationAccountId: integration.id,
    },
    {
      aiProvider: chatbot.callAiProvider as CallAiProvider,
      onAudioToAI: async (base64Audio: string) => {
        // Forward audio to CallRunner
        const audioBuffer = Buffer.from(base64Audio, "base64");
        await callRunner.sendAudio(session.sessionId, audioBuffer);
      },
    }
  );

  // 5. Store handler for future events
  activeCallHandlers.set(callEvent.call_id, {
    sessionId: session.sessionId,
    handler,
  });

  // 6. Start handler and get SDP answer
  try {
    await handler.start();
    const sdpAnswer = handler.getSDPAnswer();

    if (sdpAnswer) {
      // Send answer back to WhatsApp
      await acceptCall(
        phoneNumberId,
        callEvent.call_id,
        sdpAnswer,
        integration.credentials as IntegrationCredentials
      );
    } else {
      console.error("[WhatsAppWebhook] No SDP answer from handler");
      await rejectCall(phoneNumberId, callEvent.call_id, "no_sdp_answer");
    }

    // 7. Start call with runner
    await callRunner.startCall(session.sessionId, handler);
  } catch (error) {
    console.error("[WhatsAppWebhook] Error starting call:", error);
    await rejectCall(phoneNumberId, callEvent.call_id, "start_error");
    activeCallHandlers.delete(callEvent.call_id);
  }
}

// ============================================================================
// Handle Call Termination
// ============================================================================

async function handleCallTermination(callEvent: WhatsAppCallEvent): Promise<void> {
  console.log(
    `[WhatsAppWebhook] Call terminated: ${callEvent.call_id} (reason: ${callEvent.call?.termination_reason})`
  );

  const activeCall = activeCallHandlers.get(callEvent.call_id);
  if (!activeCall) {
    console.log(`[WhatsAppWebhook] No active handler for call ${callEvent.call_id}`);
    return;
  }

  // End the call
  const callRunner = getCallRunner();
  await callRunner.endCall(
    activeCall.sessionId,
    callEvent.call?.termination_reason || "remote_hangup"
  );

  // Clean up
  activeCallHandlers.delete(callEvent.call_id);
}

// ============================================================================
// Handle Media Event (if WhatsApp sends audio via webhook)
// ============================================================================

async function handleMediaEvent(callEvent: WhatsAppCallEvent): Promise<void> {
  if (!callEvent.media) return;

  const activeCall = activeCallHandlers.get(callEvent.call_id);
  if (!activeCall) {
    console.log(`[WhatsAppWebhook] No active handler for media event ${callEvent.call_id}`);
    return;
  }

  // Decode and forward audio to handler
  const audioBuffer = Buffer.from(callEvent.media.payload, "base64");
  await activeCall.handler.handleAudio(audioBuffer);
}

// ============================================================================
// WhatsApp API Calls
// ============================================================================

async function acceptCall(
  phoneNumberId: string,
  callId: string,
  sdpAnswer: string,
  credentials: IntegrationCredentials
): Promise<void> {
  const accessToken = credentials.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("[WhatsAppWebhook] No access token for accepting call");
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/calls/${callId}/accept`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: {
            sdp: sdpAnswer,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[WhatsAppWebhook] Failed to accept call:", error);
    } else {
      console.log(`[WhatsAppWebhook] Call accepted: ${callId}`);
    }
  } catch (error) {
    console.error("[WhatsAppWebhook] Error accepting call:", error);
  }
}

async function rejectCall(
  phoneNumberId: string,
  callId: string,
  reason: string
): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("[WhatsAppWebhook] No access token for rejecting call");
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/calls/${callId}/reject`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[WhatsAppWebhook] Failed to reject call:", error);
    } else {
      console.log(`[WhatsAppWebhook] Call rejected: ${callId} (${reason})`);
    }
  } catch (error) {
    console.error("[WhatsAppWebhook] Error rejecting call:", error);
  }
}

// ============================================================================
// Cleanup on Server Shutdown
// ============================================================================

if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    console.log("[WhatsAppWebhook] Cleaning up active calls...");
    const callRunner = getCallRunner();
    for (const [callId, { sessionId }] of activeCallHandlers) {
      callRunner.endCall(sessionId, "server_shutdown").catch(console.error);
    }
    activeCallHandlers.clear();
  });
}
