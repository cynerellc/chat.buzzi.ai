/**
 * Widget Embed Script
 *
 * This is the entry point for the embeddable chat widget.
 * It loads the widget iframe and exposes the global ChatWidget API.
 */

import type { WidgetConfig, ChatWidgetAPI, WidgetSession, WidgetEventType, WidgetEventCallback } from "./types";

declare global {
  interface Window {
    CHATBOT_CONFIG?: WidgetConfig;
    ChatWidget?: ChatWidgetAPI;
  }
}

// ============================================================================
// Widget Class
// ============================================================================

class BuzziChatWidget implements ChatWidgetAPI {
  private config: WidgetConfig;
  private container: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private session: WidgetSession | null = null;
  private isWidgetOpen = false;
  private isWidgetMinimized = false;
  private eventListeners: Map<WidgetEventType, Set<WidgetEventCallback>> = new Map();
  private baseUrl: string;

  constructor(config: WidgetConfig) {
    this.config = this.validateConfig(config);
    this.baseUrl = this.getBaseUrl();
    this.init();
  }

  private validateConfig(config: WidgetConfig): WidgetConfig {
    if (!config.agentId) {
      throw new Error("BuzziChatWidget: agentId is required");
    }
    if (!config.companyId) {
      throw new Error("BuzziChatWidget: companyId is required");
    }

    return {
      theme: "light",
      position: "bottom-right",
      primaryColor: "#007bff",
      autoOpen: false,
      autoOpenDelay: 5000,
      showBranding: true,
      enableFileUpload: true,
      enableEmoji: true,
      enableVoice: false,
      enableMarkdown: true,
      enableTypingIndicator: true,
      closeOnEscape: true,
      ...config,
    };
  }

  private getBaseUrl(): string {
    // In production, this would be the CDN URL
    // For development, use the current origin or a configured URL
    const scriptEl = document.querySelector('script[src*="chat.min.js"]');
    if (scriptEl) {
      const src = scriptEl.getAttribute("src") ?? "";
      try {
        const url = new URL(src);
        return `${url.protocol}//${url.host}`;
      } catch {
        // Relative URL, use current origin
      }
    }
    return window.location.origin;
  }

  private async init(): Promise<void> {
    // Create container
    this.container = document.createElement("div");
    this.container.id = "buzzi-chat-widget";
    this.container.style.cssText = `
      position: fixed;
      bottom: 0;
      ${this.config.position === "bottom-left" ? "left: 0" : "right: 0"};
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create launcher button
    const launcher = this.createLauncher();
    this.container.appendChild(launcher);

    // Append to body
    document.body.appendChild(this.container);

    // Setup keyboard listener
    if (this.config.closeOnEscape) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isWidgetOpen) {
          this.close();
        }
      });
    }

    // Auto-open if configured
    if (this.config.autoOpen) {
      setTimeout(() => {
        this.open();
      }, this.config.autoOpenDelay ?? 5000);
    }

    // Expose global API
    window.ChatWidget = this;
  }

  private createLauncher(): HTMLButtonElement {
    const launcher = document.createElement("button");
    launcher.id = "buzzi-launcher";
    launcher.setAttribute("aria-label", this.config.strings?.openChat ?? "Open chat");
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");

    launcher.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      background: ${this.config.primaryColor};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;

    launcher.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;

    launcher.addEventListener("mouseenter", () => {
      launcher.style.transform = "scale(1.05)";
      launcher.style.boxShadow = "0 6px 32px rgba(0, 0, 0, 0.2)";
    });

    launcher.addEventListener("mouseleave", () => {
      launcher.style.transform = "scale(1)";
      launcher.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.15)";
    });

    launcher.addEventListener("click", () => {
      this.toggle();
    });

    return launcher;
  }

  private createChatWindow(): HTMLDivElement {
    const window = document.createElement("div");
    window.id = "buzzi-chat-window";
    window.setAttribute("role", "dialog");
    window.setAttribute("aria-label", "Chat window");

    window.style.cssText = `
      position: absolute;
      bottom: 90px;
      ${this.config.position === "bottom-left" ? "left: 20px" : "right: 20px"};
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 120px);
      border-radius: ${this.config.borderRadius ?? 16}px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;

    // Create iframe
    this.iframe = document.createElement("iframe");
    this.iframe.id = "buzzi-chat-iframe";
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    // Build iframe URL with config params
    const params = new URLSearchParams({
      agentId: this.config.agentId,
      companyId: this.config.companyId,
      theme: this.config.theme ?? "light",
      primaryColor: this.config.primaryColor ?? "#007bff",
    });

    if (this.config.customer) {
      params.set("customer", JSON.stringify(this.config.customer));
    }

    this.iframe.src = `${this.baseUrl}/embed-widget?${params.toString()}`;

    // Setup iframe communication
    globalThis.addEventListener("message", this.handleIframeMessage.bind(this));

    window.appendChild(this.iframe);
    return window;
  }

  private handleIframeMessage(event: MessageEvent): void {
    // Verify origin
    if (!event.origin.includes(new URL(this.baseUrl).host)) {
      return;
    }

    const { type, data } = event.data ?? {};

    switch (type) {
      case "widget:ready":
        // Widget iframe is ready, send config
        this.postToWidget("config", this.config);
        break;

      case "widget:session":
        this.session = data;
        this.emit("session:start", data);
        break;

      case "widget:message":
        this.emit("message:received", data);
        this.config.onMessage?.(data);
        break;

      case "widget:close":
        this.close();
        break;

      case "widget:minimize":
        this.minimize();
        break;

      case "widget:error":
        this.emit("error", data);
        this.config.onError?.(new Error(data.message));
        break;
    }
  }

  private postToWidget(type: string, data?: unknown): void {
    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage({ type, data }, this.baseUrl);
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  open(): void {
    if (!this.container) return;

    let window = this.container.querySelector("#buzzi-chat-window") as HTMLDivElement | null;
    if (!window) {
      window = this.createChatWindow();
      this.container.appendChild(window);
    }

    // Show window with animation
    requestAnimationFrame(() => {
      if (window) {
        window.style.opacity = "1";
        window.style.transform = "translateY(0) scale(1)";
      }
    });

    // Update launcher
    const launcher = this.container.querySelector("#buzzi-launcher") as HTMLButtonElement | null;
    if (launcher) {
      launcher.setAttribute("aria-expanded", "true");
      launcher.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
    }

    this.isWidgetOpen = true;
    this.isWidgetMinimized = false;
    this.emit("open", {});
    this.config.onOpen?.();
  }

  close(): void {
    if (!this.container) return;

    const window = this.container.querySelector("#buzzi-chat-window") as HTMLDivElement | null;
    if (window) {
      window.style.opacity = "0";
      window.style.transform = "translateY(20px) scale(0.95)";
    }

    // Update launcher
    const launcher = this.container.querySelector("#buzzi-launcher") as HTMLButtonElement | null;
    if (launcher) {
      launcher.setAttribute("aria-expanded", "false");
      launcher.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
    }

    this.isWidgetOpen = false;
    this.emit("close", {});
    this.config.onClose?.();
  }

  toggle(): void {
    if (this.isWidgetOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  minimize(): void {
    this.isWidgetMinimized = true;
    this.close();
    this.emit("minimize", {});
  }

  destroy(): void {
    if (this.container) {
      document.body.removeChild(this.container);
      this.container = null;
    }
    this.iframe = null;
    this.session = null;
    delete window.ChatWidget;
  }

  async sendMessage(content: string, _attachments?: File[]): Promise<void> {
    this.postToWidget("sendMessage", { content });
    this.emit("message:sent", { content });
  }

  clearHistory(): void {
    this.postToWidget("clearHistory", {});
  }

  setCustomer(customer: WidgetConfig["customer"]): void {
    this.config.customer = customer;
    this.postToWidget("setCustomer", customer);
  }

  setMetadata(key: string, value: unknown): void {
    if (!this.config.customer) {
      this.config.customer = {};
    }
    if (!this.config.customer.metadata) {
      this.config.customer.metadata = {};
    }
    this.config.customer.metadata[key] = value;
    this.postToWidget("setMetadata", { key, value });
  }

  on<T = unknown>(event: WidgetEventType, callback: WidgetEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback as WidgetEventCallback);
  }

  off<T = unknown>(event: WidgetEventType, callback: WidgetEventCallback<T>): void {
    this.eventListeners.get(event)?.delete(callback as WidgetEventCallback);
  }

  private emit<T = unknown>(event: WidgetEventType, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const eventObj = { type: event, data, timestamp: new Date() };
      listeners.forEach((callback) => callback(eventObj));
    }
  }

  isOpen(): boolean {
    return this.isWidgetOpen;
  }

  isMinimized(): boolean {
    return this.isWidgetMinimized;
  }

  getConversationId(): string | null {
    return this.session?.conversationId ?? null;
  }

  getSession(): WidgetSession | null {
    return this.session;
  }
}

// ============================================================================
// Auto-initialization
// ============================================================================

function initWidget(): void {
  if (typeof window !== "undefined" && window.CHATBOT_CONFIG) {
    new BuzziChatWidget(window.CHATBOT_CONFIG);
  }
}

// Initialize on DOM ready or immediately if already ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWidget);
} else {
  // Use requestIdleCallback for non-blocking initialization
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(initWidget);
  } else {
    setTimeout(initWidget, 0);
  }
}

export { BuzziChatWidget };
export type { WidgetConfig, ChatWidgetAPI };
