# Accept Invitation Page

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/invite/{token}` |
| Access | Public (invited users only) |
| Purpose | Allow invited support agents to create their account |
| Mobile Support | Full responsive |

---

## Page Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Token Valid    │───▶│  Create Account │───▶│  Success        │
│  (Show Form)    │    │  (Set Password) │    │  (Redirect)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         │ Invalid/Expired
         ▼
┌─────────────────┐
│  Error State    │
│  (Contact Admin)│
└─────────────────┘
```

---

## Valid Invitation: Account Setup

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     ┌─────────────────────────┐                     │
│                     │                         │                     │
│                     │      [Logo]             │                     │
│                     │   Chat.buzzi.ai         │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  You're invited!        │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ [Company Logo]    │  │                     │
│                     │  │ Acme Corporation  │  │                     │
│                     │  │ invites you to    │  │                     │
│                     │  │ join as Support   │  │                     │
│                     │  │ Agent             │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  Complete your account  │                     │
│                     │  setup to get started.  │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ john@acme.com     │  │  (Read-only)        │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Full Name         │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Password      [👁] │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │  Password strength: ████░░ Good │             │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Confirm Password  │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  □ I agree to Terms of  │                     │
│                     │    Service and Privacy  │                     │
│                     │    Policy               │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │  Accept & Join    │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  Already have account?  │                     │
│                     │  Sign in instead        │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Invitation Card Content

| Element | Description |
|---------|-------------|
| Company Logo | Company's uploaded logo or placeholder |
| Company Name | Name of the inviting company |
| Role | Role being assigned (e.g., "Support Agent") |
| Inviter Name | Optional: "Invited by [Admin Name]" |

### Form Fields

| Field | Type | Required | Editable | Validation |
|-------|------|----------|----------|------------|
| Email | Email | Yes | No (pre-filled) | From invitation |
| Full Name | Text | Yes | Yes | 2-100 characters |
| Password | Password | Yes | Yes | Min 8 chars, complexity requirements |
| Confirm Password | Password | Yes | Yes | Must match password |
| Terms Agreement | Checkbox | Yes | Yes | Must be checked |

---

## Invalid/Expired Invitation

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     ┌─────────────────────────┐                     │
│                     │                         │                     │
│                     │      [Logo]             │                     │
│                     │   Chat.buzzi.ai         │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │      [❌ Icon]          │                     │
│                     │                         │                     │
│                     │  Invitation Expired     │                     │
│                     │                         │                     │
│                     │  This invitation link   │                     │
│                     │  is no longer valid.    │                     │
│                     │  It may have expired    │                     │
│                     │  or already been used.  │                     │
│                     │                         │                     │
│                     │  Please contact your    │                     │
│                     │  administrator to       │                     │
│                     │  request a new invite.  │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  Already have account?  │                     │
│                     │  [Sign in]              │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Error States

| State | Icon | Title | Message |
|-------|------|-------|---------|
| Expired | Clock/Warning | "Invitation Expired" | "This invitation has expired. Please contact your administrator for a new invite." |
| Invalid | Error X | "Invalid Link" | "This invitation link is not valid. Please check the link or contact your administrator." |
| Already Used | Checkmark | "Already Accepted" | "This invitation has already been accepted. Sign in to access your account." |
| Company Deactivated | Warning | "Company Unavailable" | "This company is no longer active on our platform." |

---

## Behaviors

### Token Validation
```
On Page Load:
1. Extract token from URL
2. Validate token with API
3. If valid:
   ├─ Show account setup form
   ├─ Pre-fill email (read-only)
   └─ Pre-fill name if provided in invitation
4. If invalid:
   ├─ Determine error type
   └─ Show appropriate error state
```

### Account Creation Flow
```
1. User fills form
2. Client-side validation
3. Submit to API
4. API validates:
   ├─ Token still valid
   ├─ Email matches invitation
   ├─ Password meets requirements
   └─ Terms accepted
5. On success:
   ├─ Create user account
   ├─ Link to company
   ├─ Invalidate invitation token
   ├─ Create session
   └─ Redirect to inbox
6. On error:
   └─ Show appropriate error message
```

### Password Requirements
Display real-time checklist:
- At least 8 characters
- One uppercase letter
- One lowercase letter
- One number
- One special character

---

## Success State

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     ┌─────────────────────────┐                     │
│                     │                         │                     │
│                     │      [Logo]             │                     │
│                     │   Chat.buzzi.ai         │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │      [✓ Icon]           │                     │
│                     │                         │                     │
│                     │  Welcome to the team!   │                     │
│                     │                         │                     │
│                     │  Your account has been  │                     │
│                     │  created successfully.  │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ [Company Logo]    │  │                     │
│                     │  │ Acme Corporation  │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  Redirecting to your    │                     │
│                     │  inbox...               │                     │
│                     │                         │                     │
│                     │  [Go to Inbox →]        │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Existing User Flow

If the invited email belongs to an existing user:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     ┌─────────────────────────┐                     │
│                     │                         │                     │
│                     │  You've been invited!   │                     │
│                     │                         │                     │
│                     │  [Company Logo]         │                     │
│                     │  Acme Corporation       │                     │
│                     │  wants you to join      │                     │
│                     │  as Support Agent       │                     │
│                     │                         │                     │
│                     │  You already have an    │                     │
│                     │  account. Sign in to    │                     │
│                     │  accept this invitation.│                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Sign In & Accept  │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  [Decline Invitation]   │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

After sign in, user is prompted to confirm:
- Accept: Added to company, redirected to inbox
- Decline: Invitation marked as declined, redirect to their existing dashboard

---

## Security Measures

| Measure | Implementation |
|---------|----------------|
| Token Expiry | 7 days from creation |
| Single Use | Token invalidated after acceptance |
| Email Verification | Email pre-verified (from invitation) |
| CSRF Protection | Token required for form submission |
| Rate Limiting | 5 attempts per token per hour |

---

## Accessibility

- Company invitation card has proper heading structure
- Form fields have visible labels
- Password requirements announced to screen readers
- Error states have `role="alert"`
- Success redirect announced
- Focus management on state changes

---

## Mobile Layout

```
┌───────────────────────────┐
│                           │
│        [Logo]             │
│     Chat.buzzi.ai         │
│                           │
│  ┌─────────────────────┐  │
│  │ [Company Logo]      │  │
│  │ Acme Corporation    │  │
│  │ Support Agent       │  │
│  └─────────────────────┘  │
│                           │
│  Complete your account    │
│                           │
│  ┌─────────────────────┐  │
│  │ john@acme.com       │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │ Full Name           │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │ Password        [👁] │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │ Confirm Password    │  │
│  └─────────────────────┘  │
│                           │
│  □ I agree to Terms       │
│                           │
│  ┌─────────────────────┐  │
│  │   Accept & Join     │  │
│  └─────────────────────┘  │
│                           │
└───────────────────────────┘
```

---

## Related Pages

- [Login](./01-login.md)
- [Team Management](../company-admin/09-team-management.md) (where invitations are sent)
