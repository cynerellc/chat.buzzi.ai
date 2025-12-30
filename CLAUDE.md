# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant AI customer support SaaS platform. Companies can deploy customizable AI chatbot agents with knowledge bases, escalation to human agents, and multi-channel support.

## Development Commands

```bash
# Development
pnpm dev              # Next.js dev server (Turbo)
pnpm build            # Production build
pnpm type-check       # TypeScript validation

# Testing
pnpm test             # Unit tests (Vitest, watch mode)
pnpm test:run         # Single test run (CI)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:e2e:headed  # E2E with visible browser

# Database (requires DATABASE_URL)
pnpm db:push          # Push schema to database
pnpm db:generate      # Generate migrations
pnpm db:studio        # Drizzle Studio web UI
pnpm db:seed          # Seed database

# Linting
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
```

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components)
- **Database**: PostgreSQL + Drizzle ORM (schema: `chatapp`)
- **Auth**: NextAuth.js v5 (JWT sessions, 30-day expiry)
- **UI**: Radix UI + Tailwind CSS v4
- **AI**: OpenAI, Anthropic, Google GenAI providers
- **Vector DB**: Qdrant (for RAG/embeddings)
- **Testing**: Vitest (unit), Playwright (E2E)

## Architecture

### Multi-Tenancy Model

Database-level multi-tenancy with three-tier authorization:

1. **User Roles** (in `users` table):
   - `chatapp.master_admin` - Platform-wide god mode
   - `chatapp.user` - Regular user (needs company permissions)

2. **Company Permissions** (in `company_permissions` junction table):
   - `chatapp.company_admin` - Full company access
   - `chatapp.support_agent` - Limited to inbox/conversations

3. **Active Company**: Cookie `active_company_id` tracks current company context

### Route Groups

```
(auth)           - Public: /login, /register, /forgot-password
(company-admin)  - Company dashboard: /dashboard, /chatbots, /knowledge, /team
(master-admin)   - Platform admin: /admin/*
(support-agent)  - Agent inbox: /inbox, /customers, /responses
api/             - RESTful endpoints
embed-widget/    - Embeddable chat widget
```

### Authorization Guards (src/lib/auth/guards.ts)

Use these in Server Components and Server Actions:
- `requireAuth()` - Redirects to /login if unauthenticated
- `requireMasterAdmin()` - Requires master_admin role
- `requireCompanyAdmin()` - Requires company_admin permission (uses active company cookie)
- `requireSupportAgent()` - Requires at least support_agent permission
- `getCompanyPermission(userId, companyId)` - Gets user's role in specific company

Master admins bypass all company-level permission checks.

### Database Schema Location

All tables defined in `src/lib/db/schema/` with `chatapp` schema prefix:
- `companies` - Tenant records with branding, API keys
- `users` - Auth users with global role
- `company_permissions` - User-company role junction
- `chatbots` - Company chatbot instances
- `chatbotPackages` - Master admin chatbot templates
- `conversations`, `messages` - Chat sessions
- `knowledgeSources`, `knowledgeChunks` - RAG documents

### AI Agent Framework (src/lib/ai/)

- `execution/runner.ts` - Main agent orchestration
- `execution/adk-executor.ts` - Google ADK integration
- `llm/client.ts` - Multi-provider LLM client
- `rag/service.ts` - Vector search via Qdrant
- `tools/` - Agent tool implementations

### Key Patterns

- **Server Components by default** - Client components marked with `"use client"`
- **Zod validation** on all API endpoints
- **Soft deletes** - All tables have `deletedAt` timestamp
- **UUID identifiers** - No sequential IDs
- **Path alias** - `@/` maps to `src/`

### Widget API (Public, no auth)

```
POST /api/widget/session         - Create chat session
POST /api/widget/[sessionId]/message - Send message
GET  /api/widget/config          - Get chatbot config
```

## Testing

Unit tests: `**/*.{test,spec}.ts` (exclude `e2e/` directory)
E2E tests: `e2e/*.spec.ts`

Playwright runs against 5 browser profiles (Chrome, Firefox, Safari, mobile variants).

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `OPENAI_API_KEY` - For embeddings and LLM
- `QDRANT_ENDPOINT`, `QDRANT_API_KEY` - Vector database

Optional:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Real-time features
- `ANTHROPIC_API_KEY` - Claude models
- `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` - OAuth providers
