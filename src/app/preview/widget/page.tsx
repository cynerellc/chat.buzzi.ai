"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, MessageSquare, HelpCircle, Sparkles, X, Loader2 } from "lucide-react";

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

interface WidgetConfig {
  primaryColor?: string;
  launcherIcon?: string;
  position?: "bottom-right" | "bottom-left";
  placement?: "above-launcher" | "center-screen";
  borderRadius?: number;
  buttonSize?: number;
  launcherIconBorderRadius?: number;
  launcherIconPulseGlow?: boolean;
  autoOpen?: boolean;
  autoOpenDelay?: number;
  soundEnabled?: boolean;
}

function WidgetPreviewContent() {
  const searchParams = useSearchParams();
  const chatbotId = searchParams.get("chatbotId");
  const companyId = searchParams.get("companyId");

  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<WidgetConfig>({
    primaryColor: "#6437F3",
    launcherIcon: "chat",
    position: "bottom-right",
    placement: "above-launcher",
    borderRadius: 16,
    buttonSize: 60,
    launcherIconBorderRadius: 50,
    launcherIconPulseGlow: false,
    autoOpen: false,
    autoOpenDelay: 5000,
    soundEnabled: false,
  });
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Compute validation error as derived value (not state)
  const validationError = useMemo(() => {
    if (!chatbotId || !companyId) {
      return "chatbotId and companyId are required";
    }
    if (!isValidUUID(chatbotId) || !isValidUUID(companyId)) {
      return "Invalid chatbotId or companyId format";
    }
    return null;
  }, [chatbotId, companyId]);

  // Fetch widget config when params are valid
  useEffect(() => {
    if (validationError || !chatbotId || !companyId) return;

    fetch(`/api/widget/config?agentId=${chatbotId}&companyId=${companyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setConfig({
            primaryColor: data.config.primaryColor || "#6437F3",
            launcherIcon: data.config.launcherIcon || "chat",
            position: data.config.position || "bottom-right",
            placement: data.config.placement || "above-launcher",
            borderRadius: data.config.borderRadius ?? 16,
            buttonSize: data.config.buttonSize ?? 60,
            launcherIconBorderRadius: data.config.launcherIconBorderRadius ?? 50,
            launcherIconPulseGlow: data.config.launcherIconPulseGlow ?? false,
            autoOpen: data.config.autoOpen ?? false,
            autoOpenDelay: data.config.autoOpenDelay ?? 5000,
            soundEnabled: data.config.soundEnabled ?? false,
          });
        }
        setIsConfigLoaded(true);
      })
      .catch(() => {
        // Use defaults if config fetch fails
        setIsConfigLoaded(true);
      });
  }, [chatbotId, companyId, validationError]);

  // Auto-open widget after delay if configured
  useEffect(() => {
    if (!isConfigLoaded || !config.autoOpen || isOpen) return;

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, config.autoOpenDelay || 5000);

    return () => clearTimeout(timer);
  }, [isConfigLoaded, config.autoOpen, config.autoOpenDelay, isOpen]);

  // Listen for close messages from the iframe (embed widget)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "widget:close" || event.data?.type === "widget:minimize") {
        setIsOpen(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
        <div className="bg-white rounded-lg p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600">{validationError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-500 to-purple-600">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Widget Test Page</span>
          </div>
          <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-md text-sm font-medium">
            Test Environment
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-md">
            Test Your Chat Widget
          </h1>
          <p className="text-white/90 text-lg max-w-xl mx-auto">
            This is a sample page to test your chat widget configuration. The widget should appear
            in the corner of your screen.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-white/95 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Testing Instructions</h2>
          <ol className="space-y-4">
            {[
              { title: "Open the widget", desc: "Click the chat bubble in the corner to open the chat window." },
              { title: "Send a message", desc: "Type a message and press Enter or click the send button to test the conversation flow." },
              { title: "Test voice input", desc: "If enabled, hold the microphone button to test push-to-talk voice input." },
              { title: "Check styling", desc: "Verify that colors, branding, and layout match your configuration." },
              { title: "Test agent switching", desc: "If your chatbot has multiple agents, try triggering a transfer to test notifications." },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-sm font-medium flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="text-gray-600">
                  <strong className="text-gray-900">{step.title}</strong> - {step.desc}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: "Appearance", desc: "Check that the widget colors, position, and styling match your customization settings." },
            { title: "Functionality", desc: "Test sending messages, receiving responses, and using features like emoji and voice input." },
            { title: "Responsiveness", desc: "Resize your browser to test how the widget behaves on different screen sizes." },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-white/80 text-sm">
        Powered by <span className="font-medium text-white">Buzzi Chat</span>
      </footer>

      {/* Overlay for center-screen placement - does not close on click */}
      {isOpen && config.placement === "center-screen" && (
        <div className="fixed inset-0 bg-black/50 z-[999998] transition-opacity duration-200" />
      )}

      {/* Chat Window for center-screen placement */}
      {isOpen && config.placement === "center-screen" && (
        <div
          className="fixed z-[999999] overflow-hidden shadow-2xl transition-all duration-200 md:w-[min(70vw,800px)] md:h-[min(70vh,700px)] md:max-w-[800px] md:max-h-[700px] md:min-w-[380px] md:min-h-[500px] w-full h-full top-0 left-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2"
          style={{
            borderRadius: typeof window !== "undefined" && window.innerWidth > 768 ? `${config.borderRadius || 16}px` : 0,
          }}
        >
          <iframe
            src={`/embed-widget?agentId=${chatbotId}&companyId=${companyId}`}
            className="w-full h-full border-none"
            title="Chat Widget"
          />
        </div>
      )}

      {/* Widget launcher container */}
      <div
        className="fixed bottom-5 z-[999999]"
        style={{
          right: config.position === "bottom-left" ? "auto" : "20px",
          left: config.position === "bottom-left" ? "20px" : "auto",
        }}
      >
        {/* Chat Window for above-launcher placement */}
        {isOpen && config.placement !== "center-screen" && (
          <div
            className="absolute w-[380px] h-[600px] max-h-[calc(100vh-120px)] overflow-hidden shadow-2xl transition-all duration-200"
            style={{
              bottom: `${(config.buttonSize || 60) + 20}px`,
              right: config.position === "bottom-left" ? "auto" : 0,
              left: config.position === "bottom-left" ? 0 : "auto",
              borderRadius: `${config.borderRadius || 16}px`,
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
            }}
          >
            <iframe
              src={`/embed-widget?agentId=${chatbotId}&companyId=${companyId}`}
              className="w-full h-full border-none"
              title="Chat Widget"
            />
          </div>
        )}

        {/* Launcher Button */}
        {isConfigLoaded ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative border-none cursor-pointer flex items-center justify-center shadow-xl transition-transform hover:scale-105"
            style={{
              width: `${config.buttonSize || 60}px`,
              height: `${config.buttonSize || 60}px`,
              backgroundColor: config.primaryColor,
              borderRadius: `${config.launcherIconBorderRadius || 50}%`,
              boxShadow: config.launcherIconPulseGlow
                ? `0 0 20px ${config.primaryColor}80`
                : undefined,
            }}
            aria-label={isOpen ? "Close chat" : "Open chat"}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <>
                {config.launcherIcon === "chat" && <MessageCircle className="w-7 h-7 text-white" />}
                {config.launcherIcon === "message" && <MessageSquare className="w-7 h-7 text-white" />}
                {config.launcherIcon === "help" && <HelpCircle className="w-7 h-7 text-white" />}
                {config.launcherIcon === "sparkle" && <Sparkles className="w-7 h-7 text-white" />}
                {!["chat", "message", "help", "sparkle"].includes(config.launcherIcon || "") && (
                  <MessageCircle className="w-7 h-7 text-white" />
                )}
              </>
            )}
            {config.launcherIconPulseGlow && !isOpen && (
              <span
                className="absolute inset-0 animate-ping opacity-30"
                style={{
                  backgroundColor: config.primaryColor,
                  borderRadius: `${config.launcherIconBorderRadius || 50}%`,
                }}
              />
            )}
          </button>
        ) : (
          <div
            className="bg-gray-300 animate-pulse"
            style={{
              width: `${config.buttonSize || 60}px`,
              height: `${config.buttonSize || 60}px`,
              borderRadius: `${config.launcherIconBorderRadius || 50}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function WidgetPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <WidgetPreviewContent />
    </Suspense>
  );
}
