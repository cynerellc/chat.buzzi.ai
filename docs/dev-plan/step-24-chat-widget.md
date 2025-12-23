# Step 24: Chat Widget Development

## Objective
Develop the embeddable chat widget that can be integrated into any website. The widget includes the launcher button, chat window, message display, input area, file upload, voice input (PTT), and theming support using Shadow DOM for style isolation.

---

## Prerequisites
- Step 22 completed (AI Agent Framework)
- Step 23 completed (Real-time Communication)
- CDN setup for widget hosting

---

## Reference Documents
- [Architecture: Chat Widget](../architecture-chat-widget.md)

---

## Tasks

### 24.1 Widget Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            HOST WEBSITE                                          │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         EMBED SNIPPET                                      │ │
│  │  <script>                                                                  │ │
│  │    window.CHATBOT_CONFIG = { agentId: "...", companyId: "..." };          │ │
│  │  </script>                                                                 │ │
│  │  <script src="https://cdn.buzzi.ai/widget/v1/chat.min.js" async></script> │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                           │
│                                     ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                        WIDGET CONTAINER                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Shadow DOM (Isolated Styles)                                        │ │ │
│  │  │  ┌───────────────────────────────────────────────────────────────┐  │ │ │
│  │  │  │                    CHAT WIDGET UI                              │  │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐  │  │ │ │
│  │  │  │  │  Header                                                  │  │  │ │ │
│  │  │  │  ├─────────────────────────────────────────────────────────┤  │  │ │ │
│  │  │  │  │  Message List                                           │  │  │ │ │
│  │  │  │  ├─────────────────────────────────────────────────────────┤  │  │ │ │
│  │  │  │  │  Input Area                                             │  │  │ │ │
│  │  │  │  └─────────────────────────────────────────────────────────┘  │  │ │ │
│  │  │  └───────────────────────────────────────────────────────────────┘  │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │  Launcher Button (floating)                                                │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 24.2 Setup Widget Project Structure

**Directory:** `packages/chat-widget/`

```
packages/chat-widget/
├── src/
│   ├── index.ts                 # Entry point
│   ├── widget.ts                # Main widget class
│   ├── components/
│   │   ├── launcher.ts          # Launcher button
│   │   ├── chat-window.ts       # Chat window container
│   │   ├── header.ts            # Header component
│   │   ├── message-list.ts      # Message list
│   │   ├── message.ts           # Single message
│   │   ├── input-area.ts        # Input area
│   │   ├── file-upload.ts       # File upload
│   │   ├── voice-input.ts       # PTT voice input
│   │   └── typing-indicator.ts  # Typing indicator
│   ├── services/
│   │   ├── api.ts               # API client
│   │   ├── session.ts           # Session management
│   │   ├── sse.ts               # SSE connection
│   │   └── storage.ts           # Local storage
│   ├── styles/
│   │   ├── variables.css        # CSS custom properties
│   │   ├── widget.css           # Main styles
│   │   ├── launcher.css         # Launcher styles
│   │   ├── messages.css         # Message styles
│   │   └── voice.css            # Voice input styles
│   ├── utils/
│   │   ├── markdown.ts          # Markdown renderer
│   │   ├── event-emitter.ts     # Event emitter
│   │   └── dom.ts               # DOM utilities
│   └── types.ts                 # Type definitions
├── package.json
├── tsconfig.json
├── vite.config.ts               # Build configuration
└── README.md
```

### 24.3 Implement Widget Core

**File:** `packages/chat-widget/src/widget.ts`

```typescript
class BuzziChatWidget {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private config: WidgetConfig;
  private session: ChatSession | null = null;
  private eventEmitter: EventEmitter;
  private sseConnection: EventSource | null = null;

  constructor(config: WidgetConfig) {
    this.config = this.validateConfig(config);
    this.eventEmitter = new EventEmitter();
    this.init();
  }

  private async init(): Promise<void> {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'buzzi-chat-widget';
    document.body.appendChild(this.container);

    // Create shadow DOM for style isolation
    this.shadow = this.container.attachShadow({ mode: 'closed' });

    // Inject styles
    const styles = await this.loadStyles();
    this.shadow.appendChild(styles);

    // Render widget
    this.render();

    // Auto-open if configured
    if (this.config.autoOpen) {
      setTimeout(() => this.open(), this.config.autoOpenDelay ?? 5000);
    }

    // Load existing session
    await this.restoreSession();

    // Expose global API
    this.exposeAPI();
  }
}
```

### 24.4 Implement Embed Code Configuration

**Configuration Options:**
```typescript
interface WidgetConfig {
  // Required
  agentId: string;
  companyId: string;

  // Appearance
  theme: 'light' | 'dark' | 'auto';
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;

  // Branding
  title: string;
  subtitle: string;
  avatarUrl: string;
  welcomeMessage: string;
  placeholderText: string;

  // Behavior
  autoOpen: boolean;
  autoOpenDelay: number;
  showBranding: boolean;

  // Features
  enableVoice: boolean;
  enableFileUpload: boolean;
  enableEmoji: boolean;

  // Localization
  locale: string;

  // Customer context
  customer?: {
    id: string;
    name: string;
    email: string;
    metadata: Record<string, unknown>;
  };
}
```

**Embed Snippet:**
```html
<script>
  window.CHATBOT_CONFIG = {
    agentId: "a_xyz789",
    companyId: "c_abc123",
    theme: "light",
    position: "bottom-right",
    primaryColor: "#007bff",
    title: "Support Chat",
    subtitle: "We typically reply within minutes",
  };
</script>
<script
  src="https://cdn.buzzi.ai/widget/v1/chat.min.js"
  async
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 24.5 Implement Launcher Button

**File:** `packages/chat-widget/src/components/launcher.ts`

**Features:**
- Floating button with configurable position
- Animation on hover
- Notification badge for unread messages
- Accessibility (aria labels, keyboard navigation)

```css
.buzzi-launcher {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--buzzi-primary);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease;
  z-index: 999998;
}

.buzzi-launcher:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.2);
}
```

### 24.6 Implement Chat Window

**File:** `packages/chat-widget/src/components/chat-window.ts`

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Header                                [×]  │
│  • Avatar, Title, Subtitle                  │
├─────────────────────────────────────────────┤
│                                             │
│  Message List                               │
│  • Welcome message                          │
│  • User messages                            │
│  • AI responses (streaming)                 │
│  • Typing indicators                        │
│  • Tool usage display                       │
│                                             │
├─────────────────────────────────────────────┤
│  Input Area                                 │
│  [📎] [textarea          ] [🎤] [➤]        │
├─────────────────────────────────────────────┤
│  Powered by Buzzi                           │
└─────────────────────────────────────────────┘
```

### 24.7 Implement Message List

**File:** `packages/chat-widget/src/components/message-list.ts`

**Message Types:**
- User messages (right-aligned, primary color)
- AI messages (left-aligned, neutral background)
- System messages (centered, muted)
- Typing indicator (animated dots)
- Tool execution indicator

**Features:**
- Auto-scroll to new messages
- Markdown rendering
- Code block syntax highlighting
- Link previews
- Image thumbnails
- Timestamp display

### 24.8 Implement Streaming Response Display

**File:** `packages/chat-widget/src/components/message.ts`

**SSE Event Handling:**
```typescript
private connectSSE(): void {
  this.sseConnection = new EventSource(
    `${API_URL}/chat/${this.session!.sessionId}/stream`
  );

  this.sseConnection.addEventListener('thinking', (e) => {
    const data = JSON.parse(e.data);
    this.showThinking(data.step);
  });

  this.sseConnection.addEventListener('delta', (e) => {
    const data = JSON.parse(e.data);
    this.appendToResponse(data.content);
  });

  this.sseConnection.addEventListener('complete', (e) => {
    const data = JSON.parse(e.data);
    this.finalizeResponse(data);
    this.sseConnection?.close();
  });

  this.sseConnection.addEventListener('error', (e) => {
    this.showError('Connection error. Please try again.');
  });
}
```

### 24.9 Implement File Upload

**File:** `packages/chat-widget/src/components/file-upload.ts`

**Supported Types:**
| Type | Extensions | Processing |
|------|------------|------------|
| Images | JPG, PNG, GIF, WebP | Vision API analysis |
| Documents | PDF, DOCX, TXT, MD | Text extraction |
| Spreadsheets | CSV, XLSX | Data extraction |
| Audio | MP3, WAV, OGG, WebM | Whisper transcription |

**Features:**
- Drag and drop support
- File type validation
- File size validation (max 10MB)
- Upload progress indicator
- Preview before send
- Virus scanning

### 24.10 Implement Voice Input (Push-to-Talk)

**File:** `packages/chat-widget/src/components/voice-input.ts`

**Architecture:**
```
   User Speech              Recording              Transcription           Response
       │                       │                        │                      │
       ▼                       ▼                        ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ Hold PTT      │─────▶│ MediaRecorder │─────▶│ Whisper API   │─────▶│ AI Response   │
│ Button        │      │ (Opus/WebM)   │      │ Transcription │      │               │
└───────────────┘      └───────────────┘      └───────────────┘      └───────────────┘
```

**Features:**
- Push-to-talk button
- Recording duration display
- Audio visualization (waveform)
- Keyboard accessibility (hold Space)
- Mobile touch support
- Maximum duration limit (60s)

### 24.11 Implement Theming System

**File:** `packages/chat-widget/src/styles/variables.css`

**CSS Custom Properties:**
```css
:host {
  /* Colors */
  --buzzi-primary: var(--buzzi-user-primary, #007bff);
  --buzzi-background: var(--buzzi-user-bg, #ffffff);
  --buzzi-surface: var(--buzzi-user-surface, #f8f9fa);
  --buzzi-text: var(--buzzi-user-text, #212529);
  --buzzi-text-muted: var(--buzzi-user-text-muted, #6c757d);
  --buzzi-border: var(--buzzi-user-border, #dee2e6);

  /* Dark theme */
  --buzzi-dark-background: #1a1a2e;
  --buzzi-dark-surface: #16213e;
  --buzzi-dark-text: #eaeaea;

  /* Sizing */
  --buzzi-width: 380px;
  --buzzi-height: 600px;
  --buzzi-launcher-size: 60px;
  --buzzi-border-radius: 16px;

  /* Typography */
  --buzzi-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --buzzi-font-size: 14px;
}

/* Dark theme */
:host([data-theme="dark"]) {
  --buzzi-background: var(--buzzi-dark-background);
  --buzzi-surface: var(--buzzi-dark-surface);
  --buzzi-text: var(--buzzi-dark-text);
}

/* Auto theme (system preference) */
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) {
    --buzzi-background: var(--buzzi-dark-background);
    --buzzi-surface: var(--buzzi-dark-surface);
    --buzzi-text: var(--buzzi-dark-text);
  }
}
```

### 24.12 Implement Widget SDK API

**Global API:**
```typescript
interface ChatWidgetAPI {
  // Lifecycle
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;

  // Messaging
  sendMessage(content: string): Promise<void>;
  clearHistory(): void;

  // Customer context
  setCustomer(customer: CustomerInfo): void;
  setMetadata(key: string, value: unknown): void;

  // Events
  on(event: WidgetEvent, callback: EventCallback): void;
  off(event: WidgetEvent, callback: EventCallback): void;

  // State
  isOpen(): boolean;
  getConversationId(): string | null;
}

type WidgetEvent =
  | 'open'
  | 'close'
  | 'message:sent'
  | 'message:received'
  | 'handover:started'
  | 'handover:ended'
  | 'error';
```

### 24.13 Implement Accessibility

**ARIA Attributes:**
```html
<div class="buzzi-chat-window"
     role="dialog"
     aria-label="Chat with support"
     aria-hidden="true">

  <div class="buzzi-messages"
       role="log"
       aria-live="polite"
       aria-atomic="false">
  </div>

  <textarea class="buzzi-input"
            aria-label="Type your message"
            placeholder="Type a message...">
  </textarea>
</div>

<button class="buzzi-launcher"
        role="button"
        aria-label="Open chat"
        aria-haspopup="dialog"
        aria-expanded="false">
</button>
```

**Keyboard Navigation:**
- `Escape` - Close widget
- `Enter` - Send message
- `Shift+Enter` - New line
- `Tab` - Focus trap within dialog

### 24.14 Implement Security

**Domain Allowlisting:**
```typescript
// Server-side validation
export async function validateWidgetOrigin(
  companyId: string,
  agentId: string,
  origin: string
): Promise<boolean> {
  const config = await db.query.widgetConfigs.findFirst({
    where: and(
      eq(widgetConfigs.companyId, companyId),
      eq(widgetConfigs.agentId, agentId)
    ),
  });

  const allowedDomains = config.allowedDomains as string[];

  // Wildcard subdomain support: *.example.com
  const originHostname = new URL(origin).hostname;
  return allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      const baseDomain = domain.slice(2);
      return originHostname === baseDomain ||
             originHostname.endsWith('.' + baseDomain);
    }
    return originHostname === domain;
  });
}
```

**Subresource Integrity:**
```html
<script
  src="https://cdn.buzzi.ai/widget/v1/chat.min.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 24.15 Implement Mobile Responsive Design

**Mobile Styles:**
```css
@media (max-width: 480px) {
  .buzzi-chat-window {
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    height: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .buzzi-launcher {
    bottom: 16px;
    right: 16px;
  }
}
```

### 24.16 Build & Bundle Configuration

**Vite Config:**
```typescript
// packages/chat-widget/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BuzziChatWidget',
      fileName: 'chat',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    target: 'es2015',
  },
});
```

**Bundle Size Targets:**
```
Widget Bundle Size:
├── chat.min.js         < 50KB gzipped
├── chat.min.css        < 10KB gzipped
└── Total               < 60KB gzipped
```

---

## React Integration Package

**File:** `packages/chat-widget-react/`

```tsx
import { ChatWidget, useChatWidget } from '@buzzi/chat-widget-react';

function App() {
  const { open, close, sendMessage } = useChatWidget();

  return (
    <>
      <ChatWidget
        agentId="a_xyz789"
        companyId="c_abc123"
        theme="light"
        position="bottom-right"
        customer={{
          id: user.id,
          name: user.name,
          email: user.email,
        }}
        onMessage={(message) => {
          analytics.track('chat_message', { type: message.role });
        }}
      />

      <button onClick={open}>Open Chat</button>
    </>
  );
}
```

---

## Validation Checklist

- [ ] Widget loads correctly on external websites
- [ ] Shadow DOM isolates styles properly
- [ ] Launcher button displays and animates
- [ ] Chat window opens/closes smoothly
- [ ] Messages display with proper formatting
- [ ] Streaming responses work correctly
- [ ] File upload works for all supported types
- [ ] Voice input records and transcribes
- [ ] Theming (light/dark/auto) works
- [ ] Mobile responsive design works
- [ ] Keyboard accessibility works
- [ ] Screen reader compatible
- [ ] Domain allowlisting enforced
- [ ] Bundle size under 60KB gzipped
- [ ] Works in Chrome, Firefox, Safari, Edge

---

## File Structure

```
packages/
└── chat-widget/
    ├── src/
    │   ├── index.ts
    │   ├── widget.ts
    │   ├── components/
    │   │   ├── launcher.ts
    │   │   ├── chat-window.ts
    │   │   ├── header.ts
    │   │   ├── message-list.ts
    │   │   ├── message.ts
    │   │   ├── input-area.ts
    │   │   ├── file-upload.ts
    │   │   ├── voice-input.ts
    │   │   └── typing-indicator.ts
    │   ├── services/
    │   │   ├── api.ts
    │   │   ├── session.ts
    │   │   ├── sse.ts
    │   │   └── storage.ts
    │   ├── styles/
    │   │   ├── variables.css
    │   │   ├── widget.css
    │   │   ├── launcher.css
    │   │   ├── messages.css
    │   │   └── voice.css
    │   ├── utils/
    │   │   ├── markdown.ts
    │   │   ├── event-emitter.ts
    │   │   └── dom.ts
    │   └── types.ts
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

---

## Next Step
[Step 25 - Testing & Deployment](./step-25-testing-deployment.md)

---

## Related Documentation
- [Architecture: Chat Widget](../architecture-chat-widget.md)
- [Step 16 - Widget Customizer](./step-16-widget-customizer.md)
