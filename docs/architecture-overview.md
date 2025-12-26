# Architecture Overview: Multi-Tenant AI Chatbot SaaS Platform

## 1. Executive Summary

This document describes the high-level architecture for `chat.buzzi.ai`, a multi-tenant AI chatbot SaaS platform. The system enables enterprises to deploy AI-powered chatbots across multiple communication channels with features including pluggable agent logic, RAG-based knowledge retrieval, human-in-the-loop support, and comprehensive analytics.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15 (App Router) | SSR, API routes, dashboard UI |
| **Styling** | Tailwind CSS 4, shadcn ui framework | Component library, responsive design |
| **Animation** | Framer Motion | Smooth UI transitions |
| **Language** | TypeScript | Type safety across stack |
| **ORM** | Drizzle ORM | Type-safe database queries |
| **Database** | PostgreSQL (Supabase) | Primary relational data store |
| **Vector Store** | Qdrant | RAG embeddings, semantic search (free tier, multi-tenant with auto-offloading) |
| **Cache** | Redis | Session state, chat history, rate limiting |
| **Queue** | BullMQ | Background job processing |
| **Auth** | Auth.js (NextAuth) | Authentication, session management |
| **i18n** | Paraglide | Internationalization |
| **Hosting** | Cloudflare | CDN, Workers, D1, R2 Storage |
| **File Storage** | Supabase Storage / Cloudflare R2 | Document uploads, agent packages |

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Web Widget  │  │   WhatsApp   │  │   Telegram   │  │  Other Channels      │ │
│  │  (Embedded)  │  │  Business    │  │     Bot      │  │  (Slack/Teams/etc)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────┼────────────────────┼──────────────┘
          │                 │                 │                    │
          ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EDGE LAYER (Cloudflare)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │   CDN / Cache   │  │  DDoS Protection │  │  Custom Domain SSL Termination │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER (Next.js)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         NEXT.JS APP ROUTER                                │   │
│  ├──────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Dashboard UI   │  │  Widget Loader  │  │  Public Marketing Site  │   │   │
│  │  │  (Admin/Agent)  │  │  (CDN Served)   │  │                         │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │   │
│  │                                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐   │   │
│  │  │                        API ROUTES                                  │   │   │
│  │  ├───────────────────────────────────────────────────────────────────┤   │   │
│  │  │  /api/webhooks/*     │  Channel webhook handlers                  │   │   │
│  │  │  /api/chat/*         │  Chat session management, SSE streaming    │   │   │
│  │  │  /api/agents/*       │  Agent CRUD, configuration                 │   │   │
│  │  │  /api/companies/*    │  Company/tenant management                 │   │   │
│  │  │  /api/knowledge/*    │  Knowledge base operations                 │   │   │
│  │  │  /api/admin/*        │  Master admin operations                   │   │   │
│  │  │  /api/auth/*         │  Auth.js endpoints                         │   │   │
│  │  └───────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │   Agent Runner     │  │   RAG Service      │  │   Notification Service     │ │
│  │   ─────────────    │  │   ───────────      │  │   ────────────────────     │ │
│  │  • Load agent pkg  │  │  • Query Qdrant    │  │  • Email (expiration)      │ │
│  │  • Sandboxed exec  │  │  • Hybrid search   │  │  • Push notifications      │ │
│  │  • Worker threads  │  │  • Re-ranking      │  │  • Webhook delivery        │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │  Indexing Pipeline │  │  Analytics Engine  │  │   Billing Service          │ │
│  │  ─────────────────  │  │  ────────────────  │  │   ───────────────          │ │
│  │  • File processing │  │  • Usage tracking  │  │  • Subscription mgmt       │ │
│  │  • Chunking        │  │  • Metrics agg     │  │  • Usage metering          │ │
│  │  • Embedding gen   │  │  • Reporting       │  │  • Grace period handling   │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │   PostgreSQL       │  │      Qdrant        │  │        Redis               │ │
│  │   (Supabase)       │  │   (Vector Store)   │  │       (Cache)              │ │
│  │   ─────────────    │  │   ──────────────   │  │   ────────────────         │ │
│  │  • Companies       │  │  • Document chunks │  │  • Session state           │ │
│  │  • Users/Roles     │  │  • Embeddings      │  │  • Chat history (hot)      │ │
│  │  • Agents          │  │  • Semantic search │  │  • Rate limiting           │ │
│  │  • Subscriptions   │  │  • Auto-offloading │  │  • Agent pkg cache         │ │
│  │  • Conversations   │  │    for idle agents │  │                            │ │
│  │  • Knowledge meta  │  │                    │  │                            │ │
│  │  • Audit logs      │  │                    │  │                            │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                                 │
│  │  File Storage      │  │     BullMQ         │                                 │
│  │  (Supabase/R2)     │  │   (Job Queue)      │                                 │
│  │  ──────────────    │  │   ────────────     │                                 │
│  │  • Agent packages  │  │  • File indexing   │                                 │
│  │  • Knowledge docs  │  │  • Email sending   │                                 │
│  │  • User uploads    │  │  • Analytics agg   │                                 │
│  │  • Widget assets   │  │  • Cleanup tasks   │                                 │
│  └────────────────────┘  └────────────────────┘                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Pluggable Agent Framework (Unified Execution Environment)

### 4.1 Design Philosophy
To ensure maximum performance, low latency, and efficient resource capability, the platform utilizes a **Unified Execution Environment**. Instead of deploying heavy, separate microservices for every agent pack, custom agent logic is run as dynamically loaded modules (Plugins) within a highly optimized, distinct fleet of "Agent Runners."

This approach offers:
- **Zero Cold Starts**: Agents respond instantly.
- **High Density**: Thousands of agents can run on shared infrastructure, reducing costs.
- **Strict Isolation**: Using Node.js Worker Threads or Cloudflare V8 Isolates (e.g., `isolated-vm`), each agent's code is sandboxed to prevent it from crashing the platform or accessing other tenants' data.

### 4.2 Universal Agent Runner
The "Agent Runner" is a specialized service responsible for executing custom agent code.

1. **Dynamic Loading**: When a message arrives, the Runner fetches the specific Agent Package (JavaScript bundle) from storage (cached locally).
2. **Sandboxed Execution**: The code is instantiated in a secure, isolated thread.
3. **Inheritance**: All custom agents invoke the platform's `BaseAgent` library, which handles the heavy lifting (RAG, History, State).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT RUNNER SERVICE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐ │
│  │   Message    │────▶│   Package    │────▶│     Worker Thread Pool       │ │
│  │   Router     │     │   Resolver   │     │     (V8 Isolates)            │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────────┘ │
│                              │                          │                    │
│                              ▼                          ▼                    │
│                       ┌──────────────┐          ┌──────────────────┐        │
│                       │  Local Cache │          │  Sandboxed Agent │        │
│                       │  + Supabase  │          │  Execution       │        │
│                       │  Storage     │          └──────────────────┘        │
│                       └──────────────┘                  │                    │
│                                                         ▼                    │
│                                                 ┌──────────────────┐        │
│                                                 │  BaseAgent SDK   │        │
│                                                 │  (RAG, History,  │        │
│                                                 │   Tools, LLM)    │        │
│                                                 └──────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Agent Package Structure (Node.js Plugin)
Agents are packaged as standard Node.js modules using the `@buzzi/base-agent` SDK.

**Single Agent Example:**
```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createBuzziAgent, createAgentPackage, AgentTypes } from "@buzzi/base-agent";

// Define tools
const searchTool = tool(
  async ({ query }) => { /* Implementation */ },
  {
    name: "web_search",
    description: "Search the web for information",
    schema: z.object({ query: z.string().describe("Search query") }),
  }
);

const salesAgent = createBuzziAgent({
  agentId: "abc123",
  type: AgentTypes.Worker,
  tools: [searchTool]
});

// Entry point - use default export
export default createAgentPackage("package_id", salesAgent);
```

**Multi-Agent Example (Supervisor/Worker Pattern):**
```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createBuzziAgent, createAgentPackage, AgentTypes } from "@buzzi/base-agent";

// Worker agents
const mathAgent = createBuzziAgent({
  agentId: "math-001",
  type: AgentTypes.Worker,
  tools: [calculatorTool]
});

const researchAgent = createBuzziAgent({
  agentId: "research-001",
  type: AgentTypes.Worker,
  tools: [webSearchTool, documentTool]
});

// Supervisor agent with workers
const orchestratorAgent = createBuzziAgent({
  agentId: "orchestrator-001",
  type: AgentTypes.Supervisor,
  agents: [mathAgent, researchAgent],
  tools: [routingTool]
});

export default createAgentPackage("package_id", orchestratorAgent);
```

**Directory Structure:**
```text
/agent-packages
  /[package_id]
    - index.js          # Entry point (compiled bundle)
    - agents/           # Agent definitions
    - tools/            # Custom tools
```

### 4.4 Execution Flow

```
1. Platform receives message ──▶ Routes to Agent Runner Service
                                        │
2. Runner Service:                      ▼
   ├─ Identifies package_id
   ├─ Checks /agent-packages/[package_id] folder
   │   └─ If exists: Load from disk
   │   └─ If not: Check local cache, then download from Supabase Storage
   ├─ Spins up Worker Thread (or reuses warm one)
   └─ Injects context (User message, History, RAG results)
                                        │
3. Agent Logic:                         ▼
   └─ Executes synchronously/async within thread
                                        │
4. Response:                            ▼
   └─ Streamed back via internal event bus (not HTTP)
```

### 4.5 Development & Deployment
- **"Semi-SaaS" Experience**: Customers (or administrators) write custom code, but it is uploaded to the dashboard rather than deployed to a server.
- **Hot-Swap**: Updating an agent is as simple as uploading a new `bundle.js`. The next message will automatically use the new code.
- **Security Limits**: The sandbox restricts:
  - Network access (allowlist only)
  - File system access (read-only)
  - Execution time (timeout prevention)
  - Memory usage (configurable limits)

### 4.6 Admin Panel Package Management

The Master Admin dashboard provides comprehensive package management:

| Feature | Description |
|---------|-------------|
| **Package Type** | Choose between Single Agent or Multi-Agent packages |
| **Agent Configuration** | For each agent: name, designation, system prompt, model, temperature |
| **Tab-based UI** | Multi-agent packages display agents as tabs (tab names update dynamically with agent names) |
| **Package ID** | Auto-generated GUID for code reference |
| **Agent Identifiers** | Unique IDs for each agent within the package |
| **Version Management** | Track bundle versions and checksums |

### 4.7 Database Schema

**agent_packages table:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Package identifier (used in code) |
| name | VARCHAR | Display name |
| package_type | ENUM | 'single_agent' or 'multi_agent' |
| bundle_path | VARCHAR | Path to code bundle in storage |
| bundle_version | VARCHAR | Semantic version |
| execution_config | JSONB | Sandbox settings (timeout, memory, allowed domains) |

**package_agents table:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Database ID |
| package_id | UUID | Parent package reference |
| agent_identifier | VARCHAR | ID used in code (e.g., "math-001") |
| name | VARCHAR | Display name (appears in tabs) |
| designation | VARCHAR | Role description |
| agent_type | ENUM | 'worker' or 'supervisor' |
| system_prompt | TEXT | Agent instructions |
| model_id | VARCHAR | LLM model to use |
| temperature | INTEGER | 0-100 creativity setting |
| managed_agent_ids | JSONB | For supervisors: list of worker IDs |

---

## 5. Core Modules

The platform is divided into the following major modules, each with its own detailed architecture document:

| Module | Document | Description |
|--------|----------|-------------|
| **Auth & Multi-tenancy** | [architecture-auth-multitenancy.md](./architecture-auth-multitenancy.md) | Authentication, authorization, role hierarchy, tenant isolation |
| **Agent Framework** | [architecture-agent-framework.md](./architecture-agent-framework.md) | Pluggable agent system, sandboxed execution, base agent SDK |
| **RAG & Knowledge** | [architecture-rag-knowledge.md](./architecture-rag-knowledge.md) | Document processing, vector storage, retrieval strategies |
| **Realtime & Channels** | [architecture-realtime-channels.md](./architecture-realtime-channels.md) | Webhook handling, SSE streaming, channel integrations |
| **Chat Widget** | [architecture-chat-widget.md](./architecture-chat-widget.md) | Embeddable widget, SDK, security model |
| **Human-in-the-Loop** | [architecture-hitl.md](./architecture-hitl.md) | Escalation, agent takeover, co-pilot mode |

---

## 6. Multi-Tenancy Model

### 6.1 Tenant Isolation Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM (chat.buzzi.ai)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      COMPANY A                               ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                      ││
│  │  │ Agent 1 │  │ Agent 2 │  │ Agent 3 │                      ││
│  │  └─────────┘  └─────────┘  └─────────┘                      ││
│  │  ┌─────────────────────────────────────────┐                ││
│  │  │ Knowledge Base (Qdrant: company_A)     │                ││
│  │  └─────────────────────────────────────────┘                ││
│  │  ┌─────────────────────────────────────────┐                ││
│  │  │ Storage: /companies/company_a/...      │                ││
│  │  └─────────────────────────────────────────┘                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      COMPANY B                               ││
│  │  ┌─────────┐  ┌─────────┐                                   ││
│  │  │ Agent 1 │  │ Agent 2 │                                   ││
│  │  └─────────┘  └─────────┘                                   ││
│  │  ┌─────────────────────────────────────────┐                ││
│  │  │ Knowledge Base (Qdrant: company_B)     │                ││
│  │  └─────────────────────────────────────────┘                ││
│  │  ┌─────────────────────────────────────────┐                ││
│  │  │ Storage: /companies/company_b/...      │                ││
│  │  └─────────────────────────────────────────┘                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Isolation Mechanisms

| Layer | Isolation Method |
|-------|------------------|
| **Database** | Row-Level Security (RLS) policies on all tables |
| **Vector Store** | Separate Qdrant collection per company (auto-offloaded after 1hr idle) |
| **File Storage** | Path-based isolation: `/companies/{company_id}/` |
| **Agent Execution** | Worker thread sandboxing with tenant context |
| **API Access** | JWT claims include `company_id`, validated on every request |
| **Caching** | Redis key prefixes: `{company_id}:{resource}:{id}` |

---

## 7. Request Flow

### 7.1 Web Chat Message Flow

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Widget  │────▶│   Next.js   │────▶│   Agent     │────▶│     LLM     │
│          │     │  API Route  │     │   Runner    │     │   (Claude)  │
└──────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                 │                   │                    │
     │                 │                   │                    │
     │                 ▼                   ▼                    │
     │           ┌───────────┐      ┌───────────┐              │
     │           │   Redis   │      │   Qdrant  │              │
     │           │  (state)  │      │   (RAG)   │              │
     │           └───────────┘      └───────────┘              │
     │                                                          │
     │◀────────────────── SSE Stream ──────────────────────────┘
```

**Steps:**
1. Widget sends message via POST to `/api/chat/{session_id}/message`
2. API validates session, loads company/agent context
3. Opens SSE connection for response streaming
4. Agent Runner loads agent package, injects context
5. Agent queries Qdrant for relevant knowledge (RAG)
6. Agent calls LLM with enriched context
7. LLM response streamed back through SSE events
8. Conversation persisted to PostgreSQL, hot data cached in Redis

### 7.2 Webhook Message Flow (WhatsApp Example)

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ WhatsApp │────▶│  Webhook    │────▶│   Agent     │────▶│  WhatsApp   │
│  Cloud   │     │  Handler    │     │   Runner    │     │  Send API   │
└──────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                       │                   │
                       ▼                   ▼
                 ┌───────────┐      ┌───────────┐
                 │ Validate  │      │  Process  │
                 │  Signature│      │  Message  │
                 └───────────┘      └───────────┘
```

---

## 8. URL Routing Structure

### 8.1 Dashboard Routes (Next.js App Router)

```
/                           # Landing page (public)
/login                      # Auth.js sign-in
/dashboard                  # Redirect based on role

# Master Admin Routes
/admin/companies            # Company management
/admin/companies/[id]       # Company details
/admin/subscriptions        # Subscription management
/admin/agents/library       # Agent package library
/admin/analytics            # Platform-wide analytics
/admin/settings             # Global settings

# Company Admin Routes
/[company]/dashboard        # Company dashboard
/[company]/agents           # Agent list
/[company]/agents/[id]      # Agent configuration
/[company]/knowledge        # Knowledge base management
/[company]/team             # Team/user management
/[company]/channels         # Channel integrations
/[company]/analytics        # Company analytics
/[company]/settings         # Company settings

# Support Agent Routes
/[company]/inbox            # Conversation inbox
/[company]/inbox/[id]       # Conversation detail
```

### 8.2 API Routes

```
# Webhooks (public, signature-validated)
/api/webhooks/[company_id]/[agent_id]/[channel]/[webhook_id]

# Chat (session-authenticated)
/api/chat/[session_id]/message      # POST: Send message
/api/chat/[session_id]/stream       # GET: SSE stream
/api/chat/[session_id]/upload       # POST: File upload

# Internal APIs (JWT-authenticated)
/api/agents/[id]                    # Agent CRUD
/api/companies/[id]                 # Company CRUD
/api/knowledge/[id]                 # Knowledge operations
/api/auth/*                         # Auth.js handlers
```

---

## 9. Deployment Architecture

### 9.1 Cloudflare Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   DNS + CDN     │    │   SSL/TLS       │                     │
│  │  (chat.buzzi.ai)│    │   Termination   │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Cloudflare Pages                           ││
│  │                   (Next.js SSR)                              ││
│  │                                                              ││
│  │  • App Router with edge runtime                              ││
│  │  • API routes for webhooks and chat                          ││
│  │  • Static assets cached at edge                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   R2 Storage    │    │   Workers KV    │                     │
│  │  (Files/Assets) │    │   (Edge Cache)  │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐
│     Supabase        │    │       Qdrant        │
│   (PostgreSQL +     │    │   (Vector Store)    │
│    Storage + Auth)  │    │                     │
└─────────────────────┘    └─────────────────────┘
```

### 9.2 Environment Configuration

| Environment | Purpose | Database | URL |
|-------------|---------|----------|-----|
| **Development** | Local development | Local PostgreSQL | localhost:3000 |
| **Staging** | Pre-production testing | Supabase (staging) | staging.chat.buzzi.ai |
| **Production** | Live platform | Supabase (prod) | chat.buzzi.ai |

---

## 10. Security Overview

### 10.1 Authentication Flow

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐
│  User    │────▶│   Auth.js   │────▶│  Provider   │
│          │     │  (NextAuth) │     │ (OAuth/etc) │
└──────────┘     └─────────────┘     └─────────────┘
                       │
                       ▼
                 ┌───────────┐
                 │   JWT     │
                 │  Session  │
                 └───────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Middleware     │
              │  (Role Check)   │
              └─────────────────┘
```

### 10.2 Security Layers

| Layer | Mechanism |
|-------|-----------|
| **Transport** | TLS 1.3, HTTPS only |
| **Authentication** | Auth.js with multiple providers |
| **Authorization** | Role-based + resource-based permissions |
| **Data Isolation** | RLS policies, tenant context validation |
| **Webhook Security** | HMAC-SHA256 signatures, timestamp validation |
| **API Security** | Rate limiting, CORS, CSP headers |
| **Agent Sandbox** | V8 Isolates, restricted network/filesystem |

---

## 11. Scalability Considerations

### 11.1 Horizontal Scaling Points

| Component | Scaling Strategy |
|-----------|------------------|
| **Next.js** | Cloudflare Pages auto-scales |
| **Agent Runners** | Worker pool with queue-based distribution |
| **PostgreSQL** | Supabase managed scaling, read replicas |
| **Qdrant** | Cluster mode with auto-offloading for idle collections |
| **Redis** | Cluster mode for session/cache scaling |
| **BullMQ** | Multiple workers, priority queues |

### 11.2 Performance Targets

| Metric | Target |
|--------|--------|
| **API Response (p95)** | < 200ms |
| **Chat First Token** | < 500ms |
| **Webhook Processing** | < 1s |
| **File Indexing** | < 30s per document |
| **Widget Load Time** | < 100ms (cached) |

---

## 12. Related Documents

- [Database Schema](./database-schema.md)
- [Auth & Multi-tenancy Architecture](./architecture-auth-multitenancy.md)
- [Agent Framework Architecture](./architecture-agent-framework.md)
- [RAG & Knowledge Architecture](./architecture-rag-knowledge.md)
- [Realtime & Channels Architecture](./architecture-realtime-channels.md)
- [Chat Widget Architecture](./architecture-chat-widget.md)
- [Human-in-the-Loop Architecture](./architecture-hitl.md)
- [Requirements Document](./requirement.v2.md)
