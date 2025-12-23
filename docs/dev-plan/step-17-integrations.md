# Step 17: Company Admin - Integrations

## Objective
Implement integrations management allowing companies to connect third-party services, configure webhooks, and access the API.

---

## Prerequisites
- Step 16 completed
- OAuth handling infrastructure
- Webhook delivery system

---

## Reference Documents
- [UI: Integrations](../ui/company-admin/12-integrations.md)

---

## Tasks

### 17.1 Create Integrations Page

**Route:** `src/app/(company-admin)/integrations/page.tsx`

**Tabs:**
- Connected - Active integrations
- Available - Browse integrations
- API & Webhooks - Developer tools

### 17.2 Implement Connected Integrations Tab

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Connected Integrations (3)                                  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  [Slack Logo]  Slack                    ● Connected   │  │
│  │  Get notified about new conversations                 │  │
│  │  Connected to: #support-alerts                        │  │
│  │                          [Configure] [Disconnect]     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  [Zapier Logo]  Zapier                  ● Connected   │  │
│  │  Automate workflows with 5000+ apps                   │  │
│  │  3 active Zaps                                        │  │
│  │                          [Configure] [Disconnect]     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  [Email Logo]  Email Forwarding         ● Connected   │  │
│  │  Forward emails to create conversations               │  │
│  │  support@acme.chat.buzzi.ai                          │  │
│  │                          [Configure] [Disconnect]     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 17.3 Implement Available Integrations Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Available Integrations                                             │
│                                                                     │
│  🔍 Search integrations...                                          │
│                                                                     │
│  [All] [CRM] [Communication] [Analytics] [E-commerce]              │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ [Salesforce]│ │ [HubSpot]   │ │ [Zendesk]   │ │ [Slack]     │   │
│  │    CRM      │ │    CRM      │ │  Support    │ │Communication│   │
│  │  [Connect]  │ │  [Connect]  │ │  [Connect]  │ │ [Connected] │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ [MS Teams]  │ │ [Google]    │ │ [WhatsApp]  │ │ [Telegram]  │   │
│  │Communication│ │ Analytics   │ │ Messaging   │ │ Messaging   │   │
│  │  [Connect]  │ │  [Connect]  │ │  [Connect]  │ │  [Connect]  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ [Shopify]   │ │ [WooCommerce││ │ [Stripe]    │ │ [Mailchimp] │   │
│  │ E-commerce  │ │ E-commerce  │ │ Payments    │ │ Marketing   │   │
│  │  [Connect]  │ │  [Connect]  │ │  [Connect]  │ │  [Connect]  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.4 Implement Integration Detail Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Slack Integration                                          [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Slack Logo]                                                   │
│                                                                 │
│  Get real-time notifications about customer conversations       │
│  in your Slack workspace.                                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Features:                                                      │
│  • New conversation notifications                               │
│  • Escalation alerts                                            │
│  • Reply to customers from Slack                                │
│  • Daily summary reports                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Permissions Required:                                          │
│  • Send messages to channels                                    │
│  • Read channel messages                                        │
│  • Manage webhooks                                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                               [Cancel]  [Connect with Slack]    │
└─────────────────────────────────────────────────────────────────┘
```

### 17.5 Implement Integration Configuration Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Configure Slack                                            [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Connected Workspace: Acme Corp                                 │
│  Connected by: john@acme.com                                    │
│  Connected: January 15, 2024                                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Notification Channel                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ #support-alerts                                       ▼ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Notifications                                                  │
│  ─────────────                                                  │
│                                                                 │
│  ☑ New conversations                                           │
│  ☑ Escalations to human                                        │
│  ☐ All messages (high volume)                                  │
│  ☑ Daily summary                                               │
│                                                                 │
│  Reply from Slack                                               │
│  ────────────────                                               │
│                                                                 │
│  ☑ Allow agents to reply from Slack                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          [Disconnect]  [Save Changes]           │
└─────────────────────────────────────────────────────────────────┘
```

### 17.6 Implement API & Webhooks Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  API Access                                                         │
│  ──────────                                                         │
│                                                                     │
│  API Key                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ sk_live_abc123••••••••••••••••••••••••••••••••    [Show]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  [Copy]  [Regenerate]                                               │
│                                                                     │
│  ⚠️ Keep this key secret. Never expose it in client-side code.     │
│                                                                     │
│  API Endpoint: https://api.chat.buzzi.ai/v1                        │
│  [View API Documentation →]                                         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Webhooks                                                           │
│  ────────                                                           │
│                                                                     │
│  Receive real-time updates when events occur.                       │
│                                                                     │
│  [+ Add Webhook Endpoint]                                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │  https://api.acme.com/webhooks/chat                       │     │
│  │  Events: conversation.created, message.received           │     │
│  │  Status: ● Active                                         │     │
│  │                              [Edit] [Test] [Delete]       │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                     │
│  Available Events:                                                  │
│  • conversation.created                                             │
│  • conversation.updated                                             │
│  • conversation.closed                                              │
│  • message.received                                                 │
│  • message.sent                                                     │
│  • escalation.triggered                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.7 Implement Add Webhook Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Webhook Endpoint                                       [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Endpoint URL *                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ https://                                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Description (optional)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CRM integration webhook                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Events to Subscribe *                                          │
│  ─────────────────────                                          │
│                                                                 │
│  ☑ conversation.created                                        │
│  ☑ conversation.closed                                         │
│  ☑ message.received                                            │
│  ☐ message.sent                                                │
│  ☑ escalation.triggered                                        │
│                                                                 │
│  Security                                                       │
│  ────────                                                       │
│                                                                 │
│  Signing Secret (auto-generated)                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ whsec_abc123xyz                                   [Copy]│   │
│  └─────────────────────────────────────────────────────────┘   │
│  Use this to verify webhook signatures                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          [Cancel]  [Create Webhook]             │
└─────────────────────────────────────────────────────────────────┘
```

### 17.8 Implement OAuth Flow

```
┌─────────────────────────────────────────┐
│  Connect to Salesforce              [×] │
├─────────────────────────────────────────┤
│                                         │
│  [Salesforce Logo]                      │
│                                         │
│  You will be redirected to              │
│  Salesforce to authorize access.        │
│                                         │
│  We will request permission to:         │
│  • Read and write contacts              │
│  • Create and update leads              │
│  • Access account information           │
│                                         │
│  [Cancel]  [Continue to Salesforce]     │
│                                         │
└─────────────────────────────────────────┘

         ↓ (After OAuth success)

┌─────────────────────────────────────────┐
│  Connection Successful              [×] │
├─────────────────────────────────────────┤
│                                         │
│          ✓                              │
│                                         │
│  Successfully connected to              │
│  Salesforce!                            │
│                                         │
│  Your conversations will now sync       │
│  with your Salesforce account.          │
│                                         │
│  [Configure Settings]  [Done]           │
│                                         │
└─────────────────────────────────────────┘
```

### 17.9 Create Integration API Routes

**`src/app/api/company/integrations/route.ts`:**
- GET: List all integrations (connected + available)

**`src/app/api/company/integrations/[integrationId]/route.ts`:**
- GET: Get integration details
- PATCH: Update integration config
- DELETE: Disconnect integration

**`src/app/api/company/integrations/[integrationId]/connect/route.ts`:**
- POST: Initiate OAuth flow

**`src/app/api/company/integrations/[integrationId]/callback/route.ts`:**
- GET: OAuth callback handler

**`src/app/api/company/api-keys/route.ts`:**
- GET: Get API key (masked)
- POST: Regenerate API key

**`src/app/api/company/webhooks/route.ts`:**
- GET: List webhooks
- POST: Create webhook

**`src/app/api/company/webhooks/[webhookId]/route.ts`:**
- GET: Get webhook details
- PATCH: Update webhook
- DELETE: Delete webhook

**`src/app/api/company/webhooks/[webhookId]/test/route.ts`:**
- POST: Send test webhook

### 17.10 Create Integration Components

**`src/components/company-admin/integrations/connected-list.tsx`:**
- Connected integration cards
- Configure/disconnect buttons

**`src/components/company-admin/integrations/available-grid.tsx`:**
- Integration card grid
- Category filter
- Search

**`src/components/company-admin/integrations/integration-detail-modal.tsx`:**
- Integration info
- Features list
- Connect button

**`src/components/company-admin/integrations/config-modal.tsx`:**
- Integration-specific settings
- Save/disconnect buttons

**`src/components/company-admin/integrations/api-keys.tsx`:**
- API key display
- Show/copy/regenerate

**`src/components/company-admin/integrations/webhooks-list.tsx`:**
- Webhook endpoints list
- Add/edit/delete/test

**`src/components/company-admin/integrations/webhook-modal.tsx`:**
- Endpoint URL input
- Event checkboxes
- Signing secret

**`src/components/company-admin/integrations/oauth-flow.tsx`:**
- Pre-authorize modal
- Success/error states

---

## Data Models

### Integration
```typescript
interface Integration {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: 'crm' | 'communication' | 'analytics' | 'ecommerce' | 'support' | 'marketing';
  logoUrl: string;
  features: string[];
  permissions: string[];
  authType: 'oauth2' | 'api_key' | 'webhook';
  isAvailable: boolean;
}
```

### Company Integration
```typescript
interface CompanyIntegration {
  id: string;
  companyId: string;
  integrationId: string;
  status: 'active' | 'error' | 'pending';
  config: Record<string, any>;
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    expiresAt?: Date;
  };
  connectedBy: string;
  connectedAt: Date;
  lastSyncAt: Date | null;
  errorMessage: string | null;
}
```

### API Key
```typescript
interface ApiKey {
  id: string;
  companyId: string;
  key: string;
  keyPreview: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}
```

### Webhook
```typescript
interface Webhook {
  id: string;
  companyId: string;
  url: string;
  description: string | null;
  events: string[];
  signingSecret: string;
  status: 'active' | 'disabled' | 'failing';
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: number | null;
  failureCount: number;
  createdAt: Date;
}
```

### Webhook Event
```typescript
type WebhookEvent =
  | 'conversation.created'
  | 'conversation.updated'
  | 'conversation.closed'
  | 'message.received'
  | 'message.sent'
  | 'escalation.triggered';
```

---

## Validation Checklist

- [ ] Connected integrations display
- [ ] Available integrations grid works
- [ ] Integration search/filter works
- [ ] OAuth flow completes
- [ ] Integration config saves
- [ ] Disconnect works
- [ ] API key show/copy/regenerate works
- [ ] Webhooks CRUD works
- [ ] Webhook test sends event
- [ ] Webhook signing works

---

## File Structure

```
src/
├── app/
│   ├── (company-admin)/
│   │   └── integrations/
│   │       └── page.tsx
│   │
│   └── api/
│       └── company/
│           ├── integrations/
│           │   ├── route.ts
│           │   └── [integrationId]/
│           │       ├── route.ts
│           │       ├── connect/
│           │       │   └── route.ts
│           │       └── callback/
│           │           └── route.ts
│           ├── api-keys/
│           │   └── route.ts
│           └── webhooks/
│               ├── route.ts
│               └── [webhookId]/
│                   ├── route.ts
│                   └── test/
│                       └── route.ts
│
├── components/
│   └── company-admin/
│       └── integrations/
│           ├── connected-list.tsx
│           ├── available-grid.tsx
│           ├── integration-detail-modal.tsx
│           ├── config-modal.tsx
│           ├── api-keys.tsx
│           ├── webhooks-list.tsx
│           ├── webhook-modal.tsx
│           └── oauth-flow.tsx
│
└── lib/
    └── integrations/
        ├── oauth.ts
        ├── webhook-delivery.ts
        └── providers/
            ├── slack.ts
            ├── salesforce.ts
            ├── hubspot.ts
            └── index.ts
```

---

## Next Step
[Step 18 - Billing](./step-18-billing.md)

---

## Related Documentation
- [UI: Integrations](../ui/company-admin/12-integrations.md)
- [Architecture Overview](../architecture-overview.md)
