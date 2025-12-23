# Development Plan Overview

## Project: Chat.buzzi.ai - Multi-Tenant AI Customer Support Platform

This document provides a high-level overview of the 25-step development plan for building the Chat.buzzi.ai platform.

---

## Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript |
| UI Library | HeroUI Components |
| Icons | Lucide Icons |
| Animations | Framer Motion |
| Database | PostgreSQL (Supabase) |
| ORM | Drizzle ORM |
| Authentication | Auth.js (NextAuth) |
| LLM Provider | OpenAI / Anthropic |
| Vector Store | Weaviate |
| Caching | Redis |
| Queue | BullMQ |
| Real-time | Server-Sent Events (SSE) |
| File Storage | Supabase Storage |
| Deployment | Vercel / Docker |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Master Admin │  │ Company Admin│  │Support Agent │              │
│  │   Portal     │  │   Portal     │  │   Portal     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Embeddable Chat Widget                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                          BACKEND (API Routes)                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Auth API   │  │  Agent API  │  │Knowledge API│  │  Chat API  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   AI Agent Execution Engine                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │   LLM    │  │   RAG    │  │  Tools   │  │    HITL      │ │   │
│  │  │ Provider │  │ Pipeline │  │ Registry │  │  Escalation  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                            DATABASE LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                PostgreSQL + Weaviate + Redis                 │   │
│  │  Companies │ Users │ Agents │ Knowledge │ Conversations     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Roles

| Role | Access Level | Primary Functions |
|------|--------------|-------------------|
| Master Admin | Platform-wide | Manage companies, plans, platform settings |
| Company Admin | Company-scoped | Manage agents, knowledge, team, billing |
| Support Agent | Company-scoped | Handle conversations, respond to customers |

---

## Development Phases

### Phase 1: Foundation (Steps 1-4)
Core infrastructure setup including project configuration, database schema, authentication, and base UI components.

| Step | Title | Description |
|------|-------|-------------|
| 01 | Project Setup | Initialize Next.js, configure TypeScript, install dependencies |
| 02 | Database Schema | Implement Drizzle ORM schema with all tables |
| 03 | Authentication | Auth.js (NextAuth) integration with multi-tenant support |
| 04 | Core Layout | Shared components, layouts, and route groups |

### Phase 2: Master Admin Portal (Steps 5-9)
Complete master admin functionality for platform management.

| Step | Title | Description |
|------|-------|-------------|
| 05 | Dashboard | Master admin dashboard with key metrics |
| 06 | Company Management | CRUD operations for companies |
| 07 | Plans & Packages | Subscription plans and agent packages |
| 08 | Analytics & Audit | Platform analytics and audit logs |
| 09 | System Settings | Global settings and impersonation |

### Phase 3: Company Admin Portal (Steps 10-18)
Complete company admin functionality for managing AI agents and support operations.

| Step | Title | Description |
|------|-------|-------------|
| 10 | Dashboard | Company dashboard with metrics |
| 11 | Agent Management | Create, edit, and configure AI agents |
| 12 | Knowledge Base | File management and RAG pipeline |
| 13 | Conversations | View and manage conversation history |
| 14 | Team Management | Invite and manage team members |
| 15 | Analytics | Company-level analytics dashboard |
| 16 | Widget Customizer | Chat widget appearance configuration |
| 17 | Integrations | Third-party integrations and webhooks |
| 18 | Billing | Subscription and payment management |

### Phase 4: Support Agent Portal (Steps 19-21)
Live chat and customer support functionality.

| Step | Title | Description |
|------|-------|-------------|
| 19 | Inbox | Conversation queue and assignment |
| 20 | Live Chat | Real-time chat interface |
| 21 | Customer Profile | Customer details and canned responses |

### Phase 5: AI & Real-time (Steps 22-24)
AI agent framework and real-time communication.

| Step | Title | Description |
|------|-------|-------------|
| 22 | AI Agent Framework | LLM integration, tool system, agent execution |
| 23 | Real-time Communication | SSE implementation for live updates |
| 24 | Chat Widget | Embeddable widget with Shadow DOM |

### Phase 6: Finalization (Step 25)
Testing, optimization, and deployment.

| Step | Title | Description |
|------|-------|-------------|
| 25 | Testing & Deployment | E2E tests, performance optimization, deployment |

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/                    # Authentication pages (public)
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── accept-invitation/
│   │
│   ├── (master-admin)/            # Master admin portal (protected)
│   │   ├── layout.tsx             # Master admin layout
│   │   ├── dashboard/
│   │   ├── companies/
│   │   ├── plans/
│   │   ├── packages/
│   │   ├── analytics/
│   │   ├── audit-logs/
│   │   └── settings/
│   │
│   ├── (company-admin)/           # Company admin portal (protected)
│   │   ├── layout.tsx             # Company admin layout
│   │   ├── dashboard/
│   │   ├── agents/
│   │   ├── knowledge/
│   │   ├── conversations/
│   │   ├── team/
│   │   ├── analytics/
│   │   ├── widget/
│   │   ├── integrations/
│   │   ├── settings/
│   │   └── billing/
│   │
│   ├── (support-agent)/           # Support agent portal (protected)
│   │   ├── layout.tsx             # Support agent layout
│   │   ├── inbox/
│   │   ├── customers/
│   │   ├── responses/
│   │   └── settings/
│   │
│   ├── api/                       # API routes
│   │   ├── auth/
│   │   ├── companies/
│   │   ├── agents/
│   │   ├── knowledge/
│   │   ├── conversations/
│   │   ├── widget/
│   │   └── webhooks/
│   │
│   └── widget/                    # Embeddable widget
│       └── [widgetId]/
│
├── components/
│   ├── ui/                        # HeroUI component wrappers
│   ├── layouts/                   # Layout components
│   ├── forms/                     # Form components
│   ├── charts/                    # Chart components
│   └── shared/                    # Shared components
│
├── lib/
│   ├── db/                        # Database (Drizzle)
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── index.ts
│   ├── auth/                      # Authentication utilities
│   ├── ai/                        # AI agent framework
│   │   ├── llm/
│   │   ├── tools/
│   │   ├── rag/
│   │   └── execution/
│   ├── realtime/                  # SSE and real-time
│   └── utils/                     # Utility functions
│
├── hooks/                         # Custom React hooks
├── stores/                        # State management (Zustand)
├── types/                         # TypeScript types
└── styles/                        # Global styles
```

---

## Key Architectural Decisions

### 1. Route Groups for Access Control
Use Next.js route groups `(auth)`, `(master-admin)`, `(company-admin)`, `(support-agent)` to logically separate portals and apply role-based middleware.

### 2. Multi-Tenant Data Isolation
All database queries include `company_id` filter. Middleware validates company access on every request.

### 3. AI Agent Execution
Agents run in a controlled execution loop:
1. Receive message
2. Retrieve relevant knowledge (RAG)
3. Execute LLM with tools
4. Handle tool calls
5. Check for escalation triggers
6. Return response

### 4. Real-time Updates
SSE (Server-Sent Events) for:
- New messages in conversations
- Status updates
- Notifications
- Typing indicators

### 5. Widget Architecture
Chat widget uses Shadow DOM for style isolation, allowing embedding on any website without CSS conflicts.

---

## Documentation References

| Document | Path | Description |
|----------|------|-------------|
| Requirements | `docs/requirement.v2.md` | Core requirements |
| Architecture | `docs/architecture-overview.md` | System architecture |
| Database | `docs/database-schema.md` | Drizzle schema |
| Auth | `docs/architecture-auth-multitenancy.md` | Auth patterns |
| AI Agents | `docs/architecture-agent-framework.md` | Agent execution |
| RAG | `docs/architecture-rag-knowledge.md` | Knowledge pipeline |
| Real-time | `docs/architecture-realtime-channels.md` | SSE & webhooks |
| Widget | `docs/architecture-chat-widget.md` | Widget design |
| HITL | `docs/architecture-hitl.md` | Human escalation |
| UI Overview | `docs/ui/00-overview.md` | UI specifications |

---

## Step Documents

Each step has a dedicated document with detailed implementation instructions:

1. [Step 01 - Project Setup](./step-01-project-setup.md)
2. [Step 02 - Database Schema](./step-02-database-schema.md)
3. [Step 03 - Authentication System](./step-03-authentication.md)
4. [Step 04 - Core Layout & Components](./step-04-core-layout.md)
5. [Step 05 - Master Admin Dashboard](./step-05-master-dashboard.md)
6. [Step 06 - Company Management](./step-06-company-management.md)
7. [Step 07 - Plans & Packages](./step-07-plans-packages.md)
8. [Step 08 - Analytics & Audit](./step-08-analytics-audit.md)
9. [Step 09 - System Settings](./step-09-system-settings.md)
10. [Step 10 - Company Dashboard](./step-10-company-dashboard.md)
11. [Step 11 - Agent Management](./step-11-agent-management.md)
12. [Step 12 - Knowledge Base](./step-12-knowledge-base.md)
13. [Step 13 - Conversations](./step-13-conversations.md)
14. [Step 14 - Team Management](./step-14-team-management.md)
15. [Step 15 - Company Analytics](./step-15-company-analytics.md)
16. [Step 16 - Widget Customizer](./step-16-widget-customizer.md)
17. [Step 17 - Integrations](./step-17-integrations.md)
18. [Step 18 - Billing](./step-18-billing.md)
19. [Step 19 - Support Inbox](./step-19-support-inbox.md)
20. [Step 20 - Live Chat](./step-20-live-chat.md)
21. [Step 21 - Customer Profile](./step-21-customer-profile.md)
22. [Step 22 - AI Agent Framework](./step-22-ai-agent-framework.md)
23. [Step 23 - Real-time Communication](./step-23-realtime.md)
24. [Step 24 - Chat Widget](./step-24-chat-widget.md)
25. [Step 25 - Testing & Deployment](./step-25-testing-deployment.md)

---

## Success Criteria

Each step should be considered complete when:

1. All specified features are implemented
2. UI matches the design specifications
3. API endpoints return correct responses
4. Database operations work correctly
5. Error handling is in place
6. Code follows project conventions
7. No TypeScript errors
8. Basic manual testing passes

---

## Notes

- All UI should follow HeroUI component patterns
- Use Lucide icons consistently throughout
- Apply Framer Motion animations for improved UX
- Maintain multi-tenant isolation at all times
- Follow mobile-first responsive design
- Implement proper error boundaries
- Use server components where possible
- Client components only when needed for interactivity
