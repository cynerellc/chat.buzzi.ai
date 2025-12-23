# Project Issues Report

**Generated:** 2025-12-23
**Analysis Scope:** All documentation files in `docs/` folder cross-referenced with implementation

---

## Executive Summary

| Category | Total Issues |
|----------|--------------|
| Architecture | 31 |
| Database Schema | 39 |
| Development Plan | 63 |
| UI - Master/Company Admin | 42 |
| UI - Support Agent/Shared | 41 |
| **TOTAL** | **216** |

---

## 1. Architecture Issues

### 1.1 Critical Infrastructure Gaps

| Issue | Type | Documentation | Status |
|-------|------|---------------|--------|
| Vector Store | DIFFERENT | Qdrant documented | pgvector implemented instead |
| Background Jobs | NOT_IMPLEMENTED | BullMQ documented | No queue system exists |
| V8 Isolate Sandboxing | NOT_IMPLEMENTED | `architecture-agent-framework.md` | No isolated-vm or worker threads |
| Worker Thread Pool | NOT_IMPLEMENTED | Agent execution parallelism | Single-threaded execution only |

### 1.2 RAG & Knowledge Base

| Issue | Location | Description |
|-------|----------|-------------|
| Qdrant Integration | `src/lib/knowledge/` | Doc specifies Qdrant collections; implementation uses PostgreSQL pgvector |
| BullMQ Job Queue | `src/lib/knowledge/queue.ts` | Document processing queue not implemented |
| Query Expansion | `rag-service.ts` | LLM-based query expansion not implemented |
| Cohere Reranker | `rag-service.ts` | Uses keyword matching instead of cross-encoder |
| Semantic Chunking | `src/lib/knowledge/chunker.ts` | Chunking service not implemented |
| Content Extractors | `src/lib/knowledge/extractors/` | PDFExtractor, DocxExtractor, etc. not found |
| Parent Context Expansion | `rag-service.ts` | Sibling chunk expansion not implemented |

### 1.3 Chat Widget

| Issue | Location | Description |
|-------|----------|-------------|
| Shadow DOM Isolation | `src/lib/widget/embed.ts` | Uses iframe; Shadow DOM not implemented |
| Voice Input (Whisper) | `src/lib/voice/` | Push-to-talk with Whisper API not implemented |
| File Upload Processing | `embed-widget/page.tsx` | File upload UI and Vision API processing missing |
| React SDK Package | `packages/chat-widget-react/` | NPM package not created |

### 1.4 HITL (Human-in-the-Loop)

| Issue | Location | Description |
|-------|----------|-------------|
| AI Co-pilot Service | `src/lib/copilot/` | Response suggestions for agents not implemented |
| Internal Notes System | `src/lib/notes/` | Conversation notes with real-time sync missing |
| HITL Metrics Analytics | `src/lib/analytics/hitl-metrics.ts` | Escalation analytics not implemented |
| Sentiment Analysis | `src/lib/escalation/triggers.ts` | LLM-based sentiment scoring not implemented |
| Push Notifications | `src/lib/notifications/` | Agent notification system not implemented |

### 1.5 Channel Adapters

| Issue | Location | Description |
|-------|----------|-------------|
| Microsoft Teams | `src/lib/realtime/channels/teams.ts` | Adapter not implemented |
| Instagram | `src/lib/realtime/channels/instagram.ts` | Adapter not implemented |
| Custom Webhook | `src/lib/realtime/channels/custom.ts` | Generic webhook adapter missing |

### 1.6 Operations & Security

| Issue | Location | Description |
|-------|----------|-------------|
| Subscription Notifications | `src/lib/subscriptions/` | Expiration cron jobs not implemented |
| Data Retention Service | `src/lib/retention/` | Cleanup service for expired data missing |
| IP Allowlisting | `src/lib/webhooks/security.ts` | Webhook IP validation not implemented |
| Paraglide i18n | `src/lib/i18n/` | Internationalization not set up |
| Package Cache (Redis) | `src/lib/ai/packages/cache.ts` | Only in-memory caching exists |

---

## 2. Database Schema Issues

### 2.1 Missing/Different Tables

| Table | Issue | Expected | Actual |
|-------|-------|----------|--------|
| `chatapp_customers` | Different structure | Full customer profiles | Implemented as `chatapp_end_users` with different columns |
| `chatapp_knowledge_files` | Different structure | File-specific columns | Uses `chatapp_knowledge_sources` with JSONB config |
| `chatapp_agent_knowledge_categories` | Missing | Join table for agents-categories | Uses JSONB array instead |

### 2.2 Missing Columns by Table

**chatapp_agent_packages:**
- `version`, `packageUrl`, `packageHash`, `entryPoint`, `packageSize`
- `capabilities`, `author`, `documentation`, `changelog`, `usageCount`, `publishedAt`

**chatapp_agents:**
- `customPackageUrl`, `customPackageHash`, `capabilities`, `personality`, `responseStyle`
- `llmConfig`, `ragEnabled`, `ragConfig`, `enabledTools`, `toolConfig`
- `escalationRules`, `businessHours`, `fallbackResponses`, `webhookSecret`, `totalMessages`

**chatapp_conversations:**
- `sessionToken` (unique), `customerId`, `customerName`, `customerEmail`, `customerPhone`
- `customerMetadata`, `externalId`, `isHumanAgent`, `context`, `summary`
- `aiMessageCount`, `humanMessageCount`, `averageSentiment`, `startedAt`

**chatapp_escalations:**
- `companyId`, `agentId`, `triggerDetails`, `resolutionNotes`
- `waitTime`, `handleTime`

**chatapp_subscription_plans:**
- `setupFee`, `billingCycle` enum
- `limits` JSONB structure, `features` JSONB array

**chatapp_daily_analytics:**
- `channel` dimension, `avgConfidenceScore`
- `ragQueriesCount`, `avgRagRelevance`, `estimatedCost`

### 2.3 Type Mismatches

| Table | Column | Expected | Actual |
|-------|--------|----------|--------|
| `conversations` | `sentiment` | decimal(3,2) | integer |
| `widgets` | scope | per-agent | per-company only |
| `webhooks` | stat columns | integer | JSONB |
| `usage_records` | costs | decimal | cents as integer |
| `audit_logs` | `ipAddress` | inet type | varchar(45) |

### 2.4 Undocumented Tables in Implementation

These tables exist but are NOT in `database-schema.md`:
- `agentVersions`
- `deviceSessions`
- `magicLinkTokens`
- `faqItems`
- `webhookDeliveries`
- `paymentHistory`
- `hourlyAnalytics`
- `topicAnalytics`
- `platformAnalytics`

### 2.5 Missing Requirement Features

| Feature | Documentation | Implementation Gap |
|---------|---------------|-------------------|
| Grace Period Handling | `requirement.v2.md` | No `gracePeriodEndsAt`, `gracePeriodDays` columns |
| Pluggable Agent Code | `requirement.v2.md` | No `packageUrl`, `packageHash` for dynamic loading |
| RAG Configuration | `requirement.v2.md` | No per-agent `ragEnabled`, `ragConfig` |
| Business Hours | `requirement.v2.md` | Only basic `workingHours` in behavior JSONB |
| Custom Domain Verification | `requirement.v2.md` | No DNS/SSL verification tracking |
| Data Retention Policy | `requirement.v2.md` | No retention period tracking |
| Conversation Context/Summary | `requirement.v2.md` | No `context`, `summary` fields |

---

## 3. Development Plan Issues

### 3.1 Step 21: Support Agent Profile & Responses (NOT IMPLEMENTED)

| Component | Path | Status |
|-----------|------|--------|
| Responses Page | `src/app/(support-agent)/responses/page.tsx` | Missing |
| Settings Page | `src/app/(support-agent)/settings/page.tsx` | Missing |
| Responses API | `src/app/api/agent/responses/route.ts` | Missing |
| Profile API | `src/app/api/agent/profile/route.ts` | Missing |
| Settings API | `src/app/api/agent/settings/route.ts` | Missing |
| Security API | `src/app/api/agent/security/` | Missing |
| Response Components | `src/components/support-agent/responses/` | Missing |
| Settings Components | `src/components/support-agent/settings/` | Missing |

### 3.2 Step 22: AI Agent Framework (PARTIAL)

| Component | Documented Path | Actual Status |
|-----------|-----------------|---------------|
| Agent SDK | `src/lib/agent-sdk/` | Different: `src/lib/ai/` |
| Streaming Module | `src/lib/agent-sdk/streaming.ts` | Missing |
| Agent Runner | `src/services/agent-runner/` | Different: `src/lib/ai/execution/` |
| Config Loader | `src/services/agent-runner/config-loader.ts` | Missing |
| Message Processor | `src/services/agent-runner/message-processor.ts` | Missing |
| Agent Metrics | `src/services/agent-runner/metrics.ts` | Missing |

### 3.3 Step 23: Realtime Communication (MOSTLY MISSING)

| Component | Path | Status |
|-----------|------|--------|
| Services Directory | `src/services/` | Does not exist (using `src/lib/`) |
| Chat Session Service | `src/services/chat/session.ts` | Missing |
| Typing Service | `src/services/chat/typing.ts` | Missing |
| Message Handler | `src/services/chat/message-handler.ts` | Missing |
| Handover Service | `src/services/handover/service.ts` | Missing |
| Handover Queue | `src/services/handover/queue.ts` | Missing |
| Copilot Service | `src/services/copilot/service.ts` | Missing |
| Realtime Notifications | `src/services/notifications/realtime.ts` | Missing |
| Push Notifications | `src/services/notifications/push.ts` | Missing |
| Rate Limit Service | `src/services/rate-limit/index.ts` | Missing |
| Teams Adapter | `src/services/channels/teams.ts` | Missing |
| Custom Webhook Adapter | `src/services/channels/custom.ts` | Missing |
| Typing API | `src/app/api/chat/[sessionId]/typing/route.ts` | Missing |
| Agent Stream API | `src/app/api/agent/stream/route.ts` | Missing |

### 3.4 Step 24: Chat Widget (NOT IMPLEMENTED)

The entire `packages/` directory does not exist.

| Component | Path | Status |
|-----------|------|--------|
| Widget Package | `packages/chat-widget/` | Missing |
| Widget Core | `packages/chat-widget/src/widget.ts` | Missing |
| Launcher Component | `packages/chat-widget/src/components/launcher.ts` | Missing |
| Chat Window | `packages/chat-widget/src/components/chat-window.ts` | Missing |
| Message Components | `packages/chat-widget/src/components/` | Missing |
| Voice Input | `packages/chat-widget/src/components/voice-input.ts` | Missing |
| Widget Services | `packages/chat-widget/src/services/` | Missing |
| Widget Styles | `packages/chat-widget/src/styles/` | Missing |
| React Package | `packages/chat-widget-react/` | Missing |

### 3.5 Step 25: Testing & Deployment (MOSTLY MISSING)

| Component | Path | Status |
|-----------|------|--------|
| Tests Directory | `__tests__/` | Different: `src/tests/` |
| E2E Tests (Playwright) | `__tests__/e2e/` | Missing |
| Integration Tests | `__tests__/integration/` | Missing |
| Playwright Config | `playwright.config.ts` | Missing |
| GitHub Actions CI | `.github/workflows/ci.yml` | Missing |
| Health Check API | `src/app/api/health/route.ts` | Missing |
| Metrics Library | `src/lib/metrics.ts` | Missing |
| Logger (pino) | `src/lib/logger.ts` | Missing |
| Test Factories | `__tests__/factories/` | Missing |
| Vercel Config | `vercel.json` | Missing |
| Sentry Config | `sentry.client.config.ts` | Missing |

### 3.6 Other Missing Components

| Step | Component | Path | Status |
|------|-----------|------|--------|
| 04 | Layout Components | `src/components/layout/` | Missing |
| 12 | Knowledge Components | `src/components/company-admin/knowledge/` | Empty |
| 14 | Team Components | `src/components/company-admin/team/` | Missing |
| 15 | Analytics Components | `src/components/company-admin/analytics/` | Missing |
| 16 | Widget Components | `src/components/company-admin/widget/` | Missing |
| 17 | Integrations Components | `src/components/company-admin/integrations/` | Missing |
| 18 | Billing Components | `src/components/company-admin/billing/` | Missing |
| 18 | Stripe API Routes | `src/app/api/stripe/` | Missing |

---

## 4. UI Issues - Master Admin

### 4.1 Missing Pages

| Page | Route | Documentation |
|------|-------|---------------|
| Impersonation Page | `/admin/impersonate/[companyId]` | `08-impersonation.md` |
| Agent Configuration | `/admin/companies/[companyId]/agents/[agentId]` | `10-agent-configuration.md` |

### 4.2 Missing Components

| Component | Path | Documentation |
|-----------|------|---------------|
| Branding Settings Tab | `src/components/master-admin/settings/branding-settings.tsx` | `07-system-settings.md` |
| Authentication Settings Tab | `src/components/master-admin/settings/authentication-settings.tsx` | `07-system-settings.md` |
| Limits Settings Tab | `src/components/master-admin/settings/limits-settings.tsx` | `07-system-settings.md` |
| Notifications Settings Tab | `src/components/master-admin/settings/notifications-settings.tsx` | `07-system-settings.md` |
| Package Upload Modal | `src/components/master-admin/packages/package-upload-modal.tsx` | `09-agent-packages.md` |
| Package Version History | `src/components/master-admin/packages/package-versions.tsx` | `09-agent-packages.md` |
| Package Deployments | `src/components/master-admin/packages/package-deployments.tsx` | `09-agent-packages.md` |
| Company Agents Tab | `src/components/master-admin/companies/company-agents.tsx` | `03-company-details.md` |
| Company Activity Tab | `src/components/master-admin/companies/company-activity.tsx` | `03-company-details.md` |

### 4.3 Missing APIs

| API | Path | Documentation |
|-----|------|---------------|
| Suspend Company | `src/app/api/master-admin/companies/[companyId]/suspend/route.ts` | `02-companies-list.md` |
| Package Versions | `src/app/api/master-admin/packages/[packageId]/versions/route.ts` | `09-agent-packages.md` |
| Audit Log Export | `src/app/api/master-admin/audit-logs/export/route.ts` | `06-audit-logs.md` |

---

## 5. UI Issues - Company Admin

### 5.1 Missing Pages

| Page | Route | Documentation |
|------|-------|---------------|
| File Manager | `/files` | `06-file-manager.md` |
| Agent Editor | `/agents/[agentId]/edit` | `03-agent-editor.md` |
| Agent Settings | `/agents/[agentId]/settings` | `04-agent-settings.md` |

### 5.2 Missing Components

| Component | Path | Documentation |
|-----------|------|---------------|
| Agents Filters | `src/components/company-admin/agents/agents-filters.tsx` | `02-agents-list.md` |
| Knowledge Tab | `src/components/company-admin/agents/knowledge-tab.tsx` | `03-agent-editor.md` |
| Channels Tab | `src/components/company-admin/agents/channels-tab.tsx` | `03-agent-editor.md` |
| Knowledge Sources Grid | `src/components/company-admin/knowledge/sources-grid.tsx` | `05-knowledge-base.md` |
| Upload Modal | `src/components/company-admin/knowledge/upload-modal.tsx` | `05-knowledge-base.md` |
| FAQ Editor | `src/components/company-admin/knowledge/faq-editor.tsx` | `05-knowledge-base.md` |
| Conversations List | `src/components/company-admin/conversations/conversations-list.tsx` | `07-conversations.md` |
| Conversations Filters | `src/components/company-admin/conversations/conversations-filters.tsx` | `07-conversations.md` |
| Conversation Actions | `src/components/company-admin/conversations/conversation-actions.tsx` | `08-conversation-detail.md` |
| Team Grid | `src/components/company-admin/team/team-grid.tsx` | `09-team-management.md` |
| Invite Modal | `src/components/company-admin/team/invite-modal.tsx` | `09-team-management.md` |
| Pending Invitations | `src/components/company-admin/team/pending-invitations.tsx` | `09-team-management.md` |
| Analytics Components | `src/components/company-admin/analytics/` | `10-analytics.md` |
| Widget Components | `src/components/company-admin/widget/` | `11-widget-customizer.md` |
| Integrations Components | `src/components/company-admin/integrations/` | `12-integrations.md` |
| Settings Components | `src/components/company-admin/settings/` | `13-settings.md` |
| Billing Components | `src/components/company-admin/billing/` | `14-billing.md` |

### 5.3 Missing APIs

| API | Path | Documentation |
|-----|------|---------------|
| Files Management | `src/app/api/company/files/route.ts` | `06-file-manager.md` |
| Webhooks Management | `src/app/api/company/integrations/webhooks/route.ts` | `12-integrations.md` |
| Conversation Assignment | `src/app/api/company/conversations/[conversationId]/assign/route.ts` | `08-conversation-detail.md` |
| Analytics Export | `src/app/api/company/analytics/export/route.ts` | `10-analytics.md` |
| Billing History | `src/app/api/company/billing/history/route.ts` | `14-billing.md` |
| Plan Upgrade | `src/app/api/company/billing/upgrade/route.ts` | `14-billing.md` |
| Widget Code Generation | `src/app/api/company/widget/code/route.ts` | `11-widget-customizer.md` |
| Resend Invitation | `src/app/api/company/team/invite/resend/route.ts` | `09-team-management.md` |

---

## 6. UI Issues - Support Agent

### 6.1 Missing Pages

| Page | Route | Documentation |
|------|-------|---------------|
| Canned Responses | `/responses` | `04-canned-responses.md` |
| My Settings | `/settings` | `05-my-settings.md` |
| Customer Profile | `/customers/[customerId]` | `03-customer-profile.md` |

### 6.2 Missing Features in Inbox

| Feature | Location | Documentation |
|---------|----------|---------------|
| Status Selector | Top bar | `01-inbox.md` |
| Capacity Indicator | Sidebar | `01-inbox.md` |
| Notification Badge Dropdown | Header | `01-inbox.md` |
| Sound Notifications | Global | `01-inbox.md` |
| Keyboard Shortcuts | Global | `01-inbox.md` |

### 6.3 Missing Features in Live Chat

| Feature | Location | Documentation |
|---------|----------|---------------|
| Canned Responses Picker | Chat input (Cmd+K) | `02-live-chat.md` |
| Emoji Picker | Chat input | `02-live-chat.md` |
| File Attachment Upload | Chat input | `02-live-chat.md` |
| Transfer Modal | Actions menu | `02-live-chat.md` |
| Typing Indicators | Chat area | `02-live-chat.md` |
| AI Summary Panel | Customer sidebar | `02-live-chat.md` |
| Quick Actions Panel | Customer sidebar | `02-live-chat.md` |

### 6.4 Missing APIs

| API | Path | Documentation |
|-----|------|---------------|
| Canned Responses | `src/app/api/support-agent/responses/route.ts` | `04-canned-responses.md` |
| Agent Settings | `src/app/api/support-agent/settings/route.ts` | `05-my-settings.md` |
| Customer Profile | `src/app/api/support-agent/customers/[customerId]/route.ts` | `03-customer-profile.md` |
| Attachments | `src/app/api/support-agent/conversations/[conversationId]/attachments/route.ts` | `02-live-chat.md` |
| Transfer Conversation | `src/app/api/support-agent/conversations/[conversationId]/transfer/route.ts` | `02-live-chat.md` |

---

## 7. UI Issues - Shared Components

### 7.1 Missing UI Components

| Component | Path | Documentation |
|-----------|------|---------------|
| Toggle Switch | `src/components/ui/toggle.tsx` | `00-components.md` |
| Slider/Range | `src/components/ui/slider.tsx` | `00-components.md` |
| File Upload | `src/components/ui/file-upload.tsx` | `00-components.md` |
| Color Picker | `src/components/ui/color-picker.tsx` | `00-components.md` |
| Toast | `src/components/ui/toast.tsx` | `00-components.md` |
| Popover | `src/components/ui/popover.tsx` | `00-components.md` |
| Alert Banner | `src/components/ui/alert.tsx` | `00-components.md` |
| Progress Bar | `src/components/ui/progress.tsx` | `00-components.md` |
| Breadcrumbs | `src/components/ui/breadcrumbs.tsx` | `00-components.md` |
| Pagination | `src/components/ui/pagination.tsx` | `00-components.md` |
| Date Picker | `src/components/ui/date-picker.tsx` | `00-components.md` |
| Time Picker | `src/components/ui/time-picker.tsx` | `00-components.md` |
| Checkbox | `src/components/ui/checkbox.tsx` | `00-components.md` |
| Radio Button | `src/components/ui/radio.tsx` | `00-components.md` |
| Textarea | `src/components/ui/textarea.tsx` | `00-components.md` |

### 7.2 Auth Features to Verify

| Feature | Documentation | Notes |
|---------|---------------|-------|
| Social Login (Google/Microsoft) | `01-login.md` | Implementation status unclear |
| Remember Me (30-day session) | `01-login.md` | Needs verification |
| Multi-Step Registration | `02-register.md` | Steps 2-4 (Company, Plan, Payment) missing |
| Password Strength Indicator | `02-register.md` | Needs verification |
| Forgot Password Confirmation | `03-forgot-password.md` | Two-stage flow needs verification |
| Existing User Invitation Flow | `04-accept-invitation.md` | Needs verification |

---

## 8. Priority Classification

### Critical (Blocks Core Functionality)
1. Missing background job queue (BullMQ)
2. Missing chat widget package
3. Missing support agent canned responses
4. Missing typing indicators and realtime features
5. Missing health check and monitoring

### High (Significant Feature Gaps)
1. V8 Isolate sandboxing for agents
2. HITL co-pilot suggestions
3. File manager functionality
4. Teams/Instagram channel adapters
5. E2E testing infrastructure

### Medium (Enhanced Features)
1. Query expansion in RAG
2. Cohere reranker integration
3. Voice input with Whisper
4. Shadow DOM widget isolation
5. Multi-step registration

### Low (Nice to Have)
1. Paraglide i18n
2. Missing UI components (color picker, etc.)
3. Audit log export
4. Package version history UI

---

## 9. Structural Differences

The implementation uses a different directory structure than documented:

| Documented | Actual |
|------------|--------|
| `src/services/` | `src/lib/` |
| `src/lib/agent-sdk/` | `src/lib/ai/` |
| `__tests__/` | `src/tests/` |
| `packages/chat-widget/` | `src/lib/widget/` + `src/app/embed-widget/` |
| `src/services/channels/` | `src/lib/realtime/channels/` |

---

*This report should be used as a reference for fixing and completing the project implementation.*
