# Architecture Overview: Multi-Tenant AI Chatbot SaaS Platform

## 1. Executive Summary

This document describes the high-level architecture for `chat.buzzi.ai`, a multi-tenant AI chatbot SaaS platform. The system enables enterprises to deploy AI-powered chatbots across multiple communication channels with features including pluggable agent logic, RAG-based knowledge retrieval, human-in-the-loop support, and comprehensive analytics.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15 (App Router) | SSR, API routes, dashboard UI |
| **Styling** | Tailwind CSS 4, HeroUI | Component library, responsive design |
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

## 4. Core Modules

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

## 5. Multi-Tenancy Model

### 5.1 Tenant Isolation Strategy

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

### 5.2 Isolation Mechanisms

| Layer | Isolation Method |
|-------|------------------|
| **Database** | Row-Level Security (RLS) policies on all tables |
| **Vector Store** | Separate Qdrant collection per company (auto-offloaded after 1hr idle) |
| **File Storage** | Path-based isolation: `/companies/{company_id}/` |
| **Agent Execution** | Worker thread sandboxing with tenant context |
| **API Access** | JWT claims include `company_id`, validated on every request |
| **Caching** | Redis key prefixes: `{company_id}:{resource}:{id}` |

---

## 6. Request Flow

### 6.1 Web Chat Message Flow

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

### 6.2 Webhook Message Flow (WhatsApp Example)

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

## 7. URL Routing Structure

### 7.1 Dashboard Routes (Next.js App Router)

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

### 7.2 API Routes

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

## 8. Deployment Architecture

### 8.1 Cloudflare Deployment

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

### 8.2 Environment Configuration

| Environment | Purpose | Database | URL |
|-------------|---------|----------|-----|
| **Development** | Local development | Local PostgreSQL | localhost:3000 |
| **Staging** | Pre-production testing | Supabase (staging) | staging.chat.buzzi.ai |
| **Production** | Live platform | Supabase (prod) | chat.buzzi.ai |

---

## 9. Security Overview

### 9.1 Authentication Flow

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

### 9.2 Security Layers

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

## 10. Scalability Considerations

### 10.1 Horizontal Scaling Points

| Component | Scaling Strategy |
|-----------|------------------|
| **Next.js** | Cloudflare Pages auto-scales |
| **Agent Runners** | Worker pool with queue-based distribution |
| **PostgreSQL** | Supabase managed scaling, read replicas |
| **Qdrant** | Cluster mode with auto-offloading for idle collections |
| **Redis** | Cluster mode for session/cache scaling |
| **BullMQ** | Multiple workers, priority queues |

### 10.2 Performance Targets

| Metric | Target |
|--------|--------|
| **API Response (p95)** | < 200ms |
| **Chat First Token** | < 500ms |
| **Webhook Processing** | < 1s |
| **File Indexing** | < 30s per document |
| **Widget Load Time** | < 100ms (cached) |

---

## 11. Related Documents

- [Database Schema](./database-schema.md)
- [Auth & Multi-tenancy Architecture](./architecture-auth-multitenancy.md)
- [Agent Framework Architecture](./architecture-agent-framework.md)
- [RAG & Knowledge Architecture](./architecture-rag-knowledge.md)
- [Realtime & Channels Architecture](./architecture-realtime-channels.md)
- [Chat Widget Architecture](./architecture-chat-widget.md)
- [Human-in-the-Loop Architecture](./architecture-hitl.md)
- [Requirements Document](./requirement.v2.md)
