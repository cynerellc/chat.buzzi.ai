# Agent Editor

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/agents/{agentId}/edit` |
| Access | Company Admin |
| Purpose | Configure basic agent settings (personality, response styles) |
| Mobile Support | Responsive (limited on mobile) |

---

## Important Note

**Limited Access**: Company Admins can only edit basic agent settings like personality and response styles. Advanced settings such as system prompts, execution environment, and core configurations are managed by Master Admin and are not visible to Company Admins.

---

## Page Layout

```
+---------------------------------------------------------------------------------+
|  [Logo] Acme Corporation           [Search...]        [?] [Bell] [CA]           |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  <- Back to Agents                                                              |
|                                                                                 |
|  Edit Agent: Sales Bot                                    [Save] [Test Chat]    |
|  @buzzi/sales-agent v2.1.0 - Managed by Platform Admin                          |
|                                                                                 |
|  +-----------------------------------------------------------------------+     |
|  |  [Identity]  [Personality]  [Knowledge]  [Business Hours]             |     |
|  |  ==========                                                           |     |
|  +-----------------------------------------------------------------------+     |
|                                                                                 |
|  +-----------------------------------+  +-------------------------------+       |
|  |                                   |  |                               |       |
|  |         [Tab Content]             |  |     [Live Preview]            |       |
|  |                                   |  |                               |       |
|  |                                   |  |                               |       |
|  |                                   |  |                               |       |
|  +-----------------------------------+  +-------------------------------+       |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## Tab: Identity

```
+---------------------------------------------------------------------+
|                                                                     |
|  Agent Identity                                                     |
|  --------------                                                     |
|                                                                     |
|  Agent Name (Read-only)                                             |
|  +---------------------------------------------------------------+  |
|  | Sales Bot                                                [!]  |  |
|  +---------------------------------------------------------------+  |
|  Set by platform administrator                                      |
|                                                                     |
|  Package (Read-only)                                                |
|  +---------------------------------------------------------------+  |
|  | @buzzi/sales-agent v2.1.0                                [!]  |  |
|  +---------------------------------------------------------------+  |
|  Managed by platform administrator                                  |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Display Name (Editable)                                            |
|  +---------------------------------------------------------------+  |
|  | Alex                                                          |  |
|  +---------------------------------------------------------------+  |
|  The name shown to customers in the chat                            |
|                                                                     |
|  Agent Avatar                                                       |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [Current Avatar]                                             |  |
|  |                                                               |  |
|  |  [Upload Custom]  [Choose from Library]                       |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Description (Internal)                                             |
|  +---------------------------------------------------------------+  |
|  | Handles sales inquiries, product questions, and helps         |  |
|  | customers find the right products for their needs.            |  |
|  +---------------------------------------------------------------+  |
|  This description is for your team only, not shown to customers     |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Personality

```
+---------------------------------------------------------------------+
|                                                                     |
|  Response Style                                                     |
|  --------------                                                     |
|                                                                     |
|  These settings control how the agent communicates with customers.  |
|  Core behavior is defined by platform administrator.                |
|                                                                     |
|  Personality Preset                                                 |
|  -----------------                                                  |
|                                                                     |
|  +--------------+ +--------------+ +--------------+ +--------------+|
|  | Professional | |  Friendly    | |   Casual     | |   Custom     ||
|  |      *       | |              | |              | |              ||
|  +--------------+ +--------------+ +--------------+ +--------------+|
|                                                                     |
|  Tone Adjustments                                                   |
|  ----------------                                                   |
|                                                                     |
|  Formality                                                          |
|  Very Formal |-------*-------------------| Very Casual              |
|                                                                     |
|  Enthusiasm                                                         |
|  Reserved |-------------*---------------| Enthusiastic              |
|                                                                     |
|  Verbosity                                                          |
|  Concise |-------*---------------------| Detailed                   |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Greeting Message                                                   |
|  ----------------                                                   |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  | Hi! I'm Alex, your sales assistant. How can I help you today? |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  [+ Add Greeting Variation]                                         |
|                                                                     |
|  Existing Variations:                                               |
|  +---------------------------------------------------------------+  |
|  | 1. "Hello! Looking for something specific? I'm here to help." |  |
|  | 2. "Welcome back! How can I assist you today?"                |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Fallback Response (when agent can't help)                          |
|  +---------------------------------------------------------------+  |
|  | I'm not sure about that, but I'd be happy to connect you      |  |
|  | with someone from our team who can help.                      |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Language Settings                                                  |
|  -----------------                                                  |
|                                                                     |
|  Primary Language                                                   |
|  +---------------------------------------------------------------+  |
|  | English (US)                                                v |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  [x] Auto-detect and respond in customer's language                 |
|                                                                     |
|  Additional supported languages:                                    |
|  [x] Spanish  [ ] French  [x] German  [ ] Portuguese  [ ] Japanese  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Knowledge

```
+---------------------------------------------------------------------+
|                                                                     |
|  Knowledge Access                                                   |
|  ----------------                                                   |
|                                                                     |
|  Select which knowledge categories this agent can access.           |
|  Categories are managed in the Knowledge Base section.              |
|                                                                     |
|  Available Categories                                               |
|  +---------------------------------------------------------------+  |
|  |                                                               |  |
|  |  [x] Product Catalog                              45 docs     |  |
|  |      Product descriptions, specifications, pricing            |  |
|  |      Last updated: 2 days ago                                 |  |
|  |                                                               |  |
|  |  [x] FAQ                                          23 docs     |  |
|  |      Frequently asked questions and answers                   |  |
|  |      Last updated: 1 week ago                                 |  |
|  |                                                               |  |
|  |  [x] Pricing & Plans                               8 docs     |  |
|  |      Pricing information, discounts, plans                    |  |
|  |      Last updated: 3 days ago                                 |  |
|  |                                                               |  |
|  |  [ ] Technical Documentation                      120 docs    |  |
|  |      Technical specs, API docs, integration guides            |  |
|  |      Last updated: 1 day ago                                  |  |
|  |                                                               |  |
|  |  [ ] Company Policies                             15 docs     |  |
|  |      Return policy, shipping, terms of service                |  |
|  |      Last updated: 2 weeks ago                                |  |
|  |                                                               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  [Manage Knowledge Base ->]                                         |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Response Preferences                                               |
|  --------------------                                               |
|                                                                     |
|  [x] Include source references when using knowledge base            |
|      Example: "According to our product guide..."                   |
|                                                                     |
|  [x] Allow agent to say "I don't know" when uncertain               |
|      Prevents making up information                                 |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Tab: Business Hours

```
+---------------------------------------------------------------------+
|                                                                     |
|  Operating Hours                                                    |
|  ---------------                                                    |
|                                                                     |
|  Configure when this agent is available to chat.                    |
|                                                                     |
|  Availability                                                       |
|  ( ) Always available (24/7)                                        |
|  (*) Custom schedule                                                |
|                                                                     |
|  Weekly Schedule                                                    |
|  +---------------------------------------------------------------+  |
|  |  Day         Start      End        Active                     |  |
|  +---------------------------------------------------------------+  |
|  |  Monday      [09:00]    [18:00]    [x]                        |  |
|  |  Tuesday     [09:00]    [18:00]    [x]                        |  |
|  |  Wednesday   [09:00]    [18:00]    [x]                        |  |
|  |  Thursday    [09:00]    [18:00]    [x]                        |  |
|  |  Friday      [09:00]    [18:00]    [x]                        |  |
|  |  Saturday    [10:00]    [14:00]    [x]                        |  |
|  |  Sunday      [--:--]    [--:--]    [ ]                        |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  Timezone                                                           |
|  +---------------------------------------------------------------+  |
|  | America/New_York (EST)                                      v |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Outside Hours Behavior                                             |
|  ----------------------                                             |
|                                                                     |
|  When contacted outside business hours:                             |
|  (*) Show offline message                                           |
|  ( ) Continue with AI (limited functionality)                       |
|  ( ) Collect contact info for callback                              |
|                                                                     |
|  Offline Message                                                    |
|  +---------------------------------------------------------------+  |
|  | Thanks for reaching out! We're currently closed. Our hours    |  |
|  | are Mon-Fri 9AM-6PM EST. Leave your email and we'll get back |  |
|  | to you when we're open!                                       |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  ------------------------------------------------------------------ |
|                                                                     |
|  Holiday Schedule                                    [+ Add Holiday] |
|  +---------------------------------------------------------------+  |
|  |  Dec 25, 2024  Christmas Day        Closed                    |  |
|  |  Jan 1, 2025   New Year's Day       Closed                    |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Live Preview Panel

```
+-------------------------------------+
|  Preview                    [R] [E] |
+-------------------------------------+
|                                     |
|  +-------------------------------+  |
|  |  [Widget Preview]             |  |
|  |                               |  |
|  |  +-------------------------+  |  |
|  |  | [Avatar] Alex           |  |  |
|  |  |                         |  |  |
|  |  | Hi! I'm Alex, your      |  |  |
|  |  | sales assistant. How    |  |  |
|  |  | can I help you today?   |  |  |
|  |  +-------------------------+  |  |
|  |                               |  |
|  |  +-------------------------+  |  |
|  |  | Type a message...       |  |  |
|  |  +-------------------------+  |  |
|  |                               |  |
|  +-------------------------------+  |
|                                     |
|  Preview updates as you make        |
|  changes to the configuration.      |
|                                     |
|  [Open Full Test Chat]              |
|                                     |
+-------------------------------------+
```

---

## Test Chat Modal

```
+-------------------------------------------------------------------+
|  Test Chat: Sales Bot                                          [x] |
+-------------------------------------------------------------------+
|                                                                   |
|  +---------------------------------------------------------------+|
|  |                                                               ||
|  |  [Avatar] Alex                                                ||
|  |  Hi! I'm Alex, your sales assistant. How can I help you?     ||
|  |                                                               ||
|  |                                     What products do you have?||
|  |                                                               ||
|  |  [Avatar] Alex                                                ||
|  |  Great question! We have a wide range of products...         ||
|  |  [Thinking indicator]                                        ||
|  |                                                               ||
|  +---------------------------------------------------------------+|
|                                                                   |
|  +---------------------------------------------------------------+|
|  | Type a test message...                              [Send]   ||
|  +---------------------------------------------------------------+|
|                                                                   |
|  Test Mode: Responses don't affect statistics                     |
|                                                                   |
+-------------------------------------------------------------------+
|                                            [Clear Chat] [Close]    |
+-------------------------------------------------------------------+
```

---

## Read-Only Notice Banner

When agent has configurations that are Master Admin only:

```
+---------------------------------------------------------------------+
|  [!] Some settings are managed by your platform administrator       |
|      Contact support if you need changes to system configuration    |
+---------------------------------------------------------------------+
```

---

## Behaviors

### Auto-Save
- Changes saved automatically every 30 seconds
- Manual save available at any time
- "Unsaved changes" indicator in header

### Validation
- Form fields validated on blur
- Save button disabled if validation errors
- Clear error messages with field highlighting

### Test Mode
- Test chat available at any time
- Uses current configuration
- Doesn't affect agent statistics

---

## Mobile Layout

```
+---------------------------+
|  [<] Edit: Sales Bot [S]  |
+---------------------------+
|  [Ident][Person][Know][Hr]|
+---------------------------+
|                           |
|  Tab Content              |
|  (Full width)             |
|                           |
|  Collapsible sections     |
|  for complex settings     |
|                           |
+---------------------------+
|  [Preview] [Test Chat]    |
+---------------------------+
```

---

## Related Pages

- [Agents List](./02-agents-list.md)
- [Agent Settings](./04-agent-settings.md)
- [Knowledge Base](./05-knowledge-base.md)
