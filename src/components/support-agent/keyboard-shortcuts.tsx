"use client";

import { motion } from "framer-motion";
import { useEffect, useCallback, useState } from "react";
import { Keyboard, Command, Navigation, MessageSquare, HelpCircle } from "lucide-react";
import { Separator, Modal, ModalContent, ModalHeader, ModalBody } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ShortcutAction {
  key: string;
  description: string;
  category: string;
  keys: string[];
  action: () => void;
}

interface KeyboardShortcutsConfig {
  enabled: boolean;
  onResolve?: () => void;
  onStar?: () => void;
  onTransfer?: () => void;
  onReturnToAi?: () => void;
  onCannedResponses?: () => void;
  onEmojiPicker?: () => void;
  onNextConversation?: () => void;
  onPrevConversation?: () => void;
  onFocusInput?: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: ShortcutAction[] = [
    // Navigation
    {
      key: "next",
      description: "Next conversation",
      category: "Navigation",
      keys: ["j"],
      action: () => config.onNextConversation?.(),
    },
    {
      key: "prev",
      description: "Previous conversation",
      category: "Navigation",
      keys: ["k"],
      action: () => config.onPrevConversation?.(),
    },
    {
      key: "focus",
      description: "Focus message input",
      category: "Navigation",
      keys: ["/"],
      action: () => config.onFocusInput?.(),
    },

    // Actions
    {
      key: "resolve",
      description: "Resolve conversation",
      category: "Actions",
      keys: ["Cmd", "Shift", "R"],
      action: () => config.onResolve?.(),
    },
    {
      key: "star",
      description: "Toggle star",
      category: "Actions",
      keys: ["s"],
      action: () => config.onStar?.(),
    },
    {
      key: "transfer",
      description: "Transfer conversation",
      category: "Actions",
      keys: ["t"],
      action: () => config.onTransfer?.(),
    },
    {
      key: "returnToAi",
      description: "Return to AI",
      category: "Actions",
      keys: ["Cmd", "Shift", "A"],
      action: () => config.onReturnToAi?.(),
    },

    // Chat
    {
      key: "canned",
      description: "Open canned responses",
      category: "Chat",
      keys: ["Cmd", "K"],
      action: () => config.onCannedResponses?.(),
    },
    {
      key: "emoji",
      description: "Open emoji picker",
      category: "Chat",
      keys: ["Cmd", "E"],
      action: () => config.onEmojiPicker?.(),
    },

    // Help
    {
      key: "help",
      description: "Show keyboard shortcuts",
      category: "Help",
      keys: ["?"],
      action: () => setShowHelp(true),
    },
  ];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!config.enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Allow some shortcuts even in inputs
      const allowInInput = ["Escape", "?"];
      const key = event.key;

      if (isInput && !allowInInput.includes(key) && !event.metaKey && !event.ctrlKey) {
        return;
      }

      // Check for matching shortcut
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      for (const shortcut of shortcuts) {
        const keys = shortcut.keys;
        if (keys.length === 0) continue;

        const hasModKey = keys.includes("Cmd");
        const hasShift = keys.includes("Shift");
        const lastKey = keys[keys.length - 1];
        if (!lastKey) continue;
        const mainKey = lastKey.toLowerCase();

        if (hasModKey && !modKey) continue;
        if (hasShift && !event.shiftKey) continue;
        if (key.toLowerCase() !== mainKey) continue;

        // If we get here, the shortcut matches
        event.preventDefault();
        shortcut.action();
        return;
      }
    },
    [config, shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, shortcuts };
}

const categoryConfig = {
  Navigation: {
    icon: Navigation,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  Actions: {
    icon: Command,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  Chat: {
    icon: MessageSquare,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  Help: {
    icon: HelpCircle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
};

// Keyboard shortcuts help modal
export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
  shortcuts,
}: {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutAction[];
}) {
  // Group shortcuts by category
  const categories = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category]!.push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutAction[]>);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 border-b border-border/50 pb-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
            <Keyboard size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Keyboard Shortcuts</h2>
            <p className="text-xs text-muted-foreground">Navigate faster with shortcuts</p>
          </div>
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="space-y-5">
            {Object.entries(categories).map(([category, categoryShortcuts], categoryIndex) => {
              const config = categoryConfig[category as keyof typeof categoryConfig] || {
                icon: Keyboard,
                color: "text-muted-foreground",
                bg: "bg-muted",
              };
              const CategoryIcon = config.icon;

              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: categoryIndex * 0.1 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", config.bg)}>
                      <CategoryIcon size={12} className={config.color} />
                    </div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h3>
                  </div>
                  <div className="space-y-1.5 pl-8">
                    {categoryShortcuts.map((shortcut, index) => (
                      <motion.div
                        key={shortcut.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: categoryIndex * 0.1 + index * 0.03 }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm text-foreground">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center">
                              <kbd className="min-w-[28px] h-7 px-2 flex items-center justify-center bg-muted border border-border/50 rounded-md text-xs font-mono font-medium shadow-sm">
                                {key === "Cmd"
                                  ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
                                    ? "⌘"
                                    : "Ctrl"
                                  : key === "Shift"
                                  ? "⇧"
                                  : key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="mx-1 text-muted-foreground text-xs">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Separator className="my-5 bg-border/50" />

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Press</span>
            <kbd className="min-w-[28px] h-6 px-2 flex items-center justify-center bg-muted border border-border/50 rounded-md text-xs font-mono font-medium">
              Esc
            </kbd>
            <span>to close</span>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// Provider component to wrap the app with keyboard shortcuts
export function KeyboardShortcutsProvider({
  children,
  enabled = true,
  ...actions
}: KeyboardShortcutsConfig & { children: React.ReactNode }) {
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts({
    enabled,
    ...actions,
  });

  return (
    <>
      {children}
      <KeyboardShortcutsHelp
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        shortcuts={shortcuts}
      />
    </>
  );
}

export default useKeyboardShortcuts;
