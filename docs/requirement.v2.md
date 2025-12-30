# Expanded Requirements: Multi-Tenant AI Chatbot SaaS Platform v2

---

Our Platform domain is `chat.buzzi.ai`

## 1. Business Model & Subscription Management

### 1.1 Multi-Tenant SaaS Architecture
The platform operates as a fully multi-tenant SaaS solution where each company is an isolated tenant with complete data segregation. The business model centers on selling AI-powered chatbot capabilities to enterprises who can deploy unlimited agents (based on their subscription tier) across multiple communication channels.

### 1.2 Flexible Subscription Tiers
- **Per-Company Pricing**: Each company negotiates or selects a subscription plan with custom pricing. This allows for enterprise-level negotiations, startup discounts, or volume-based pricing.
- **Setup Fee**: A one-time setup charge based on the effort required to build an agent (e.g., flat rate of $1,200).
- **Subscription Attributes**:
  - Billing cycles: 6 Months / Annual
  - Message volume limits (e.g., 10,000 AI responses/month)
  - Number of allowed agents
  - Number of allowed human support seats
  - Storage quotas for knowledge base files (includes storage size, database size, and max file size)
  - API rate limits
  - Access to premium integrations (WhatsApp Business API, Microsoft Teams, etc.)
  - Priority support tiers

### 1.3 Expiration & Grace Period Handling
- Each company subscription has a clearly defined `expires_at` timestamp.
- **Pre-Expiration Notifications**: Automated emails/alerts sent at 45, 30, 14, 7, 3, and 1 day(s) before expiration.
- **Grace Period**: Configurable grace period (e.g., 7 days) after expiration where chatbots display a "temporarily unavailable" message rather than completely failing.
- **Hard Cutoff**: After the grace period, all webhook endpoints return appropriate error responses, chat widgets display plan expired messages, and no AI processing occurs.
- **Reactivation**: Upon renewal, all services restore immediately without data loss.
- **Data Retention Policy**: Company data retained for a configurable period (e.g., 90 days) post-expiration before permanent deletion, allowing for late renewals.

---

## 2. User Role Hierarchy & Permissions

### 2.1 Master Admin (Platform Owner)
The Master Admin represents the SaaS platform operators—your team. This role has super-admin access across all tenants.

**Capabilities**:
- Create, suspend, and delete company accounts.
- Set and modify subscription terms and pricing per company.
- Configure global platform settings (default system prompts, blocked words, rate limits).
- Deploy and manage agent code packages (pluggable supervisor modules).
- Configure advanced agent settings: personality, response styles, escalation rules, system prompts, key configurations, etc.
- Access cross-company analytics and usage dashboards.
- Manage the agent marketplace/library.
- Configure platform-wide integrations (payment processors, email services).
- Impersonate any Company Admin for support purposes.
- Manage platform security policies and audit logs.
- Configure Qdrant clusters and Supabase storage policies.

### 2.2 Company Admin (Tenant Administrator)
Each company has one or more Company Admins who manage their organization's chatbot deployment.

**Capabilities**:
- Full CRUD operations on agents within their company.
- Configure basic agent settings: personality, response styles (Note: Core system prompts and key configurations are managed by Master Admin and hidden from Company Admin).
- Manage knowledge bases: upload/delete documents into multiple categories, trigger re-indexing.
- Assign one or more knowledge base categories to an agent.
- Configure channel integrations (WhatsApp, Telegram, etc.) with their own API credentials.
- Customize chat widget appearance (color, style, design parameters) and generate embed code.
- View company-specific analytics: conversation volumes, resolution rates, sentiment analysis.
- Manage Human Support Agents: invite users, assign to agents, set permissions.
  - *Permissions*: Assign to another agent, takeover conversation (AI to Human), handover conversation (Human to AI), add internal notes, view customer context and history.
- Configure their company subdomain.
- Configure agent's webhook routing.
- Set business hours and auto-responses.
- Export conversation histories and analytics.
- Configure escalation rules (when to involve human agents).

### 2.3 Human Support Agent
Frontline support staff who can intervene in AI conversations.

**Capabilities**:
- View real-time conversation feeds for assigned agents.
- Take over conversations from AI (human-in-the-loop).
- Hand conversations back to AI.
- Add internal notes to conversations.
- Access customer context and conversation history.
- View personal performance metrics.
- Receive notifications for escalations and @mentions.
- Limited access to knowledge base (read-only, suggest additions).

### 2.4 Permission Granularity
Each role supports fine-grained permissions:
- Read/Write/Delete per resource type.
- Agent-specific access (e.g., Access to Agent A but not Agent B).
- Time-based access (temporary permissions).
- IP-based restrictions for sensitive operations.

---

## 3. Company & Agent Architecture

### 3.1 Company Entity Structure
Each company (tenant) is a self-contained unit with:
- Unique identifier (UUID).
- Company name and branding assets (logo, colors).
- Custom subdomain (e.g., `acme.yoursaas.com` or custom domain `acme-chat.com`).
- Billing information and subscription status.
- Timezone and locale settings.
- Data residency preferences (if applicable).
- API keys for programmatic access.
- Usage quotas and current consumption metrics.

### 3.2 Agent Entity Structure
Agents are the individual chatbot personalities/functions within a company:
- Unique identifier (UUID).
- Human-readable name and description.
- **Agent Type**: References the underlying pluggable code (Node.js package) that defines the agent's behavior.
- **Pluggable Code**: Complete agent logic (can be multi-agent or single-agent system), tool integrations, and custom business logic.
- **System Prompt**: The core personality and instruction set.
- **Configuration Object**: JSON structure containing:
  - Temperature and other LLM parameters.
  - Tool configurations (enabled tools list).
  - RAG settings (chunk size, relevance threshold).
  - Escalation thresholds.
  - Business hours behavior.
  - Fallback responses.
- **Channel Configurations**: Per-channel settings for WhatsApp, Web, etc.
- **Knowledge Store Reference**: Link to dedicated Qdrant collection/categories.
- **Webhook Secrets**: Per-agent secrets for secure webhook validation.
- **Status**: Active, Paused, Draft, Archived.

### 3.3 Multi-Agent Scenarios
Companies may deploy multiple agents for different purposes:
- Sales chatbot on landing pages.
- Technical support bot in the product dashboard.
- HR assistant for internal employee queries.
*Each agent has isolated knowledge bases but can optionally share company-wide knowledge.*

---

## 4. Pluggable Agent Framework (Unified Execution Environment)

### 4.1 Design Philosophy
To ensure maximum performance, low latency, and efficient resource capability, the platform utilizes a **Unified Execution Environment**. Instead of deploying heavy, separate microservices for every agent packs, custom agent logic is run as dynamically loaded modules (Plugins) within a highly optimized, distinct fleet of "Agent Runners."

This approach offers:
- **Zero Cold Starts**: Agents respond instantly.
- **High Density**: Thousands of agents can run on shared infrastructure, reducing costs.
- **Strict Isolation**: Using Node.js Worker Threads or Claudflare V8 Isolates (cloudflare v8) (e.g., `isolated-vm`), each agent's code is sandboxed to prevent it from crashing the platform or accessing other tenants' data.

### 4.2 Universal Agent Runner
The "Agent Runner" is a specialized service responsible for executing custom agent code.
1. **Dynamic Loading**: When a message arrives, the Runner fetches the specific Agent Package (JavaScript bundle) from storage (cached locally).
2. **Sandboxed Execution**: The code is instantiated in a secure, isolated thread.
3. **Inheritance**: All custom agents invoke the platform's `BaseAgent` library, which handles the heavy lifting (RAG, History, State).

### 4.3 Agent Package Structure (Node.js Plugin)
Agents are packaged as standard Node.js modules.

```javascript
// ============================================
// Example 1: Single Agent
// ============================================
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createBuzziAgent, createAgentPackage, AgentTypes } from "@buzzi/base-agent";

// Define tools BEFORE using them
const searchTool = tool(
  async ({ query }) => {
    // Implementation
  },
  {
    name: "web_search",
    description: "Search the web for information",
    schema: z.object({ query: z.string().describe("Search query") }),
  }
);

const salesAgent = createBuzziAgent({
  agentId: "...",
  type: AgentTypes.Worker,
  tools: [searchTool]
});

// Entry point - use default export
export default createAgentPackage("agent_package_id", salesAgent);
```

```javascript
// ============================================
// Example 2: Multi Agent
// ============================================
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createBuzziAgent, createAgentPackage, AgentTypes } from "@buzzi/base-agent";

// Define worker agents first
const mathAgent = createBuzziAgent({
  agentId: "efg...",
  type: AgentTypes.Worker,
  tools: [someTool2]
});

const researchAgent = createBuzziAgent({
  agentId: "hij...",
  type: AgentTypes.Worker,
  tools: [someTool2, someTool3]
});

// Define supervisor with workers
const orchestratorAgent = createBuzziAgent({
  agentId: "abc...",
  type: AgentTypes.Supervisor,
  agents: [mathAgent, researchAgent],
  tools: [someTool]
});

// Entry point
export default createAgentPackage("agent_package_id", orchestratorAgent);

```

**Directory Structure**:
```text
src/chatbot-packages
  /[package_id]
    - index.js          # Entry point
    - agents/           # Agents
    - tools/            # Custom tools
```

### 4.4 Execution Flow
1. **Platform receives message** -> Routes to `Agent Runner Service`.
2. **Runner Service**:
   - Identifies `package_id`.
   - If '/chatbot-packages/[package_id]' folder exists then load the agent from there. else Checks local cache for the Agent's code bundle. if missing, downloads from Supabase Storage.
   - Spins up a **Worker Thread** (or reuses a warm one).
   - Injects the `context` (User message, History, RAG results).
3. **Agent Logic**: Executes synchronously or asynchronously within the thread.
4. **Response**: Streamed back to the Platform via internal event bus (not HTTP).

### 4.5 Development & Deployment
- **"Semi-SaaS" Experience**: Customers (or us) write custom code, but it is uploaded to the dashboard rather than deployed to a server.
- **Hot-Swap**: Updating an agent is as simple as uploading a new `bundle.js`. The next message will automatically use the new code.
- **Security limits**: The sandbox restricts network access (allowlist only), file system access (read-only), and execution time (timeout prevention).

### 4.6 Admin panel options
- in master admin's admin panel, when agent package adds, give a package id(guid), ask whther its single agent or multi agent
- if multi agent ask number of agents; 
- Master admin need options to edit each agent's agent name, designation, system prompt, model and temprature(if model supports temprature). 
- Show agents list as tabs where tabname will change when name field in that tab updates.

## 5. Webhook & API Architecture

### 5.1 URL Structure
All inbound webhooks follow a consistent, routable pattern:

```
https://chat.buzzi.ai/{company-id}/{agent-id}/{channel}/{webhook-id}
https://{configured-company-subdomain}/{company-id}/{agent-id}/{channel}/{webhook-id}
```

**Examples**:
- WhatsApp: `https://chat.buzzi.ai/c_abc123/a_xyz789/whatsapp/wh_001`
- Telegram: `https://acme.abccompany.com/c_abc123/a_xyz789/telegram/wh_002`
- Custom: `https://chat.buzzi.ai/c_abc123/a_xyz789/custom/wh_003`

### 5.2 HTTP Methods by Channel
- **WhatsApp Business API**:
  - `GET`: Webhook verification (challenge-response).
  - `POST`: Incoming messages.
- **Telegram Bot API**:
  - `POST`: Incoming updates.
- **Facebook Messenger**:
  - `GET`: Verification.
  - `POST`: Incoming messages.
- **Slack**:
  - `POST`: Events and slash commands.
- **Microsoft Teams**:
  - `POST`: Activity notifications via Bot Framework.
- **Web Chat**:
  - `POST`: New message submission.
  - `GET` (with SSE): Response streaming.

### 5.3 SSE Streaming for Web Chat
For real-time, ChatGPT-like experiences:
- Client opens SSE connection: `GET /chat/{session-id}/stream`
- **Event Types**:
  - `event: thinking`: Shows processing status.
  - `event: notifications`: System status (e.g., handover).
  - `event: tool_call`: Indicates tool usage.
  - `event: delta`: Incremental text chunks.
  - `event: complete`: Final message with metadata.
  - `event: error`: Error notifications.
- **Reliability**: Heartbeat pings and automatic client-side reconnection.

### 5.4 Thinking/Reasoning Transparency
Stream intermediate states during processing:

```text
event: thinking
data: {"step": "Analyzing user query...", "progress": 0.1}

event: thinking
data: {"step": "Searching knowledge base...", "progress": 0.3}

event: tool_call
data: {"tool": "rag_search", "query": "return policy", "status": "executing"}

event: delta
data: {"content": "Based on our "}
...
```

---

## 6. RAG & Knowledge Management

### 6.1 Default RAG Tool
Every agent includes a RAG (Retrieval-Augmented Generation) tool that:
- Searches the company's dedicated knowledge store, filtered by category.
- **Permissions**: Master Admin assigns which knowledge categories an agent can access.
- Returns relevant context to inform responses.
- Respects configured relevance thresholds.
- Can be disabled per-agent.

### 6.2 Qdrant Vector Database Structure
Each company gets an isolated collection in Qdrant (with free tier support and auto-offloading for idle agents):

`Collection naming: company_{company_id}`

**Document Schema**:
- `content`: The text chunk.
- `metadata`: JSON (source file, page number, section headers).
- `embedding`: Vector representation.
- `created_at`: Timestamp.
- `category_id`: Reference to category.
- `file_id`: Reference to source file in Supabase.

### 6.3 Indexing Best Practices

**Context-Aware Chunking**:
- Preserve semantic boundaries (paragraphs, sections).
- Overlapping chunks (e.g., 20%) to maintain context.
- Hierarchical indexing: Document → Section → Paragraph.
- Parent-child relationships for retrieving surrounding context.

**Smart Parsing**:
- **PDF**: Extract text, tables, images (OCR if needed).
- **DOCX**: Preserve structure, headers, lists.
- **HTML**: Clean extraction, preserve heading hierarchy.
- **CSV/Excel**: Convert rows to natural language descriptions.
- **Images**: Generate descriptions using vision models.

**Metadata Enrichment**:
- Auto-generate summaries per document.
- Extract named entities, dates, product names.
- Keyword indices for hybrid search.

**Indexing Pipeline**:
1. File upload to Supabase Storage.
2. Processing queue detects new file.
3. Content extraction and cleaning.
4. Chunking based on document type.
5. Embedding generation (batch processing).
6. Storage in Qdrant with metadata.
7. Status update in Supabase database.

### 6.4 Supabase Storage Structure
```
/companies
  /{company_id}
    /agents
      /{agent_id}
        /knowledge
          /{file_uuid}_{original_filename}
        /uploads
          /{conversation_id}
            /{file_uuid}_{original_filename}
```

### 6.5 Retrieval Strategy
- **Hybrid Search**: Combine vector similarity with BM25 keyword matching.
- **Reranking**: Cross-encoder model to re-score top-N results.
- **Multi-Query Expansion**: Generate query variations for better recall.

---

## 7. Channel Integrations
(Standard integrations for WhatsApp, Instagram, Messenger, Telegram, Slack, Teams, and generic webhooks as defined in v1)

### 7.2 Push-to-Talk Voice Support
**Web Chat Implementation**:
- Browser-based audio recording (MediaRecorder API).
- Upload as Opus/WebM.
- Server-side transcription (Whisper).
- Response: Text or Text-to-Speech (TTS).

---

## 8. Client-Side Chat Widget

### 8.1 Embed Code
Minimal JavaScript snippet for Company Admins:
```html
<script>
  window.CHATBOT_CONFIG = {
    agentId: "a_xyz789",
    companyId: "c_abc123",
    theme: "light",
    position: "bottom-right",
    primaryColor: "#007bff"
  };
</script>
<script src="https://cdn.buzzi.ai/widget/v1/chat.min.js" async></script>
```

### 8.2 & 8.3 Widget Features & Security
- Customizable appearance (branding, colors).
- Rich functionality: Markdown, file uploads, voice, typing indicators.
- **Security**: SRI, session tokens, rate limiting, CORS, CSP compliance.
- **SDK**: Programmatic control for advanced integrations.

---

## 9. File Upload & Processing
- **Types**: Images, PDFs, Spreadsheets, Audio.
- **Pipeline**: Upload -> Validation -> AI Analysis (Vision/Text Extraction) -> Context Injection.
- **System Prompt**: Instructions on how to handle uploaded files (e.g., "Extract invoice details").

---

## 10. Human-in-the-Loop (HITL)

### 10.1 Escalation Triggers
- Explicit user request.
- Low AI confidence.
- Negative sentiment.
- Specific keywords ("refund", "cancel").
- Business rules.

### 10.2 Workflow
- **State Update**: Database marks session as `is_human_agent = true`.
- **Handover**: Notification to support agent; history transfer.
- **Hybrid Mode**: AI suggests responses (Co-pilot).
- **Return**: Agent hands back to AI after resolution.

---

## 11. Security Architecture

### 11.1 Authentication & Validation
- **DPoP**: Optional advanced proof-of-possession for high-security webhooks.
- **Standard Webhook Security**: HMAC-SHA256 signatures, timestamp validation, IP allowlisting.

### 11.2 AI Security
- **Prompt Injection Defense**: Input sanitization, delimiter confusion prevention, "ignore instructions" detection.
- **Architectural Guidelines**: Separate system prompts from user input; output validation.

### 11.3 Data Security
- Encryption at Rest (Supabase) and Transit (TLS 1.3).
- Row-Level Security (RLS) for strict tenant isolation.
- PII handling and audit logging.
- Compliance: GDPR, SOC 2 alignment.

---

## 12. Custom Domain & Subdomain Management
- **Default**: `https://chat.buzzi.ai`
- **Subdomains**: `https://{company}.chat.buzzi.ai` automatically provisioned.
- **Custom Domains**: `https://chat.acme.com` supported via CNAME and auto-SSL.

---

## 13. Analytics & Monitoring
- **Conversation**: Volume, resolution rates, handle time.
- **AI Performance**: Quality scores, RAG relevance, token usage.
- **Business**: Cost per conversation, conversion tracking.
- **Operational**: Latency, webhook delivery, error rates.

---

## 14. Database & Tech Stack Recommendations

### 14.1 Core Stack
- **Frontend Framework**: Next.js 15 (App Router), React 19, Tailwind CSS v4.
- **Database**: Supabase (PostgreSQL) for relational data.
- **Vector Store**: Qdrant for RAG and knowledge base (free tier, auto-offloading for idle collections).
- **Caching**: **Redis** for fast chat history retrieval and session state.
- **Storage**: Supabase Storage for files.
- **Queue**: BullMQ or similar for processing pipelines (file indexing).
- **Authentication**: Auth.js (NextAuth v5) with Supabase Adapter.

### 14.2 Schema Considerations
- **Chat History**: Expire detailed history after 90 days; retain summaries for analytics.
- **Strict Isolation**: Use RLS policies to ensure companies never access other tenants' data.
- **Optimization**: Indexes on `company_id`, `agent_id`, and `created_at` are critical.

---

This v2 specification refines the original requirements for improved clarity, scalability, and technical precision.
