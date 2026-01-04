/**
 * Widget Embed Loader Script
 *
 * This is a tiny (~2KB gzipped) script that:
 * 1. Creates a launcher button on the host page
 * 2. Loads the full chat widget in an iframe when clicked
 * 3. Handles communication between the host page and widget
 *
 * Usage:
 * <script src="https://cdn.buzzi.ai/chatapp/embed.js" data-chatbot-id="xxx" data-company-id="yyy"></script>
 */

// Make this file a module for proper global augmentation
export {};

interface BuzziWidgetConfig {
  chatbotId: string;
  companyId: string;
  // Appearance
  position?: "bottom-right" | "bottom-left";
  theme?: "light" | "dark" | "auto";
  primaryColor?: string;
  // Launcher
  launcherIcon?: string;
  launcherText?: string;
  // Behavior
  autoOpen?: boolean;
  autoOpenDelay?: number;
  // Customer data
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: { role: string; content: string }) => void;
  onReady?: () => void;
}

interface BuzziWidget {
  init: (config: BuzziWidgetConfig) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
  setCustomer: (customer: BuzziWidgetConfig["customer"]) => void;
  sendMessage: (message: string) => void;
}

declare global {
  interface Window {
    BuzziWidget: BuzziWidget;
    __buzzi_widget_loaded?: boolean;
  }
}

(() => {
  // Prevent double loading
  if (window.__buzzi_widget_loaded) return;
  window.__buzzi_widget_loaded = true;

  const WIDGET_BASE = "https://widget.buzzi.ai";

  let config: BuzziWidgetConfig | null = null;
  let isOpen = false;
  let iframe: HTMLIFrameElement | null = null;
  let launcher: HTMLElement | null = null;
  let container: HTMLElement | null = null;

  // Styles for the launcher and container
  const injectStyles = () => {
    const style = document.createElement("style");
    style.id = "buzzi-widget-styles";
    style.textContent = `
      .buzzi-widget-launcher {
        position: fixed;
        z-index: 999998;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border: none;
        outline: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .buzzi-widget-launcher:hover {
        transform: scale(1.05);
      }
      .buzzi-widget-launcher:active {
        transform: scale(0.95);
      }
      .buzzi-widget-launcher-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      .buzzi-widget-launcher-text {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 50px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        color: white;
      }
      .buzzi-widget-launcher-text svg {
        width: 20px;
        height: 20px;
      }
      .buzzi-widget-container {
        position: fixed;
        z-index: 999999;
        width: 400px;
        height: 600px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 100px);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      }
      .buzzi-widget-container.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      .buzzi-widget-iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
      @media (max-width: 480px) {
        .buzzi-widget-container {
          width: 100vw;
          height: 100vh;
          max-width: 100vw;
          max-height: 100vh;
          border-radius: 0;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
        }
        .buzzi-widget-launcher {
          bottom: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  // Create chat icon SVG using DOM methods
  const createChatIcon = (): SVGSVGElement => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "28");
    svg.setAttribute("height", "28");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
    svg.appendChild(path);

    return svg;
  };

  // Create small chat icon for text launcher
  const createSmallChatIcon = (): SVGSVGElement => {
    const svg = createChatIcon();
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    return svg;
  };

  // Create the launcher element
  const createLauncher = () => {
    if (!config) return;

    launcher = document.createElement("button");
    launcher.className = "buzzi-widget-launcher";
    launcher.setAttribute("aria-label", "Open chat");

    const position = config.position || "bottom-right";
    const isRight = position.includes("right");

    // Position the launcher
    Object.assign(launcher.style, {
      [isRight ? "right" : "left"]: "20px",
      bottom: "20px",
    });

    // Create launcher content
    if (config.launcherText) {
      // Text + icon launcher
      const content = document.createElement("div");
      content.className = "buzzi-widget-launcher-text";
      content.style.backgroundColor = config.primaryColor || "#6437F3";

      content.appendChild(createSmallChatIcon());

      const textSpan = document.createElement("span");
      textSpan.textContent = config.launcherText;
      content.appendChild(textSpan);

      launcher.appendChild(content);
    } else {
      // Icon only launcher
      const content = document.createElement("div");
      content.className = "buzzi-widget-launcher-icon";
      content.style.backgroundColor = config.primaryColor || "#6437F3";
      content.style.color = "white";

      if (config.launcherIcon) {
        // Custom icon
        const img = document.createElement("img");
        img.src = config.launcherIcon;
        img.alt = "Chat";
        img.style.cssText = "width: 32px; height: 32px; object-fit: contain;";
        content.appendChild(img);
      } else {
        // Default chat icon
        content.appendChild(createChatIcon());
      }
      launcher.appendChild(content);
    }

    launcher.addEventListener("click", toggle);
    document.body.appendChild(launcher);
  };

  // Create the widget container and iframe
  const createWidget = () => {
    if (!config) return;

    container = document.createElement("div");
    container.className = "buzzi-widget-container";

    const position = config.position || "bottom-right";
    const isRight = position.includes("right");

    // Position the container
    Object.assign(container.style, {
      [isRight ? "right" : "left"]: "20px",
      bottom: "90px",
    });

    // Create iframe
    iframe = document.createElement("iframe");
    iframe.className = "buzzi-widget-iframe";
    iframe.setAttribute("allow", "microphone");
    iframe.setAttribute("title", "Chat Widget");

    // Build iframe URL with config params
    const params = new URLSearchParams({
      agentId: config.chatbotId,
      companyId: config.companyId,
      theme: config.theme || "light",
      primaryColor: config.primaryColor || "#6437F3",
    });

    if (config.customer) {
      params.set("customer", JSON.stringify(config.customer));
    }

    iframe.src = `${WIDGET_BASE}/embed-widget?${params.toString()}`;

    container.appendChild(iframe);
    document.body.appendChild(container);

    // Listen for messages from iframe
    window.addEventListener("message", handleMessage);
  };

  // Handle messages from the widget iframe
  const handleMessage = (event: MessageEvent) => {
    // Verify origin in production
    // if (event.origin !== WIDGET_BASE) return;

    const { type, data } = event.data ?? {};

    switch (type) {
      case "widget:ready":
        config?.onReady?.();
        break;
      case "widget:close":
      case "widget:minimize":
        close();
        break;
      case "widget:message":
        config?.onMessage?.(data);
        break;
    }
  };

  // Open the widget
  const open = () => {
    if (isOpen || !container) return;
    isOpen = true;
    container.classList.add("open");
    config?.onOpen?.();
  };

  // Close the widget
  const close = () => {
    if (!isOpen || !container) return;
    isOpen = false;
    container.classList.remove("open");
    config?.onClose?.();
  };

  // Toggle widget open/close
  const toggle = () => {
    isOpen ? close() : open();
  };

  // Send a message to the widget
  const sendMessage = (message: string) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "sendMessage", data: { content: message } },
        "*"
      );
    }
  };

  // Update customer data
  const setCustomer = (customer: BuzziWidgetConfig["customer"]) => {
    if (!config) return;
    config.customer = customer;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "setCustomer", data: customer },
        "*"
      );
    }
  };

  // Destroy the widget
  const destroy = () => {
    window.removeEventListener("message", handleMessage);
    launcher?.remove();
    container?.remove();
    iframe = null;
    launcher = null;
    container = null;
    config = null;
    isOpen = false;
    window.__buzzi_widget_loaded = false;
  };

  // Initialize the widget
  const init = (userConfig: BuzziWidgetConfig) => {
    if (!userConfig.chatbotId || !userConfig.companyId) {
      console.error("BuzziWidget: chatbotId and companyId are required");
      return;
    }

    config = userConfig;
    injectStyles();
    createLauncher();
    createWidget();

    // Auto-open if configured
    if (config.autoOpen) {
      const delay = (config.autoOpenDelay ?? 5) * 1000;
      setTimeout(open, delay);
    }
  };

  // Expose the API
  window.BuzziWidget = {
    init,
    open,
    close,
    toggle,
    destroy,
    setCustomer,
    sendMessage,
  };

  // Auto-initialize from script data attributes
  const currentScript = document.currentScript as HTMLScriptElement;
  if (currentScript) {
    const chatbotId = currentScript.getAttribute("data-chatbot-id");
    const companyId = currentScript.getAttribute("data-company-id");

    if (chatbotId && companyId) {
      // Wait for DOM to be ready
      const autoInit = () => {
        init({
          chatbotId,
          companyId,
          position: (currentScript.getAttribute("data-position") as "bottom-right" | "bottom-left") || "bottom-right",
          theme: (currentScript.getAttribute("data-theme") as "light" | "dark" | "auto") || "light",
          primaryColor: currentScript.getAttribute("data-primary-color") || undefined,
          launcherText: currentScript.getAttribute("data-launcher-text") || undefined,
          autoOpen: currentScript.getAttribute("data-auto-open") === "true",
          autoOpenDelay: parseInt(currentScript.getAttribute("data-auto-open-delay") || "5", 10),
        });
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoInit);
      } else {
        autoInit();
      }
    }
  }
})();
