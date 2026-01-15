# Chat.Buzzi.AI

Multi-tenant AI customer support SaaS platform. Companies can deploy customizable AI chatbot agents with knowledge bases, escalation to human agents, voice calls, and multi-channel support.

## Features

- **AI Chatbots**: Deploy conversational AI agents powered by OpenAI, Anthropic, or Google models
- **Knowledge Base (RAG)**: Upload documents to create intelligent, context-aware responses
- **Voice Calls**: Real-time voice conversations with AI using OpenAI Realtime API or Google Gemini Live
- **Multi-Channel**: Support for web widget, WhatsApp, and Twilio integrations
- **Human Escalation (HITL)**: Seamlessly transfer conversations to human agents
- **Multi-Tenant**: Fully isolated companies with role-based access control
- **Analytics**: Comprehensive dashboards for chat and call metrics

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth.js v5 (JWT sessions)
- **UI**: Radix UI + Tailwind CSS v4
- **AI**: OpenAI, Anthropic, Google GenAI providers
- **Vector DB**: Qdrant (for RAG/embeddings)
- **Real-time**: WebSocket server for voice calls
- **Testing**: Vitest (unit), Playwright (E2E)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm package manager
- Qdrant vector database

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/chat.buzzi.ai.git
cd chat.buzzi.ai

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Configure your environment variables (see below)

# Push database schema
pnpm db:push

# Seed initial data (optional)
pnpm db:seed

# Start development server
pnpm dev
```

### Environment Variables

Required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chatbuzzi

# Auth
AUTH_SECRET=your-auth-secret  # Generate: openssl rand -base64 32

# AI Providers
OPENAI_API_KEY=sk-...

# Vector Database
QDRANT_ENDPOINT=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-api-key

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional variables for voice calls:

```bash
# Voice Call Feature
ENABLE_CALL_FEATURE=true
ENABLE_CALL_RECORDING=true
WEBSOCKET_PORT=3001

# WhatsApp Integration
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
```

See `.env.example` for all available options.

## Development Commands

```bash
# Development
pnpm dev              # Next.js dev server
pnpm build            # Production build
pnpm type-check       # TypeScript validation

# Testing
pnpm test             # Unit tests (watch mode)
pnpm test:run         # Single test run (CI)
pnpm test:e2e         # E2E tests (Playwright)

# Database
pnpm db:push          # Push schema to database
pnpm db:generate      # Generate migrations
pnpm db:studio        # Drizzle Studio web UI
pnpm db:seed          # Seed database

# Linting
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
```

## Architecture

### Multi-Tenancy Model

Three-tier authorization system:

1. **User Roles** (`users` table):
   - `master_admin` - Platform-wide access
   - `user` - Regular user (needs company permissions)

2. **Company Permissions** (`company_permissions` table):
   - `company_admin` - Full company access
   - `support_agent` - Limited to inbox/conversations

3. **Active Company**: Cookie tracks current company context

### Route Groups

```
(auth)           - Public: /login, /register
(company-admin)  - Company dashboard: /dashboard, /chatbots, /knowledge
(master-admin)   - Platform admin: /admin/*
(support-agent)  - Agent inbox: /inbox, /customers
api/             - RESTful endpoints
embed-widget/    - Embeddable chat widget
```

### Voice Call Architecture

```
Client (Browser/WhatsApp) → WebSocket Handler → CallRunnerService → AI Provider
                                    ↓
                           CallSessionManager → Database
```

Key components:
- `CallRunnerService`: Orchestrates call sessions with executor caching
- `CallExecutor`: Abstract base for AI provider integration
- `OpenAIRealtimeExecutor`: OpenAI Realtime API integration
- `GeminiLiveExecutor`: Google Gemini Live API integration
- `CallSessionManager`: In-memory session tracking with timeout handling

See [docs/call-feature-architecture.md](docs/call-feature-architecture.md) for detailed architecture.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Public auth pages
│   ├── (company-admin)/   # Company dashboard
│   ├── (master-admin)/    # Platform admin
│   ├── (support-agent)/   # Agent inbox
│   └── api/               # API routes
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── ai/               # AI agent framework
│   │   ├── execution/    # Agent orchestration
│   │   ├── llm/          # LLM client
│   │   ├── rag/          # Vector search
│   │   └── tools/        # Agent tools
│   ├── call/             # Voice call feature
│   │   ├── execution/    # Call orchestration
│   │   ├── handlers/     # Integration handlers
│   │   └── utils/        # Audio utilities
│   ├── db/               # Database schema & queries
│   └── auth/             # Authentication utilities
└── tests/                # Test setup
```

## API Endpoints

### Widget API (Public)

```
POST /api/widget/session              - Create chat session
POST /api/widget/[sessionId]/message  - Send message
GET  /api/widget/config               - Get chatbot config
POST /api/widget/call/session         - Create call session
WS   /api/widget/call/ws              - WebSocket for voice
```

### Company API (Authenticated)

```
GET  /api/company/chatbots            - List chatbots
POST /api/company/chatbots            - Create chatbot
GET  /api/company/analytics           - Chat analytics
GET  /api/company/analytics/calls     - Call analytics
GET  /api/company/integration-accounts - Integration accounts
```

## Documentation

- [Call Feature Architecture](docs/call-feature-architecture.md)
- [Call Feature API Reference](docs/call-feature-api.md)
- [Call Feature Activity Flow](docs/call-feature-activity-flow.md)
- [Database Updates for Calls](docs/call-feature-database-updates-needed.md)

## Testing

Unit tests use Vitest and are located alongside source files:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test:run src/lib/call/utils/audio-converter.test.ts

# Run tests with coverage
pnpm test:coverage
```

E2E tests use Playwright:

```bash
# Run E2E tests
pnpm test:e2e

# Run with visible browser
pnpm test:e2e:headed
```

## Deployment

### Production Build

```bash
pnpm build
pnpm start
```

### Environment Requirements

- Node.js 18+
- PostgreSQL 14+
- Qdrant vector database
- WebSocket server port (for voice calls)

### Voice Call Deployment

For voice call functionality, ensure:
1. `ENABLE_CALL_FEATURE=true` in environment
2. WebSocket server port (default 3001) is accessible
3. OpenAI API key has access to Realtime API
4. For WhatsApp: Configure Meta webhook URL

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test:run`
5. Submit a pull request

## License

Proprietary - All rights reserved.
