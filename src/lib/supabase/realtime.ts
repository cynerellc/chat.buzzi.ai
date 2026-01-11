"use client";

import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Get Supabase client for browser-side realtime subscriptions
 * Uses anon key (public) - security is enforced via broadcast channels
 * (only server can broadcast, clients can only subscribe)
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase browser environment variables not configured. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return browserClient;
}

/**
 * Check if Supabase Realtime is configured
 */
export function isRealtimeConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ============================================================================
// Broadcast Message Types
// ============================================================================

export interface BroadcastMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "human_agent" | "system";
  content: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}

export interface ConversationUpdate {
  conversationId: string;
  status: string;
  [key: string]: unknown;
}

export type MessageCallback = (message: BroadcastMessage) => void;
export type ConversationUpdateCallback = (update: ConversationUpdate) => void;

// ============================================================================
// Broadcast Subscriptions (Secure - server controls what's broadcast)
// ============================================================================

/**
 * Subscribe to new messages in a conversation via broadcast
 * Only receives messages that the server explicitly broadcasts
 *
 * @param conversationId - The conversation to subscribe to
 * @param onMessage - Callback when a new message is received
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: MessageCallback
): RealtimeChannel {
  const supabase = getSupabaseBrowserClient();

  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on("broadcast", { event: "new_message" }, (payload) => {
      onMessage(payload.payload as BroadcastMessage);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed to conversation ${conversationId}`);
      }
    });

  return channel;
}

/**
 * Subscribe to conversation updates for a company via broadcast
 * Receives updates when conversations change status (new, escalated, resolved, etc.)
 *
 * @param companyId - The company to subscribe to
 * @param onUpdate - Callback when a conversation is updated
 */
export function subscribeToCompanyConversations(
  companyId: string,
  onUpdate: ConversationUpdateCallback
): RealtimeChannel {
  const supabase = getSupabaseBrowserClient();

  const channel = supabase
    .channel(`company:${companyId}`)
    .on("broadcast", { event: "conversation_update" }, (payload) => {
      onUpdate(payload.payload as ConversationUpdate);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed to company ${companyId} updates`);
      }
    });

  return channel;
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channel: RealtimeChannel): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.removeChannel(channel);
}

/**
 * React hook helper - Use this in components to auto-cleanup subscriptions
 * Example usage:
 *
 * useEffect(() => {
 *   const channel = subscribeToConversationMessages(conversationId, sessionId, (msg) => {
 *     // Handle new message
 *   });
 *
 *   return () => {
 *     unsubscribe(channel);
 *   };
 * }, [conversationId, sessionId]);
 */

/**
 * Get the active company ID from cookie (client-side)
 */
export function getActiveCompanyIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/active_company_id=([^;]+)/);
  return match?.[1] ?? null;
}
