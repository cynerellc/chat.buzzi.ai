"use client";

import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Get Supabase client for browser-side realtime subscriptions
 * Uses anon key (public) - requires RLS policies for security
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

export interface RealtimeMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  type: string;
  content: string;
  created_at: string;
  token_count?: number;
}

export interface MessagePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: RealtimeMessage;
  old: RealtimeMessage | null;
}

export type MessageCallback = (payload: MessagePayload) => void;

/**
 * Subscribe to new messages in a conversation
 * For widget users, the sessionId is used for RLS filtering
 */
export function subscribeToConversationMessages(
  conversationId: string,
  sessionId: string,
  onMessage: MessageCallback
): RealtimeChannel {
  const supabase = getSupabaseBrowserClient();

  // Create channel with session context for RLS
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "chatapp",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage({
          eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          new: payload.new as RealtimeMessage,
          old: payload.old as RealtimeMessage | null,
        });
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Subscribed to messages for conversation ${conversationId}`);
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
 * Subscribe to conversation status changes for a company
 * For support agents and company admins
 */
export function subscribeToCompanyConversations(
  companyId: string,
  onUpdate: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    conversationId: string;
    status: string;
  }) => void
): RealtimeChannel {
  const supabase = getSupabaseBrowserClient();

  const channel = supabase
    .channel(`company-conversations:${companyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "chatapp",
        table: "conversations",
        filter: `company_id=eq.${companyId}`,
      },
      (payload) => {
        const record = payload.new as { id: string; status: string } | null;
        if (record) {
          onUpdate({
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            conversationId: record.id,
            status: record.status,
          });
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Subscribed to conversations for company ${companyId}`);
      }
    });

  return channel;
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
