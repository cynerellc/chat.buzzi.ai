# Step 02: Database Schema Implementation

## Objective
Implement the complete database schema using Drizzle ORM, including all tables defined in the database specification, relationships, indexes, and initial migrations.

---

## Prerequisites
- Step 01 completed
- PostgreSQL database running (Supabase)
- Qdrant instance configured for vector storage (see Step 12)

---

## Reference Document
- [Database Schema Specification](../database-schema.md)

---

## Tasks

### 2.1 Enable PostgreSQL Extensions

Create initial migration for required extensions:

**Extensions to enable:**
- `uuid-ossp` - UUID generation
- `pg_trgm` - Text search optimization (optional)

> **Note:** Vector embeddings are stored in Qdrant (external vector database with free tier and auto-offloading for idle collections), not PostgreSQL. The `knowledge_chunks` table contains a `qdrant_id` reference to the vector in Qdrant.

### 2.2 Create Schema Directory Structure

```
src/lib/db/
├── index.ts           # Database client
├── schema/
│   ├── index.ts       # Export all schemas
│   ├── companies.ts   # Company & subscription tables
│   ├── users.ts       # User & auth tables
│   ├── agents.ts      # AI agent tables
│   ├── knowledge.ts   # Knowledge base tables
│   ├── conversations.ts # Conversation & message tables
│   ├── analytics.ts   # Analytics tables
│   ├── integrations.ts # Integration tables
│   └── enums.ts       # Enum definitions
├── migrations/        # Generated migrations
└── seed.ts           # Seed data
```

### 2.3 Define Enums

Create enum types for:

**User/Role Enums:**
- `user_role`: master_admin, company_admin, support_agent
- `user_status`: active, inactive, pending, suspended

**Agent Enums:**
- `agent_status`: draft, active, paused, archived
- `agent_type`: support, sales, general, custom

**Conversation Enums:**
- `conversation_status`: active, waiting, resolved, archived
- `message_role`: user, assistant, system
- `message_type`: text, image, file, system_event
- `channel_type`: widget, whatsapp, telegram, slack, teams, email

**Subscription Enums:**
- `plan_type`: free, starter, professional, enterprise
- `billing_cycle`: monthly, yearly

### 2.4 Implement Core Tables

#### Companies Table
```
chatapp_companies
├── id (uuid, pk)
├── name (text)
├── slug (text, unique)
├── domain (text)
├── logo_url (text)
├── settings (jsonb)
├── subscription_plan_id (uuid, fk)
├── subscription_status
├── trial_ends_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Subscription Plans Table
```
chatapp_subscription_plans
├── id (uuid, pk)
├── name (text)
├── slug (text, unique)
├── description (text)
├── price_monthly (decimal)
├── price_yearly (decimal)
├── features (jsonb)
├── limits (jsonb)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Users Table
```
chatapp_users
├── id (uuid, pk)
├── email (text, unique)
├── name (text)
├── avatar_url (text)
├── role (enum)
├── company_id (uuid, fk, nullable)
├── status (enum)
├── settings (jsonb)
├── last_login_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.5 Implement Agent Tables

#### Agents Table
```
chatapp_agents
├── id (uuid, pk)
├── company_id (uuid, fk)
├── name (text)
├── description (text)
├── avatar_url (text)
├── type (enum)
├── status (enum)
├── system_prompt (text)
├── welcome_message (text)
├── model_config (jsonb)
├── tools_config (jsonb)
├── escalation_config (jsonb)
├── widget_config (jsonb)
├── created_by (uuid, fk)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Agent Packages Table (Master Admin)
```
chatapp_agent_packages
├── id (uuid, pk)
├── name (text)
├── description (text)
├── category (text)
├── icon (text)
├── base_prompt (text)
├── suggested_tools (jsonb)
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.6 Implement Knowledge Base Tables

#### Knowledge Sources Table
```
chatapp_knowledge_sources
├── id (uuid, pk)
├── company_id (uuid, fk)
├── agent_id (uuid, fk, nullable)
├── name (text)
├── type (enum: file, url, text)
├── status (enum: processing, ready, error)
├── file_path (text)
├── file_type (text)
├── file_size (integer)
├── url (text)
├── content_hash (text)
├── metadata (jsonb)
├── created_by (uuid, fk)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Knowledge Chunks Table
```
chatapp_knowledge_chunks
├── id (uuid, pk)
├── source_id (uuid, fk)
├── company_id (uuid, fk)
├── content (text)
├── embedding (vector(1536))
├── metadata (jsonb)
├── chunk_index (integer)
├── token_count (integer)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Index:** Create vector similarity index on `embedding` column.

### 2.7 Implement Conversation Tables

#### Conversations Table
```
chatapp_conversations
├── id (uuid, pk)
├── company_id (uuid, fk)
├── agent_id (uuid, fk)
├── customer_id (uuid, fk)
├── assigned_user_id (uuid, fk, nullable)
├── channel (enum)
├── channel_conversation_id (text)
├── status (enum)
├── priority (integer)
├── tags (text[])
├── metadata (jsonb)
├── started_at (timestamp)
├── resolved_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Messages Table
```
chatapp_messages
├── id (uuid, pk)
├── conversation_id (uuid, fk)
├── role (enum)
├── type (enum)
├── content (text)
├── attachments (jsonb)
├── metadata (jsonb)
├── tokens_used (integer)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Customers Table
```
chatapp_customers
├── id (uuid, pk)
├── company_id (uuid, fk)
├── external_id (text)
├── email (text)
├── name (text)
├── phone (text)
├── avatar_url (text)
├── metadata (jsonb)
├── tags (text[])
├── first_seen_at (timestamp)
├── last_seen_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.8 Implement Team & Invitation Tables

#### Team Invitations Table
```
chatapp_team_invitations
├── id (uuid, pk)
├── company_id (uuid, fk)
├── email (text)
├── role (enum)
├── invited_by (uuid, fk)
├── token (text, unique)
├── status (enum: pending, accepted, expired)
├── expires_at (timestamp)
├── accepted_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.9 Implement Analytics Tables

#### Conversation Analytics Table
```
chatapp_conversation_analytics
├── id (uuid, pk)
├── company_id (uuid, fk)
├── conversation_id (uuid, fk)
├── agent_id (uuid, fk)
├── resolution_type (enum: ai, human, abandoned)
├── messages_count (integer)
├── ai_messages_count (integer)
├── human_messages_count (integer)
├── response_time_avg (integer)
├── duration_seconds (integer)
├── satisfaction_score (integer)
├── escalated (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Daily Analytics Table
```
chatapp_daily_analytics
├── id (uuid, pk)
├── company_id (uuid, fk)
├── date (date)
├── conversations_total (integer)
├── conversations_resolved (integer)
├── conversations_escalated (integer)
├── messages_total (integer)
├── avg_response_time (integer)
├── avg_satisfaction (decimal)
├── tokens_used (integer)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.10 Implement Integration Tables

#### Integrations Table
```
chatapp_integrations
├── id (uuid, pk)
├── company_id (uuid, fk)
├── type (enum: slack, zapier, salesforce, etc.)
├── name (text)
├── config (jsonb, encrypted)
├── status (enum: active, inactive, error)
├── last_sync_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)
```

#### Webhooks Table
```
chatapp_webhooks
├── id (uuid, pk)
├── company_id (uuid, fk)
├── url (text)
├── events (text[])
├── secret (text)
├── is_active (boolean)
├── last_triggered_at (timestamp)
├── failure_count (integer)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.11 Implement Audit Log Table

```
chatapp_audit_logs
├── id (uuid, pk)
├── company_id (uuid, fk, nullable)
├── user_id (uuid, fk, nullable)
├── action (text)
├── resource_type (text)
├── resource_id (uuid)
├── old_values (jsonb)
├── new_values (jsonb)
├── ip_address (text)
├── user_agent (text)
├── created_at (timestamp)
└── (no updated_at - immutable)
```

### 2.12 Implement Widget Settings Table

```
chatapp_widget_settings
├── id (uuid, pk)
├── company_id (uuid, fk, unique)
├── agent_id (uuid, fk)
├── appearance (jsonb)
├── behavior (jsonb)
├── launcher (jsonb)
├── chat_window (jsonb)
├── embed_code (text)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.13 Implement Canned Responses Table

```
chatapp_canned_responses
├── id (uuid, pk)
├── company_id (uuid, fk)
├── user_id (uuid, fk, nullable)
├── shortcut (text)
├── title (text)
├── content (text)
├── category (text)
├── tags (text[])
├── is_team (boolean)
├── usage_count (integer)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 2.14 Create Indexes

**Critical Indexes:**
- `chatapp_companies.slug` - Unique index
- `chatapp_users.email` - Unique index
- `chatapp_users.company_id` - Foreign key lookup
- `chatapp_agents.company_id` - Foreign key lookup
- `chatapp_conversations.company_id, status` - Composite index
- `chatapp_conversations.assigned_user_id` - Assignment lookup
- `chatapp_messages.conversation_id, created_at` - Message ordering
- `chatapp_knowledge_chunks.company_id` - Tenant isolation
- `chatapp_knowledge_chunks.embedding` - Vector similarity (IVFFlat or HNSW)
- `chatapp_customers.company_id, email` - Customer lookup
- `chatapp_audit_logs.company_id, created_at` - Audit queries

### 2.15 Create Relations

Define Drizzle relations:

- Company hasMany Users, Agents, Conversations, KnowledgeSources
- User belongsTo Company
- Agent belongsTo Company, hasMany Conversations
- Conversation belongsTo Company, Agent, Customer, User
- Message belongsTo Conversation
- KnowledgeSource hasMany KnowledgeChunks
- etc.

### 2.16 Generate Initial Migration

Run Drizzle Kit to generate migration:

```bash
npx drizzle-kit generate
npx drizzle-kit push  # or migrate
```

### 2.17 Create Seed Script

Create `src/lib/db/seed.ts` with:

- Default subscription plans (Free, Starter, Professional, Enterprise)
- Default agent packages (Support, Sales, FAQ, etc.)
- Test master admin user (for development)

---

## Database Diagram

```
┌─────────────────┐     ┌─────────────────┐
│ chatapp_        │     │ chatapp_        │
│ subscription_   │     │   companies     │
│    plans        │────▶│                 │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ chatapp_users   │     │ chatapp_agents  │     │  chatapp_       │
│                 │     │                 │     │  knowledge_     │
└────────┬────────┘     └────────┬────────┘     │   sources       │
         │                       │              └────────┬────────┘
         │              ┌────────┴────────┐              │
         │              │                 │              ▼
         │              ▼                 │     ┌─────────────────┐
         │     ┌─────────────────┐        │     │ chatapp_        │
         │     │ chatapp_        │        │     │ knowledge_      │
         │     │  conversations  │◀───────┘     │  chunks         │
         │     └────────┬────────┘              └─────────────────┘
         │              │
         │              ▼
         │     ┌─────────────────┐
         │     │ chatapp_        │
         │     │   messages      │
         │     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ chatapp_canned_ │
│  responses      │
└─────────────────┘
```

---

## Validation Checklist

- [ ] All tables created successfully
- [ ] Foreign key relationships work correctly
- [ ] Indexes are created
- [ ] Vector extension enabled and working
- [ ] Migrations generate without errors
- [ ] Seed data inserts correctly
- [ ] Multi-tenant queries work (company_id filtering)

---

## Next Step
[Step 03 - Authentication System](./step-03-authentication.md)

---

## Related Documentation
- [Database Schema Specification](../database-schema.md)
- [Architecture Overview](../architecture-overview.md)
- [Auth & Multi-tenancy](../architecture-auth-multitenancy.md)
