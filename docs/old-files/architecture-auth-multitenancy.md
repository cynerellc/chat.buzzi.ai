# Architecture: Authentication & Multi-tenancy

## Overview

This document details the authentication, authorization, and multi-tenancy architecture for the platform. The system uses Auth.js (NextAuth) for authentication and implements a comprehensive role-based access control (RBAC) system with Row-Level Security (RLS) for data isolation.

---

## 1. Authentication Architecture

### 1.1 Auth.js Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AUTHENTICATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Client  │────▶│  Next.js App    │────▶│    Auth.js      │────▶│   Provider   │
│          │     │  /api/auth/*    │     │   (NextAuth)    │     │  (OAuth/etc) │
└──────────┘     └─────────────────┘     └─────────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │   PostgreSQL    │
                                         │  (Drizzle ORM)  │
                                         └─────────────────┘
```

### 1.2 Supported Authentication Providers

| Provider | Use Case | Configuration |
|----------|----------|---------------|
| **Email Magic Link** | Primary for Company Admins & Support Agents | Resend/SendGrid |
| **Google OAuth** | Enterprise SSO | Google Cloud Console |
| **Microsoft Entra** | Enterprise SSO | Azure AD |
| **Credentials** | Master Admin (development) | Bcrypt hashed passwords |

### 1.3 Auth.js Configuration

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),

    Resend({
      from: 'no-reply@chat.buzzi.ai',
    }),

    Credentials({
      // Master Admin only
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        // Validate master admin credentials
        return validateMasterAdmin(credentials);
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.companyId = user.companyId;
        token.permissions = user.permissions;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.companyId = token.companyId;
      session.user.permissions = token.permissions;
      return session;
    },

    async signIn({ user, account, profile }) {
      // Check if user is active
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, user.email),
      });

      if (dbUser && !dbUser.isActive) {
        return false; // Block inactive users
      }

      // Check IP allowlist if configured
      if (dbUser?.ipAllowlist?.length > 0) {
        const clientIp = headers().get('x-forwarded-for');
        if (!dbUser.ipAllowlist.includes(clientIp)) {
          return false;
        }
      }

      // Check time-based access
      if (dbUser?.accessExpiresAt && new Date() > dbUser.accessExpiresAt) {
        return false;
      }

      return true;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/login/verify',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

### 1.4 Session Types

```typescript
// src/types/auth.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'master_admin' | 'company_admin' | 'support_agent';
      companyId: string | null;
      permissions: UserPermissions;
    } & DefaultSession['user'];
  }

  interface User {
    role: 'master_admin' | 'company_admin' | 'support_agent';
    companyId: string | null;
    permissions: UserPermissions;
  }
}

interface UserPermissions {
  agents?: Record<string, ('read' | 'write' | 'delete')[]>;
  knowledge?: ('read' | 'write' | 'delete')[];
  analytics?: ('read' | 'export')[];
  team?: ('read' | 'write' | 'delete')[];
  settings?: ('read' | 'write')[];
}
```

---

## 2. Authorization Architecture

### 2.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ROLE HIERARCHY                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────────┐
                         │    MASTER ADMIN      │
                         │  (Platform Owner)    │
                         │                      │
                         │  • Full platform     │
                         │  • All companies     │
                         │  • System config     │
                         └──────────┬───────────┘
                                    │
                                    │ Can impersonate
                                    ▼
          ┌─────────────────────────────────────────────────┐
          │                                                  │
          ▼                                                  ▼
┌──────────────────────┐                        ┌──────────────────────┐
│    COMPANY ADMIN     │                        │    COMPANY ADMIN     │
│   (Tenant: Acme)     │                        │   (Tenant: Beta)     │
│                      │                        │                      │
│  • Agents (CRUD)     │                        │  • Agents (CRUD)     │
│  • Knowledge (CRUD)  │                        │  • Knowledge (CRUD)  │
│  • Team management   │                        │  • Team management   │
│  • Analytics         │                        │  • Analytics         │
└──────────┬───────────┘                        └──────────┬───────────┘
           │                                               │
           │ Manages                                       │ Manages
           ▼                                               ▼
┌──────────────────────┐                        ┌──────────────────────┐
│   SUPPORT AGENT      │                        │   SUPPORT AGENT      │
│  (Tenant: Acme)      │                        │  (Tenant: Beta)      │
│                      │                        │                      │
│  • View inbox        │                        │  • View inbox        │
│  • Handle convs      │                        │  • Handle convs      │
│  • Add notes         │                        │  • Add notes         │
│  • KB (read-only)    │                        │  • KB (read-only)    │
└──────────────────────┘                        └──────────────────────┘
```

### 2.2 Permission Matrix

| Resource | Master Admin | Company Admin | Support Agent |
|----------|:------------:|:-------------:|:-------------:|
| **Platform Settings** | CRUD | - | - |
| **Companies** | CRUD | Read Own | - |
| **Subscriptions** | CRUD | Read Own | - |
| **Agent Types (Library)** | CRUD | Read | - |
| **Agents** | CRUD (All) | CRUD (Own) | Read (Assigned) |
| **Agent System Prompts** | CRUD | - | - |
| **Agent Personality** | CRUD | CRUD | - |
| **Knowledge Base** | CRUD (All) | CRUD (Own) | Read |
| **Conversations** | CRUD (All) | Read (Own) | Read/Handle (Assigned) |
| **Team/Users** | CRUD (All) | CRUD (Own) | - |
| **Analytics** | Read (All) | Read (Own) | Read (Personal) |
| **Audit Logs** | Read (All) | Read (Own) | - |
| **Channels** | CRUD (All) | CRUD (Own) | - |

### 2.3 Permission Checking Middleware

```typescript
// src/middleware/auth.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const withAuth = (
  handler: Function,
  options: {
    roles?: ('master_admin' | 'company_admin' | 'support_agent')[];
    permissions?: string[];
    companyRequired?: boolean;
  } = {}
) => {
  return async (req: Request, context: any) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    if (options.roles && !options.roles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check company context (non-master admins must have company)
    if (options.companyRequired && !session.user.companyId) {
      return NextResponse.json({ error: 'No company context' }, { status: 403 });
    }

    // Check specific permissions
    if (options.permissions) {
      const hasPermission = checkPermissions(
        session.user.permissions,
        options.permissions
      );
      if (!hasPermission) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    return handler(req, context, session);
  };
};

// Usage in API route
export const GET = withAuth(
  async (req, ctx, session) => {
    // Handler logic
  },
  {
    roles: ['company_admin', 'support_agent'],
    companyRequired: true,
  }
);
```

### 2.4 Resource-Level Authorization

```typescript
// src/lib/authorization.ts

export class Authorization {
  constructor(private session: Session) {}

  // Check if user can access an agent
  async canAccessAgent(agentId: string, action: 'read' | 'write' | 'delete'): Promise<boolean> {
    if (this.session.user.role === 'master_admin') {
      return true;
    }

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) return false;

    // Must be same company
    if (agent.companyId !== this.session.user.companyId) {
      return false;
    }

    if (this.session.user.role === 'company_admin') {
      return true;
    }

    // Support agent - check permissions
    const agentPermissions = this.session.user.permissions?.agents?.[agentId] ?? [];
    return agentPermissions.includes(action);
  }

  // Check if user can access conversation
  async canAccessConversation(conversationId: string): Promise<boolean> {
    if (this.session.user.role === 'master_admin') {
      return true;
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) return false;

    if (conversation.companyId !== this.session.user.companyId) {
      return false;
    }

    if (this.session.user.role === 'company_admin') {
      return true;
    }

    // Support agent - must be assigned or unassigned
    return (
      conversation.assignedAgentId === this.session.user.id ||
      conversation.assignedAgentId === null
    );
  }
}
```

---

## 3. Multi-tenancy Architecture

### 3.1 Tenant Identification

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TENANT IDENTIFICATION                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST SOURCES                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. Dashboard Access (Authenticated)                                            │
│     ┌─────────────────┐                                                         │
│     │ JWT Session     │ ──────▶ Extract companyId from token                    │
│     │ (company_admin) │                                                         │
│     └─────────────────┘                                                         │
│                                                                                  │
│  2. Webhook (URL-based)                                                         │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │ /api/webhooks/{company_id}/{agent_id}/whatsapp/{webhook_id}         │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  3. Chat Widget (Session-based)                                                 │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │ Session Token ──▶ Lookup ──▶ companyId + agentId                    │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  4. Custom Domain (Optional)                                                    │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │ chat.acme.com ──▶ Custom Domain Lookup ──▶ companyId                │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  NOTE: All companies access dashboard via chat.buzzi.ai by default.            │
│        Custom domains are optional for white-label deployments.                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tenant Context Middleware

```typescript
// src/middleware/tenant.ts
import { NextRequest, NextResponse } from 'next/server';

export async function tenantMiddleware(req: NextRequest) {
  const hostname = req.headers.get('host') ?? '';
  let companyId: string | null = null;

  // 1. Check if accessing via custom domain (optional white-label)
  if (!isMainDomain(hostname)) {
    const customDomain = await lookupCustomDomain(hostname);
    if (customDomain?.verified) {
      companyId = customDomain.companyId;
    }
  }

  // 2. For main domain (chat.buzzi.ai), tenant is resolved via:
  //    - JWT session for authenticated users
  //    - URL params for webhooks (/api/webhooks/{company_id}/...)
  //    - Session token for chat widget

  // Set tenant context in headers for downstream use
  const requestHeaders = new Headers(req.headers);
  if (companyId) {
    requestHeaders.set('x-tenant-id', companyId);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function isMainDomain(hostname: string): boolean {
  // Check if this is the main platform domain
  const mainDomains = ['chat.buzzi.ai', 'localhost', '127.0.0.1'];
  return mainDomains.some(domain => hostname.includes(domain));
}

async function lookupCustomDomain(hostname: string) {
  return db.query.companies.findFirst({
    where: and(
      eq(companies.customDomain, hostname),
      eq(companies.customDomainVerified, true)
    ),
    columns: { id: true, customDomainVerified: true },
  });
}
```

### 3.3 Database-Level Isolation (RLS)

```typescript
// src/db/rls.ts
import { sql } from 'drizzle-orm';

export async function setTenantContext(
  tx: Transaction,
  context: {
    userId?: string;
    companyId?: string;
    role?: string;
  }
) {
  // Set session variables for RLS policies
  await tx.execute(sql`
    SELECT set_config('app.current_user_id', ${context.userId ?? ''}, true);
    SELECT set_config('app.current_company_id', ${context.companyId ?? ''}, true);
    SELECT set_config('app.user_role', ${context.role ?? ''}, true);
  `);
}

// Usage in API handlers
export async function getAgents(session: Session) {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, {
      userId: session.user.id,
      companyId: session.user.companyId,
      role: session.user.role,
    });

    // RLS policies automatically filter results
    return tx.query.agents.findMany();
  });
}
```

### 3.4 Application-Level Isolation

```typescript
// src/lib/tenant-query.ts
import { and, eq } from 'drizzle-orm';

export class TenantQuery {
  constructor(private companyId: string) {}

  // All queries automatically scoped to tenant
  agents() {
    return db.query.agents.findMany({
      where: eq(agents.companyId, this.companyId),
    });
  }

  agent(id: string) {
    return db.query.agents.findFirst({
      where: and(
        eq(agents.id, id),
        eq(agents.companyId, this.companyId)
      ),
    });
  }

  conversations(filters?: { status?: string; agentId?: string }) {
    return db.query.conversations.findMany({
      where: and(
        eq(conversations.companyId, this.companyId),
        filters?.status ? eq(conversations.status, filters.status) : undefined,
        filters?.agentId ? eq(conversations.agentId, filters.agentId) : undefined
      ),
      orderBy: desc(conversations.lastMessageAt),
    });
  }

  // ... more tenant-scoped queries
}

// Usage
export async function GET(req: Request) {
  const session = await auth();
  const query = new TenantQuery(session.user.companyId);

  const agents = await query.agents();
  return NextResponse.json(agents);
}
```

---

## 4. Subscription & Access Control

### 4.1 Subscription Status Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SUBSCRIPTION LIFECYCLE                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

   TRIAL          ACTIVE          PAST DUE       GRACE PERIOD      EXPIRED
     │               │                │                │               │
     │   Payment     │    Missed      │   Grace        │   Grace       │
     │   Success     │    Payment     │   Ends         │   Expires     │
     ▼               ▼                ▼                ▼               ▼
┌─────────┐    ┌─────────┐      ┌─────────┐     ┌─────────────┐   ┌─────────┐
│ 14-day  │───▶│ Active  │─────▶│Past Due │────▶│Grace Period │──▶│ Expired │
│ Trial   │    │         │      │         │     │ (7 days)    │   │         │
└─────────┘    └─────────┘      └─────────┘     └─────────────┘   └─────────┘
                   │                                                    │
                   │              ┌──────────────┐                      │
                   └─────────────▶│  Cancelled   │◀─────────────────────┘
                    User Cancel   └──────────────┘     Auto after 90d

FEATURES BY STATUS:
─────────────────────────────────────────────────────────────────────────────────
│ Status        │ Dashboard │ Chat Widget │ Webhooks │ Data Access │ Notifications │
├───────────────┼───────────┼─────────────┼──────────┼─────────────┼───────────────│
│ Trial         │    ✓      │      ✓      │    ✓     │      ✓      │ Trial ending  │
│ Active        │    ✓      │      ✓      │    ✓     │      ✓      │ -             │
│ Past Due      │    ✓      │      ✓      │    ✓     │      ✓      │ Payment req.  │
│ Grace Period  │    ✓      │   Limited*  │ Limited* │      ✓      │ Urgent        │
│ Expired       │   Read    │      ✗      │    ✗     │      ✓      │ Reactivate    │
│ Cancelled     │    ✗      │      ✗      │    ✗     │    90 days  │ -             │
─────────────────────────────────────────────────────────────────────────────────

* Limited: "Service temporarily unavailable" message
```

### 4.2 Subscription Middleware

```typescript
// src/middleware/subscription.ts
import { db } from '@/db';
import { companySubscriptions } from '@/db/schema';

export async function checkSubscription(companyId: string): Promise<{
  valid: boolean;
  status: string;
  limits: SubscriptionLimits;
  message?: string;
}> {
  const subscription = await db.query.companySubscriptions.findFirst({
    where: eq(companySubscriptions.companyId, companyId),
    with: { plan: true },
  });

  if (!subscription) {
    return { valid: false, status: 'none', limits: {}, message: 'No subscription found' };
  }

  const now = new Date();

  // Check status
  if (subscription.status === 'expired' || subscription.status === 'cancelled') {
    return {
      valid: false,
      status: subscription.status,
      limits: {},
      message: 'Subscription has expired. Please renew to continue.',
    };
  }

  // Check expiration
  if (now > subscription.expiresAt) {
    // Check grace period
    if (subscription.gracePeriodEndsAt && now < subscription.gracePeriodEndsAt) {
      return {
        valid: true, // Limited access
        status: 'grace_period',
        limits: subscription.plan.limits,
        message: 'Subscription expired. Service limited during grace period.',
      };
    }

    // Update to expired
    await db.update(companySubscriptions)
      .set({ status: 'expired' })
      .where(eq(companySubscriptions.id, subscription.id));

    return { valid: false, status: 'expired', limits: {} };
  }

  // Merge custom limits with plan limits
  const limits = {
    ...subscription.plan.limits,
    ...subscription.customLimits,
  };

  return { valid: true, status: subscription.status, limits };
}
```

### 4.3 Usage Limit Enforcement

```typescript
// src/lib/usage-limits.ts

export async function checkUsageLimit(
  companyId: string,
  limitType: 'messages' | 'agents' | 'storage' | 'api'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { limits } = await checkSubscription(companyId);

  switch (limitType) {
    case 'messages': {
      const currentMonth = startOfMonth(new Date());
      const usage = await db.query.usageRecords.findFirst({
        where: and(
          eq(usageRecords.companyId, companyId),
          gte(usageRecords.periodStart, currentMonth)
        ),
      });

      return {
        allowed: (usage?.aiResponseCount ?? 0) < limits.messagesPerMonth,
        current: usage?.aiResponseCount ?? 0,
        limit: limits.messagesPerMonth,
      };
    }

    case 'agents': {
      const agentCount = await db
        .select({ count: count() })
        .from(agents)
        .where(and(
          eq(agents.companyId, companyId),
          ne(agents.status, 'archived')
        ));

      return {
        allowed: agentCount[0].count < limits.agentCount,
        current: agentCount[0].count,
        limit: limits.agentCount,
      };
    }

    // ... more limit types
  }
}
```

---

## 5. Master Admin Impersonation

### 5.1 Impersonation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          IMPERSONATION FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Master Admin   │────▶│  Select Company  │────▶│  Create Scoped   │
│   Dashboard      │     │  to Impersonate  │     │  Session Token   │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                                                           ▼
                         ┌──────────────────────────────────────────────┐
                         │  Impersonated Session                        │
                         │  ─────────────────────                       │
                         │  • originalUserId: master_admin_id           │
                         │  • impersonatedCompanyId: target_company     │
                         │  • role: company_admin (effective)           │
                         │  • isImpersonating: true                     │
                         │  • expiresAt: +2 hours                       │
                         └──────────────────────────────────────────────┘
                                                           │
                                                           ▼
                         ┌──────────────────────────────────────────────┐
                         │  All actions logged to audit_logs with:      │
                         │  • actor: master_admin                       │
                         │  • impersonated_company: target              │
                         │  • action_type: impersonated_action          │
                         └──────────────────────────────────────────────┘
```

### 5.2 Impersonation Implementation

```typescript
// src/lib/impersonation.ts

export async function createImpersonationSession(
  masterAdminId: string,
  targetCompanyId: string
): Promise<string> {
  // Verify master admin
  const admin = await db.query.users.findFirst({
    where: and(
      eq(users.id, masterAdminId),
      eq(users.role, 'master_admin')
    ),
  });

  if (!admin) {
    throw new Error('Only master admins can impersonate');
  }

  // Create impersonation token
  const token = await signJwt({
    originalUserId: masterAdminId,
    impersonatedCompanyId: targetCompanyId,
    role: 'company_admin',
    isImpersonating: true,
    expiresAt: addHours(new Date(), 2),
  });

  // Audit log
  await db.insert(auditLogs).values({
    userId: masterAdminId,
    companyId: targetCompanyId,
    action: 'impersonation.start',
    details: { targetCompanyId },
  });

  return token;
}

export async function endImpersonation(token: string): Promise<void> {
  const decoded = await verifyJwt(token);

  await db.insert(auditLogs).values({
    userId: decoded.originalUserId,
    companyId: decoded.impersonatedCompanyId,
    action: 'impersonation.end',
  });
}
```

---

## 6. Security Considerations

### 6.1 Session Security

| Measure | Implementation |
|---------|----------------|
| **Token Rotation** | Refresh tokens rotated on each use |
| **Secure Cookies** | HttpOnly, Secure, SameSite=Strict |
| **Session Binding** | Tied to IP and User-Agent fingerprint |
| **Idle Timeout** | 30 minutes of inactivity |
| **Absolute Timeout** | 24 hours maximum session |

### 6.2 IP Allowlisting

```typescript
// For high-security support agents
const ipAllowlist = [
  '192.168.1.0/24',  // Office network
  '10.0.0.0/8',       // VPN
];

async function validateIp(userId: string, clientIp: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { ipAllowlist: true },
  });

  if (!user.ipAllowlist || user.ipAllowlist.length === 0) {
    return true; // No restrictions
  }

  return user.ipAllowlist.some(range => ipRangeCheck(clientIp, range));
}
```

### 6.3 Rate Limiting by Role

| Role | API Limit | Login Attempts |
|------|-----------|----------------|
| Master Admin | Unlimited | 5/minute |
| Company Admin | 100/minute | 5/minute |
| Support Agent | 60/minute | 5/minute |
| Unauthenticated | 20/minute | 3/minute |

---

## 7. Subscription Notifications

### 7.1 Pre-Expiration Notification Schedule

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     PRE-EXPIRATION NOTIFICATION SCHEDULE                         │
└─────────────────────────────────────────────────────────────────────────────────┘

   Days Before Expiration    Notification Type       Recipients
   ──────────────────────────────────────────────────────────────────────────────
         45 days             Email (reminder)        Company Admin
         30 days             Email (reminder)        Company Admin
         14 days             Email (warning)         Company Admin + Billing
          7 days             Email (urgent)          Company Admin + Billing
          3 days             Email (critical)        Company Admin + Billing + In-App
          1 day              Email (final)           Company Admin + Billing + In-App
          0 days             Email (expired)         All Company Users + In-App Banner
```

### 7.2 Notification Service Implementation

```typescript
// src/services/notifications/subscription-notifications.ts
import { CronJob } from 'cron';
import { db } from '@/db';
import { companySubscriptions, companies, users } from '@/db/schema';
import { and, eq, lte, gte, sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';

// Notification schedule: days before expiration
const NOTIFICATION_SCHEDULE = [45, 30, 14, 7, 3, 1, 0] as const;

interface NotificationConfig {
  days: number;
  type: 'reminder' | 'warning' | 'urgent' | 'critical' | 'final' | 'expired';
  includeInApp: boolean;
  includeBilling: boolean;
}

const NOTIFICATION_CONFIG: Record<number, NotificationConfig> = {
  45: { days: 45, type: 'reminder', includeInApp: false, includeBilling: false },
  30: { days: 30, type: 'reminder', includeInApp: false, includeBilling: false },
  14: { days: 14, type: 'warning', includeInApp: false, includeBilling: true },
  7:  { days: 7,  type: 'urgent', includeInApp: false, includeBilling: true },
  3:  { days: 3,  type: 'critical', includeInApp: true, includeBilling: true },
  1:  { days: 1,  type: 'final', includeInApp: true, includeBilling: true },
  0:  { days: 0,  type: 'expired', includeInApp: true, includeBilling: true },
};

export class SubscriptionNotificationService {
  private cronJob: CronJob;

  constructor() {
    // Run daily at 9:00 AM UTC
    this.cronJob = new CronJob('0 9 * * *', () => this.processNotifications());
  }

  start(): void {
    this.cronJob.start();
    console.log('Subscription notification service started');
  }

  stop(): void {
    this.cronJob.stop();
  }

  async processNotifications(): Promise<void> {
    for (const days of NOTIFICATION_SCHEDULE) {
      await this.sendNotificationsForDays(days);
    }
  }

  private async sendNotificationsForDays(daysBeforeExpiration: number): Promise<void> {
    const config = NOTIFICATION_CONFIG[daysBeforeExpiration];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiration);

    // Find subscriptions expiring on target date
    const expiringSubscriptions = await db.query.companySubscriptions.findMany({
      where: and(
        eq(companySubscriptions.status, 'active'),
        sql`DATE(${companySubscriptions.expiresAt}) = DATE(${targetDate})`
      ),
      with: {
        company: true,
        plan: true,
      },
    });

    for (const subscription of expiringSubscriptions) {
      await this.sendNotification(subscription, config);
    }
  }

  private async sendNotification(
    subscription: CompanySubscription & { company: Company; plan: SubscriptionPlan },
    config: NotificationConfig
  ): Promise<void> {
    // Get recipients
    const recipients = await this.getRecipients(subscription.companyId, config);

    // Send email notifications
    for (const recipient of recipients) {
      await sendEmail({
        to: recipient.email,
        template: `subscription-${config.type}`,
        data: {
          userName: recipient.name,
          companyName: subscription.company.name,
          planName: subscription.plan.name,
          expiresAt: subscription.expiresAt,
          daysRemaining: config.days,
          renewalUrl: `https://chat.buzzi.ai/${subscription.company.slug}/settings/billing`,
        },
      });
    }

    // Create in-app notification if required
    if (config.includeInApp) {
      await this.createInAppNotification(subscription, config);
    }

    // Log notification sent
    await db.insert(auditLogs).values({
      companyId: subscription.companyId,
      action: 'subscription.notification_sent',
      details: {
        type: config.type,
        daysBeforeExpiration: config.days,
        recipientCount: recipients.length,
      },
    });
  }

  private async getRecipients(
    companyId: string,
    config: NotificationConfig
  ): Promise<{ email: string; name: string }[]> {
    // Get company admins
    const admins = await db.query.users.findMany({
      where: and(
        eq(users.companyId, companyId),
        eq(users.role, 'company_admin'),
        eq(users.isActive, true)
      ),
    });

    const recipients = admins.map(a => ({ email: a.email, name: a.name ?? a.email }));

    // Add billing contact if configured and required
    if (config.includeBilling) {
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      });

      const billingEmail = (company?.settings as any)?.billingEmail;
      if (billingEmail && !recipients.some(r => r.email === billingEmail)) {
        recipients.push({ email: billingEmail, name: 'Billing Contact' });
      }
    }

    return recipients;
  }

  private async createInAppNotification(
    subscription: CompanySubscription,
    config: NotificationConfig
  ): Promise<void> {
    // Store in-app notification for dashboard banner
    await redis.set(
      `notification:subscription:${subscription.companyId}`,
      JSON.stringify({
        type: config.type,
        message: this.getInAppMessage(config),
        expiresAt: subscription.expiresAt,
        dismissible: config.days > 0,
      }),
      'EX',
      86400 * (config.days + 1) // Expire after subscription would be expired
    );
  }

  private getInAppMessage(config: NotificationConfig): string {
    switch (config.type) {
      case 'critical':
        return 'Your subscription expires in 3 days. Renew now to avoid service interruption.';
      case 'final':
        return 'Your subscription expires tomorrow! Renew immediately to keep your chatbots running.';
      case 'expired':
        return 'Your subscription has expired. Your chatbots are currently unavailable.';
      default:
        return 'Your subscription is expiring soon. Please renew to continue service.';
    }
  }
}

// Initialize and export
export const subscriptionNotificationService = new SubscriptionNotificationService();
```

### 7.3 Email Templates

```typescript
// Email template configuration
const EMAIL_TEMPLATES = {
  'subscription-reminder': {
    subject: 'Subscription Renewal Reminder - {{companyName}}',
    preview: 'Your subscription expires in {{daysRemaining}} days',
  },
  'subscription-warning': {
    subject: 'Action Required: Subscription Expiring Soon - {{companyName}}',
    preview: 'Only {{daysRemaining}} days until your subscription expires',
  },
  'subscription-urgent': {
    subject: '⚠️ Urgent: Subscription Expires in {{daysRemaining}} Days',
    preview: 'Renew now to avoid service interruption',
  },
  'subscription-critical': {
    subject: '🚨 Critical: 3 Days Until Service Interruption',
    preview: 'Your chatbots will go offline in 3 days',
  },
  'subscription-final': {
    subject: '🚨 FINAL NOTICE: Subscription Expires Tomorrow',
    preview: 'Last chance to renew before service interruption',
  },
  'subscription-expired': {
    subject: '❌ Subscription Expired - Service Suspended',
    preview: 'Your chatbots are now offline. Renew to restore service.',
  },
};
```

---

## 8. Data Retention & Cleanup

### 8.1 Data Retention Policy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DATA RETENTION POLICY                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

  Status              Retention Period       Data Access         Cleanup Action
  ─────────────────────────────────────────────────────────────────────────────────
  Active              Unlimited              Full                None
  Grace Period        +7 days                Full                None
  Expired             +90 days               Read-only export    Warning emails
  Cancelled           +90 days               Export only         Scheduled deletion
  After 90 days       Deleted                None                Permanent removal

  DATA CLEANUP SCHEDULE:
  ─────────────────────────────────────────────────────────────────────────────────
  Day 0   (Expired)     → Send data export reminder email
  Day 30  (Expired+30)  → Send data deletion warning (60 days remaining)
  Day 60  (Expired+60)  → Send final data deletion warning (30 days remaining)
  Day 85  (Expired+85)  → Send last chance email (5 days remaining)
  Day 90  (Expired+90)  → Execute permanent data deletion
```

### 8.2 Data Cleanup Service

```typescript
// src/services/cleanup/data-retention.ts
import { CronJob } from 'cron';
import { db } from '@/db';
import {
  companies, companySubscriptions, agents, conversations,
  messages, knowledgeFiles, knowledgeChunks, auditLogs
} from '@/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { storage } from '@/lib/storage';
import { qdrantClient } from '@/lib/qdrant';

const RETENTION_DAYS = 90;
const WARNING_SCHEDULE = [0, 30, 60, 85]; // Days after expiration to send warnings

export class DataRetentionService {
  private cleanupJob: CronJob;
  private warningJob: CronJob;

  constructor() {
    // Run cleanup daily at 2:00 AM UTC
    this.cleanupJob = new CronJob('0 2 * * *', () => this.processCleanup());

    // Run warning checks daily at 10:00 AM UTC
    this.warningJob = new CronJob('0 10 * * *', () => this.processWarnings());
  }

  start(): void {
    this.cleanupJob.start();
    this.warningJob.start();
    console.log('Data retention service started');
  }

  stop(): void {
    this.cleanupJob.stop();
    this.warningJob.stop();
  }

  async processWarnings(): Promise<void> {
    for (const daysAfterExpiration of WARNING_SCHEDULE) {
      await this.sendRetentionWarnings(daysAfterExpiration);
    }
  }

  private async sendRetentionWarnings(daysAfterExpiration: number): Promise<void> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAfterExpiration);

    // Find companies that expired on the target date
    const expiredSubscriptions = await db.query.companySubscriptions.findMany({
      where: and(
        eq(companySubscriptions.status, 'expired'),
        sql`DATE(${companySubscriptions.expiresAt}) = DATE(${targetDate})`
      ),
      with: { company: true },
    });

    for (const subscription of expiredSubscriptions) {
      const daysRemaining = RETENTION_DAYS - daysAfterExpiration;
      await this.sendRetentionWarningEmail(subscription.company, daysRemaining);
    }
  }

  private async sendRetentionWarningEmail(
    company: Company,
    daysRemaining: number
  ): Promise<void> {
    const admins = await db.query.users.findMany({
      where: and(
        eq(users.companyId, company.id),
        eq(users.role, 'company_admin')
      ),
    });

    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        template: 'data-retention-warning',
        data: {
          userName: admin.name,
          companyName: company.name,
          daysRemaining,
          exportUrl: `https://chat.buzzi.ai/${company.slug}/settings/export`,
          renewUrl: `https://chat.buzzi.ai/${company.slug}/settings/billing`,
        },
      });
    }
  }

  async processCleanup(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Find companies past retention period
    const companiesToDelete = await db.query.companySubscriptions.findMany({
      where: and(
        eq(companySubscriptions.status, 'expired'),
        lt(companySubscriptions.expiresAt, cutoffDate)
      ),
      with: { company: true },
    });

    for (const subscription of companiesToDelete) {
      await this.deleteCompanyData(subscription.company);
    }
  }

  async deleteCompanyData(company: Company): Promise<void> {
    const companyId = company.id;

    console.log(`Starting data deletion for company: ${companyId}`);

    try {
      await db.transaction(async (tx) => {
        // 1. Delete messages (cascade from conversations)
        await tx.delete(messages)
          .where(
            sql`conversation_id IN (
              SELECT id FROM chatapp_conversations WHERE company_id = ${companyId}
            )`
          );

        // 2. Delete conversations
        await tx.delete(conversations)
          .where(eq(conversations.companyId, companyId));

        // 3. Delete knowledge chunks
        await tx.delete(knowledgeChunks)
          .where(eq(knowledgeChunks.companyId, companyId));

        // 4. Delete knowledge files (get paths first for storage cleanup)
        const files = await tx.query.knowledgeFiles.findMany({
          where: eq(knowledgeFiles.companyId, companyId),
          columns: { storagePath: true },
        });

        await tx.delete(knowledgeFiles)
          .where(eq(knowledgeFiles.companyId, companyId));

        // 5. Delete agents and related configs
        await tx.delete(agents)
          .where(eq(agents.companyId, companyId));

        // 6. Delete users (except for audit trail reference)
        await tx.update(users)
          .set({
            isActive: false,
            deletedAt: new Date(),
            email: sql`CONCAT('deleted_', id, '@deleted.local')`,
            name: 'Deleted User',
          })
          .where(eq(users.companyId, companyId));

        // 7. Update company status
        await tx.update(companies)
          .set({
            status: 'deleted',
            deletedAt: new Date(),
            // Anonymize identifiable info
            name: sql`CONCAT('Deleted Company ', id)`,
            customDomain: null,
          })
          .where(eq(companies.id, companyId));

        // 8. Update subscription status
        await tx.update(companySubscriptions)
          .set({ status: 'cancelled' })
          .where(eq(companySubscriptions.companyId, companyId));

        // 9. Log deletion
        await tx.insert(auditLogs).values({
          companyId,
          action: 'company.data_deleted',
          details: {
            reason: 'retention_policy',
            retentionDays: RETENTION_DAYS,
          },
        });

        // 10. Delete from Qdrant
        await this.deleteQdrantCollection(companyId);

        // 11. Delete from file storage
        await this.deleteStorageFiles(companyId, files.map(f => f.storagePath));
      });

      console.log(`Data deletion completed for company: ${companyId}`);
    } catch (error) {
      console.error(`Error deleting data for company ${companyId}:`, error);

      // Log failure for manual review
      await db.insert(auditLogs).values({
        companyId,
        action: 'company.data_deletion_failed',
        success: false,
        errorMessage: error.message,
      });
    }
  }

  private async deleteQdrantCollection(companyId: string): Promise<void> {
    const collectionName = `company_${companyId.replace(/-/g, '_')}`;

    try {
      await qdrantClient.deleteCollection(collectionName);
    } catch (error) {
      console.error(`Failed to delete Qdrant collection: ${collectionName}`, error);
    }
  }

  private async deleteStorageFiles(
    companyId: string,
    filePaths: string[]
  ): Promise<void> {
    // Delete individual files
    for (const path of filePaths) {
      try {
        await storage.delete(path);
      } catch (error) {
        console.error(`Failed to delete file: ${path}`, error);
      }
    }

    // Delete company folder
    try {
      await storage.deleteFolder(`companies/${companyId}`);
    } catch (error) {
      console.error(`Failed to delete company folder: ${companyId}`, error);
    }
  }
}

// Export data before deletion
export async function exportCompanyData(companyId: string): Promise<string> {
  // Generate downloadable archive of all company data
  const exportData = {
    exportedAt: new Date().toISOString(),
    conversations: await db.query.conversations.findMany({
      where: eq(conversations.companyId, companyId),
      with: { messages: true },
    }),
    agents: await db.query.agents.findMany({
      where: eq(agents.companyId, companyId),
    }),
    knowledgeFiles: await db.query.knowledgeFiles.findMany({
      where: eq(knowledgeFiles.companyId, companyId),
    }),
    analytics: await db.query.dailyAnalytics.findMany({
      where: eq(dailyAnalytics.companyId, companyId),
    }),
  };

  // Store export as downloadable file
  const exportPath = `exports/${companyId}/data-export-${Date.now()}.json`;
  await storage.upload(exportPath, JSON.stringify(exportData, null, 2));

  // Generate signed URL valid for 7 days
  return storage.getSignedUrl(exportPath, 7 * 24 * 60 * 60);
}

// Initialize and export
export const dataRetentionService = new DataRetentionService();
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Database Schema](./database-schema.md)
- [Requirements Document](./requirement.v2.md)
