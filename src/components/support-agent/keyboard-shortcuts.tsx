"use client";

import { useEffect, useCallback, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { Keyboard } from "lucide-react";
import { Divider } from "@/components/ui";
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
        <ModalHeader className="flex items-center gap-2">
          <Keyboard size={20} className="text-primary" />
          Keyboard Shortcuts
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="space-y-6">
            {Object.entries(categories).map(([category, categoryShortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-default-600 mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-default-700">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, index) => (
                          <span key={index}>
                            <kbd className="bg-default-100 px-2 py-1 rounded text-xs font-mono">
                              {key === "Cmd"
                                ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
                                  ? "Cmd"
                                  : "Ctrl"
                                : key}
                            </kbd>
                            {index < shortcut.keys.length - 1 && (
                              <span className="mx-0.5 text-default-400">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Divider className="my-4" />

          <p className="text-xs text-default-400 text-center">
            Press <kbd className="bg-default-100 px-1 rounded">Esc</kbd> to close
          </p>
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
