# Login Page

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/login` |
| Access | Public (unauthenticated users) |
| Purpose | Authenticate users and route to appropriate dashboard |
| Mobile Support | Full responsive |

---

## Page Layout

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
│                     │  Welcome back           │                     │
│                     │  Sign in to continue    │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Email             │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │ Password      [👁] │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  □ Remember me          │                     │
│                     │           Forgot password? │                  │
│                     │                         │                     │
│                     │  ┌───────────────────┐  │                     │
│                     │  │     Sign In       │  │                     │
│                     │  └───────────────────┘  │                     │
│                     │                         │                     │
│                     │  ──── or continue with ────  │                │
│                     │                         │                     │
│                     │  [G] Google   [M] Microsoft │                 │
│                     │                         │                     │
│                     │  ─────────────────────  │                     │
│                     │                         │                     │
│                     │  Don't have an account? │                     │
│                     │  Register your company  │                     │
│                     │                         │                     │
│                     └─────────────────────────┘                     │
│                                                                     │
│                     © 2024 Chat.buzzi.ai                            │
│                     Terms · Privacy · Support                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Form Fields

### Email Input
| Property | Value |
|----------|-------|
| Type | Email |
| Required | Yes |
| Validation | Valid email format |
| Autocomplete | `email` |
| Error Message | "Please enter a valid email address" |

### Password Input
| Property | Value |
|----------|-------|
| Type | Password (with toggle visibility) |
| Required | Yes |
| Min Length | 8 characters |
| Autocomplete | `current-password` |
| Error Message | "Password is required" |

### Remember Me Checkbox
| Property | Value |
|----------|-------|
| Default | Unchecked |
| Behavior | Extends session duration to 30 days |

---

## Interactive Elements

### Sign In Button
- **State: Default** - Primary blue (#0066FF), enabled
- **State: Loading** - Shows spinner, disabled, text "Signing in..."
- **State: Disabled** - Gray background when form invalid
- **Action** - Submits credentials to authentication endpoint

### Social Login Buttons
| Provider | Icon | Label |
|----------|------|-------|
| Google | Google "G" logo | "Continue with Google" |
| Microsoft | Microsoft logo | "Continue with Microsoft" |

### Links
| Link | Destination |
|------|-------------|
| "Forgot password?" | `/forgot-password` |
| "Register your company" | `/register` |
| "Terms" | `/terms` |
| "Privacy" | `/privacy` |
| "Support" | `/support` |

---

## Behaviors

### Form Submission Flow
```
1. User enters credentials
2. Client-side validation
   ├─ Invalid → Show inline errors, focus first error field
   └─ Valid → Continue
3. Submit to API
4. Show loading state
5. API Response
   ├─ Success → Redirect based on role
   ├─ Invalid credentials → Show error toast, clear password
   ├─ Account locked → Show locked message with unlock info
   ├─ Email not verified → Show verification prompt
   └─ MFA required → Redirect to MFA challenge
```

### Role-Based Redirect
| User Role | Redirect Destination |
|-----------|---------------------|
| Master Admin | `/admin/dashboard` |
| Company Admin | `/dashboard` |
| Support Agent | `/inbox` |

### Error States
| Error | Display |
|-------|---------|
| Invalid credentials | Toast: "Invalid email or password" |
| Account locked | Inline alert: "Account temporarily locked. Try again in X minutes." |
| Too many attempts | Inline alert: "Too many login attempts. Please try again later." |
| Network error | Toast: "Connection error. Please check your internet." |

---

## Security Features

1. **Rate Limiting** - Max 5 failed attempts per 15 minutes
2. **CSRF Protection** - Token included in form
3. **Secure Password Field** - No browser autocomplete for sensitive fields option
4. **Session Management** - Secure, httpOnly cookies

---

## Accessibility

- All form fields have associated labels
- Error messages linked with `aria-describedby`
- Focus trap within modal (if used as modal)
- Tab order: Email → Password → Remember me → Sign In → Social buttons
- Enter key submits form
- Screen reader announcements for errors and success

---

## Mobile Layout (< 640px)

```
┌───────────────────────────┐
│                           │
│        [Logo]             │
│     Chat.buzzi.ai         │
│                           │
│  Welcome back             │
│  Sign in to continue      │
│                           │
│  ┌─────────────────────┐  │
│  │ Email               │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │ Password        [👁] │  │
│  └─────────────────────┘  │
│                           │
│  □ Remember me            │
│  Forgot password?         │
│                           │
│  ┌─────────────────────┐  │
│  │      Sign In        │  │
│  └─────────────────────┘  │
│                           │
│  ─── or continue with ─── │
│                           │
│  ┌─────────────────────┐  │
│  │ [G] Google          │  │
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │ [M] Microsoft       │  │
│  └─────────────────────┘  │
│                           │
│  Don't have an account?   │
│  Register your company    │
│                           │
└───────────────────────────┘
```

---

## Related Pages

- [Register](./02-register.md)
- [Forgot Password](./03-forgot-password.md)
- [Accept Invitation](./04-accept-invitation.md)
