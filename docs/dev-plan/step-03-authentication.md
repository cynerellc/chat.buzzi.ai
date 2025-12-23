# Step 03: Authentication System

## Objective
Implement a complete authentication system using Auth.js (NextAuth v5) with multi-tenant support, role-based access control, and secure session management. The system uses PostgreSQL (Supabase) as the database backend with Drizzle ORM adapter.

---

## Prerequisites
- Step 01 and 02 completed
- PostgreSQL database (Supabase) with Auth.js tables migrated
- Environment variables configured (AUTH_SECRET, provider credentials)

---

## Reference Documents
- [Auth & Multi-tenancy Architecture](../architecture-auth-multitenancy.md)
- [UI: Login](../ui/shared/01-login.md)
- [UI: Register](../ui/shared/02-register.md)
- [UI: Forgot Password](../ui/shared/03-forgot-password.md)
- [UI: Accept Invitation](../ui/shared/04-accept-invitation.md)

---

## Tasks

### 3.1 Configure Auth.js (NextAuth v5)

Set up Auth.js configuration and utilities:

**`src/lib/auth/config.ts`:**
- Auth.js configuration with providers (Google, GitHub, Email)
- Drizzle adapter for PostgreSQL
- Session strategy (JWT or database)
- Custom callbacks for multi-tenant support

**`src/lib/auth/index.ts`:**
- Export auth handlers (signIn, signOut, auth)
- Export useSession hook for client components

**`src/app/api/auth/[...nextauth]/route.ts`:**
- Auth.js API route handler
- Exports GET and POST handlers

### 3.2 Create Auth Middleware

Implement Next.js middleware for route protection:

**`src/middleware.ts`:**

```
Route Protection Logic:
├── Public routes (no auth required):
│   ├── /login
│   ├── /register
│   ├── /forgot-password
│   ├── /accept-invitation
│   └── /widget/*
│
├── Protected routes (auth required):
│   ├── (master-admin)/* → requires master_admin role
│   ├── (company-admin)/* → requires company_admin role
│   └── (support-agent)/* → requires support_agent role
│
└── API routes:
    ├── /api/auth/* → public
    ├── /api/widget/* → public (with widget auth)
    └── /api/* → requires auth + appropriate role
```

**Middleware responsibilities:**
1. Check for valid session
2. Refresh session if needed
3. Validate user role for route
4. Validate company access
5. Redirect unauthorized users

### 3.3 Implement Auth Context & Hooks

**`src/lib/auth/context.tsx`:**
- AuthProvider component
- Current user state
- Session management
- Loading states

**`src/hooks/useAuth.ts`:**
- Access current user
- Login/logout functions
- Role checking utilities
- Company context

**`src/hooks/useUser.ts`:**
- User profile data
- Update profile functions

### 3.4 Implement Login Page

**Route:** `src/app/(auth)/login/page.tsx`

**Features:**
- Email/password login form
- "Remember me" option
- Social login buttons (if configured)
- Link to forgot password
- Link to register (for company signup)
- Error handling and validation
- Redirect after successful login based on role

**Form Fields:**
- Email (required, email format)
- Password (required)
- Remember me (checkbox)

**Validations:**
- Client-side with Zod
- Server-side with Supabase

**After Login:**
- Fetch user from database with role
- Redirect to appropriate dashboard:
  - Master Admin → /dashboard (master-admin)
  - Company Admin → /dashboard (company-admin)
  - Support Agent → /inbox (support-agent)

### 3.5 Implement Registration Page

**Route:** `src/app/(auth)/register/page.tsx`

**Features:**
- Company registration flow
- Creates company + admin user
- Company name input
- Admin user details
- Terms acceptance
- Email verification notice

**Form Fields:**
- Company name (required)
- Full name (required)
- Email (required, email format)
- Password (required, min 8 chars, complexity)
- Confirm password (required, must match)
- Terms acceptance (required checkbox)

**Flow:**
1. Validate form
2. Create Supabase auth user
3. Create company record
4. Create user record linked to company
5. Assign company_admin role
6. Create default widget settings
7. Send verification email
8. Redirect to verification notice

### 3.6 Implement Forgot Password Page

**Route:** `src/app/(auth)/forgot-password/page.tsx`

**Features:**
- Email input form
- Password reset email trigger
- Success message
- Link back to login

**Form Fields:**
- Email (required, email format)

**Flow:**
1. Validate email
2. Call Supabase resetPasswordForEmail
3. Show success message (even if email not found - security)
4. User receives email with reset link

### 3.7 Implement Password Reset Page

**Route:** `src/app/(auth)/reset-password/page.tsx`

**Features:**
- New password form
- Password confirmation
- Strength indicator
- Success redirect to login

**Form Fields:**
- New password (required, min 8 chars)
- Confirm password (required, must match)

**Flow:**
1. Validate token from URL (handled by Supabase)
2. Update password
3. Redirect to login with success message

### 3.8 Implement Accept Invitation Page

**Route:** `src/app/(auth)/accept-invitation/page.tsx`

**Features:**
- Accept team invitation
- Create password for new account
- Join existing company
- Token validation

**Form Fields:**
- Full name (required)
- Password (required)
- Confirm password (required)

**Flow:**
1. Validate invitation token
2. Check token not expired
3. Create Supabase auth user
4. Create user record with company_id and role from invitation
5. Update invitation status to accepted
6. Redirect to login

### 3.9 Implement Auth API Routes

**`src/app/api/auth/callback/route.ts`:**
- Handle OAuth callbacks
- Handle email verification
- Handle password reset

**`src/app/api/auth/logout/route.ts`:**
- Sign out user
- Clear session
- Redirect to login

### 3.10 Implement Role-Based Guards

**`src/lib/auth/guards.ts`:**

Functions to check permissions:
- `requireAuth()` - Throws if not authenticated
- `requireMasterAdmin()` - Throws if not master admin
- `requireCompanyAdmin()` - Throws if not company admin
- `requireSupportAgent()` - Throws if not support agent
- `requireCompanyAccess(companyId)` - Validates company access

**Usage in Server Components/Actions:**
```typescript
// In a server component
const user = await requireCompanyAdmin();
// Proceeds only if user is company admin

// In an API route
export async function GET(request: Request) {
  const user = await requireAuth();
  // ...
}
```

### 3.11 Implement User Profile Sync

After Supabase auth events, sync with our users table:

**Triggers:**
- After signup → Create user record
- After login → Update last_login_at
- After profile update → Sync changes

**`src/lib/auth/sync.ts`:**
- `syncUserProfile(authUser)` - Create/update user record
- `getUserWithRole(authUserId)` - Get user with role from DB

### 3.12 Implement Session Management

**Session storage:**
- Use Supabase session cookies
- Implement session refresh in middleware
- Handle session expiry

**`src/lib/auth/session.ts`:**
- `getSession()` - Get current session
- `getUser()` - Get current user with role
- `refreshSession()` - Refresh expired session

### 3.13 Implement Multi-Tenant Context

**`src/lib/auth/tenant.ts`:**
- `getCurrentCompany()` - Get user's company
- `validateCompanyAccess(companyId)` - Check access
- `getCompanyContext()` - Company settings and limits

**All database queries must include company_id filter:**
```typescript
// Example pattern
const agents = await db.query.agents.findMany({
  where: eq(agents.companyId, currentCompany.id)
});
```

### 3.14 Create Auth Components

**`src/components/auth/LoginForm.tsx`:**
- Reusable login form
- Framer Motion animations
- HeroUI components

**`src/components/auth/RegisterForm.tsx`:**
- Company registration form
- Password strength indicator

**`src/components/auth/ForgotPasswordForm.tsx`:**
- Password reset request form

**`src/components/auth/AcceptInvitationForm.tsx`:**
- Invitation acceptance form

**`src/components/auth/PasswordInput.tsx`:**
- Password input with visibility toggle
- Strength indicator

---

## Route Group Configuration

### (auth) Layout

**`src/app/(auth)/layout.tsx`:**
- Centered card layout
- Logo display
- No navigation
- Redirect if already authenticated

### Middleware Pattern

```
Request
    │
    ▼
┌─────────────────┐
│   Middleware    │
│                 │
│ 1. Parse route  │
│ 2. Check session│
│ 3. Get user role│
│ 4. Validate     │
│    access       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Allow    Redirect
    │      to Login
    ▼
  Continue
```

---

## Security Considerations

1. **Password Requirements:**
   - Minimum 8 characters
   - At least one uppercase, lowercase, number
   - Special character recommended

2. **Session Security:**
   - HTTP-only cookies
   - Secure flag in production
   - SameSite=Lax

3. **Rate Limiting:**
   - Login attempts
   - Password reset requests
   - Registration

4. **Token Security:**
   - Invitation tokens expire after 7 days
   - Single-use reset tokens
   - Secure token generation

---

## Validation Checklist

- [ ] Login flow works correctly
- [ ] Registration creates company and user
- [ ] Password reset flow works
- [ ] Invitation acceptance works
- [ ] Role-based redirects work
- [ ] Protected routes reject unauthorized users
- [ ] Session persistence works
- [ ] Logout clears session
- [ ] Multi-tenant isolation is enforced

---

## File Structure

```
src/
├── app/
│   └── (auth)/
│       ├── layout.tsx
│       ├── login/
│       │   └── page.tsx
│       ├── register/
│       │   └── page.tsx
│       ├── forgot-password/
│       │   └── page.tsx
│       ├── reset-password/
│       │   └── page.tsx
│       └── accept-invitation/
│           └── page.tsx
│
├── lib/
│   └── auth/
│       ├── supabase/
│       │   ├── client.ts
│       │   ├── server.ts
│       │   └── middleware.ts
│       ├── context.tsx
│       ├── guards.ts
│       ├── session.ts
│       ├── sync.ts
│       └── tenant.ts
│
├── components/
│   └── auth/
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       ├── ForgotPasswordForm.tsx
│       ├── AcceptInvitationForm.tsx
│       └── PasswordInput.tsx
│
├── hooks/
│   ├── useAuth.ts
│   └── useUser.ts
│
└── middleware.ts
```

---

## Next Step
[Step 04 - Core Layout & Shared Components](./step-04-core-layout.md)

---

## Related Documentation
- [Auth & Multi-tenancy Architecture](../architecture-auth-multitenancy.md)
- [UI Specifications](../ui/00-overview.md)
