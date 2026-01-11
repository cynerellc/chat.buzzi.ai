/**
 * Widget Embed Script
 *
 * This is the entry point for the embeddable chat widget.
 * It loads the widget iframe and exposes the global ChatWidget API.
 *
 * OPTIMIZATION: The widget now loads config from pre-generated JSON before
 * showing the launcher to prevent flash of default colors/icons.
 */

import type {
  WidgetConfig,
  ChatWidgetAPI,
  WidgetSession,
  WidgetEventType,
  WidgetEventCallback,
  WidgetConfigJson,
} from "./types";

declare global {
  interface Window {
    CHATBOT_CONFIG?: WidgetConfig;
    ChatWidget?: ChatWidgetAPI;
  }
}

// ============================================================================
// Config Cache
// ============================================================================

const CONFIG_CACHE_KEY = "buzzi_widget_config_";
const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedConfig {
  config: WidgetConfigJson;
  timestamp: number;
}

function getCachedConfig(chatbotId: string): WidgetConfigJson | null {
  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY + chatbotId);
    if (!cached) return null;

    const { config, timestamp } = JSON.parse(cached) as CachedConfig;
    if (Date.now() - timestamp > CONFIG_CACHE_DURATION) {
      localStorage.removeItem(CONFIG_CACHE_KEY + chatbotId);
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

function setCachedConfig(chatbotId: string, config: WidgetConfigJson): void {
  try {
    const cached: CachedConfig = { config, timestamp: Date.now() };
    localStorage.setItem(CONFIG_CACHE_KEY + chatbotId, JSON.stringify(cached));
  } catch {
    // localStorage might be full or disabled
  }
}

// ============================================================================
// Safe SVG Creation Helpers
// ============================================================================

function createSvgElement(
  tag: string,
  attrs: Record<string, string>
): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

function createChatIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const path = createSvgElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  });
  svg.appendChild(path);
  return svg;
}

function createMessageIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const path = createSvgElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  });
  const line1 = createSvgElement("line", {
    x1: "8",
    y1: "9",
    x2: "16",
    y2: "9",
  });
  const line2 = createSvgElement("line", {
    x1: "8",
    y1: "13",
    x2: "14",
    y2: "13",
  });
  svg.appendChild(path);
  svg.appendChild(line1);
  svg.appendChild(line2);
  return svg;
}

function createHelpIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const circle = createSvgElement("circle", {
    cx: "12",
    cy: "12",
    r: "10",
  });
  const path = createSvgElement("path", {
    d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
  });
  const line = createSvgElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17",
  });
  svg.appendChild(circle);
  svg.appendChild(path);
  svg.appendChild(line);
  return svg;
}

function createSparkleIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const path1 = createSvgElement("path", {
    d: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z",
  });
  const path2 = createSvgElement("path", {
    d: "M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z",
  });
  const path3 = createSvgElement("path", {
    d: "M19 12l.5 1.5L21 14l-1.5.5L19 16l-.5-1.5L17 14l1.5-.5L19 12z",
  });
  svg.appendChild(path1);
  svg.appendChild(path2);
  svg.appendChild(path3);
  return svg;
}

function createCloseIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const line1 = createSvgElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18",
  });
  const line2 = createSvgElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18",
  });
  svg.appendChild(line1);
  svg.appendChild(line2);
  return svg;
}

function getLauncherIconElement(iconType: string): SVGElement {
  switch (iconType) {
    case "message":
      return createMessageIcon();
    case "help":
      return createHelpIcon();
    case "sparkle":
      return createSparkleIcon();
    case "chat":
    default:
      return createChatIcon();
  }
}

// ============================================================================
// Widget Class
// ============================================================================

class BuzziChatWidget implements ChatWidgetAPI {
  private config: WidgetConfig;
  private loadedConfig: WidgetConfigJson | null = null;
  private container: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private session: WidgetSession | null = null;
  private isWidgetOpen = false;
  private isWidgetMinimized = false;
  private eventListeners: Map<WidgetEventType, Set<WidgetEventCallback>> = new Map();
  private baseUrl: string;
  private isReady = false;

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
      primaryColor: "#6437F3",
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
    // Load config from JSON first (with caching)
    await this.loadConfig();

    // Create container
    this.container = document.createElement("div");
    this.container.id = "buzzi-chat-widget";
    this.container.style.cssText = `
      position: fixed;
      bottom: 0;
      ${this.getPosition() === "bottom-left" ? "left: 0" : "right: 0"};
      z-index: ${this.getZIndex()};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create launcher button with loaded config
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

    // Mark as ready
    this.isReady = true;

    // Auto-open if configured
    if (this.getBehavior().autoOpen) {
      setTimeout(() => {
        this.open();
      }, (this.getBehavior().autoOpenDelay ?? 5) * 1000);
    }

    // Expose global API
    window.ChatWidget = this;
  }

  private async loadConfig(): Promise<void> {
    const { agentId, companyId } = this.config;

    // Check cache first
    const cached = getCachedConfig(agentId);
    if (cached) {
      this.loadedConfig = cached;
      return;
    }

    try {
      // Get config URL from API
      const urlResponse = await fetch(
        `${this.baseUrl}/api/widget/config-url?chatbotId=${agentId}&companyId=${companyId}`
      );

      if (!urlResponse.ok) {
        console.warn("Failed to get widget config URL, using defaults");
        return;
      }

      const { configUrl } = await urlResponse.json();

      if (!configUrl) {
        console.warn("No config URL available, using defaults");
        return;
      }

      // Fetch the JSON config directly from storage
      const configResponse = await fetch(configUrl);
      if (!configResponse.ok) {
        console.warn("Failed to fetch widget config JSON, using defaults");
        return;
      }

      const config = await configResponse.json();
      this.loadedConfig = config;

      // Cache for future loads
      setCachedConfig(agentId, config);
    } catch (error) {
      console.warn("Error loading widget config:", error);
      // Continue with defaults
    }
  }

  // Helper methods to get config values (prefer loaded config over initial)
  private getAppearance() {
    return this.loadedConfig?.appearance ?? {
      primaryColor: this.config.primaryColor ?? "#6437F3",
      position: this.config.position ?? "bottom-right",
      borderRadius: this.config.borderRadius ?? 16,
      buttonSize: 60,
      launcherIcon: "chat",
      zIndex: 9999,
    };
  }

  private getBehavior() {
    return this.loadedConfig?.behavior ?? {
      autoOpen: this.config.autoOpen ?? false,
      autoOpenDelay: this.config.autoOpenDelay ?? 5,
      showTypingIndicator: this.config.enableTypingIndicator ?? true,
      persistConversation: true,
      playSoundOnMessage: true,
      hideLauncherOnMobile: false,
    };
  }

  private getPosition(): string {
    return this.loadedConfig?.appearance?.position ?? this.config.position ?? "bottom-right";
  }

  private getPlacement(): string {
    return this.loadedConfig?.appearance?.placement ?? "above-launcher";
  }

  private getZIndex(): number {
    return this.loadedConfig?.appearance?.zIndex ?? 999999;
  }

  private getPrimaryColor(): string {
    return this.loadedConfig?.appearance?.primaryColor ?? this.config.primaryColor ?? "#6437F3";
  }

  private getButtonSize(): number {
    return this.loadedConfig?.appearance?.buttonSize ?? 60;
  }

  private getLauncherIcon(): string {
    return this.loadedConfig?.appearance?.launcherIcon ?? "chat";
  }

  private getBorderRadius(): number {
    return this.loadedConfig?.appearance?.borderRadius ?? this.config.borderRadius ?? 16;
  }

  private createLauncher(): HTMLButtonElement {
    const launcher = document.createElement("button");
    launcher.id = "buzzi-launcher";
    launcher.setAttribute("aria-label", this.config.strings?.openChat ?? "Open chat");
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");

    const buttonSize = this.getButtonSize();
    const primaryColor = this.getPrimaryColor();

    launcher.style.cssText = `
      width: ${buttonSize}px;
      height: ${buttonSize}px;
      border-radius: 50%;
      border: none;
      background: ${primaryColor};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;

    // Set icon based on config using safe DOM methods
    launcher.appendChild(getLauncherIconElement(this.getLauncherIcon()));

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

  private updateLauncherIcon(launcher: HTMLButtonElement, isOpen: boolean): void {
    // Clear existing children
    while (launcher.firstChild) {
      launcher.removeChild(launcher.firstChild);
    }

    // Add appropriate icon
    if (isOpen) {
      launcher.appendChild(createCloseIcon());
    } else {
      launcher.appendChild(getLauncherIconElement(this.getLauncherIcon()));
    }
  }

  private createChatWindow(): HTMLDivElement {
    const chatWindow = document.createElement("div");
    chatWindow.id = "buzzi-chat-window";
    chatWindow.setAttribute("role", "dialog");
    chatWindow.setAttribute("aria-label", "Chat window");

    const position = this.getPosition();
    const placement = this.getPlacement();
    const borderRadius = this.getBorderRadius();
    const isMobile = window.innerWidth <= 768;
    const isCenterScreen = placement === "center-screen";

    if (isCenterScreen) {
      if (isMobile) {
        // Mobile: full screen
        chatWindow.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
          overflow: hidden;
          box-shadow: none;
          opacity: 0;
          transform: scale(0.95);
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: ${this.getZIndex() + 1};
        `;
      } else {
        // Desktop: centered at 70% of screen
        chatWindow.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.95);
          width: min(70vw, 800px);
          height: min(70vh, 700px);
          max-width: 800px;
          max-height: 700px;
          min-width: 380px;
          min-height: 500px;
          border-radius: ${Math.min(borderRadius, 24)}px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: ${this.getZIndex() + 1};
        `;
      }
    } else {
      // Above launcher (default)
      chatWindow.style.cssText = `
        position: absolute;
        bottom: 90px;
        ${position === "bottom-left" ? "left: 20px" : "right: 20px"};
        width: 380px;
        height: 600px;
        max-height: calc(100vh - 120px);
        border-radius: ${Math.min(borderRadius, 24)}px;
        overflow: hidden;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: opacity 0.2s ease, transform 0.2s ease;
      `;
    }

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
      theme: this.loadedConfig?.appearance?.theme ?? this.config.theme ?? "light",
      primaryColor: this.getPrimaryColor(),
    });

    if (this.config.customer) {
      params.set("customer", JSON.stringify(this.config.customer));
    }

    this.iframe.src = `${this.baseUrl}/embed-widget?${params.toString()}`;

    // Setup iframe communication
    globalThis.addEventListener("message", this.handleIframeMessage.bind(this));

    chatWindow.appendChild(this.iframe);
    return chatWindow;
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "buzzi-chat-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: ${this.getZIndex()};
      cursor: pointer;
    `;

    // Close when clicking overlay
    overlay.addEventListener("click", () => {
      this.close();
    });

    return overlay;
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

    const placement = this.getPlacement();
    const isCenterScreen = placement === "center-screen";
    const isMobile = window.innerWidth <= 768;

    // Create and show overlay for center-screen mode
    if (isCenterScreen) {
      let overlay = document.querySelector("#buzzi-chat-overlay") as HTMLDivElement | null;
      if (!overlay) {
        overlay = this.createOverlay();
        document.body.appendChild(overlay);
      }
      requestAnimationFrame(() => {
        if (overlay) {
          overlay.style.opacity = "1";
        }
      });
    }

    let chatWindow = isCenterScreen
      ? (document.querySelector("#buzzi-chat-window") as HTMLDivElement | null)
      : (this.container.querySelector("#buzzi-chat-window") as HTMLDivElement | null);

    if (!chatWindow) {
      chatWindow = this.createChatWindow();
      if (isCenterScreen) {
        document.body.appendChild(chatWindow);
      } else {
        this.container.appendChild(chatWindow);
      }
    }

    // Show window with animation
    requestAnimationFrame(() => {
      if (chatWindow) {
        chatWindow.style.opacity = "1";
        if (isCenterScreen) {
          if (isMobile) {
            chatWindow.style.transform = "scale(1)";
          } else {
            chatWindow.style.transform = "translate(-50%, -50%) scale(1)";
          }
        } else {
          chatWindow.style.transform = "translateY(0) scale(1)";
        }
      }
    });

    // Update launcher
    const launcher = this.container.querySelector("#buzzi-launcher") as HTMLButtonElement | null;
    if (launcher) {
      launcher.setAttribute("aria-expanded", "true");
      this.updateLauncherIcon(launcher, true);
    }

    this.isWidgetOpen = true;
    this.isWidgetMinimized = false;
    this.emit("open", {});
    this.config.onOpen?.();
  }

  close(): void {
    if (!this.container) return;

    const placement = this.getPlacement();
    const isCenterScreen = placement === "center-screen";
    const isMobile = window.innerWidth <= 768;

    // Hide overlay for center-screen mode
    if (isCenterScreen) {
      const overlay = document.querySelector("#buzzi-chat-overlay") as HTMLDivElement | null;
      if (overlay) {
        overlay.style.opacity = "0";
      }
    }

    const chatWindow = isCenterScreen
      ? (document.querySelector("#buzzi-chat-window") as HTMLDivElement | null)
      : (this.container.querySelector("#buzzi-chat-window") as HTMLDivElement | null);

    if (chatWindow) {
      chatWindow.style.opacity = "0";
      if (isCenterScreen) {
        if (isMobile) {
          chatWindow.style.transform = "scale(0.95)";
        } else {
          chatWindow.style.transform = "translate(-50%, -50%) scale(0.95)";
        }
      } else {
        chatWindow.style.transform = "translateY(20px) scale(0.95)";
      }
    }

    // Update launcher with correct icon
    const launcher = this.container.querySelector("#buzzi-launcher") as HTMLButtonElement | null;
    if (launcher) {
      launcher.setAttribute("aria-expanded", "false");
      this.updateLauncherIcon(launcher, false);
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
    // Remove overlay if exists
    const overlay = document.querySelector("#buzzi-chat-overlay");
    if (overlay) {
      document.body.removeChild(overlay);
    }

    // Remove center-screen chat window if exists (not in container)
    const centerChatWindow = document.querySelector("#buzzi-chat-window");
    if (centerChatWindow && centerChatWindow.parentElement === document.body) {
      document.body.removeChild(centerChatWindow);
    }

    if (this.container) {
      document.body.removeChild(this.container);
      this.container = null;
    }
    this.iframe = null;
    this.session = null;
    delete window.ChatWidget;
  }

  async sendMessage(content: string): Promise<void> {
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

  /**
   * Force refresh the config from server
   */
  async refreshConfig(): Promise<void> {
    // Clear cache
    localStorage.removeItem(CONFIG_CACHE_KEY + this.config.agentId);

    // Reload
    await this.loadConfig();

    // Update launcher if visible
    if (this.container && !this.isWidgetOpen) {
      const launcher = this.container.querySelector("#buzzi-launcher") as HTMLButtonElement | null;
      if (launcher) {
        launcher.style.background = this.getPrimaryColor();
        this.updateLauncherIcon(launcher, false);
      }
    }
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
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
      initWidget
    );
  } else {
    setTimeout(initWidget, 0);
  }
}

export { BuzziChatWidget };
export type { WidgetConfig, ChatWidgetAPI };
