// Database Schema Index
// Export all schema tables, relations, and types

// Enums
export * from "./enums";

// Companies (Tenants)
export * from "./companies";

// Users & Auth
export * from "./users";

// Company Permissions (Junction table for user-company-role relationships)
export * from "./company-permissions";

// Subscription Plans
export * from "./subscriptions";

// AI Chatbots (renamed from agents)
export * from "./chatbots";

// Knowledge Base
export * from "./knowledge";

// Conversations & Messages
export * from "./conversations";

// Calls & Call Transcripts (Voice Calls Feature)
export * from "./calls";

// Integrations & Webhooks
export * from "./integrations";

// Analytics
export * from "./analytics";

// Operational Tables (API Keys, Rate Limits, Usage Records, Channel Configs)
export * from "./operations";

// AI Models
export * from "./models";
