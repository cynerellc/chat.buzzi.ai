/**
 * Twilio Voice Webhook Handler
 *
 * Handles incoming webhook events from Twilio for voice calls.
 *
 * Events handled:
 * - Initial call webhook: Returns TwiML with Stream for bidirectional audio
 * - Status callback: Call status updates (completed, failed, etc.)
 *
 * Reference: https://www.twilio.com/docs/voice/twiml/stream
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { integrationAccounts, type IntegrationAccountSettings } from "@/lib/db/schema/calls";
import { chatbots } from "@/lib/db/schema/chatbots";
import { eq, and, isNull } from "drizzle-orm";
import { getCallRunner } from "@/lib/call/execution/call-runner";

// ============================================================================
// Types
// ============================================================================

interface TwilioCredentials {
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
}

// ============================================================================
// POST - Incoming Voice Call
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Parse form data from Twilio
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log("[TwilioWebhook] Incoming call:", {
      from: params.From,
      to: params.To,
      callSid: params.CallSid,
      direction: params.Direction,
    });

    // 2. Validate required parameters
    if (!params.To || !params.From || !params.CallSid) {
      console.error("[TwilioWebhook] Missing required parameters");
      return new NextResponse(
        generateTwiML('<Say voice="alice">Invalid request parameters.</Say><Hangup/>'),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // 3. Validate Twilio signature
    const twilioSignature = request.headers.get("x-twilio-signature");
    const requestUrl = request.url;

    // Get auth token from environment or we'll validate per-account later
    const globalAuthToken = process.env.TWILIO_AUTH_TOKEN;

    // 4. Find integration account by phone number (the "To" number)
    const toNumber = normalizePhoneNumber(params.To);
    const integrationResult = await db
      .select()
      .from(integrationAccounts)
      .where(
        and(
          eq(integrationAccounts.provider, "twilio"),
          eq(integrationAccounts.isActive, true),
          isNull(integrationAccounts.deletedAt)
        )
      );

    // Filter by phone number from credentials or settings
    const integration = integrationResult.find((i) => {
      const creds = i.credentials as TwilioCredentials;
      const settings = i.settings as IntegrationAccountSettings;
      const phoneNumber = creds.twilio_phone_number ?? settings?.phone_number ?? "";
      return normalizePhoneNumber(phoneNumber) === toNumber;
    });

    if (!integration) {
      console.error(`[TwilioWebhook] No integration account found for: ${params.To}`);
      return new NextResponse(
        generateTwiML(
          '<Say voice="alice">Sorry, this number is not configured for AI calls. Goodbye.</Say><Hangup/>'
        ),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // 4. Validate signature using account-specific or global auth token
    const creds = integration.credentials as TwilioCredentials;
    const authToken = creds.twilio_auth_token || globalAuthToken;

    if (authToken && twilioSignature && !validateTwilioSignature(requestUrl, params, twilioSignature, authToken)) {
      console.error("[TwilioWebhook] Invalid Twilio signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // 5. Find chatbot linked to this integration's company
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
        `[TwilioWebhook] No call-enabled chatbot found for company: ${integration.companyId}`
      );
      return new NextResponse(
        generateTwiML(
          '<Say voice="alice">Sorry, there is no AI assistant configured for this number. Goodbye.</Say><Hangup/>'
        ),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // 6. Create call session
    const callRunner = getCallRunner();
    const session = await callRunner.createSession({
      chatbotId: chatbot.id,
      companyId: integration.companyId,
      source: "twilio",
      fromNumber: params.From,
      integrationAccountId: integration.id,
      metadata: {
        twilio_call_sid: params.CallSid,
        twilio_account_sid: params.AccountSid,
        direction: params.Direction,
      },
    });

    if (!session) {
      console.error("[TwilioWebhook] Failed to create call session");
      return new NextResponse(
        generateTwiML(
          '<Say voice="alice">Sorry, we could not start your call right now. Please try again later.</Say><Hangup/>'
        ),
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`[TwilioWebhook] Created session ${session.sessionId} for call ${params.CallSid}`);

    // 7. Generate TwiML with Stream directive
    // The stream URL points to our WebSocket handler for Twilio media streams
    const host = request.headers.get("host") || process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "");
    const wsProtocol = process.env.NODE_ENV === "production" ? "wss" : "wss"; // Twilio requires wss
    const streamUrl = `${wsProtocol}://${host}/api/widget/call/twilio/stream?sessionId=${session.sessionId}`;

    // Return TwiML with bidirectional stream
    const twiml = `
      <Connect>
        <Stream url="${streamUrl}">
          <Parameter name="sessionId" value="${session.sessionId}" />
          <Parameter name="callId" value="${session.callId}" />
          <Parameter name="chatbotId" value="${chatbot.id}" />
        </Stream>
      </Connect>
    `;

    console.log(`[TwilioWebhook] Returning TwiML with stream URL: ${streamUrl}`);

    return new NextResponse(generateTwiML(twiml), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("[TwilioWebhook] Error processing webhook:", error);
    return new NextResponse(
      generateTwiML(
        '<Say voice="alice">Sorry, an error occurred. Please try again later.</Say><Hangup/>'
      ),
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate TwiML response wrapper
 */
function generateTwiML(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${content}
</Response>`;
}

/**
 * Normalize phone number for comparison
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^+\d]/g, "");
}

/**
 * Validate Twilio request signature
 * Reference: https://www.twilio.com/docs/usage/security#validating-requests
 */
function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  // Build the string to sign
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  const data = url + sortedParams;

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");

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
// Status Callback Handler (optional separate endpoint)
// ============================================================================

// This could be extended to handle status callbacks from Twilio
// POST /api/webhook/twilio/voice/status
// to track call completion, duration, etc.
