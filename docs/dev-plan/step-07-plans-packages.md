# Step 07: Master Admin - Subscription Plans & Agent Packages

## Objective
Implement subscription plan management and agent package configuration for the Master Admin portal.

---

## Prerequisites
- Step 06 completed
- Database schema with subscription_plans and agent_packages tables

---

## Reference Documents
- [UI: Subscription Plans](../ui/master-admin/04-subscription-plans.md)
- [UI: Agent Packages](../ui/master-admin/09-agent-packages.md)
- [UI: Agent Configuration](../ui/master-admin/10-agent-configuration.md)

---

## Tasks

### 7.1 Create Subscription Plans Page

**Route:** `src/app/(master-admin)/plans/page.tsx`

**Features:**
- Grid of plan cards
- Create new plan
- Edit existing plans
- Compare plans table

### 7.2 Implement Plans Grid

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Subscription Plans                                              [+ Create Plan] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐              │
│ │                   │ │                   │ │                   │              │
│ │   FREE            │ │   STARTER         │ │   PROFESSIONAL    │              │
│ │                   │ │                   │ │   ★ Popular       │              │
│ │   $0/mo           │ │   $49/mo          │ │   $99/mo          │              │
│ │                   │ │                   │ │                   │              │
│ │   1 Agent         │ │   3 Agents        │ │   10 Agents       │              │
│ │   1,000 Messages  │ │   10,000 Messages │ │   50,000 Messages │              │
│ │   1 User          │ │   5 Users         │ │   25 Users        │              │
│ │                   │ │                   │ │                   │              │
│ │   14 companies    │ │   58 companies    │ │   72 companies    │              │
│ │                   │ │                   │ │                   │              │
│ │   [Edit]          │ │   [Edit]          │ │   [Edit]          │              │
│ │                   │ │                   │ │                   │              │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘              │
│                                                                                 │
│ ┌───────────────────┐                                                          │
│ │                   │                                                          │
│ │   ENTERPRISE      │                                                          │
│ │                   │                                                          │
│ │   Custom          │                                                          │
│ │                   │                                                          │
│ │   Unlimited       │                                                          │
│ │   Custom Limits   │                                                          │
│ │   Dedicated       │                                                          │
│ │                   │                                                          │
│ │   12 companies    │                                                          │
│ │                   │                                                          │
│ │   [Edit]          │                                                          │
│ │                   │                                                          │
│ └───────────────────┘                                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Implement Plan Card Component

**`src/components/master-admin/plans/plan-card.tsx`:**
- Plan name and badge
- Price (monthly/yearly toggle)
- Key limits display
- Active company count
- Edit button
- Status indicator (active/inactive)

### 7.4 Create Plan Editor Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Subscription Plan                                      [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Basic Information                                               │
│ ─────────────────                                               │
│                                                                 │
│ Plan Name *                                                     │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Professional                                            │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Description                                                     │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Best for growing teams                                  │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Pricing                                                         │
│ ───────                                                         │
│                                                                 │
│ Monthly Price      Yearly Price                                 │
│ ┌───────────┐      ┌───────────┐                               │
│ │ $99       │      │ $990      │  (17% discount)                │
│ └───────────┘      └───────────┘                               │
│                                                                 │
│ Limits                                                          │
│ ──────                                                          │
│                                                                 │
│ Agents             Users              Messages/mo               │
│ ┌───────────┐      ┌───────────┐      ┌───────────┐            │
│ │ 10        │      │ 25        │      │ 50000     │            │
│ └───────────┘      └───────────┘      └───────────┘            │
│                                                                 │
│ Storage (GB)       API Calls/mo       Knowledge Sources         │
│ ┌───────────┐      ┌───────────┐      ┌───────────┐            │
│ │ 10        │      │ 100000    │      │ 50        │            │
│ └───────────┘      └───────────┘      └───────────┘            │
│                                                                 │
│ Features                                                        │
│ ────────                                                        │
│                                                                 │
│ ☑ Custom Branding                                              │
│ ☑ Priority Support                                             │
│ ☑ API Access                                                   │
│ ☑ Webhooks                                                     │
│ ☑ SSO Integration                                              │
│ ☐ White Label                                                  │
│ ☐ Dedicated Support                                            │
│                                                                 │
│ Status                                                          │
│ ──────                                                          │
│ ● Active  ○ Inactive                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                            [Cancel]  [Save Changes]             │
└─────────────────────────────────────────────────────────────────┘
```

**Form Fields:**
- Plan Name
- Description
- Monthly Price
- Yearly Price
- Limits (agents, users, messages, storage, API calls, knowledge sources)
- Features (checkboxes)
- Status (active/inactive)

### 7.5 Implement Plans Comparison Table

**`src/components/master-admin/plans/plans-comparison.tsx`:**
- Side-by-side feature comparison
- All plans in columns
- All features in rows
- Check marks for included features

### 7.6 Create Agent Packages Page

**Route:** `src/app/(master-admin)/packages/page.tsx`

**Features:**
- Grid of package cards
- Create new package
- Edit existing packages
- Category filter

### 7.7 Implement Packages Grid

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Agent Packages                                            [+ Create Package]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [All] [Support] [Sales] [FAQ] [Custom]                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐              │
│ │                   │ │                   │ │                   │              │
│ │   [🎧 Icon]       │ │   [💼 Icon]       │ │   [❓ Icon]       │              │
│ │                   │ │                   │ │                   │              │
│ │   Customer        │ │   Sales           │ │   FAQ             │              │
│ │   Support         │ │   Assistant       │ │   Bot             │              │
│ │                   │ │                   │ │                   │              │
│ │   Handle support  │ │   Qualify leads   │ │   Answer common   │              │
│ │   tickets and     │ │   and schedule    │ │   questions       │              │
│ │   customer issues │ │   demos           │ │   instantly       │              │
│ │                   │ │                   │ │                   │              │
│ │   Used by 234     │ │   Used by 156     │ │   Used by 312     │              │
│ │   companies       │ │   companies       │ │   companies       │              │
│ │                   │ │                   │ │                   │              │
│ │   [Configure]     │ │   [Configure]     │ │   [Configure]     │              │
│ │                   │ │                   │ │                   │              │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.8 Create Package Editor Page

**Route:** `src/app/(master-admin)/packages/[packageId]/page.tsx`

**Sections:**
1. Basic Information
2. System Prompt Template
3. Suggested Tools
4. Default Settings
5. Preview

### 7.9 Implement Package Basic Info Form

**Fields:**
- Package Name
- Category (Support, Sales, FAQ, Custom)
- Description
- Icon selection
- Active/Inactive status

### 7.10 Implement System Prompt Template Editor

```
┌─────────────────────────────────────────────────────────────────────┐
│ System Prompt Template                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ This is the default system prompt for agents using this package.    │
│ Companies can customize this for their specific needs.              │
│                                                                     │
│ Available Variables:                                                │
│ {company_name} {agent_name} {current_date} {business_hours}         │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ You are a helpful customer support agent for {company_name}.│    │
│ │                                                             │    │
│ │ Your name is {agent_name} and your role is to:              │    │
│ │ - Answer customer questions accurately                      │    │
│ │ - Help resolve issues efficiently                           │    │
│ │ - Escalate complex issues when needed                       │    │
│ │                                                             │    │
│ │ Guidelines:                                                 │    │
│ │ - Be professional and friendly                              │    │
│ │ - Use the knowledge base when available                     │    │
│ │ - Ask clarifying questions when needed                      │    │
│ │ - Offer to escalate to a human if you cannot help          │    │
│ │                                                             │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ Character count: 456 / 4000                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.11 Implement Tools Configuration

**`src/components/master-admin/packages/tools-config.tsx`:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Suggested Tools                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Enable tools that this agent type typically uses:                   │
│                                                                     │
│ ☑ Knowledge Base Search                                            │
│   Search company knowledge base for answers                         │
│                                                                     │
│ ☑ Create Support Ticket                                            │
│   Create tickets in connected ticketing systems                     │
│                                                                     │
│ ☑ Escalate to Human                                                │
│   Transfer conversation to human agent                              │
│                                                                     │
│ ☐ Schedule Meeting                                                 │
│   Book meetings using calendar integration                          │
│                                                                     │
│ ☐ Send Email                                                       │
│   Send emails to customers                                          │
│                                                                     │
│ ☐ CRM Lookup                                                       │
│   Search customer data in connected CRM                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.12 Implement Package Preview

**Live preview of how the package will appear to companies:**
- Package card preview
- System prompt with sample values
- Tools list

### 7.13 Create Plans API Routes

**`src/app/api/master-admin/plans/route.ts`:**
- GET: List all plans
- POST: Create new plan

**`src/app/api/master-admin/plans/[planId]/route.ts`:**
- GET: Get plan details
- PATCH: Update plan
- DELETE: Delete plan (soft delete)

### 7.14 Create Packages API Routes

**`src/app/api/master-admin/packages/route.ts`:**
- GET: List all packages
- POST: Create new package

**`src/app/api/master-admin/packages/[packageId]/route.ts`:**
- GET: Get package details
- PATCH: Update package
- DELETE: Delete package (soft delete)

### 7.15 Implement Data Hooks

**`src/hooks/master-admin/usePlans.ts`:**
- List plans
- CRUD operations
- Optimistic updates

**`src/hooks/master-admin/usePackages.ts`:**
- List packages
- CRUD operations
- Filter by category

---

## Data Models

### Subscription Plan
```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  limits: {
    agents: number;
    users: number;
    messagesPerMonth: number;
    storageGb: number;
    apiCallsPerMonth: number;
    knowledgeSources: number;
  };
  features: {
    customBranding: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    ssoIntegration: boolean;
    whiteLabel: boolean;
    dedicatedSupport: boolean;
  };
  isActive: boolean;
  companiesCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Agent Package
```typescript
interface AgentPackage {
  id: string;
  name: string;
  description: string;
  category: 'support' | 'sales' | 'faq' | 'custom';
  icon: string;
  basePrompt: string;
  suggestedTools: string[];
  defaultSettings: Record<string, unknown>;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Validation Checklist

- [ ] Plans grid displays all plans
- [ ] Create plan works
- [ ] Edit plan works
- [ ] Plan limits save correctly
- [ ] Features checkboxes save
- [ ] Packages grid displays
- [ ] Category filter works
- [ ] Package editor saves
- [ ] System prompt template works
- [ ] Tools configuration saves
- [ ] Preview renders correctly

---

## File Structure

```
src/
├── app/
│   ├── (master-admin)/
│   │   ├── plans/
│   │   │   └── page.tsx
│   │   └── packages/
│   │       ├── page.tsx
│   │       └── [packageId]/
│   │           └── page.tsx
│   │
│   └── api/
│       └── master-admin/
│           ├── plans/
│           │   ├── route.ts
│           │   └── [planId]/
│           │       └── route.ts
│           └── packages/
│               ├── route.ts
│               └── [packageId]/
│                   └── route.ts
│
├── components/
│   └── master-admin/
│       ├── plans/
│       │   ├── plans-grid.tsx
│       │   ├── plan-card.tsx
│       │   ├── plan-editor-modal.tsx
│       │   └── plans-comparison.tsx
│       └── packages/
│           ├── packages-grid.tsx
│           ├── package-card.tsx
│           ├── package-editor.tsx
│           ├── system-prompt-editor.tsx
│           ├── tools-config.tsx
│           └── package-preview.tsx
│
└── hooks/
    └── master-admin/
        ├── usePlans.ts
        └── usePackages.ts
```

---

## Next Step
[Step 08 - Analytics & Audit](./step-08-analytics-audit.md)

---

## Related Documentation
- [UI: Subscription Plans](../ui/master-admin/04-subscription-plans.md)
- [UI: Agent Packages](../ui/master-admin/09-agent-packages.md)
