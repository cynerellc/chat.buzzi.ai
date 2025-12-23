# Agent Packages

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/admin/packages` |
| Access | Master Admin only |
| Purpose | Manage pluggable agent code packages |
| Mobile Support | Desktop recommended |

---

## Page Layout

```
+---------------------------------------------------------------------------------+
|  [Logo] Chat.buzzi.ai            [Search...]        [?] [Bell] [MA]             |
+----------------+----------------------------------------------------------------+
|                |                                                                |
|  MAIN MENU     |  Agent Packages                              [+ Upload Package]|
|  ---------     |                                                                |
|  o Dashboard   |  +----------------------------------------------------------+  |
|  o Companies   |  | Reusable agent code packages that can be deployed to     |  |
|  o Plans       |  | company agents. Each package extends BaseAgent.          |  |
|  o Analytics   |  +----------------------------------------------------------+  |
|                |                                                                |
|  AGENTS        |  [All] [Published] [Draft] [Deprecated]                        |
|  ------        |                                                                |
|  * Packages    |  +----------------------------------------------------------+  |
|                |  |  Search packages...                    [Type v] [Sort v] |  |
|  SYSTEM        |  +----------------------------------------------------------+  |
|  ------        |                                                                |
|  o Audit Logs  |  +----------------------------------------------------------+  |
|  o Settings    |  |                                                          |  |
|                |  |  +------------------------------------------------------+|  |
|                |  |  | [Code Icon]  Sales Agent                    v2.1.0   ||  |
|                |  |  | @buzzi/sales-agent                                   ||  |
|                |  |  | Optimized for lead qualification and sales queries   ||  |
|                |  |  |                                                      ||  |
|                |  |  | Capabilities: [RAG] [Tools] [File Upload]            ||  |
|                |  |  | Used by: 24 agents across 12 companies               ||  |
|                |  |  | Status: * Published                                  ||  |
|                |  |  |                                                      ||  |
|                |  |  |                       [View] [New Version] [...]     ||  |
|                |  |  +------------------------------------------------------+|  |
|                |  |                                                          |  |
|                |  |  +------------------------------------------------------+|  |
|                |  |  | [Code Icon]  Support Agent                  v3.0.2   ||  |
|                |  |  | @buzzi/support-agent                                 ||  |
|                |  |  | Customer support with escalation and co-pilot        ||  |
|                |  |  |                                                      ||  |
|                |  |  | Capabilities: [RAG] [Tools] [HITL] [Co-pilot]        ||  |
|                |  |  | Used by: 45 agents across 28 companies               ||  |
|                |  |  | Status: * Published                                  ||  |
|                |  |  |                                                      ||  |
|                |  |  |                       [View] [New Version] [...]     ||  |
|                |  |  +------------------------------------------------------+|  |
|                |  |                                                          |  |
|                |  |  +------------------------------------------------------+|  |
|                |  |  | [Code Icon]  Custom: Acme Corp             v1.0.0    ||  |
|                |  |  | @acme/custom-agent                                   ||  |
|                |  |  | Custom agent for Acme Corporation                    ||  |
|                |  |  |                                                      ||  |
|                |  |  | Capabilities: [RAG] [Custom Tools]                   ||  |
|                |  |  | Used by: 3 agents (Acme Corp only)                   ||  |
|                |  |  | Status: * Published                                  ||  |
|                |  |  |                                                      ||  |
|                |  |  |                       [View] [New Version] [...]     ||  |
|                |  |  +------------------------------------------------------+|  |
|                |  |                                                          |  |
|                |  +----------------------------------------------------------+  |
|                |                                                                |
+----------------+----------------------------------------------------------------+
```

---

## Package Card Structure

```
+----------------------------------------------------------------------+
|                                                                      |
|  [Code Icon]  Package Display Name                         vX.Y.Z   |
|               @scope/package-name                                    |
|               Short description of what this agent does              |
|                                                                      |
|               Capabilities: [Tag] [Tag] [Tag]                        |
|               Used by: X agents across Y companies                   |
|               Status: * Published / Draft / Deprecated               |
|                                                                      |
|                                    [View] [New Version] [...]        |
|                                                                      |
+----------------------------------------------------------------------+
```

---

## Package Status

| Status | Icon | Description |
|--------|------|-------------|
| Published | * Green | Available for deployment |
| Draft | o Yellow | In development, not deployable |
| Deprecated | ! Gray | Phasing out, existing agents still work |
| Error | x Red | Validation failed |

---

## Upload Package Modal

```
+-------------------------------------------------------------------+
|  Upload Agent Package                                          [x] |
+-------------------------------------------------------------------+
|                                                                   |
|  Package Type                                                     |
|  o Platform Package (available to all companies)                  |
|  o Company-Specific (restricted to one company)                   |
|                                                                   |
|  If Company-Specific:                                             |
|  +-------------------------------------------------------------+  |
|  | Select Company...                                         v |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  --------------------------------------------------------------- |
|                                                                   |
|  Package File *                                                   |
|  +-------------------------------------------------------------+  |
|  |                                                             |  |
|  |     +-------------------------------------------+           |  |
|  |     |                                           |           |  |
|  |     |     [Upload Icon] Drop .zip file here     |           |  |
|  |     |                                           |           |  |
|  |     |     or click to browse                    |           |  |
|  |     |                                           |           |  |
|  |     |     Required: index.js, package.json      |           |  |
|  |     |                                           |           |  |
|  |     +-------------------------------------------+           |  |
|  |                                                             |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  Package Details (auto-detected from package.json)                |
|  -------------------------------------------------                |
|                                                                   |
|  Name: @buzzi/sales-agent                                         |
|  Version: 2.2.0                                                   |
|  Extends: BaseAgent v2.0.0 (compatible)                           |
|                                                                   |
|  Detected Capabilities:                                           |
|  [x] RAG Integration                                              |
|  [x] Custom Tools (3 found)                                       |
|  [x] File Upload Handling                                         |
|  [ ] HITL Escalation                                              |
|                                                                   |
+-------------------------------------------------------------------+
|                                [Cancel]  [Validate & Upload]       |
+-------------------------------------------------------------------+
```

---

## Package Validation Results

```
+-------------------------------------------------------------------+
|  Package Validation                                            [x] |
+-------------------------------------------------------------------+
|                                                                   |
|  @buzzi/sales-agent v2.2.0                                        |
|                                                                   |
|  Validation Status: [Checkmark] Passed                            |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |                                                             |  |
|  |  [Checkmark] Structure validation                           |  |
|  |      index.js found, package.json valid                     |  |
|  |                                                             |  |
|  |  [Checkmark] BaseAgent inheritance                          |  |
|  |      Extends BaseAgent v2.0.0                               |  |
|  |                                                             |  |
|  |  [Checkmark] Dependency check                               |  |
|  |      All dependencies on approved list                      |  |
|  |                                                             |  |
|  |  [Checkmark] Security scan                                  |  |
|  |      No dangerous patterns detected                         |  |
|  |                                                             |  |
|  |  [Checkmark] Sandbox test                                   |  |
|  |      Executed successfully in isolated environment          |  |
|  |                                                             |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  Package Hash: sha256:a1b2c3d4e5f6...                             |
|                                                                   |
+-------------------------------------------------------------------+
|                                [Cancel]  [Publish Package]         |
+-------------------------------------------------------------------+
```

---

## Validation Error State

```
+-------------------------------------------------------------------+
|  Package Validation                                            [x] |
+-------------------------------------------------------------------+
|                                                                   |
|  @acme/broken-agent v1.0.0                                        |
|                                                                   |
|  Validation Status: [X] Failed                                    |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |                                                             |  |
|  |  [Checkmark] Structure validation                           |  |
|  |      index.js found, package.json valid                     |  |
|  |                                                             |  |
|  |  [Checkmark] BaseAgent inheritance                          |  |
|  |      Extends BaseAgent v2.0.0                               |  |
|  |                                                             |  |
|  |  [X] Dependency check                                       |  |
|  |      Unauthorized dependency: child_process                 |  |
|  |                                                             |  |
|  |  [X] Security scan                                          |  |
|  |      Dangerous pattern found: eval() on line 45             |  |
|  |      Dangerous pattern found: require() on line 78          |  |
|  |                                                             |  |
|  |  [--] Sandbox test                                          |  |
|  |      Skipped due to previous failures                       |  |
|  |                                                             |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  Please fix the issues above and upload again.                    |
|                                                                   |
+-------------------------------------------------------------------+
|                                               [Close]              |
+-------------------------------------------------------------------+
```

---

## Package Detail View

```
+---------------------------------------------------------------------------------+
|                                                                                 |
|  <- Back to Packages                                                            |
|                                                                                 |
|  Sales Agent                                              [Edit] [New Version]  |
|  @buzzi/sales-agent                                                             |
|                                                                                 |
|  [Overview] [Versions] [Configuration Schema] [Deployments] [Logs]              |
|  ============================================================================== |
|                                                                                 |
|  +-----------------------------------+  +-----------------------------------+   |
|  |                                   |  |                                   |   |
|  |  Package Information              |  |  Deployment Stats                 |   |
|  |  -------------------              |  |  ----------------                 |   |
|  |                                   |  |                                   |   |
|  |  Current Version: v2.1.0          |  |  Total Agents: 24                 |   |
|  |  Published: Jan 15, 2024          |  |  Companies: 12                    |   |
|  |  Base Agent: v2.0.0               |  |  Messages/day: ~15,000            |   |
|  |  Package Size: 245 KB             |  |  Avg Latency: 1.2s                |   |
|  |  Hash: sha256:a1b2c3...           |  |  Error Rate: 0.02%                |   |
|  |                                   |  |                                   |   |
|  +-----------------------------------+  +-----------------------------------+   |
|                                                                                 |
|  Description                                                                    |
|  -----------                                                                    |
|  Optimized for lead qualification and sales queries. Includes product          |
|  recommendation, pricing lookup, and quote generation capabilities.            |
|                                                                                 |
|  Capabilities                                                                   |
|  ------------                                                                   |
|  [RAG] [Custom Tools] [File Upload]                                             |
|                                                                                 |
|  Custom Tools (3)                                                               |
|  ----------------                                                               |
|  +-----------------------------------------------------------------------+     |
|  | Tool Name           | Description                      | Parameters  |     |
|  +-----------------------------------------------------------------------+     |
|  | check_inventory     | Check product stock levels       | productId   |     |
|  | create_quote        | Generate sales quote             | items, disc |     |
|  | lookup_pricing      | Get current pricing              | productId   |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
|  Security Configuration                                                         |
|  ----------------------                                                         |
|  Allowed Hosts: api.crm.internal, inventory.internal                            |
|  Max Memory: 128 MB                                                             |
|  Execution Timeout: 30 seconds                                                  |
|  File System: Read-only                                                         |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## Versions Tab

```
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Version History                                          [+ Upload New Version]|
|                                                                                 |
|  +-----------------------------------------------------------------------+     |
|  | Version  | Status      | Published      | Deployments | Actions       |     |
|  +-----------------------------------------------------------------------+     |
|  | v2.1.0   | * Current   | Jan 15, 2024   | 24 agents   | [View] [...]  |     |
|  | v2.0.0   | Deprecated  | Dec 1, 2023    | 2 agents    | [View] [...]  |     |
|  | v1.5.0   | Deprecated  | Oct 15, 2023   | 0 agents    | [View] [...]  |     |
|  | v1.0.0   | Archived    | Aug 1, 2023    | 0 agents    | [View]        |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
|  Version Upgrade Status                                                         |
|  ---------------------                                                          |
|  [!] 2 agents still on v2.0.0 - [View Agents] [Notify Companies]                |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## Configuration Schema Tab

```
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Configuration Schema                                                           |
|  This defines the configurable options exposed to agents using this package     |
|                                                                                 |
|  +-----------------------------------------------------------------------+     |
|  |                                                                       |     |
|  |  {                                                                    |     |
|  |    "temperature": {                                                   |     |
|  |      "type": "number",                                                |     |
|  |      "default": 0.7,                                                  |     |
|  |      "min": 0,                                                        |     |
|  |      "max": 1,                                                        |     |
|  |      "description": "LLM response creativity"                         |     |
|  |    },                                                                 |     |
|  |    "maxDiscountPercent": {                                            |     |
|  |      "type": "number",                                                |     |
|  |      "default": 10,                                                   |     |
|  |      "adminOnly": true,                                               |     |
|  |      "description": "Maximum discount agent can offer"                |     |
|  |    },                                                                 |     |
|  |    "enableQuoteGeneration": {                                         |     |
|  |      "type": "boolean",                                               |     |
|  |      "default": true,                                                 |     |
|  |      "description": "Allow agent to generate quotes"                  |     |
|  |    },                                                                 |     |
|  |    "fallbackResponse": {                                              |     |
|  |      "type": "string",                                                |     |
|  |      "default": "Let me connect you with a team member.",             |     |
|  |      "companyEditable": true,                                         |     |
|  |      "description": "Response when agent cannot help"                 |     |
|  |    }                                                                  |     |
|  |  }                                                                    |     |
|  |                                                                       |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
|  Legend:                                                                        |
|  - adminOnly: Only Master Admin can modify                                      |
|  - companyEditable: Company Admin can modify                                    |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## Deployments Tab

```
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Active Deployments                                                             |
|                                                                                 |
|  +-----------------------------------------------------------------------+     |
|  | Company          | Agent Name       | Version | Status   | Actions    |     |
|  +-----------------------------------------------------------------------+     |
|  | Acme Corporation | Sales Bot        | v2.1.0  | Active   | [Config]   |     |
|  | Acme Corporation | Product Advisor  | v2.1.0  | Active   | [Config]   |     |
|  | TechStart Inc    | Lead Qualifier   | v2.1.0  | Active   | [Config]   |     |
|  | TechStart Inc    | Demo Bot         | v2.0.0  | Active   | [Upgrade]  |     |
|  | Global Retail    | Shopping Helper  | v2.1.0  | Paused   | [Config]   |     |
|  | ...              | ...              | ...     | ...      | ...        |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
|  Showing 1-10 of 24 deployments                          [< 1 2 3 >]           |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## Package Actions Menu

```
+------------------------+
|  Edit Package Info     |
|  Upload New Version    |
+------------------------+
|  Deprecate Package     |
|  Archive Package       |
+------------------------+
|  View Audit Log        |
|  Export Package        |
+------------------------+
```

---

## Mobile Layout

```
+---------------------------+
|  [=] Packages        [+]  |
+---------------------------+
|  [All][Published][Draft]  |
+---------------------------+
|  Search...                |
+---------------------------+
|                           |
|  +---------------------+  |
|  | Sales Agent  v2.1.0 |  |
|  | @buzzi/sales-agent  |  |
|  | [RAG] [Tools]       |  |
|  | 24 agents           |  |
|  | * Published         |  |
|  +---------------------+  |
|                           |
|  +---------------------+  |
|  | Support Agent v3.0  |  |
|  | @buzzi/support      |  |
|  | [RAG] [HITL]        |  |
|  | 45 agents           |  |
|  | * Published         |  |
|  +---------------------+  |
|                           |
+---------------------------+
```

---

## Related Pages

- [Company Details](./03-company-details.md)
- [Agent Configuration](./10-agent-configuration.md)
- [System Settings](./07-system-settings.md)
- [Audit Logs](./06-audit-logs.md)
