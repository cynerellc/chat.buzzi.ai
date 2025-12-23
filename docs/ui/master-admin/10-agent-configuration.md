# Agent Configuration (Master Admin)

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/admin/companies/{companyId}/agents/{agentId}` |
| Access | Master Admin only |
| Purpose | Advanced agent configuration (system prompts, execution settings, key configs) |
| Mobile Support | Desktop recommended |

---

## Page Layout

```
+---------------------------------------------------------------------------------+
|  [Logo] Chat.buzzi.ai            [Search...]        [?] [Bell] [MA]             |
+----------------+----------------------------------------------------------------+
|                |                                                                |
|  MAIN MENU     |  <- Acme Corporation / Sales Bot                               |
|  ---------     |                                                                |
|  o Dashboard   |  +------------------------------------------------------------+|
|  * Companies   |  |                                                            ||
|  o Plans       |  |  [Bot Icon] Sales Bot                   [Test] [Save]     ||
|  o Analytics   |  |  @buzzi/sales-agent v2.1.0                                ||
|                |  |  Status: * Active                       [Pause] [Delete]  ||
|  AGENTS        |  |                                                            ||
|  ------        |  +------------------------------------------------------------+|
|  o Packages    |                                                                |
|                |  [Identity] [System Prompt] [Execution] [RAG] [Tools]          |
|  SYSTEM        |  [Escalation] [Channels] [Logs]                                |
|  ------        |  ==============================================================|
|  o Audit Logs  |                                                                |
|  o Settings    |  +------------------------------------------------------------+|
|                |  |                                                            ||
|                |  |                    [Tab Content]                           ||
|                |  |                                                            ||
|                |  +------------------------------------------------------------+|
|                |                                                                |
+----------------+----------------------------------------------------------------+
```

---

## Tab: Identity

```
+---------------------------------------------------------------------+
|                                                                     |
|  Basic Information                                                  |
|  -----------------                                                  |
|                                                                     |
|  Agent Name *                                                       |
|  +---------------------------------------------------------------+  |
|  | Sales Bot                                                      |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Description                                                        |
|  +---------------------------------------------------------------+  |
|  | Handles sales inquiries, product questions, and lead          |  |
|  | qualification for the Acme Corporation website.               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Agent Package                                      [Change Package]|
|  -------------                                                      |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [Code Icon] @buzzi/sales-agent                       v2.1.0  |  |
|  |              Optimized for lead qualification and sales       |  |
|  |              Capabilities: [RAG] [Tools] [File Upload]        |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Personality Settings (Company Admin can edit)                      |
|  ---------------------                                              |
|                                                                     |
|  Display Name                                                       |
|  +---------------------------------------------------------------+  |
|  | Aria - Sales Assistant                                         |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Avatar                                                             |
|  [Current Avatar]  [Upload New]  [Generate AI Avatar]               |
|                                                                     |
|  Greeting Message                                                   |
|  +---------------------------------------------------------------+  |
|  | Hi! I'm Aria, your sales assistant. How can I help you today? |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: System Prompt (Master Admin Only)

```
+---------------------------------------------------------------------+
|                                                                     |
|  ! This section is hidden from Company Admin                        |
|                                                                     |
|  Core System Prompt *                                               |
|  -------------------                                                |
|  +---------------------------------------------------------------+  |
|  |  You are Aria, an AI sales assistant for {company_name}.      |  |
|  |                                                               |  |
|  |  Your primary objectives are:                                 |  |
|  |  1. Answer product questions accurately using the knowledge   |  |
|  |     base provided                                             |  |
|  |  2. Qualify leads by understanding customer needs             |  |
|  |  3. Guide customers toward appropriate products               |  |
|  |  4. Collect contact information when appropriate              |  |
|  |                                                               |  |
|  |  Important rules:                                             |  |
|  |  - Never make up product information. If unsure, say so       |  |
|  |  - Do not discuss competitor products negatively              |  |
|  |  - Maximum discount you can offer is {max_discount}%          |  |
|  |  - For complex quotes, escalate to human sales team           |  |
|  |                                                               |  |
|  |  Available tools:                                             |  |
|  |  - check_inventory: Check product availability                |  |
|  |  - create_quote: Generate price quotes                        |  |
|  |  - rag_search: Search knowledge base                          |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|  Character count: 847 / 4000                                        |
|                                                                     |
|  Variables Available:                                               |
|  {company_name}, {agent_name}, {customer_name}, {max_discount}      |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  System Prompt Additions (per request)                              |
|  -------------------------------------                              |
|  Additional context injected at runtime based on conditions         |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |  + Add Conditional Prompt                                     |  |
|  |                                                               |  |
|  |  +-----------------------------------------------------------+|  |
|  |  | Condition: Customer is VIP                                ||  |
|  |  | Prompt: "This is a VIP customer. You may offer up to     ||  |
|  |  |         20% discount. Prioritize their satisfaction."     ||  |
|  |  |                                        [Edit] [Delete]    ||  |
|  |  +-----------------------------------------------------------+|  |
|  |                                                               |  |
|  |  +-----------------------------------------------------------+|  |
|  |  | Condition: After business hours                           ||  |
|  |  | Prompt: "It's currently outside business hours. Collect  ||  |
|  |  |         contact info for follow-up tomorrow."             ||  |
|  |  |                                        [Edit] [Delete]    ||  |
|  |  +-----------------------------------------------------------+|  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Execution (Unified Execution Environment)

```
+---------------------------------------------------------------------+
|                                                                     |
|  ! These settings control the sandboxed execution environment       |
|                                                                     |
|  LLM Configuration                                                  |
|  -----------------                                                  |
|                                                                     |
|  Model                                                              |
|  +---------------------------------------------------------------+  |
|  | claude-sonnet-4-20250514                                    v |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Temperature                                                        |
|  Cold 0 |-----------*-----------| 1 Creative                        |
|                    0.7                                              |
|                                                                     |
|  Max Tokens                                                         |
|  +-------------+                                                    |
|  | 4096        |                                                    |
|  +-------------+                                                    |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Sandbox Limits                                                     |
|  --------------                                                     |
|                                                                     |
|  Memory Limit                                                       |
|  +-------------+ MB                                                 |
|  | 128         |   (Range: 64-256 MB)                               |
|  +-------------+                                                    |
|                                                                     |
|  Execution Timeout                                                  |
|  +-------------+ seconds                                            |
|  | 30          |   (Range: 10-60 seconds)                           |
|  +-------------+                                                    |
|                                                                     |
|  Fetch Timeout (per external request)                               |
|  +-------------+ seconds                                            |
|  | 10          |   (Range: 5-30 seconds)                            |
|  +-------------+                                                    |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Network Allowlist                                                  |
|  -----------------                                                  |
|  External hosts this agent is allowed to communicate with           |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |  + Add Allowed Host                                           |  |
|  |                                                               |  |
|  |  * api.acme-corp.com                              [x Remove]  |  |
|  |  * inventory.acme-corp.com                        [x Remove]  |  |
|  |  * crm.salesforce.com                             [x Remove]  |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  ! Warning: Adding external hosts increases security risk           |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Execution Restrictions                                             |
|  ----------------------                                             |
|                                                                     |
|  [x] File system access: Read-only (package files only)             |
|  [x] Child processes: Blocked                                       |
|  [x] Native modules: Blocked                                        |
|  [x] Dynamic code evaluation: Blocked (eval, Function)              |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: RAG

```
+---------------------------------------------------------------------+
|                                                                     |
|  Knowledge Base Settings                                            |
|  -----------------------                                            |
|                                                                     |
|  RAG Integration                                                    |
|  (*) Enabled                                                        |
|  ( ) Disabled                                                       |
|                                                                     |
|  Assigned Knowledge Categories                                      |
|  +---------------------------------------------------------------+  |
|  |  [x] Product Catalog          45 documents                    |  |
|  |  [x] Pricing Information      12 documents                    |  |
|  |  [x] FAQ                      23 documents                    |  |
|  |  [ ] Technical Documentation  120 documents                   |  |
|  |  [ ] Company Policies         15 documents                    |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Retrieval Settings                                                 |
|  ------------------                                                 |
|                                                                     |
|  Max Results                                                        |
|  +-------------+                                                    |
|  | 5           |   (Range: 1-20)                                    |
|  +-------------+                                                    |
|                                                                     |
|  Relevance Threshold                                                |
|  Low 0 |----------------*------| 1 High                             |
|                        0.7                                          |
|  Lower = more results but less relevant                             |
|                                                                     |
|  Search Strategy                                                    |
|  +---------------------------------------------------------------+  |
|  | Hybrid (Vector + BM25)                                      v |  |
|  +---------------------------------------------------------------+  |
|  Options: Vector Only, BM25 Only, Hybrid                            |
|                                                                     |
|  [x] Enable re-ranking (Cross-encoder)                              |
|  [x] Enable multi-query expansion                                   |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Tools

```
+---------------------------------------------------------------------+
|                                                                     |
|  Available Tools                                                    |
|  ---------------                                                    |
|                                                                     |
|  Package Tools (from @buzzi/sales-agent)                            |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [x] check_inventory                                          |  |
|  |      Check product stock levels                               |  |
|  |      Parameters: productId (string)                           |  |
|  |                                                [Configure]    |  |
|  |                                                               |  |
|  |  [x] create_quote                                             |  |
|  |      Generate sales quote for customer                        |  |
|  |      Parameters: items (array), discount (number)             |  |
|  |                                                [Configure]    |  |
|  |                                                               |  |
|  |  [x] lookup_pricing                                           |  |
|  |      Get current pricing for products                         |  |
|  |      Parameters: productId (string)                           |  |
|  |                                                [Configure]    |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Platform Tools                                                     |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [x] rag_search (always enabled when RAG is on)               |  |
|  |      Search knowledge base for relevant information           |  |
|  |                                                               |  |
|  |  [ ] escalate_to_human                                        |  |
|  |      Explicitly trigger escalation to human agent             |  |
|  |                                                               |  |
|  |  [ ] schedule_callback                                        |  |
|  |      Schedule a callback for the customer                     |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Tool Configuration                                                 |
|  ------------------                                                 |
|                                                                     |
|  check_inventory Configuration:                                     |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  API Endpoint *                                               |  |
|  |  +-----------------------------------------------------------+|  |
|  |  | https://api.acme-corp.com/inventory                       ||  |
|  |  +-----------------------------------------------------------+|  |
|  |                                                               |  |
|  |  API Key (encrypted) *                                        |  |
|  |  +-----------------------------------------------------------+|  |
|  |  | ******************************                            ||  |
|  |  +-----------------------------------------------------------+|  |
|  |                                                               |  |
|  |  Timeout: 10 seconds                                          |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Escalation

```
+---------------------------------------------------------------------+
|                                                                     |
|  Human-in-the-Loop Settings                                         |
|  --------------------------                                         |
|                                                                     |
|  Escalation Triggers                                                |
|  -------------------                                                |
|                                                                     |
|  [x] Explicit User Request                                          |
|      Trigger words: "human", "agent", "speak to someone",           |
|      "real person", "manager"                        [Edit Words]   |
|                                                                     |
|  [x] Low AI Confidence                                              |
|      Threshold: +----------------*------+ 0.6                       |
|                 0                      1                            |
|      Escalate when confidence below threshold                       |
|                                                                     |
|  [x] Negative Sentiment                                             |
|      Trigger after: +-----+ 2 negative messages                     |
|      Sensitivity: [Medium v]                                        |
|                                                                     |
|  [x] Specific Keywords                                              |
|      Keywords: "refund", "cancel", "lawsuit", "complaint",          |
|      "supervisor"                                    [Edit Words]   |
|                                                                     |
|  [x] Response Timeout                                               |
|      Escalate after: +-----+ 3 unanswered queries                   |
|                                                                     |
|  [ ] Business Rules (Custom)                                        |
|      [+ Add Custom Rule]                                            |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Fallback Behavior                                                  |
|  -----------------                                                  |
|                                                                     |
|  When no human is available:                                        |
|  +---------------------------------------------------------------+  |
|  | Collect contact info and promise callback                   v |  |
|  +---------------------------------------------------------------+  |
|  Options: Queue message, Collect callback, Show business hours     |
|                                                                     |
|  Escalation Message Template                                        |
|  +---------------------------------------------------------------+  |
|  | I'm connecting you with a team member who can better assist. |  |
|  | Please hold on for a moment...                                |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  AI Co-pilot Settings (for human agents)                            |
|  ---------------------------------------                            |
|                                                                     |
|  [x] Enable AI response suggestions                                 |
|  [x] Enable knowledge base search suggestions                       |
|  [ ] Enable sentiment analysis display                              |
|  [ ] Enable customer intent prediction                              |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Channels

```
+---------------------------------------------------------------------+
|                                                                     |
|  Deployment Channels                                                |
|  -------------------                                                |
|                                                                     |
|  Web Chat Widget                                       [Configure]  |
|  +---------------------------------------------------------------+  |
|  |  Status: * Active                                             |  |
|  |  Widget ID: wgt_abc123xyz                                     |  |
|  |  Domains: acme-corp.com, shop.acme-corp.com                   |  |
|  |                                                               |  |
|  |  [Get Embed Code]                                             |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  WhatsApp Business                                     [Configure]  |
|  +---------------------------------------------------------------+  |
|  |  Status: * Active                                             |  |
|  |  Phone: +1 (555) 123-4567                                     |  |
|  |  Business Account: Acme Corporation                           |  |
|  |                                                               |  |
|  |  Webhook: https://chat.buzzi.ai/c_abc/a_xyz/whatsapp/wh_001   |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Telegram                                              [Configure]  |
|  +---------------------------------------------------------------+  |
|  |  Status: o Not Connected                                      |  |
|  |                                                               |  |
|  |  [Connect Telegram Bot]                                       |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Slack                                                 [Configure]  |
|  +---------------------------------------------------------------+  |
|  |  Status: o Not Connected                                      |  |
|  |                                                               |  |
|  |  [Connect Slack Workspace]                                    |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Microsoft Teams                                       [Configure]  |
|  +---------------------------------------------------------------+  |
|  |  Status: o Not Connected                                      |  |
|  |                                                               |  |
|  |  [Connect Teams]                                              |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Custom Webhook                                        [Configure]  |
|  +---------------------------------------------------------------+  |
|  |  Status: * Active                                             |  |
|  |  Endpoint: https://chat.buzzi.ai/c_abc/a_xyz/custom/wh_003    |  |
|  |  Secret: whs_••••••••                               [Rotate]  |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Logs

```
+---------------------------------------------------------------------+
|                                                                     |
|  Execution Logs                       [Date Range v] [Export]       |
|  ---------------                                                    |
|                                                                     |
|  Filter: [All v] [Errors Only] [Warnings] [Tool Calls]              |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [*] 2024-01-18 10:45:23  Message processed                   |  |
|  |      Duration: 1.2s | Tokens: 850 | Tools: rag_search         |  |
|  |                                                   [Details]   |  |
|  |                                                               |  |
|  |  [*] 2024-01-18 10:44:15  Message processed                   |  |
|  |      Duration: 2.1s | Tokens: 1240 | Tools: check_inventory   |  |
|  |                                                   [Details]   |  |
|  |                                                               |  |
|  |  [!] 2024-01-18 10:42:08  Tool execution warning              |  |
|  |      check_inventory timed out after 10s                      |  |
|  |                                                   [Details]   |  |
|  |                                                               |  |
|  |  [*] 2024-01-18 10:40:55  Escalation triggered                |  |
|  |      Reason: Negative sentiment detected                      |  |
|  |                                                   [Details]   |  |
|  |                                                               |  |
|  |  [x] 2024-01-18 10:38:22  Execution error                     |  |
|  |      Memory limit exceeded (attempted 145MB)                  |  |
|  |                                                   [Details]   |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Showing 1-20 of 1,543 logs                     [< 1 2 3 ... 78 >]  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Log Detail Modal

```
+-------------------------------------------------------------------+
|  Execution Log Detail                                          [x] |
+-------------------------------------------------------------------+
|                                                                   |
|  Timestamp: 2024-01-18 10:45:23 UTC                               |
|  Conversation ID: conv_abc123                                     |
|  Request ID: req_xyz789                                           |
|                                                                   |
|  Execution Metrics                                                |
|  -----------------                                                |
|  Duration: 1.2s                                                   |
|  Memory Used: 82 MB / 128 MB                                      |
|  CPU Time: 0.8s                                                   |
|  Tokens: 850 (prompt: 650, completion: 200)                       |
|                                                                   |
|  Tool Calls                                                       |
|  ----------                                                       |
|  1. rag_search                                                    |
|     Query: "return policy for electronics"                        |
|     Results: 3 documents                                          |
|     Duration: 0.3s                                                |
|                                                                   |
|  Input Message                                                    |
|  -------------                                                    |
|  "What's your return policy for electronics?"                     |
|                                                                   |
|  Output Response                                                  |
|  ---------------                                                  |
|  "Our return policy for electronics allows returns within 30      |
|   days of purchase with original packaging and receipt..."        |
|                                                                   |
|  [View Full Conversation] [View System Prompt Used]               |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## Test Agent Modal

```
+-------------------------------------------------------------------+
|  Test Agent                                                    [x] |
+-------------------------------------------------------------------+
|                                                                   |
|  Test your agent configuration before saving.                     |
|                                                                   |
|  +---------------------------------------------------------------+|
|  |                                                               ||
|  |  [Bot] Hi! I'm Aria, your sales assistant. How can I help?   ||
|  |                                                               ||
|  |                                                               ||
|  |                  [User] What products do you have? [User]     ||
|  |                                                               ||
|  |  [Bot] We offer a wide range of products including...        ||
|  |        [Thinking: Searching knowledge base...]               ||
|  |        [Tool: rag_search completed]                          ||
|  |                                                               ||
|  |        Based on our catalog, we have:                        ||
|  |        1. Electronics - TVs, laptops, smartphones            ||
|  |        2. Home & Garden - furniture, appliances              ||
|  |        3. Sports & Outdoors - fitness equipment              ||
|  |                                                               ||
|  |        What category interests you?                          ||
|  |                                                               ||
|  +---------------------------------------------------------------+|
|                                                                   |
|  +---------------------------------------------------------------+|
|  | Type a test message...                              [Send]   ||
|  +---------------------------------------------------------------+|
|                                                                   |
|  Test Context:                                                    |
|  Customer: Test User | VIP: [ ] | Channel: Web                   |
|                                                                   |
|  Execution Info (Last Message):                                   |
|  Duration: 1.8s | Tokens: 920 | Tools: rag_search                |
|                                                                   |
+-------------------------------------------------------------------+
|                                            [Clear] [Close]         |
+-------------------------------------------------------------------+
```

---

## Mobile Layout

```
+---------------------------+
|  [<] Sales Bot    [Save]  |
+---------------------------+
|  @buzzi/sales-agent v2.1  |
|  * Active                 |
+---------------------------+
|  [Identity][Prompt][Exec] |
|  [RAG][Tools][Esc][Chan]  |
+---------------------------+
|                           |
|  Tab Content              |
|  (Full width cards)       |
|                           |
|  Settings stack           |
|  vertically with          |
|  collapsible sections     |
|                           |
+---------------------------+
|  [Test Agent]             |
+---------------------------+
```

---

## Related Pages

- [Company Details](./03-company-details.md)
- [Agent Packages](./09-agent-packages.md)
- [System Settings](./07-system-settings.md)
- [Audit Logs](./06-audit-logs.md)
