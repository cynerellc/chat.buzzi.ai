# Step 06: Master Admin - Company Management

## Objective
Implement complete company management functionality for the Master Admin portal, including listing, creating, viewing, editing, and managing company subscriptions.

---

## Prerequisites
- Step 05 completed
- Database schema with companies table
- Authentication with master admin access

---

## Reference Documents
- [UI: Companies List](../ui/master-admin/02-companies-list.md)
- [UI: Company Details](../ui/master-admin/03-company-details.md)

---

## Tasks

### 6.1 Create Companies List Page

**Route:** `src/app/(master-admin)/companies/page.tsx`

**Features:**
- Table with company data
- Search by name, domain, email
- Filter by status, plan
- Sort by columns
- Pagination
- Bulk actions

### 6.2 Implement Companies Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Companies                                                      [+ Add Company]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search companies...                    [Status ▼] [Plan ▼] [Date Range ▼]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Company        │ Plan         │ Users │ Status │ Created    │ Actions     │
├───┼────────────────┼──────────────┼───────┼────────┼────────────┼─────────────┤
│ ☐ │ [Logo] Acme    │ Professional │ 12    │ Active │ Jan 15     │ [⋮]         │
│ ☐ │ [Logo] TechCo  │ Starter      │ 5     │ Active │ Jan 14     │ [⋮]         │
│ ☐ │ [Logo] BigOrg  │ Enterprise   │ 45    │ Trial  │ Jan 13     │ [⋮]         │
└───┴────────────────┴──────────────┴───────┴────────┴────────────┴─────────────┘
│ Showing 1-10 of 156                                    [< 1 2 3 ... 16 >]      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Table Columns:**
- Checkbox (for bulk select)
- Company (logo + name)
- Subscription Plan
- Users count
- Status badge
- Created date
- Actions menu

**Row Actions:**
- View Details
- Edit Company
- Impersonate Admin
- Manage Subscription
- Suspend/Activate
- Delete

### 6.3 Implement Filters & Search

**Search:**
- Debounced search input
- Search by name, domain, admin email
- Clear search button

**Filters:**
- Status: All, Active, Trial, Suspended, Cancelled
- Plan: All plans from database
- Date range: Custom date picker

**URL State:**
- Persist filters in URL query params
- Shareable filter URLs

### 6.4 Create Add Company Modal

**Route Component:** `src/components/master-admin/companies/add-company-modal.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ Add New Company                                             [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Company Information                                             │
│ ─────────────────────                                           │
│                                                                 │
│ Company Name *                                                  │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │                                                         │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Domain (optional)                                               │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │                                                         │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Subscription Plan *                                             │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Professional                                          ▼ │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Admin Account                                                   │
│ ─────────────────                                               │
│                                                                 │
│ Admin Name *                                                    │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │                                                         │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Admin Email *                                                   │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │                                                         │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ ☐ Send welcome email to admin                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                               [Cancel]  [Create Company]        │
└─────────────────────────────────────────────────────────────────┘
```

**Form Fields:**
- Company Name (required)
- Domain (optional)
- Subscription Plan (select)
- Admin Name (required)
- Admin Email (required)
- Send welcome email (checkbox)

**On Submit:**
1. Create company record
2. Create admin user with company_admin role
3. Create Supabase auth user
4. Create default widget settings
5. Send welcome email (if checked)

### 6.5 Create Company Details Page

**Route:** `src/app/(master-admin)/companies/[companyId]/page.tsx`

**Tabs:**
- Overview
- Users
- Subscription
- Agents
- Usage
- Settings

### 6.6 Implement Company Overview Tab

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Companies                                                             │
│                                                                                 │
│ [Logo]  Acme Corporation                                    [Edit] [Impersonate]│
│         acme.com • Created January 15, 2024                                     │
│         Status: ● Active                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Users] [Subscription] [Agents] [Usage] [Settings]                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                                │
│ │ Users   │ │ Agents  │ │ Convos  │ │ Messages│                                │
│ │   12    │ │   3     │ │  1,234  │ │  15,678 │                                │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                                │
│                                                                                 │
│ Company Details                          Admin Contact                          │
│ ─────────────────                        ──────────────                         │
│ ID: comp_abc123                          John Smith                             │
│ Slug: acme-corp                          john@acme.com                          │
│ Domain: acme.com                         +1 (555) 123-4567                      │
│ Industry: Technology                                                            │
│                                                                                 │
│ Subscription                             Usage This Month                       │
│ ────────────                             ─────────────────                       │
│ Plan: Professional                       Messages: 15,678 / 50,000              │
│ Billing: Monthly                         Storage: 2.3 GB / 10 GB                │
│ Next billing: Feb 15                     API Calls: 5,432 / 100,000             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.7 Implement Company Users Tab

**Features:**
- List all users in company
- Filter by role
- Add user button
- Remove user action
- Change role action

### 6.8 Implement Company Subscription Tab

**Features:**
- Current plan details
- Change plan option
- Billing history
- Usage limits display
- Manual plan override

### 6.9 Implement Company Agents Tab

**Features:**
- List all agents
- View agent details
- Link to agent configuration

### 6.10 Implement Company Usage Tab

**Features:**
- Usage charts over time
- Breakdown by category
- Limit warnings
- Export usage data

### 6.11 Implement Company Settings Tab

**Features:**
- Edit company information
- Danger zone (suspend, delete)
- Feature flags
- Custom limits override

### 6.12 Create Edit Company Modal

**Form Fields:**
- Company Name
- Domain
- Logo upload
- Status
- Custom settings

### 6.13 Implement Impersonation Feature

**`src/components/master-admin/companies/impersonate-modal.tsx`:**
- Select user to impersonate
- Confirm action
- Session switch logic
- Return to master admin option

**Implementation:**
1. Create impersonation session token
2. Store original master admin session
3. Redirect to company admin portal
4. Show impersonation banner
5. Allow "End impersonation" action

### 6.14 Create Company API Routes

**`src/app/api/master-admin/companies/route.ts`:**
- GET: List companies with filters, pagination
- POST: Create new company

**`src/app/api/master-admin/companies/[companyId]/route.ts`:**
- GET: Get company details
- PATCH: Update company
- DELETE: Delete company

**`src/app/api/master-admin/companies/[companyId]/users/route.ts`:**
- GET: List company users
- POST: Add user to company

**`src/app/api/master-admin/companies/[companyId]/subscription/route.ts`:**
- GET: Get subscription details
- PATCH: Change subscription

**`src/app/api/master-admin/companies/[companyId]/impersonate/route.ts`:**
- POST: Start impersonation session

### 6.15 Implement Bulk Actions

**Available Actions:**
- Activate selected
- Suspend selected
- Delete selected
- Export selected

**`src/components/master-admin/companies/bulk-actions.tsx`:**
- Actions dropdown
- Confirmation dialogs
- Progress indicator

---

## Data Models

### Company List Item
```typescript
interface CompanyListItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  domain: string | null;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  plan: {
    id: string;
    name: string;
  };
  usersCount: number;
  createdAt: Date;
}
```

### Company Details
```typescript
interface CompanyDetails extends CompanyListItem {
  settings: Record<string, unknown>;
  admin: {
    id: string;
    name: string;
    email: string;
  };
  stats: {
    agents: number;
    conversations: number;
    messages: number;
  };
  subscription: {
    planId: string;
    status: string;
    currentPeriodEnd: Date;
  };
  usage: {
    messages: { used: number; limit: number };
    storage: { used: number; limit: number };
    apiCalls: { used: number; limit: number };
  };
}
```

---

## Validation Checklist

- [ ] Companies list loads with data
- [ ] Search works correctly
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Add company creates record
- [ ] Company details page loads
- [ ] All tabs function correctly
- [ ] Edit company works
- [ ] Impersonation works
- [ ] Bulk actions work
- [ ] Suspend/activate works
- [ ] Delete with confirmation works

---

## File Structure

```
src/
├── app/
│   ├── (master-admin)/
│   │   └── companies/
│   │       ├── page.tsx
│   │       └── [companyId]/
│   │           └── page.tsx
│   │
│   └── api/
│       └── master-admin/
│           └── companies/
│               ├── route.ts
│               └── [companyId]/
│                   ├── route.ts
│                   ├── users/
│                   │   └── route.ts
│                   ├── subscription/
│                   │   └── route.ts
│                   └── impersonate/
│                       └── route.ts
│
├── components/
│   └── master-admin/
│       └── companies/
│           ├── companies-table.tsx
│           ├── companies-filters.tsx
│           ├── add-company-modal.tsx
│           ├── edit-company-modal.tsx
│           ├── company-overview.tsx
│           ├── company-users.tsx
│           ├── company-subscription.tsx
│           ├── company-agents.tsx
│           ├── company-usage.tsx
│           ├── company-settings.tsx
│           ├── impersonate-modal.tsx
│           └── bulk-actions.tsx
│
└── hooks/
    └── master-admin/
        ├── useCompanies.ts
        └── useCompany.ts
```

---

## Next Step
[Step 07 - Plans & Packages](./step-07-plans-packages.md)

---

## Related Documentation
- [UI: Companies List](../ui/master-admin/02-companies-list.md)
- [UI: Company Details](../ui/master-admin/03-company-details.md)
