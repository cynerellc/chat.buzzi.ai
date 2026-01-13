# Database Schema Design

## Overview

This document defines the PostgreSQL database schema for the Multi-Tenant AI Chatbot SaaS Platform using Drizzle ORM. The schema is designed with multi-tenancy, security, and performance as primary concerns.

---

## Table of Contents

1. [Schema Organization](#1-schema-organization)
2. [Core Tables](#2-core-tables)
3. [Agent Tables](#3-agent-tables)
4. [Conversation Tables](#4-conversation-tables)
5. [Knowledge Base Tables](#5-knowledge-base-tables)
6. [Subscription & Billing Tables](#6-subscription--billing-tables)
7. [Channel Integration Tables](#7-channel-integration-tables)
8. [Analytics Tables](#8-analytics-tables)
9. [Audit & Security Tables](#9-audit--security-tables)
10. [Team & Support Tables](#10-team--support-tables)
11. [Row-Level Security Policies](#11-row-level-security-policies)
12. [Indexes](#12-indexes)
13. [Entity Relationship Diagram](#13-entity-relationship-diagram)

---

## 1. Schema Organization

```typescript
// src/db/schema/index.ts
export * from './companies';
export * from './users';
export * from './chatbot-packages';
export * from './agents';
export * from './conversations';
export * from './customers';
export * from './escalations';
export * from './knowledge';
export * from './subscriptions';
export * from './channels';
export * from './api-keys';
export * from './webhooks';
export * from './analytics';
export * from './audit';
export * from './invitations';
export * from './canned-responses';
export * from './support-agent-status';
```

### Naming Conventions

| Convention | Example |
|------------|---------|
| Table names | `chatapp_` prefix + `snake_case`, plural (`chatapp_companies`, `chatapp_agents`) |
| Column names | `snake_case` (`company_id`, `created_at`) |
| Primary keys | `id` (UUID) |
| Foreign keys | `{table_singular}_id` (`company_id`, `agent_id`) |
| Timestamps | `created_at`, `updated_at`, `deleted_at` |
| Boolean flags | `is_*` or `has_*` (`is_active`, `has_access`) |

---

## 2. Core Tables

### 2.1 Companies (Tenants)

```typescript
// src/db/schema/companies.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

export const companies = pgTable('chatapp_companies', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),

  // Branding
  logoUrl: varchar('logo_url', { length: 500 }),
  primaryColor: varchar('primary_color', { length: 7 }).default('#007bff'),
  secondaryColor: varchar('secondary_color', { length: 7 }),

  // Custom Domain Configuration (optional - default is chat.buzzi.ai)
  customDomain: varchar('custom_domain', { length: 255 }).unique(),
  customDomainVerified: boolean('custom_domain_verified').default(false),

  // Settings
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  locale: varchar('locale', { length: 10 }).default('en'),
  settings: jsonb('settings').default({}),

  // Status
  status: varchar('status', { length: 20 }).default('active').notNull(),
  // 'active' | 'suspended' | 'pending' | 'deleted'

  // API Access
  apiKeyHash: varchar('api_key_hash', { length: 255 }),
  apiKeyPrefix: varchar('api_key_prefix', { length: 10 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
```

### 2.2 Users

```typescript
// src/db/schema/users.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const userRoleEnum = pgEnum('user_role', [
  'master_admin',
  'company_admin',
  'support_agent'
]);

export const users = pgTable('chatapp_users', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Auth.js fields
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified'),
  name: varchar('name', { length: 255 }),
  image: varchar('image', { length: 500 }),

  // Platform fields
  companyId: uuid('company_id').references(() => companies.id),
  role: userRoleEnum('role').notNull().default('support_agent'),

  // Profile
  phone: varchar('phone', { length: 20 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),

  // Permissions (fine-grained)
  permissions: jsonb('permissions').default({}),
  /*
    Example permissions structure:
    {
      "agents": {
        "agent_uuid_1": ["read", "write"],
        "agent_uuid_2": ["read"]
      },
      "knowledge": ["read", "write", "delete"],
      "analytics": ["read"],
      "team": ["read", "write"]
    }
  */

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),

  // Restrictions
  ipAllowlist: jsonb('ip_allowlist').default([]),
  accessExpiresAt: timestamp('access_expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  companyIdx: index('users_company_idx').on(table.companyId),
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### 2.3 Auth.js Required Tables

```typescript
// src/db/schema/auth.ts
import { pgTable, uuid, varchar, text, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';

export const accounts = pgTable('chatapp_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  idToken: text('id_token'),
  sessionState: varchar('session_state', { length: 255 }),
}, (table) => ({
  providerProviderAccountIdIdx: index('accounts_provider_idx')
    .on(table.provider, table.providerAccountId),
}));

export const sessions = pgTable('chatapp_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('chatapp_verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.identifier, table.token] }),
}));
```

---

## 3. Agent Tables

### 3.1 Agent Packages (Master Admin Managed)

```typescript
// src/db/schema/chatbot-packages.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const agentPackages = pgTable('chatapp_agent_packages', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  version: varchar('version', { length: 20 }).notNull(),

  // Package Storage
  packageUrl: varchar('package_url', { length: 500 }).notNull(),
  packageHash: varchar('package_hash', { length: 64 }).notNull(),
  entryPoint: varchar('entry_point', { length: 255 }).default('index.js'),
  packageSize: integer('package_size'), // bytes

  // Capabilities & Features
  capabilities: jsonb('capabilities').default([]),
  // ['rag', 'file_upload', 'voice', 'tools', 'multi_agent']

  // Default Configuration
  defaultConfig: jsonb('default_config').default({}),
  /*
    {
      "llmConfig": { "model": "claude-3-5-sonnet", "temperature": 0.7 },
      "ragConfig": { "chunkSize": 500, "relevanceThreshold": 0.7 },
      "enabledTools": ["rag_search", "request_human_handover"]
    }
  */

  // Metadata
  author: varchar('author', { length: 255 }),
  documentation: text('documentation'),
  changelog: text('changelog'),

  // Status
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false),

  // Usage Tracking
  usageCount: integer('usage_count').default(0),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
});

export type AgentPackage = typeof agentPackages.$inferSelect;
export type NewAgentPackage = typeof agentPackages.$inferInsert;
```

### 3.2 Agents Table

```typescript
// src/db/schema/agents.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, index, pgEnum } from 'drizzle-orm/pg-core';

export const agentStatusEnum = pgEnum('agent_status', [
  'draft',
  'active',
  'paused',
  'archived'
]);

export const agents = pgTable('chatapp_agents', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),

  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  avatar: varchar('avatar', { length: 500 }),

  // Agent Package (pluggable agent code)
  packageId: uuid('package_id').references(() => agentPackages.id),
  // Override package URL if custom code needed
  customPackageUrl: varchar('custom_package_url', { length: 500 }),
  customPackageHash: varchar('custom_package_hash', { length: 64 }),

  // Capabilities
  capabilities: jsonb('capabilities').default([]),
  // ['rag', 'file_upload', 'voice', 'tools']

  // Configuration (Company Admin editable)
  personality: text('personality'),
  responseStyle: jsonb('response_style').default({}),
  /*
    {
      "tone": "friendly",
      "formality": "casual",
      "verbosity": "concise",
      "language": "en"
    }
  */

  // Configuration (Master Admin controlled - hidden from Company Admin)
  systemPrompt: text('system_prompt'),
  llmConfig: jsonb('llm_config').default({}),
  /*
    {
      "model": "claude-3-5-sonnet",
      "temperature": 0.7,
      "maxTokens": 4096
    }
  */

  // RAG Configuration
  ragEnabled: boolean('rag_enabled').default(true),
  ragConfig: jsonb('rag_config').default({}),
  /*
    {
      "chunkSize": 500,
      "overlapSize": 50,
      "relevanceThreshold": 0.7,
      "maxResults": 5
    }
  */

  // Tool Configuration
  enabledTools: jsonb('enabled_tools').default([]),
  toolConfig: jsonb('tool_config').default({}),

  // Escalation Rules
  escalationRules: jsonb('escalation_rules').default({}),
  /*
    {
      "keywords": ["refund", "cancel", "urgent"],
      "sentimentThreshold": -0.5,
      "confidenceThreshold": 0.3,
      "autoEscalateAfter": 5
    }
  */

  // Business Hours
  businessHours: jsonb('business_hours').default({}),
  /*
    {
      "timezone": "America/New_York",
      "schedule": {
        "monday": { "start": "09:00", "end": "17:00" },
        ...
      },
      "outsideHoursMessage": "We're currently closed..."
    }
  */

  // Fallback Responses
  fallbackResponses: jsonb('fallback_responses').default({}),

  // Status
  status: agentStatusEnum('status').default('draft').notNull(),

  // Webhook Secrets
  webhookSecret: varchar('webhook_secret', { length: 64 }),

  // Analytics
  totalConversations: integer('total_conversations').default(0),
  totalMessages: integer('total_messages').default(0),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  companyIdx: index('agents_company_idx').on(table.companyId),
  statusIdx: index('agents_status_idx').on(table.status),
  companyStatusIdx: index('agents_company_status_idx').on(table.companyId, table.status),
}));

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
```

### 3.3 Agent Knowledge Category Assignments

```typescript
export const agentKnowledgeCategories = pgTable('chatapp_agent_knowledge_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => knowledgeCategories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  agentCategoryIdx: index('agent_knowledge_cat_idx').on(table.agentId, table.categoryId),
}));
```

---

## 4. Conversation Tables

### 4.1 Conversations (Sessions)

```typescript
// src/db/schema/conversations.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, index, integer } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { agents } from './agents';
import { users } from './users';

export const channelTypeEnum = pgEnum('channel_type', [
  'web',
  'whatsapp',
  'telegram',
  'messenger',
  'instagram',
  'slack',
  'teams',
  'custom'
]);

export const conversationStatusEnum = pgEnum('conversation_status', [
  'active',
  'waiting_human',
  'with_human',
  'resolved',
  'abandoned'
]);

export const conversations = pgTable('chatapp_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id),

  // Session Info
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  channel: channelTypeEnum('channel').notNull(),

  // Customer Info
  customerId: varchar('customer_id', { length: 255 }),
  customerName: varchar('customer_name', { length: 255 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerMetadata: jsonb('customer_metadata').default({}),

  // Channel-specific IDs
  externalId: varchar('external_id', { length: 255 }),
  // WhatsApp phone, Telegram chat_id, Slack channel, etc.

  // Status
  status: conversationStatusEnum('status').default('active').notNull(),
  isHumanAgent: boolean('is_human_agent').default(false),
  assignedAgentId: uuid('assigned_agent_id').references(() => users.id),

  // Context
  context: jsonb('context').default({}),
  // Accumulated context from conversation

  summary: text('summary'),
  // AI-generated summary for long conversations

  // Metrics
  messageCount: integer('message_count').default(0),
  aiMessageCount: integer('ai_message_count').default(0),
  humanMessageCount: integer('human_message_count').default(0),

  // Sentiment
  averageSentiment: decimal('average_sentiment', { precision: 3, scale: 2 }),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('conversations_company_idx').on(table.companyId),
  agentIdx: index('conversations_agent_idx').on(table.agentId),
  statusIdx: index('conversations_status_idx').on(table.status),
  channelIdx: index('conversations_channel_idx').on(table.channel),
  companyAgentIdx: index('conversations_company_agent_idx').on(table.companyId, table.agentId),
  lastMessageIdx: index('conversations_last_message_idx').on(table.lastMessageAt),
  sessionTokenIdx: index('conversations_session_token_idx').on(table.sessionToken),
}));

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
```

### 4.2 Messages

```typescript
export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
  'human_agent',
  'tool'
]);

export const messages = pgTable('chatapp_messages', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  conversationId: uuid('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),

  // Message Content
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),

  // For human agent messages
  senderId: uuid('sender_id').references(() => users.id),

  // Attachments
  attachments: jsonb('attachments').default([]),
  /*
    [
      {
        "type": "image",
        "url": "...",
        "name": "photo.jpg",
        "size": 12345,
        "mimeType": "image/jpeg"
      }
    ]
  */

  // Tool Calls (for assistant messages)
  toolCalls: jsonb('tool_calls').default([]),
  /*
    [
      {
        "id": "call_123",
        "name": "rag_search",
        "arguments": { "query": "..." },
        "result": { ... }
      }
    ]
  */

  // Metadata
  metadata: jsonb('metadata').default({}),
  /*
    {
      "model": "claude-3-5-sonnet",
      "tokens": { "input": 150, "output": 200 },
      "latency": 1234,
      "confidence": 0.95
    }
  */

  // Sentiment
  sentiment: decimal('sentiment', { precision: 3, scale: 2 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  roleIdx: index('messages_role_idx').on(table.role),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  conversationCreatedIdx: index('messages_conv_created_idx')
    .on(table.conversationId, table.createdAt),
}));

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

### 4.3 Internal Notes (Support Agent Notes)

```typescript
export const conversationNotes = pgTable('chatapp_conversation_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('notes_conversation_idx').on(table.conversationId),
}));
```

### 4.4 Escalations (HITL Tracking)

```typescript
export const escalationStatusEnum = pgEnum('escalation_status', [
  'pending',
  'assigned',
  'in_progress',
  'resolved',
  'returned_to_ai',
  'abandoned'
]);

export const escalationPriorityEnum = pgEnum('escalation_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

export const escalations = pgTable('chatapp_escalations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  conversationId: uuid('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id),

  // Assignment
  assignedTo: uuid('assigned_to').references(() => users.id),
  assignedBy: uuid('assigned_by').references(() => users.id),

  // Escalation Details
  reason: varchar('reason', { length: 255 }).notNull(),
  // 'keyword_trigger' | 'sentiment' | 'confidence' | 'explicit_request' | 'manual'
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerDetails: jsonb('trigger_details').default({}),
  /*
    {
      "keyword": "refund",
      "sentimentScore": -0.8,
      "confidenceScore": 0.3,
      "messageId": "..."
    }
  */

  // Priority & Status
  priority: escalationPriorityEnum('priority').default('medium').notNull(),
  status: escalationStatusEnum('status').default('pending').notNull(),

  // Resolution
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at'),

  // Metrics
  waitTime: integer('wait_time'), // seconds until first response
  handleTime: integer('handle_time'), // seconds to resolution

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('escalations_conversation_idx').on(table.conversationId),
  companyIdx: index('escalations_company_idx').on(table.companyId),
  assignedToIdx: index('escalations_assigned_to_idx').on(table.assignedTo),
  statusIdx: index('escalations_status_idx').on(table.status),
  companyStatusIdx: index('escalations_company_status_idx').on(table.companyId, table.status),
}));

export type Escalation = typeof escalations.$inferSelect;
export type NewEscalation = typeof escalations.$inferInsert;
```

### 4.5 Customers (Persistent Customer Profiles)

```typescript
export const customers = pgTable('chatapp_customers', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),

  // Identifiers
  externalId: varchar('external_id', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),

  // Profile
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),

  // Additional Info
  metadata: jsonb('metadata').default({}),
  /*
    {
      "company": "Acme Inc",
      "role": "CTO",
      "timezone": "America/New_York",
      "language": "en",
      "customFields": { ... }
    }
  */

  // Tags for categorization
  tags: jsonb('tags').default([]),

  // Notes (internal)
  notes: text('notes'),

  // Stats
  totalConversations: integer('total_conversations').default(0),
  lastConversationAt: timestamp('last_conversation_at'),

  // Channel Identifiers
  channelIds: jsonb('channel_ids').default({}),
  /*
    {
      "whatsapp": "+1234567890",
      "telegram": "123456789",
      "slack": "U123456"
    }
  */

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('customers_company_idx').on(table.companyId),
  emailIdx: index('customers_email_idx').on(table.email),
  phoneIdx: index('customers_phone_idx').on(table.phone),
  companyEmailIdx: index('customers_company_email_idx').on(table.companyId, table.email),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
```

---

## 5. Knowledge Base Tables

### 5.1 Knowledge Categories

```typescript
// src/db/schema/knowledge.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const knowledgeCategories = pgTable('chatapp_knowledge_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id),

  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  description: text('description'),

  // Parent category for hierarchy
  parentId: uuid('parent_id').references(() => knowledgeCategories.id),

  // Display order
  sortOrder: integer('sort_order').default(0),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('knowledge_cat_company_idx').on(table.companyId),
  companySlugIdx: index('knowledge_cat_company_slug_idx').on(table.companyId, table.slug),
}));

export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type NewKnowledgeCategory = typeof knowledgeCategories.$inferInsert;
```

### 5.2 Knowledge Files

```typescript
export const fileStatusEnum = pgEnum('file_status', [
  'pending',
  'processing',
  'indexed',
  'failed'
]);

export const knowledgeFiles = pgTable('chatapp_knowledge_files', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  categoryId: uuid('category_id').notNull().references(() => knowledgeCategories.id),

  // File Info
  filename: varchar('filename', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(), // bytes

  // Storage
  storagePath: varchar('storage_path', { length: 500 }).notNull(),
  storageUrl: varchar('storage_url', { length: 500 }),

  // Processing Status
  status: fileStatusEnum('status').default('pending').notNull(),
  processingError: text('processing_error'),

  // Indexing Metadata
  chunkCount: integer('chunk_count').default(0),
  qdrantCollection: varchar('qdrant_collection', { length: 255 }),

  // Document Metadata (extracted)
  metadata: jsonb('metadata').default({}),
  /*
    {
      "title": "...",
      "author": "...",
      "pageCount": 10,
      "wordCount": 5000,
      "summary": "..."
    }
  */

  // Uploaded by
  uploadedBy: uuid('uploaded_by').references(() => users.id),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  indexedAt: timestamp('indexed_at'),
}, (table) => ({
  companyIdx: index('knowledge_files_company_idx').on(table.companyId),
  categoryIdx: index('knowledge_files_category_idx').on(table.categoryId),
  statusIdx: index('knowledge_files_status_idx').on(table.status),
}));

export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type NewKnowledgeFile = typeof knowledgeFiles.$inferInsert;
```

### 5.3 Knowledge Chunks (Metadata Reference)

```typescript
// Note: Actual vectors stored in Qdrant (free tier, auto-offloading for idle collections), this is metadata reference
export const knowledgeChunks = pgTable('chatapp_knowledge_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),

  fileId: uuid('file_id').notNull()
    .references(() => knowledgeFiles.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id),

  // Chunk Info
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),

  // Position in source
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
  pageNumber: integer('page_number'),
  sectionTitle: varchar('section_title', { length: 255 }),

  // Qdrant Reference
  qdrantId: varchar('qdrant_id', { length: 36 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fileIdx: index('knowledge_chunks_file_idx').on(table.fileId),
  companyIdx: index('knowledge_chunks_company_idx').on(table.companyId),
  qdrantIdx: index('knowledge_chunks_qdrant_idx').on(table.qdrantId),
}));
```

---

## 6. Subscription & Billing Tables

### 6.1 Subscription Plans

```typescript
// src/db/schema/subscriptions.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer, decimal } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const subscriptionPlans = pgTable('chatapp_subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),

  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),

  // Pricing
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  setupFee: decimal('setup_fee', { precision: 10, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 3 }).default('USD'),

  // Billing Cycle
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(),
  // 'monthly' | 'quarterly' | 'semi_annual' | 'annual'

  // Limits
  limits: jsonb('limits').default({}).notNull(),
  /*
    {
      "messagesPerMonth": 10000,
      "agentCount": 5,
      "supportSeats": 10,
      "storageGb": 10,
      "maxFileSize": 52428800,
      "apiRateLimit": 100,
      "knowledgeCategories": 20
    }
  */

  // Features
  features: jsonb('features').default([]),
  // ['whatsapp', 'telegram', 'slack', 'teams', 'voice', 'analytics_advanced']

  // Status
  isActive: boolean('is_active').default(true),
  isPublic: boolean('is_public').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
```

### 6.2 Company Subscriptions

```typescript
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trial',
  'active',
  'past_due',
  'grace_period',
  'expired',
  'cancelled'
]);

export const companySubscriptions = pgTable('chatapp_company_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),

  // Custom Pricing (overrides plan defaults)
  customPrice: decimal('custom_price', { precision: 10, scale: 2 }),
  customSetupFee: decimal('custom_setup_fee', { precision: 10, scale: 2 }),

  // Custom Limits (overrides plan defaults)
  customLimits: jsonb('custom_limits').default({}),

  // Status
  status: subscriptionStatusEnum('status').default('trial').notNull(),

  // Dates
  trialEndsAt: timestamp('trial_ends_at'),
  startsAt: timestamp('starts_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  gracePeriodEndsAt: timestamp('grace_period_ends_at'),
  cancelledAt: timestamp('cancelled_at'),

  // Grace Period Config
  gracePeriodDays: integer('grace_period_days').default(7),

  // Auto-renewal
  autoRenew: boolean('auto_renew').default(true),

  // Notes
  notes: text('notes'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('subscriptions_company_idx').on(table.companyId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
  expiresAtIdx: index('subscriptions_expires_at_idx').on(table.expiresAt),
}));

export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type NewCompanySubscription = typeof companySubscriptions.$inferInsert;
```

### 6.3 Usage Tracking

```typescript
export const usageRecords = pgTable('chatapp_usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),

  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').references(() => agents.id),

  // Period
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),

  // Metrics
  messageCount: integer('message_count').default(0),
  aiResponseCount: integer('ai_response_count').default(0),
  tokenCount: integer('token_count').default(0),
  storageBytes: bigint('storage_bytes', { mode: 'number' }).default(0),
  apiCalls: integer('api_calls').default(0),

  // Costs
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 4 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyPeriodIdx: index('usage_company_period_idx')
    .on(table.companyId, table.periodStart),
  agentIdx: index('usage_agent_idx').on(table.agentId),
}));
```

---

## 7. Channel Integration Tables

### 7.1 Channel Configurations

```typescript
// src/db/schema/channels.ts
import { pgTable, uuid, varchar, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { agents } from './agents';

export const channelConfigs = pgTable('chatapp_channel_configs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id),

  // Channel
  channel: channelTypeEnum('channel').notNull(),

  // Credentials (encrypted)
  credentials: jsonb('credentials').default({}).notNull(),
  /*
    WhatsApp:
    {
      "phoneNumberId": "...",
      "accessToken": "encrypted:...",
      "webhookVerifyToken": "..."
    }

    Telegram:
    {
      "botToken": "encrypted:...",
      "webhookSecret": "..."
    }
  */

  // Webhook
  webhookId: varchar('webhook_id', { length: 50 }).notNull(),
  webhookUrl: varchar('webhook_url', { length: 500 }),
  webhookSecret: varchar('webhook_secret', { length: 64 }),

  // Status
  isActive: boolean('is_active').default(true),
  isVerified: boolean('is_verified').default(false),
  lastVerifiedAt: timestamp('last_verified_at'),

  // Channel-specific Settings
  settings: jsonb('settings').default({}),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyAgentChannelIdx: index('channel_config_idx')
    .on(table.companyId, table.agentId, table.channel),
  webhookIdx: index('channel_webhook_idx').on(table.webhookId),
}));

export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type NewChannelConfig = typeof channelConfigs.$inferInsert;
```

### 7.2 Widget Configurations

```typescript
export const widgetConfigs = pgTable('chatapp_widget_configs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id),

  // Appearance
  theme: varchar('theme', { length: 20 }).default('light'),
  position: varchar('position', { length: 20 }).default('bottom-right'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#007bff'),

  // Branding
  title: varchar('title', { length: 100 }),
  subtitle: varchar('subtitle', { length: 200 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  logoUrl: varchar('logo_url', { length: 500 }),

  // Behavior
  showBranding: boolean('show_branding').default(true),
  autoOpen: boolean('auto_open').default(false),
  autoOpenDelay: integer('auto_open_delay').default(5000),

  // Welcome Message
  welcomeMessage: text('welcome_message'),
  placeholderText: varchar('placeholder_text', { length: 200 }),

  // Features
  enableVoice: boolean('enable_voice').default(false),
  enableFileUpload: boolean('enable_file_upload').default(true),
  enableEmoji: boolean('enable_emoji').default(true),

  // Custom CSS
  customCss: text('custom_css'),

  // Allowed Domains (CORS)
  allowedDomains: jsonb('allowed_domains').default([]),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyAgentIdx: index('widget_config_idx').on(table.companyId, table.agentId),
}));

export type WidgetConfig = typeof widgetConfigs.$inferSelect;
export type NewWidgetConfig = typeof widgetConfigs.$inferInsert;
```

### 7.3 API Keys

```typescript
export const apiKeys = pgTable('chatapp_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),

  // Key Details
  name: varchar('name', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(), // First 8 chars for display
  keyHash: varchar('key_hash', { length: 255 }).notNull(),

  // Permissions
  permissions: jsonb('permissions').default([]),
  // ['read:conversations', 'write:messages', 'read:analytics']

  // Rate Limiting
  rateLimit: integer('rate_limit').default(100), // requests per minute

  // Status
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),

  // Expiration
  expiresAt: timestamp('expires_at'),

  // Created by
  createdBy: uuid('created_by').references(() => users.id),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('api_keys_company_idx').on(table.companyId),
  keyPrefixIdx: index('api_keys_prefix_idx').on(table.keyPrefix),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
```

### 7.4 Outbound Webhooks

```typescript
export const webhooks = pgTable('chatapp_webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').references(() => agents.id), // Optional: apply to specific agent

  // Webhook Details
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  secret: varchar('secret', { length: 64 }).notNull(),

  // Events to trigger on
  events: jsonb('events').default([]).notNull(),
  // ['conversation.created', 'message.received', 'escalation.created', 'conversation.resolved']

  // Headers
  headers: jsonb('headers').default({}),

  // Status
  isActive: boolean('is_active').default(true),

  // Retry Configuration
  maxRetries: integer('max_retries').default(3),
  retryDelay: integer('retry_delay').default(1000), // milliseconds

  // Stats
  successCount: integer('success_count').default(0),
  failureCount: integer('failure_count').default(0),
  lastTriggeredAt: timestamp('last_triggered_at'),
  lastSuccessAt: timestamp('last_success_at'),
  lastFailureAt: timestamp('last_failure_at'),
  lastError: text('last_error'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('webhooks_company_idx').on(table.companyId),
  agentIdx: index('webhooks_agent_idx').on(table.agentId),
}));

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
```

---

## 8. Analytics Tables

### 8.1 Daily Aggregates

```typescript
// src/db/schema/analytics.ts
import { pgTable, uuid, date, integer, decimal, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { agents } from './agents';

export const dailyAnalytics = pgTable('chatapp_daily_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Dimensions
  companyId: uuid('company_id').notNull().references(() => companies.id),
  agentId: uuid('agent_id').references(() => agents.id),
  channel: channelTypeEnum('channel'),
  date: date('date').notNull(),

  // Conversation Metrics
  totalConversations: integer('total_conversations').default(0),
  newConversations: integer('new_conversations').default(0),
  resolvedConversations: integer('resolved_conversations').default(0),
  escalatedConversations: integer('escalated_conversations').default(0),
  abandonedConversations: integer('abandoned_conversations').default(0),

  // Message Metrics
  totalMessages: integer('total_messages').default(0),
  userMessages: integer('user_messages').default(0),
  aiMessages: integer('ai_messages').default(0),
  humanAgentMessages: integer('human_agent_messages').default(0),

  // Performance Metrics
  avgResponseTime: decimal('avg_response_time', { precision: 10, scale: 2 }),
  avgConversationDuration: decimal('avg_conversation_duration', { precision: 10, scale: 2 }),
  avgMessagesPerConversation: decimal('avg_messages_per_conversation', { precision: 5, scale: 2 }),

  // AI Metrics
  avgConfidenceScore: decimal('avg_confidence_score', { precision: 3, scale: 2 }),
  avgSentimentScore: decimal('avg_sentiment_score', { precision: 3, scale: 2 }),
  totalTokensUsed: integer('total_tokens_used').default(0),

  // RAG Metrics
  ragQueriesCount: integer('rag_queries_count').default(0),
  avgRagRelevance: decimal('avg_rag_relevance', { precision: 3, scale: 2 }),

  // Cost Metrics
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 4 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyDateIdx: index('daily_analytics_company_date_idx')
    .on(table.companyId, table.date),
  agentDateIdx: index('daily_analytics_agent_date_idx')
    .on(table.agentId, table.date),
  dateIdx: index('daily_analytics_date_idx').on(table.date),
}));

export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type NewDailyAnalytics = typeof dailyAnalytics.$inferInsert;
```

---

## 9. Audit & Security Tables

### 9.1 Audit Logs

```typescript
// src/db/schema/audit.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, index, inet } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { users } from './users';

export const auditLogs = pgTable('chatapp_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Actor
  userId: uuid('user_id').references(() => users.id),
  companyId: uuid('company_id').references(() => companies.id),

  // Action
  action: varchar('action', { length: 100 }).notNull(),
  // 'user.login', 'agent.create', 'knowledge.upload', etc.

  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),

  // Details
  details: jsonb('details').default({}),
  /*
    {
      "before": { ... },
      "after": { ... },
      "reason": "..."
    }
  */

  // Request Context
  ipAddress: inet('ip_address'),
  userAgent: varchar('user_agent', { length: 500 }),

  // Result
  success: boolean('success').default(true),
  errorMessage: text('error_message'),

  // Timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('audit_logs_user_idx').on(table.userId),
  companyIdx: index('audit_logs_company_idx').on(table.companyId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  resourceIdx: index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

### 9.2 Rate Limiting (Tracking)

```typescript
export const rateLimitRecords = pgTable('chatapp_rate_limit_records', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identifier
  key: varchar('key', { length: 255 }).notNull(),
  // 'company:{id}:api', 'ip:{address}:login', etc.

  // Window
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),

  // Count
  requestCount: integer('request_count').default(0),

  // Limits
  limitValue: integer('limit_value').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyWindowIdx: index('rate_limit_key_window_idx').on(table.key, table.windowStart),
}));
```

---

## 10. Team & Support Tables

### 10.1 Invitations

```typescript
// src/db/schema/invitations.ts
import { pgTable, uuid, varchar, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { users } from './users';

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked'
]);

export const invitations = pgTable('chatapp_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),

  // Invitation Details
  email: varchar('email', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('support_agent'),
  token: varchar('token', { length: 64 }).notNull().unique(),

  // Status
  status: invitationStatusEnum('status').default('pending').notNull(),

  // Expiration
  expiresAt: timestamp('expires_at').notNull(),

  // Acceptance
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: uuid('accepted_by').references(() => users.id),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('invitations_company_idx').on(table.companyId),
  emailIdx: index('invitations_email_idx').on(table.email),
  tokenIdx: index('invitations_token_idx').on(table.token),
  statusIdx: index('invitations_status_idx').on(table.status),
}));

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
```

### 10.2 Canned Responses (Quick Replies)

```typescript
export const cannedResponses = pgTable('chatapp_canned_responses', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  companyId: uuid('company_id').notNull().references(() => companies.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),

  // Response Details
  title: varchar('title', { length: 255 }).notNull(),
  shortcut: varchar('shortcut', { length: 50 }), // e.g., "/thanks" or "#refund"
  content: text('content').notNull(),

  // Categorization
  category: varchar('category', { length: 100 }),
  tags: jsonb('tags').default([]),

  // Scope
  isGlobal: boolean('is_global').default(true), // Available to all agents in company
  agentIds: jsonb('agent_ids').default([]), // Specific agents if not global

  // Usage Stats
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),

  // Status
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyIdx: index('canned_responses_company_idx').on(table.companyId),
  shortcutIdx: index('canned_responses_shortcut_idx').on(table.shortcut),
  categoryIdx: index('canned_responses_category_idx').on(table.category),
}));

export type CannedResponse = typeof cannedResponses.$inferSelect;
export type NewCannedResponse = typeof cannedResponses.$inferInsert;
```

### 10.3 Support Agent Status

```typescript
export const supportAgentStatusEnum = pgEnum('support_agent_status', [
  'online',
  'busy',
  'away',
  'offline'
]);

export const supportAgentStatus = pgTable('chatapp_support_agent_status', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relations
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  companyId: uuid('company_id').notNull().references(() => companies.id),

  // Status
  status: supportAgentStatusEnum('status').default('offline').notNull(),
  statusMessage: varchar('status_message', { length: 255 }),

  // Capacity
  maxConcurrentChats: integer('max_concurrent_chats').default(5),
  currentChatCount: integer('current_chat_count').default(0),

  // Timestamps
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  statusChangedAt: timestamp('status_changed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('support_agent_status_user_idx').on(table.userId),
  companyIdx: index('support_agent_status_company_idx').on(table.companyId),
  statusIdx: index('support_agent_status_status_idx').on(table.status),
}));

export type SupportAgentStatus = typeof supportAgentStatus.$inferSelect;
export type NewSupportAgentStatus = typeof supportAgentStatus.$inferInsert;
```

---

## 11. Row-Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE chatapp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatapp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatapp_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatapp_knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatapp_knowledge_files ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Example Policy: Users can only access their own company's data
CREATE POLICY "company_isolation" ON chatapp_agents
  FOR ALL
  USING (
    company_id = current_setting('app.current_company_id')::uuid
    OR current_setting('app.user_role') = 'master_admin'
  );

-- Example Policy: Support agents can only see assigned conversations
CREATE POLICY "support_agent_conversations" ON chatapp_conversations
  FOR SELECT
  USING (
    current_setting('app.user_role') = 'master_admin'
    OR current_setting('app.user_role') = 'company_admin'
    OR (
      current_setting('app.user_role') = 'support_agent'
      AND (
        assigned_agent_id = current_setting('app.current_user_id')::uuid
        OR assigned_agent_id IS NULL
      )
    )
  );

-- Example Policy: Messages inherit conversation access
CREATE POLICY "message_access" ON chatapp_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatapp_conversations c
      WHERE c.id = conversation_id
      AND c.company_id = current_setting('app.current_company_id')::uuid
    )
    OR current_setting('app.user_role') = 'master_admin'
  );
```

---

## 12. Indexes

### Critical Performance Indexes

```sql
-- Conversation lookups (hot path)
CREATE INDEX CONCURRENTLY idx_conversations_company_agent_status
  ON chatapp_conversations(company_id, agent_id, status)
  WHERE deleted_at IS NULL;

-- Message retrieval for conversations
CREATE INDEX CONCURRENTLY idx_messages_conversation_created
  ON chatapp_messages(conversation_id, created_at DESC);

-- Active subscription lookup
CREATE INDEX CONCURRENTLY idx_subscriptions_company_active
  ON chatapp_company_subscriptions(company_id)
  WHERE status IN ('active', 'trial');

-- Expiring subscriptions (for notifications)
CREATE INDEX CONCURRENTLY idx_subscriptions_expires_soon
  ON chatapp_company_subscriptions(expires_at)
  WHERE status = 'active';

-- Knowledge file processing queue
CREATE INDEX CONCURRENTLY idx_knowledge_files_pending
  ON chatapp_knowledge_files(created_at)
  WHERE status = 'pending';

-- Audit log queries
CREATE INDEX CONCURRENTLY idx_audit_logs_company_created
  ON chatapp_audit_logs(company_id, created_at DESC);
```

---

## 13. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ENTITY RELATIONSHIPS                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │ chatapp_         │
                              │ subscription_    │
                              │     plans        │
                              └────────┬─────────┘
                                       │
                                       │ 1:N
                                       ▼
                          ┌──────────────────┐    1:N    ┌──────────────────┐
                          │chatapp_companies │─────────▶│  chatapp_users   │
                          └────────┬─────────┘           └──────────────────┘
                                   │                              │
                                   │ 1:N                          │
                                   ▼                              │
┌──────────────────┐       ┌──────────────────┐                   │
│ chatapp_agents   │◀──────│ chatapp_company_ │                   │
└────────┬─────────┘       │ subscriptions    │                   │
         │                 └──────────────────┘                   │
         │                                                         │
         │ 1:N                                                     │
         ▼                                                         │
┌──────────────────┐    N:1 (assigned_agent)                      │
│chatapp_          │                                              │
│ conversations    │◀──────────────────────────────────────────────┘
└────────┬─────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│chatapp_messages  │
└──────────────────┘


┌──────────────────┐    1:N    ┌──────────────────┐    1:N    ┌──────────────────┐
│chatapp_companies │──────────▶│ chatapp_         │──────────▶│ chatapp_         │
└──────────────────┘           │ knowledge_       │           │ knowledge_files  │
                               │   categories     │           └────────┬─────────┘
                               └──────────────────┘                    │
                                       ▲                               │ 1:N
                                       │ N:M                           ▼
                                       │                       ┌──────────────────┐
                               ┌───────┴──────────┐           │ chatapp_         │
                               │ chatapp_agent_   │           │ knowledge_chunks │
                               │ knowledge_cats   │           └──────────────────┘
                               └──────────────────┘
                                       ▲
                                       │
                               ┌───────┴──────────┐
                               │ chatapp_agents   │
                               └──────────────────┘


┌──────────────────┐    1:N    ┌──────────────────┐
│ chatapp_agents   │──────────▶│chatapp_channel_  │
└──────────────────┘           │     configs      │
         │                     └──────────────────┘
         │ 1:1
         ▼
┌──────────────────┐
│chatapp_widget_   │
│     configs      │
└──────────────────┘


           ┌───────────────────────────────────────────────────────┐
           │                 NEW TABLES ADDED                       │
           └───────────────────────────────────────────────────────┘

┌──────────────────┐
│chatapp_agent_    │
│    packages      │ ◀──────── Master Admin manages pluggable agent code
└────────┬─────────┘
         │ N:1
         ▼
┌──────────────────┐    1:N    ┌──────────────────┐
│ chatapp_agents   │──────────▶│chatapp_          │
└──────────────────┘           │   escalations    │
                               └──────────────────┘

┌──────────────────┐    1:N    ┌──────────────────┐    1:N    ┌──────────────────┐
│chatapp_companies │──────────▶│chatapp_customers │◀─────────│chatapp_          │
└────────┬─────────┘           └──────────────────┘           │  conversations   │
         │                                                     └──────────────────┘
         ├──────────────────────────────────────────┐
         │                                          │
         │ 1:N                                      │ 1:N
         ▼                                          ▼
┌──────────────────┐                       ┌──────────────────┐
│chatapp_          │                       │chatapp_canned_   │
│   invitations    │                       │    responses     │
└──────────────────┘                       └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│ chatapp_api_keys │
└──────────────────┘

┌──────────────────┐                       ┌────────────────────┐
│chatapp_webhooks  │ ◀──────────────────── │ chatapp_support_   │
└──────────────────┘   (Company outbound)  │   agent_status     │
                                           └────────────────────┘
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Auth & Multi-tenancy Architecture](./architecture-auth-multitenancy.md)
- [Requirements Document](./requirement.v2.md)
