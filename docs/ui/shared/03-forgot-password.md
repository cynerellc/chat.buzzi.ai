# Forgot Password Page

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/forgot-password` |
| Access | Public (unauthenticated users) |
| Purpose | Request password reset link via email |
| Mobile Support | Full responsive |

---

## Two-Stage Flow

```
┌─────────────────┐    ┌─────────────────┐
│  Stage 1        │───▶│  Stage 2        │
│  Request Reset  │    │  Confirmation   │
└─────────────────┘    └─────────────────┘
```

---

## Stage 1: Request Reset

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
│                     │  Forgot your password?  │                     │
│                     │                         │                     │
│                     │  Enter your email and   │                     │
│                     │  we'll send you a link  │                     │
│                     │  to reset your password.│                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Email             │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │   Send Reset Link │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  ← Back to login        │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Email | Email | Yes | Valid email format |

---

## Stage 2: Confirmation

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
│                     │      [✉️ Icon]          │                     │
│                     │                         │                     │
│                     │  Check your email       │                     │
│                     │                         │                     │
│                     │  We've sent a password  │                     │
│                     │  reset link to:         │                     │
│                     │                         │                     │
│                     │  john@example.com       │                     │
│                     │                         │                     │
│                     │  The link will expire   │                     │
│                     │  in 1 hour.             │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  Didn't receive email?  │                     │
│                     │  Check spam folder or   │                     │
│                     │  [Resend link]          │                     │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  ← Back to login        │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Reset Password Page (Email Link Destination)

### URL
`/reset-password?token={token}`

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
│                     │  Create new password    │                     │
│                     │                         │                     │
│                     │  Enter a new password   │                     │
│                     │  for your account.      │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ New Password  [👁] │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │  Password strength: ████░░ Good │             │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Confirm Password  │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  Password requirements: │                     │
│                     │  ✓ At least 8 characters│                     │
│                     │  ✓ One uppercase letter │                     │
│                     │  ○ One number           │                     │
│                     │  ○ One special character│                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │   Reset Password  │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| New Password | Password | Yes | Min 8 chars, 1 uppercase, 1 number, 1 special |
| Confirm Password | Password | Yes | Must match new password |

### Password Requirements Checklist
- Updates in real-time as user types
- Shows checkmark (✓) for met requirements
- Shows empty circle (○) for unmet requirements

---

## Behaviors

### Request Flow
```
1. User enters email
2. Client validates email format
3. Submit to API
4. Always show success message (security: don't reveal if email exists)
5. If email exists: send reset link
6. If email doesn't exist: log attempt, no email sent
```

### Token Validation
```
When user clicks email link:
1. Validate token exists and not expired
2. Token expired → Show "Link expired" with option to request new
3. Token invalid → Show "Invalid link" error
4. Token valid → Show reset form
```

### Reset Completion
```
1. Validate new password requirements
2. Confirm passwords match
3. Submit to API
4. Invalidate all existing sessions
5. Show success message
6. Auto-redirect to login (3 seconds)
```

### Security Measures

| Measure | Implementation |
|---------|----------------|
| Token Expiry | 1 hour from creation |
| Single Use | Token invalidated after use |
| Rate Limiting | Max 3 requests per email per hour |
| Token Length | 64 character secure random string |
| Old Sessions | All sessions invalidated on reset |

---

## Error States

### Stage 1 Errors

| Error | Display |
|-------|---------|
| Invalid email format | Inline: "Please enter a valid email address" |
| Rate limited | Inline: "Too many requests. Please try again in X minutes." |
| Network error | Toast: "Connection error. Please try again." |

### Reset Page Errors

| Error | Display |
|-------|---------|
| Token expired | Full page: "This link has expired" with [Request new link] button |
| Token invalid | Full page: "Invalid reset link" with [Back to forgot password] link |
| Password too weak | Inline: Requirements checklist with unmet items highlighted |
| Passwords don't match | Inline: "Passwords do not match" |
| Same as old password | Inline: "New password must be different from current password" |

---

## Success States

### Email Sent Success
```
┌─────────────────────────────────┐
│                                 │
│  [✓] Check icon (green)         │
│                                 │
│  Check your email               │
│                                 │
│  We've sent instructions to     │
│  reset your password to:        │
│                                 │
│  j***@example.com               │
│                                 │
└─────────────────────────────────┘
```

### Password Reset Success
```
┌─────────────────────────────────┐
│                                 │
│  [✓] Check icon (green)         │
│                                 │
│  Password updated!              │
│                                 │
│  Your password has been         │
│  successfully reset.            │
│                                 │
│  Redirecting to login...        │
│                                 │
│  [Go to login now]              │
│                                 │
└─────────────────────────────────┘
```

---

## Accessibility

- Email field has visible label
- Error messages linked via `aria-describedby`
- Success/error states announced to screen readers
- Password requirements list uses proper semantics
- Focus management: auto-focus email input on load

---

## Mobile Layout

- Full-width card
- Larger touch targets (min 44px)
- Simplified layout with no horizontal scrolling
- Keyboard-aware viewport adjustments

---

## Related Pages

- [Login](./01-login.md)
- [Register](./02-register.md)
