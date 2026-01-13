# Architecture: Chat Widget

## Overview

This document details the architecture of the embeddable chat widget. The widget is a lightweight, customizable JavaScript application that can be embedded on any website to provide AI-powered chat functionality.

---

## 1. Widget Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CHAT WIDGET ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────────┘

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
│  │  │  │  │  Header (branding, minimize, close)                      │  │  │ │ │
│  │  │  │  ├─────────────────────────────────────────────────────────┤  │  │ │ │
│  │  │  │  │  Message List                                           │  │  │ │ │
│  │  │  │  │  • User messages                                        │  │  │ │ │
│  │  │  │  │  • AI responses (streaming)                             │  │  │ │ │
│  │  │  │  │  • Typing indicators                                    │  │  │ │ │
│  │  │  │  │  • Tool usage display                                   │  │  │ │ │
│  │  │  │  ├─────────────────────────────────────────────────────────┤  │  │ │ │
│  │  │  │  │  Input Area                                             │  │  │ │ │
│  │  │  │  │  • Text input                                           │  │  │ │ │
│  │  │  │  │  • File upload                                          │  │  │ │ │
│  │  │  │  │  • Voice input (PTT)                                    │  │  │ │ │
│  │  │  │  │  • Emoji picker                                         │  │  │ │ │
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

---

## 2. Embed Code

### 2.1 Standard Embed

```html
<!-- Chat Widget Embed Code -->
<script>
  window.CHATBOT_CONFIG = {
    // Required
    agentId: "a_xyz789",
    companyId: "c_abc123",

    // Appearance
    theme: "light",                    // "light" | "dark" | "auto"
    position: "bottom-right",          // "bottom-right" | "bottom-left"
    primaryColor: "#007bff",

    // Branding
    title: "Support Chat",
    subtitle: "We typically reply within minutes",
    avatarUrl: "https://example.com/avatar.png",

    // Behavior
    autoOpen: false,
    autoOpenDelay: 5000,               // ms
    showBranding: true,

    // Features
    enableVoice: false,
    enableFileUpload: true,
    enableEmoji: true,

    // Localization
    locale: "en",

    // Customer context (optional)
    customer: {
      id: "user_123",
      name: "John Doe",
      email: "john@example.com",
      metadata: {
        plan: "premium",
        signupDate: "2024-01-15"
      }
    }
  };
</script>
<script
  src="https://cdn.buzzi.ai/widget/v1/chat.min.js"
  async
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 2.2 Dynamic Configuration

```html
<script>
  // Load widget dynamically after user action
  function loadChatWidget(userContext) {
    window.CHATBOT_CONFIG = {
      agentId: "a_xyz789",
      companyId: "c_abc123",
      customer: userContext
    };

    const script = document.createElement('script');
    script.src = "https://cdn.buzzi.ai/widget/v1/chat.min.js";
    script.async = true;
    document.body.appendChild(script);
  }
</script>
```

---

## 3. Widget SDK

### 3.1 JavaScript API

```typescript
// Global API exposed by the widget
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

// Usage example
window.ChatWidget.on('message:received', (message) => {
  console.log('New message:', message);
});

window.ChatWidget.open();
```

### 3.2 React Integration

```tsx
// @buzzi/chat-widget-react
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

## 4. Widget Implementation

### 4.1 Core Structure

```typescript
// src/widget/index.ts

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

  private render(): void {
    const root = document.createElement('div');
    root.className = 'buzzi-widget-root';
    root.innerHTML = this.getTemplate();
    this.shadow.appendChild(root);

    // Bind event handlers
    this.bindEvents();
  }

  private getTemplate(): string {
    return `
      <div class="buzzi-launcher" role="button" aria-label="Open chat">
        <svg class="buzzi-launcher-icon">...</svg>
      </div>

      <div class="buzzi-chat-window" role="dialog" aria-hidden="true">
        <div class="buzzi-header">
          <div class="buzzi-header-info">
            <img class="buzzi-avatar" src="${this.config.avatarUrl}" alt="" />
            <div class="buzzi-header-text">
              <div class="buzzi-title">${this.config.title}</div>
              <div class="buzzi-subtitle">${this.config.subtitle}</div>
            </div>
          </div>
          <button class="buzzi-close" aria-label="Close chat">
            <svg>...</svg>
          </button>
        </div>

        <div class="buzzi-messages" role="log" aria-live="polite">
          <div class="buzzi-welcome">
            ${this.config.welcomeMessage ?? 'How can we help you today?'}
          </div>
        </div>

        <div class="buzzi-input-area">
          <div class="buzzi-input-container">
            ${this.config.enableFileUpload ? '<button class="buzzi-attach">...</button>' : ''}
            <textarea
              class="buzzi-input"
              placeholder="${this.config.placeholderText ?? 'Type a message...'}"
              rows="1"
            ></textarea>
            ${this.config.enableVoice ? '<button class="buzzi-voice">...</button>' : ''}
            <button class="buzzi-send" disabled>
              <svg>...</svg>
            </button>
          </div>
        </div>

        ${this.config.showBranding ? `
          <div class="buzzi-branding">
            Powered by <a href="https://buzzi.ai" target="_blank">Buzzi</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  async open(): Promise<void> {
    const window = this.shadow.querySelector('.buzzi-chat-window');
    window?.setAttribute('aria-hidden', 'false');
    window?.classList.add('buzzi-open');
    this.eventEmitter.emit('open');

    // Start session if needed
    if (!this.session) {
      await this.startSession();
    }
  }

  close(): void {
    const window = this.shadow.querySelector('.buzzi-chat-window');
    window?.setAttribute('aria-hidden', 'true');
    window?.classList.remove('buzzi-open');
    this.eventEmitter.emit('close');
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.session) {
      await this.startSession();
    }

    // Add message to UI immediately
    this.addMessage({ role: 'user', content });

    // Send to server
    await fetch(`${API_URL}/chat/${this.session!.sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    // Connect SSE for response
    this.connectSSE();
  }

  private async startSession(): Promise<void> {
    const response = await fetch(`${API_URL}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: this.config.companyId,
        agentId: this.config.agentId,
        customer: this.config.customer,
      }),
    });

    const { sessionToken, conversationId } = await response.json();

    this.session = {
      sessionId: sessionToken,
      conversationId,
    };

    // Persist session
    localStorage.setItem('buzzi_session', JSON.stringify(this.session));
  }

  private connectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
    }

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
      console.error('SSE error:', e);
      this.showError('Connection error. Please try again.');
    });
  }

  private addMessage(message: { role: string; content: string }): void {
    const messagesContainer = this.shadow.querySelector('.buzzi-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `buzzi-message buzzi-message-${message.role}`;
    messageEl.innerHTML = this.renderMessage(message);
    messagesContainer?.appendChild(messageEl);
    messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight });
  }

  private renderMessage(message: { content: string }): string {
    // Render markdown
    return marked.parse(message.content, {
      gfm: true,
      breaks: true,
    });
  }

  private exposeAPI(): void {
    (window as any).ChatWidget = {
      open: () => this.open(),
      close: () => this.close(),
      toggle: () => this.isOpen() ? this.close() : this.open(),
      destroy: () => this.destroy(),
      sendMessage: (content: string) => this.sendMessage(content),
      setCustomer: (customer: CustomerInfo) => this.setCustomer(customer),
      on: (event: string, callback: Function) => this.eventEmitter.on(event, callback),
      off: (event: string, callback: Function) => this.eventEmitter.off(event, callback),
      isOpen: () => this.isOpen(),
      getConversationId: () => this.session?.conversationId ?? null,
    };
  }
}

// Initialize on load
if (typeof window !== 'undefined' && window.CHATBOT_CONFIG) {
  new BuzziChatWidget(window.CHATBOT_CONFIG);
}
```

---

## 5. Styling System

### 5.1 CSS Custom Properties

```css
/* src/widget/styles/variables.css */

:host {
  /* Colors */
  --buzzi-primary: var(--buzzi-user-primary, #007bff);
  --buzzi-primary-hover: color-mix(in srgb, var(--buzzi-primary) 85%, black);
  --buzzi-background: var(--buzzi-user-bg, #ffffff);
  --buzzi-surface: var(--buzzi-user-surface, #f8f9fa);
  --buzzi-text: var(--buzzi-user-text, #212529);
  --buzzi-text-muted: var(--buzzi-user-text-muted, #6c757d);
  --buzzi-border: var(--buzzi-user-border, #dee2e6);

  /* Dark theme */
  --buzzi-dark-background: #1a1a2e;
  --buzzi-dark-surface: #16213e;
  --buzzi-dark-text: #eaeaea;
  --buzzi-dark-text-muted: #a0a0a0;
  --buzzi-dark-border: #2a2a4a;

  /* Sizing */
  --buzzi-width: 380px;
  --buzzi-height: 600px;
  --buzzi-launcher-size: 60px;
  --buzzi-border-radius: 16px;
  --buzzi-message-radius: 18px;

  /* Typography */
  --buzzi-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --buzzi-font-size: 14px;
  --buzzi-line-height: 1.5;

  /* Shadows */
  --buzzi-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  --buzzi-shadow-hover: 0 6px 32px rgba(0, 0, 0, 0.2);

  /* Animation */
  --buzzi-transition: 200ms ease;
}

/* Dark theme overrides */
:host([data-theme="dark"]) {
  --buzzi-background: var(--buzzi-dark-background);
  --buzzi-surface: var(--buzzi-dark-surface);
  --buzzi-text: var(--buzzi-dark-text);
  --buzzi-text-muted: var(--buzzi-dark-text-muted);
  --buzzi-border: var(--buzzi-dark-border);
}

/* Auto theme (system preference) */
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) {
    --buzzi-background: var(--buzzi-dark-background);
    --buzzi-surface: var(--buzzi-dark-surface);
    --buzzi-text: var(--buzzi-dark-text);
    --buzzi-text-muted: var(--buzzi-dark-text-muted);
    --buzzi-border: var(--buzzi-dark-border);
  }
}
```

### 5.2 Widget Styles

```css
/* src/widget/styles/widget.css */

.buzzi-widget-root {
  font-family: var(--buzzi-font-family);
  font-size: var(--buzzi-font-size);
  line-height: var(--buzzi-line-height);
  color: var(--buzzi-text);
}

/* Launcher Button */
.buzzi-launcher {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: var(--buzzi-launcher-size);
  height: var(--buzzi-launcher-size);
  border-radius: 50%;
  background: var(--buzzi-primary);
  box-shadow: var(--buzzi-shadow);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--buzzi-transition), box-shadow var(--buzzi-transition);
  z-index: 999998;
}

.buzzi-launcher:hover {
  transform: scale(1.05);
  box-shadow: var(--buzzi-shadow-hover);
}

/* Chat Window */
.buzzi-chat-window {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: var(--buzzi-width);
  height: var(--buzzi-height);
  max-height: calc(100vh - 120px);
  background: var(--buzzi-background);
  border-radius: var(--buzzi-border-radius);
  box-shadow: var(--buzzi-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 999999;
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  pointer-events: none;
  transition: opacity var(--buzzi-transition), transform var(--buzzi-transition);
}

.buzzi-chat-window.buzzi-open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

/* Header */
.buzzi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--buzzi-primary);
  color: white;
}

/* Messages */
.buzzi-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.buzzi-message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: var(--buzzi-message-radius);
  word-wrap: break-word;
}

.buzzi-message-user {
  align-self: flex-end;
  background: var(--buzzi-primary);
  color: white;
  border-bottom-right-radius: 4px;
}

.buzzi-message-assistant {
  align-self: flex-start;
  background: var(--buzzi-surface);
  color: var(--buzzi-text);
  border-bottom-left-radius: 4px;
}

/* Typing Indicator */
.buzzi-typing {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.buzzi-typing-dot {
  width: 8px;
  height: 8px;
  background: var(--buzzi-text-muted);
  border-radius: 50%;
  animation: buzzi-bounce 1.4s infinite ease-in-out;
}

.buzzi-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.buzzi-typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes buzzi-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

/* Input Area */
.buzzi-input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--buzzi-border);
}

.buzzi-input-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--buzzi-surface);
  border-radius: 24px;
  padding: 8px 16px;
}

.buzzi-input {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
  color: var(--buzzi-text);
  max-height: 120px;
}

/* Mobile Responsive */
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

---

## 6. Security

### 6.1 Domain Allowlisting

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

  if (!config) {
    return false;
  }

  const allowedDomains = config.allowedDomains as string[];

  // Empty array means all domains allowed
  if (allowedDomains.length === 0) {
    return true;
  }

  const originHostname = new URL(origin).hostname;
  return allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      // Wildcard subdomain
      const baseDomain = domain.slice(2);
      return originHostname === baseDomain ||
             originHostname.endsWith('.' + baseDomain);
    }
    return originHostname === domain;
  });
}
```

### 6.2 Content Security Policy

```typescript
// Widget loader enforces CSP
const widgetCSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'cdn.buzzi.ai'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'connect-src': ["'self'", 'api.buzzi.ai', 'wss://api.buzzi.ai'],
  'img-src': ["'self'", 'data:', 'blob:', '*'],
  'media-src': ["'self'", 'blob:'],
  'frame-ancestors': ['*'], // Allow embedding
};
```

### 6.3 Subresource Integrity

```html
<!-- Widget script with SRI -->
<script
  src="https://cdn.buzzi.ai/widget/v1/chat.min.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

---

## 7. Performance

### 7.1 Loading Strategy

```typescript
// Lazy load widget after page load
function loadWidget() {
  if (document.readyState === 'complete') {
    initWidget();
  } else {
    window.addEventListener('load', initWidget);
  }
}

function initWidget() {
  // Use requestIdleCallback for non-critical initialization
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      new BuzziChatWidget(window.CHATBOT_CONFIG);
    });
  } else {
    setTimeout(() => {
      new BuzziChatWidget(window.CHATBOT_CONFIG);
    }, 100);
  }
}
```

### 7.2 Bundle Optimization

```
Widget Bundle Size Targets:
├── chat.min.js         < 50KB gzipped
├── chat.min.css        < 10KB gzipped
└── Total               < 60KB gzipped

Dependencies:
├── Preact              ~4KB (React alternative)
├── marked              ~8KB (Markdown)
├── EventEmitter        ~2KB
└── Core logic          ~30KB
```

### 7.3 Caching

```typescript
// Service worker for offline support
const CACHE_NAME = 'buzzi-widget-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/widget/v1/chat.min.js',
        '/widget/v1/chat.min.css',
      ]);
    })
  );
});
```

---

## 8. Accessibility

### 8.1 ARIA Attributes

```html
<div class="buzzi-chat-window"
     role="dialog"
     aria-label="Chat with support"
     aria-hidden="true">

  <div class="buzzi-messages"
       role="log"
       aria-live="polite"
       aria-atomic="false">
    <!-- Messages announced as they arrive -->
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

### 8.2 Keyboard Navigation

```typescript
// Keyboard handling
bindKeyboardEvents(): void {
  this.shadow.addEventListener('keydown', (e: KeyboardEvent) => {
    // Escape closes widget
    if (e.key === 'Escape' && this.isOpen()) {
      this.close();
    }

    // Enter sends message (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      const input = e.target as HTMLTextAreaElement;
      if (input.classList.contains('buzzi-input')) {
        e.preventDefault();
        this.sendMessage(input.value);
        input.value = '';
      }
    }
  });

  // Focus trap within dialog
  this.shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && this.isOpen()) {
      trapFocus(e, this.shadow.querySelector('.buzzi-chat-window'));
    }
  });
}
```

---

## 9. File Upload Processing

### 9.1 File Upload Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     CONVERSATION FILE UPLOAD PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

   User Upload         Validation          AI Analysis         Context Injection
       │                   │                    │                     │
       ▼                   ▼                    ▼                     ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ Select File   │─▶│ Validate      │─▶│ Process Content   │─▶│ Inject into       │
│ (drag/drop    │  │ • Type        │  │ • Vision API      │  │ Conversation      │
│  or click)    │  │ • Size        │  │ • Text Extraction │  │ Context           │
└───────────────┘  │ • Virus scan  │  │ • Audio → Text    │  └───────────────────┘
                   └───────────────┘  └───────────────────┘

  SUPPORTED FILE TYPES:
  ─────────────────────────────────────────────────────────────────────────────────
  Images       │ JPG, PNG, GIF, WebP        │ Vision API analysis
  Documents    │ PDF, DOCX, TXT, MD         │ Text extraction + summarization
  Spreadsheets │ CSV, XLSX                  │ Data extraction + analysis
  Audio        │ MP3, WAV, OGG, WebM        │ Whisper transcription
```

### 9.2 File Upload Service

```typescript
// src/services/chat/file-upload.ts

interface FileUploadConfig {
  maxFileSize: number;        // bytes (default: 10MB)
  allowedTypes: string[];     // MIME types
  scanForVirus: boolean;
  companyId: string;
  conversationId: string;
}

interface ProcessedFile {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageUrl: string;
  analysis: FileAnalysis;
}

interface FileAnalysis {
  type: 'image' | 'document' | 'spreadsheet' | 'audio';
  extractedText?: string;
  description?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export class ConversationFileUploadService {
  private storage: StorageService;
  private openai: OpenAI;

  constructor() {
    this.storage = new StorageService();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async processUpload(
    file: Buffer,
    filename: string,
    mimeType: string,
    config: FileUploadConfig
  ): Promise<ProcessedFile> {
    // 1. Validate file
    await this.validateFile(file, filename, mimeType, config);

    // 2. Upload to storage
    const fileId = crypto.randomUUID();
    const storagePath = `conversations/${config.conversationId}/uploads/${fileId}/${filename}`;
    const storageUrl = await this.storage.upload(storagePath, file, {
      contentType: mimeType,
      metadata: { originalName: filename },
    });

    // 3. Process and analyze file
    const analysis = await this.analyzeFile(file, mimeType, filename);

    // 4. Store metadata
    await this.storeFileMetadata(fileId, config, {
      originalName: filename,
      mimeType,
      size: file.length,
      storageUrl,
      analysis,
    });

    return {
      fileId,
      originalName: filename,
      mimeType,
      size: file.length,
      storageUrl,
      analysis,
    };
  }

  private async validateFile(
    file: Buffer,
    filename: string,
    mimeType: string,
    config: FileUploadConfig
  ): Promise<void> {
    // Check file size
    if (file.length > config.maxFileSize) {
      throw new FileUploadError(
        `File too large. Maximum size is ${formatBytes(config.maxFileSize)}`
      );
    }

    // Check file type
    if (!config.allowedTypes.includes(mimeType)) {
      throw new FileUploadError(
        `File type not allowed. Allowed types: ${config.allowedTypes.join(', ')}`
      );
    }

    // Virus scan (if enabled)
    if (config.scanForVirus) {
      const isSafe = await this.scanForVirus(file);
      if (!isSafe) {
        throw new FileUploadError('File failed security scan');
      }
    }

    // Verify file magic bytes match MIME type
    const detectedType = await fileType.fromBuffer(file);
    if (detectedType && detectedType.mime !== mimeType) {
      throw new FileUploadError('File type mismatch');
    }
  }

  private async analyzeFile(
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<FileAnalysis> {
    // Route to appropriate analyzer based on file type
    if (mimeType.startsWith('image/')) {
      return this.analyzeImage(file);
    }

    if (mimeType === 'application/pdf') {
      return this.analyzePDF(file);
    }

    if (mimeType.includes('word') || mimeType.includes('document')) {
      return this.analyzeDocument(file, mimeType);
    }

    if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') {
      return this.analyzeSpreadsheet(file, mimeType);
    }

    if (mimeType.startsWith('audio/')) {
      return this.analyzeAudio(file);
    }

    if (mimeType.startsWith('text/')) {
      return this.analyzeText(file);
    }

    throw new FileUploadError(`Unsupported file type: ${mimeType}`);
  }

  private async analyzeImage(file: Buffer): Promise<FileAnalysis> {
    // Use OpenAI Vision API for image analysis
    const base64Image = file.toString('base64');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image and provide:
              1. A brief description of what's shown
              2. Any text visible in the image (OCR)
              3. Key details relevant to customer support context

              Format as JSON with keys: description, extractedText, keyDetails`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const analysisText = response.choices[0].message.content;
    const analysis = JSON.parse(analysisText || '{}');

    return {
      type: 'image',
      description: analysis.description,
      extractedText: analysis.extractedText,
      metadata: {
        keyDetails: analysis.keyDetails,
      },
    };
  }

  private async analyzePDF(file: Buffer): Promise<FileAnalysis> {
    // Extract text from PDF
    const pdfData = await pdfParse(file);
    const text = pdfData.text;

    // Generate summary if text is long
    let summary: string | undefined;
    if (text.length > 2000) {
      summary = await this.generateSummary(text);
    }

    return {
      type: 'document',
      extractedText: text.slice(0, 10000), // Limit for context window
      summary,
      metadata: {
        pageCount: pdfData.numpages,
        wordCount: text.split(/\s+/).length,
      },
    };
  }

  private async analyzeDocument(file: Buffer, mimeType: string): Promise<FileAnalysis> {
    let text: string;

    if (mimeType.includes('word')) {
      // Extract text from DOCX
      const result = await mammoth.extractRawText({ buffer: file });
      text = result.value;
    } else {
      text = file.toString('utf-8');
    }

    let summary: string | undefined;
    if (text.length > 2000) {
      summary = await this.generateSummary(text);
    }

    return {
      type: 'document',
      extractedText: text.slice(0, 10000),
      summary,
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    };
  }

  private async analyzeSpreadsheet(file: Buffer, mimeType: string): Promise<FileAnalysis> {
    let data: unknown[][];

    if (mimeType === 'text/csv') {
      // Parse CSV
      data = await csv.parse(file.toString('utf-8'));
    } else {
      // Parse Excel
      const workbook = xlsx.read(file, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      data = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });
    }

    // Convert to readable format
    const headers = data[0] as string[];
    const rows = data.slice(1, 11); // First 10 data rows
    const preview = this.formatTablePreview(headers, rows);

    return {
      type: 'spreadsheet',
      extractedText: preview,
      description: `Spreadsheet with ${data.length - 1} rows and ${headers.length} columns`,
      metadata: {
        headers,
        rowCount: data.length - 1,
        columnCount: headers.length,
      },
    };
  }

  private async analyzeAudio(file: Buffer): Promise<FileAnalysis> {
    // Transcribe audio using Whisper
    const transcription = await this.openai.audio.transcriptions.create({
      file: new File([file], 'audio.webm', { type: 'audio/webm' }),
      model: 'whisper-1',
      language: 'en', // Auto-detect if not specified
    });

    return {
      type: 'audio',
      extractedText: transcription.text,
      description: 'Audio transcription',
      metadata: {
        duration: await this.getAudioDuration(file),
      },
    };
  }

  private async generateSummary(text: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize the following document in 2-3 sentences, focusing on key information relevant to customer support.',
        },
        { role: 'user', content: text.slice(0, 10000) },
      ],
      max_tokens: 200,
    });

    return response.choices[0].message.content || '';
  }

  private formatTablePreview(headers: string[], rows: unknown[][]): string {
    let preview = `Columns: ${headers.join(', ')}\n\nFirst ${rows.length} rows:\n`;
    for (const row of rows) {
      preview += `- ${(row as unknown[]).join(' | ')}\n`;
    }
    return preview;
  }
}
```

### 9.3 Context Injection

```typescript
// src/services/chat/context-injection.ts

export function injectFileContext(
  conversationContext: ConversationContext,
  processedFile: ProcessedFile
): ConversationContext {
  const fileContext = buildFileContext(processedFile);

  return {
    ...conversationContext,
    attachments: [
      ...(conversationContext.attachments ?? []),
      {
        fileId: processedFile.fileId,
        type: processedFile.analysis.type,
        name: processedFile.originalName,
      },
    ],
    systemContext: `${conversationContext.systemContext ?? ''}

[User uploaded a file: ${processedFile.originalName}]
${fileContext}`,
  };
}

function buildFileContext(file: ProcessedFile): string {
  const { analysis } = file;

  switch (analysis.type) {
    case 'image':
      return `
Image Analysis:
- Description: ${analysis.description}
${analysis.extractedText ? `- Text in image: ${analysis.extractedText}` : ''}
${analysis.metadata?.keyDetails ? `- Key details: ${JSON.stringify(analysis.metadata.keyDetails)}` : ''}`;

    case 'document':
      return `
Document Content:
${analysis.summary ? `Summary: ${analysis.summary}\n` : ''}
Content: ${analysis.extractedText?.slice(0, 3000)}${(analysis.extractedText?.length ?? 0) > 3000 ? '...[truncated]' : ''}`;

    case 'spreadsheet':
      return `
Spreadsheet Analysis:
- ${analysis.description}
- Preview:
${analysis.extractedText}`;

    case 'audio':
      return `
Audio Transcription:
${analysis.extractedText}`;

    default:
      return `File: ${file.originalName}`;
  }
}
```

### 9.4 Widget File Upload UI

```typescript
// src/widget/components/FileUpload.ts

export class FileUploadComponent {
  private config: WidgetConfig;
  private onUpload: (file: ProcessedFile) => void;

  constructor(config: WidgetConfig, onUpload: (file: ProcessedFile) => void) {
    this.config = config;
    this.onUpload = onUpload;
  }

  render(): string {
    return `
      <div class="buzzi-file-upload">
        <input
          type="file"
          class="buzzi-file-input"
          accept="${this.getAllowedTypes()}"
          hidden
        />
        <button class="buzzi-attach-btn" aria-label="Attach file">
          <svg><!-- paperclip icon --></svg>
        </button>
        <div class="buzzi-file-preview" hidden>
          <span class="buzzi-file-name"></span>
          <button class="buzzi-file-remove" aria-label="Remove file">×</button>
        </div>
        <div class="buzzi-upload-progress" hidden>
          <div class="buzzi-progress-bar"></div>
        </div>
      </div>
    `;
  }

  bindEvents(container: HTMLElement): void {
    const input = container.querySelector('.buzzi-file-input') as HTMLInputElement;
    const attachBtn = container.querySelector('.buzzi-attach-btn');

    attachBtn?.addEventListener('click', () => input.click());

    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.handleFileSelect(file, container);
      }
    });

    // Drag and drop
    const messagesArea = container.querySelector('.buzzi-messages');
    messagesArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      messagesArea.classList.add('buzzi-drag-over');
    });

    messagesArea?.addEventListener('drop', async (e) => {
      e.preventDefault();
      messagesArea.classList.remove('buzzi-drag-over');
      const file = (e as DragEvent).dataTransfer?.files?.[0];
      if (file) {
        await this.handleFileSelect(file, container);
      }
    });
  }

  private async handleFileSelect(file: File, container: HTMLElement): Promise<void> {
    // Show preview
    this.showFilePreview(file, container);

    // Show progress
    const progressBar = container.querySelector('.buzzi-upload-progress');
    progressBar?.removeAttribute('hidden');

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/chat/${this.config.sessionId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const processedFile = await response.json();
      this.onUpload(processedFile);
    } catch (error) {
      this.showError('Failed to upload file', container);
    } finally {
      progressBar?.setAttribute('hidden', '');
    }
  }

  private getAllowedTypes(): string {
    return [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    ].join(',');
  }
}
```

---

## 10. Push-to-Talk Voice Support

### 10.1 Voice Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        VOICE PROCESSING PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

   User Speech              Recording              Transcription           Response
       │                       │                        │                      │
       ▼                       ▼                        ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ Hold PTT      │─────▶│ MediaRecorder │─────▶│ Whisper API   │─────▶│ AI Response   │
│ Button        │      │ (Opus/WebM)   │      │ Transcription │      │               │
└───────────────┘      └───────────────┘      └───────────────┘      └───────┬───────┘
                                                                              │
                                                                              ▼
                                                                      ┌───────────────┐
                                                                      │ TTS Response  │
                                                                      │ (Optional)    │
                                                                      └───────────────┘

  VOICE FLOW:
  ─────────────────────────────────────────────────────────────────────────────────
  1. User presses and holds PTT button
  2. MediaRecorder captures audio (Opus codec in WebM container)
  3. On release, audio blob sent to server
  4. Server transcribes via Whisper API
  5. Transcription injected as user message
  6. AI response generated
  7. (Optional) Response converted to speech via TTS
```

### 10.2 Voice Recording Component

```typescript
// src/widget/components/VoiceInput.ts

interface VoiceInputConfig {
  maxDuration: number;       // Maximum recording duration (ms)
  sampleRate: number;        // Audio sample rate
  enableTTS: boolean;        // Enable text-to-speech responses
}

export class VoiceInputComponent {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private recordingTimeout: number | null = null;
  private config: VoiceInputConfig;
  private onTranscription: (text: string) => void;

  constructor(
    config: VoiceInputConfig,
    onTranscription: (text: string) => void
  ) {
    this.config = {
      maxDuration: 60000,    // 60 seconds max
      sampleRate: 16000,
      enableTTS: false,
      ...config,
    };
    this.onTranscription = onTranscription;
  }

  render(): string {
    return `
      <div class="buzzi-voice-input">
        <button
          class="buzzi-ptt-btn"
          aria-label="Push to talk"
          aria-pressed="false"
        >
          <svg class="buzzi-mic-icon">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <svg class="buzzi-recording-icon" hidden>
            <circle cx="12" cy="12" r="6" fill="red">
              <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </button>
        <div class="buzzi-voice-indicator" hidden>
          <div class="buzzi-voice-wave"></div>
          <span class="buzzi-voice-duration">0:00</span>
        </div>
        <div class="buzzi-voice-status" aria-live="polite"></div>
      </div>
    `;
  }

  bindEvents(container: HTMLElement): void {
    const pttBtn = container.querySelector('.buzzi-ptt-btn') as HTMLButtonElement;

    // Mouse events
    pttBtn.addEventListener('mousedown', () => this.startRecording(container));
    pttBtn.addEventListener('mouseup', () => this.stopRecording(container));
    pttBtn.addEventListener('mouseleave', () => {
      if (this.isRecording) this.stopRecording(container);
    });

    // Touch events (mobile)
    pttBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startRecording(container);
    });
    pttBtn.addEventListener('touchend', () => this.stopRecording(container));

    // Keyboard accessibility
    pttBtn.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isRecording) {
        e.preventDefault();
        this.startRecording(container);
      }
    });
    pttBtn.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.isRecording) {
        e.preventDefault();
        this.stopRecording(container);
      }
    });
  }

  private async startRecording(container: HTMLElement): Promise<void> {
    if (this.isRecording) return;

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: this.config.sampleRate,
        },
      });

      // Create MediaRecorder with Opus codec
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
        audioBitsPerSecond: 128000,
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Process recording
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        await this.processRecording(audioBlob, container);
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;

      // Update UI
      this.showRecordingUI(container);

      // Set max duration timeout
      this.recordingTimeout = window.setTimeout(() => {
        this.stopRecording(container);
      }, this.config.maxDuration);

      // Start duration timer
      this.startDurationTimer(container);

    } catch (error) {
      this.handleError(error, container);
    }
  }

  private stopRecording(container: HTMLElement): void {
    if (!this.isRecording || !this.mediaRecorder) return;

    // Clear timeout
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    // Stop recording
    this.mediaRecorder.stop();
    this.isRecording = false;

    // Update UI
    this.hideRecordingUI(container);
  }

  private async processRecording(
    audioBlob: Blob,
    container: HTMLElement
  ): Promise<void> {
    // Show processing indicator
    this.showStatus('Processing...', container);

    try {
      // Send to server for transcription
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${API_URL}/chat/${this.sessionId}/voice`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const { transcription } = await response.json();

      if (transcription.trim()) {
        // Callback with transcribed text
        this.onTranscription(transcription);
        this.showStatus('', container);
      } else {
        this.showStatus('No speech detected', container);
        setTimeout(() => this.showStatus('', container), 2000);
      }

    } catch (error) {
      this.handleError(error, container);
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    throw new Error('No supported audio MIME type found');
  }

  private showRecordingUI(container: HTMLElement): void {
    const pttBtn = container.querySelector('.buzzi-ptt-btn');
    const micIcon = container.querySelector('.buzzi-mic-icon');
    const recordingIcon = container.querySelector('.buzzi-recording-icon');
    const indicator = container.querySelector('.buzzi-voice-indicator');

    pttBtn?.setAttribute('aria-pressed', 'true');
    pttBtn?.classList.add('buzzi-recording');
    micIcon?.setAttribute('hidden', '');
    recordingIcon?.removeAttribute('hidden');
    indicator?.removeAttribute('hidden');
  }

  private hideRecordingUI(container: HTMLElement): void {
    const pttBtn = container.querySelector('.buzzi-ptt-btn');
    const micIcon = container.querySelector('.buzzi-mic-icon');
    const recordingIcon = container.querySelector('.buzzi-recording-icon');
    const indicator = container.querySelector('.buzzi-voice-indicator');

    pttBtn?.setAttribute('aria-pressed', 'false');
    pttBtn?.classList.remove('buzzi-recording');
    micIcon?.removeAttribute('hidden');
    recordingIcon?.setAttribute('hidden', '');
    indicator?.setAttribute('hidden', '');
  }

  private startDurationTimer(container: HTMLElement): void {
    const durationEl = container.querySelector('.buzzi-voice-duration');
    let seconds = 0;

    const timer = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(timer);
        return;
      }

      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (durationEl) {
        durationEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  private showStatus(message: string, container: HTMLElement): void {
    const statusEl = container.querySelector('.buzzi-voice-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  private handleError(error: unknown, container: HTMLElement): void {
    console.error('Voice input error:', error);

    let message = 'Voice input error';
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      message = 'Microphone access denied';
    }

    this.showStatus(message, container);
    setTimeout(() => this.showStatus('', container), 3000);
  }
}
```

### 10.3 Server-Side Transcription

```typescript
// src/app/api/chat/[sessionId]/voice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate session
    const session = await validateChatSession(params.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Transcribe audio using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: session.locale?.split('-')[0], // Use session locale if available
      response_format: 'text',
    });

    return NextResponse.json({
      transcription: transcription,
      sessionId: params.sessionId,
    });

  } catch (error) {
    console.error('Voice transcription error:', error);
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}
```

### 10.4 Text-to-Speech Response (Optional)

```typescript
// src/services/chat/text-to-speech.ts

export class TextToSpeechService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async synthesize(
    text: string,
    options: {
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      speed?: number;
    } = {}
  ): Promise<Buffer> {
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: options.voice ?? 'nova',
      input: text,
      speed: options.speed ?? 1.0,
      response_format: 'opus',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  }
}

// Widget audio playback
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  async play(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Stop any currently playing audio
    if (this.currentSource) {
      this.currentSource.stop();
    }

    const audioBuffer = await this.audioContext.decodeAudioData(audioData);
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = audioBuffer;
    this.currentSource.connect(this.audioContext.destination);
    this.currentSource.start();
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
  }
}
```

### 10.5 Voice Styles

```css
/* src/widget/styles/voice.css */

.buzzi-voice-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.buzzi-ptt-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--buzzi-surface);
  color: var(--buzzi-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--buzzi-transition);
}

.buzzi-ptt-btn:hover {
  background: var(--buzzi-primary);
  color: white;
}

.buzzi-ptt-btn.buzzi-recording {
  background: #dc3545;
  color: white;
  animation: buzzi-pulse 1.5s infinite;
}

@keyframes buzzi-pulse {
  0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
}

.buzzi-mic-icon,
.buzzi-recording-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.buzzi-voice-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--buzzi-surface);
  border-radius: 16px;
  font-size: 12px;
}

.buzzi-voice-wave {
  width: 40px;
  height: 20px;
  background: linear-gradient(90deg,
    var(--buzzi-primary) 0%,
    var(--buzzi-primary) 20%,
    transparent 20%,
    transparent 25%,
    var(--buzzi-primary) 25%,
    var(--buzzi-primary) 45%,
    transparent 45%,
    transparent 50%,
    var(--buzzi-primary) 50%,
    var(--buzzi-primary) 70%,
    transparent 70%,
    transparent 75%,
    var(--buzzi-primary) 75%,
    var(--buzzi-primary) 100%
  );
  animation: buzzi-wave 0.5s linear infinite;
}

@keyframes buzzi-wave {
  0% { background-position: 0 0; }
  100% { background-position: 40px 0; }
}

.buzzi-voice-duration {
  color: var(--buzzi-text-muted);
  font-variant-numeric: tabular-nums;
}

.buzzi-voice-status {
  font-size: 12px;
  color: var(--buzzi-text-muted);
  min-height: 16px;
}
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Realtime & Channels Architecture](./architecture-realtime-channels.md)
- [Requirements Document](./requirement.v2.md)
