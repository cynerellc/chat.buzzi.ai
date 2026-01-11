/**
 * Embed Widget Components
 *
 * Re-exports all components used in the chat widget.
 */

// Main ChatWindow component (renamed from chat-window)
export { ChatWindow } from "./ChatWindow";

// Types (from shared types file)
export type {
  AgentInfo,
  ChatWindowConfig,
  ChatWindowProps,
  Message,
  Session,
  ThinkingState,
} from "./types";
export { getContrastTextColor } from "./types";

// Agent components
export { AgentCard } from "./AgentCard";
export type { AgentCardProps } from "./AgentCard";

// Bubble components
export { TransferBubble } from "./TransferBubble";
export type { TransferBubbleProps } from "./TransferBubble";

export { ThinkingBubble } from "./ThinkingBubble";
export type { ThinkingBubbleProps, ToolCallState } from "./ThinkingBubble";

// Human escalation bubble components
export { HumanWaitingBubble } from "./HumanWaitingBubble";
export type { HumanWaitingBubbleProps } from "./HumanWaitingBubble";

export { HumanJoinedBubble, HumanExitedBubble } from "./HumanJoinedBubble";
export type { HumanJoinedBubbleProps, HumanExitedBubbleProps, HumanAgentInfo } from "./HumanJoinedBubble";

export { UserBubble } from "./UserBubble";
export type { UserBubbleProps } from "./UserBubble";

export { AgentBubble } from "./AgentBubble";
export type { AgentBubbleProps } from "./AgentBubble";

// Input component
export { MessageInput } from "./MessageInput";
export type { MessageInputProps } from "./MessageInput";
