# Step 16: Company Admin - Widget Customizer

## Objective
Implement a visual widget customizer allowing companies to customize the chat widget's appearance, behavior, and install it on their websites.

---

## Prerequisites
- Step 15 completed
- Company settings infrastructure
- File upload for logos

---

## Reference Documents
- [UI: Widget Customizer](../ui/company-admin/11-widget-customizer.md)

---

## Tasks

### 16.1 Create Widget Customizer Page

**Route:** `src/app/(company-admin)/widget/page.tsx`

**Layout:**
- Left panel: Customization options
- Right panel: Live preview
- Sticky save/publish buttons

### 16.2 Implement Appearance Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Brand Colors                                                       │
│  ────────────                                                       │
│                                                                     │
│  Primary Color                                                      │
│  ┌────────────┐                                                    │
│  │ [■] #0066FF│  [Color Picker]                                    │
│  └────────────┘                                                    │
│                                                                     │
│  Background Color                                                   │
│  ┌────────────┐                                                    │
│  │ [■] #FFFFFF│  [Color Picker]                                    │
│  └────────────┘                                                    │
│                                                                     │
│  Text Color                                                         │
│  ┌────────────┐                                                    │
│  │ [■] #1F2937│  [Color Picker]                                    │
│  └────────────┘                                                    │
│                                                                     │
│  Typography                                                         │
│  ──────────                                                         │
│                                                                     │
│  Font Family: [System Default ▼]                                    │
│  Font Size:   Small ────●──── Large (14px)                         │
│  Border Radius: Square ────●──── Rounded (12px)                    │
│                                                                     │
│  Theme                                                              │
│  ─────                                                              │
│  ○ Light mode only                                                  │
│  ○ Dark mode only                                                   │
│  ● Follow system preference                                         │
│                                                                     │
│  Shadow: None ────●──── Strong (Medium)                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.3 Implement Behavior Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Auto-Open Settings                                                 │
│  ──────────────────                                                 │
│                                                                     │
│  ○ Never                                                            │
│  ● After delay: [5] seconds                                         │
│  ○ On specific pages                                                │
│                                                                     │
│  ☐ Show only once per session                                      │
│  ☑ Don't auto-open on mobile                                       │
│                                                                     │
│  Pre-Chat Form                                                      │
│  ─────────────                                                      │
│                                                                     │
│  ☑ Collect customer information before chat                        │
│                                                                     │
│  Required Fields:                                                   │
│  ☑ Email                                                           │
│  ☐ Name                                                            │
│  ☐ Phone                                                           │
│                                                                     │
│  Custom Fields:                                                     │
│  [+ Add Custom Field]                                               │
│  Order ID    [Text]    ☐ Required    [Edit] [×]                    │
│                                                                     │
│  Sound & Notifications                                              │
│  ─────────────────────                                              │
│                                                                     │
│  ☑ Play sound on new message                                       │
│  ☑ Show browser notifications                                      │
│  ☑ Show unread badge count                                         │
│                                                                     │
│  Persistence                                                        │
│  ───────────                                                        │
│                                                                     │
│  ☑ Remember conversation across page loads                         │
│  ☑ Allow customers to view past conversations                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.4 Implement Launcher Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Launcher Button                                                    │
│  ───────────────                                                    │
│                                                                     │
│  Style                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │
│  │   [Icon]    │ │ [Icon+Text] │ │   [Text]    │                   │
│  │      ●      │ │             │ │             │                   │
│  └─────────────┘ └─────────────┘ └─────────────┘                   │
│                                                                     │
│  Icon                                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  💬  🗨️  💭  🤖  ❓  ℹ️  [Upload Custom]                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Label Text (if using text style)                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Chat with us                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Position                                                           │
│  ○ Bottom Right    ● Bottom Left                                   │
│                                                                     │
│  Offset from Edge                                                   │
│  Horizontal: [20] px    Vertical: [20] px                          │
│                                                                     │
│  Size: Small ────●──── Large (60px)                                │
│                                                                     │
│  Greeting Bubble                                                    │
│  ───────────────                                                    │
│                                                                     │
│  ☑ Show greeting bubble                                            │
│  Message: [Hi! 👋 Need any help?]                                  │
│  Show after: [3] seconds                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.5 Implement Chat Window Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Header                                                             │
│  ──────                                                             │
│                                                                     │
│  Company Logo                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Current Logo Preview]                                     │   │
│  │  [Upload Logo]  [Remove]                                    │   │
│  │  Recommended: 120x40px, PNG or SVG                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Header Title: [Acme Support]                                      │
│  Header Subtitle: [We typically reply in a few minutes]            │
│                                                                     │
│  Window Size                                                        │
│  ───────────                                                        │
│                                                                     │
│  Width:  [380] px  (300-500)                                       │
│  Height: [600] px  (400-700)                                       │
│                                                                     │
│  ☑ Allow fullscreen mode on mobile                                 │
│                                                                     │
│  Input Area                                                         │
│  ──────────                                                         │
│                                                                     │
│  Placeholder: [Type your message...]                               │
│                                                                     │
│  ☑ Allow file attachments                                          │
│  ☐ Allow voice messages                                            │
│  ☑ Show emoji picker                                               │
│                                                                     │
│  Footer                                                             │
│  ──────                                                             │
│                                                                     │
│  ☑ Show "Powered by" branding                                      │
│     (Can be hidden on Professional and Enterprise plans)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 16.6 Implement Live Preview Panel

```
┌─────────────────────────────────────────┐
│                                         │
│  Live Preview                           │
│                                         │
│  Device: [Desktop ●] [Mobile ○]         │
│  Theme:  [Light ●] [Dark ○]             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │  [Simulated Website Background] │   │
│  │                                 │   │
│  │                         ┌─────┐│   │
│  │                         │ 💬  ││   │
│  │                         └─────┘│   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Click the launcher to preview          │
│  the chat window                        │
│                                         │
└─────────────────────────────────────────┘
```

**Preview Features:**
- Real-time updates
- Interactive launcher
- Preview chat window
- Device toggle
- Theme toggle

### 16.7 Implement Get Code Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Install Chat Widget                                        [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Add this code to your website, just before the </body> tag:    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  <script>                                               │   │
│  │    (function(w,d,s,l,i){                                │   │
│  │      w[l]=w[l]||[];                                     │   │
│  │      var f=d.getElementsByTagName(s)[0],                │   │
│  │      j=d.createElement(s);                              │   │
│  │      j.async=true;                                      │   │
│  │      j.src='https://widget.chat.buzzi.ai/v1/'+i+'.js'; │   │
│  │      f.parentNode.insertBefore(j,f);                    │   │
│  │    })(window,document,'script','_chatbuzzi',            │   │
│  │      'wgt_abc123xyz');                                  │   │
│  │  </script>                                              │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Copy Code]                                                    │
│                                                                 │
│  Platform-Specific Instructions:                                │
│  [WordPress]  [Shopify]  [Wix]  [React]  [Other]               │
│                                                                 │
│  Widget ID: wgt_abc123xyz                                       │
│                                                                 │
│  [Test Installation]                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 16.8 Create Widget API Routes

**`src/app/api/company/widget/route.ts`:**
- GET: Get widget configuration
- PATCH: Update widget configuration

**`src/app/api/company/widget/publish/route.ts`:**
- POST: Publish widget changes

**`src/app/api/company/widget/logo/route.ts`:**
- POST: Upload widget logo
- DELETE: Remove widget logo

**`src/app/api/company/widget/preview/route.ts`:**
- GET: Get preview configuration

### 16.9 Create Widget Components

**`src/components/company-admin/widget/customizer-layout.tsx`:**
- Split panel layout
- Save/publish buttons
- Tab navigation

**`src/components/company-admin/widget/appearance-tab.tsx`:**
- Color pickers
- Typography controls
- Theme options

**`src/components/company-admin/widget/behavior-tab.tsx`:**
- Auto-open settings
- Pre-chat form builder
- Notification toggles

**`src/components/company-admin/widget/launcher-tab.tsx`:**
- Style selector
- Icon picker
- Position controls
- Greeting bubble

**`src/components/company-admin/widget/chat-window-tab.tsx`:**
- Logo upload
- Header text inputs
- Window size controls
- Input options

**`src/components/company-admin/widget/live-preview.tsx`:**
- Preview container
- Device toggle
- Theme toggle
- Interactive widget

**`src/components/company-admin/widget/code-modal.tsx`:**
- Code snippet
- Copy button
- Platform instructions
- Test installation

**`src/components/company-admin/widget/color-picker.tsx`:**
- Color input
- Color picker popup
- Preset colors

---

## Data Models

### Widget Configuration
```typescript
interface WidgetConfig {
  id: string;
  companyId: string;

  // Appearance
  appearance: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: 'system' | 'inter' | 'roboto' | string;
    fontSize: number;
    borderRadius: number;
    theme: 'light' | 'dark' | 'system';
    shadow: 'none' | 'small' | 'medium' | 'large';
  };

  // Behavior
  behavior: {
    autoOpen: 'never' | 'delay' | 'pages';
    autoOpenDelay: number;
    autoOpenPages: string[];
    showOncePerSession: boolean;
    disableAutoOpenMobile: boolean;
    preChatForm: {
      enabled: boolean;
      fields: {
        id: string;
        type: 'email' | 'name' | 'phone' | 'text' | 'select';
        label: string;
        required: boolean;
        options?: string[];
      }[];
    };
    sounds: boolean;
    notifications: boolean;
    unreadBadge: boolean;
    persistConversation: boolean;
    showPastConversations: boolean;
  };

  // Launcher
  launcher: {
    style: 'icon' | 'icon-text' | 'text';
    icon: string;
    customIconUrl: string | null;
    labelText: string;
    position: 'bottom-right' | 'bottom-left';
    offsetX: number;
    offsetY: number;
    size: number;
    greeting: {
      enabled: boolean;
      message: string;
      delay: number;
    };
  };

  // Chat Window
  chatWindow: {
    logoUrl: string | null;
    title: string;
    subtitle: string;
    width: number;
    height: number;
    allowFullscreenMobile: boolean;
    inputPlaceholder: string;
    allowAttachments: boolean;
    allowVoice: boolean;
    showEmojiPicker: boolean;
    showBranding: boolean;
  };

  // Meta
  publishedAt: Date | null;
  draftConfig: Partial<WidgetConfig> | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Widget Embed Code
```typescript
interface WidgetEmbed {
  widgetId: string;
  code: string;
  platforms: {
    name: string;
    instructions: string;
  }[];
}
```

---

## Validation Checklist

- [ ] All tabs load correctly
- [ ] Color pickers work
- [ ] Font controls update preview
- [ ] Auto-open settings save
- [ ] Pre-chat form builder works
- [ ] Launcher customization works
- [ ] Chat window settings save
- [ ] Live preview updates in real-time
- [ ] Code modal displays correct code
- [ ] Copy code works
- [ ] Logo upload works
- [ ] Publish deploys changes

---

## File Structure

```
src/
├── app/
│   ├── (company-admin)/
│   │   └── widget/
│   │       └── page.tsx
│   │
│   └── api/
│       └── company/
│           └── widget/
│               ├── route.ts
│               ├── publish/
│               │   └── route.ts
│               ├── logo/
│               │   └── route.ts
│               └── preview/
│                   └── route.ts
│
└── components/
    └── company-admin/
        └── widget/
            ├── customizer-layout.tsx
            ├── appearance-tab.tsx
            ├── behavior-tab.tsx
            ├── launcher-tab.tsx
            ├── chat-window-tab.tsx
            ├── live-preview.tsx
            ├── code-modal.tsx
            └── color-picker.tsx
```

---

## Next Step
[Step 17 - Integrations](./step-17-integrations.md)

---

## Related Documentation
- [UI: Widget Customizer](../ui/company-admin/11-widget-customizer.md)
- [Step 24 - Chat Widget Development](./step-24-chat-widget.md)
