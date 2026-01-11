"use client";

import { useState, useMemo } from "react";
import { Smile, Search, X, Clock } from "lucide-react";
import { Button, Input, ScrollShadow, PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui";
import { cn } from "@/lib/utils";

// Emoji categories with common emojis
const EMOJI_CATEGORIES = {
  recent: { icon: Clock, label: "Recent", emojis: [] as string[] },
  smileys: {
    icon: Smile,
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉",
      "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝",
      "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒",
      "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢",
      "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓",
    ],
  },
  gestures: {
    icon: Smile,
    label: "Gestures",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾",
    ],
  },
  objects: {
    icon: Smile,
    label: "Objects",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "⭐", "🌟", "✨", "💫", "🔥", "💯",
      "💬", "💭", "🗯️", "✉️", "📧", "📞", "☎️", "💻", "🖥️", "📱", "⌚", "📷",
    ],
  },
  symbols: {
    icon: Smile,
    label: "Symbols",
    emojis: [
      "✅", "❌", "⭕", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤",
      "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "💠", "🔘", "✔️", "☑️", "🔗", "➡️",
      "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "🔄", "🔃", "ℹ️",
    ],
  },
};

// Get recent emojis from localStorage
const getRecentEmojis = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const recent = localStorage.getItem("recentEmojis");
    return recent ? JSON.parse(recent) : [];
  } catch {
    return [];
  }
};

// Save recent emoji to localStorage
const saveRecentEmoji = (emoji: string) => {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentEmojis();
    const updated = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 24);
    localStorage.setItem("recentEmojis", JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
};

export interface EmojiPickerProps {
  onSelect?: (emoji: string) => void;
  onEmojiSelect?: (emoji: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function EmojiPicker({
  onSelect,
  onEmojiSelect,
  className,
  triggerClassName,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>("smileys");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  // Load recent emojis when popover opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setRecentEmojis(getRecentEmojis());
      setSearchQuery("");
    }
  };

  // Get current category emojis with recent
  const categories = useMemo(() => ({
    ...EMOJI_CATEGORIES,
    recent: { ...EMOJI_CATEGORIES.recent, emojis: recentEmojis },
  }), [recentEmojis]);

  // Filter emojis based on search
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories[activeCategory].emojis;
    }
    // When searching, show all emojis that match
    return Object.values(EMOJI_CATEGORIES)
      .flatMap((cat) => cat.emojis)
      .filter((emoji) => emoji.includes(searchQuery));
  }, [searchQuery, activeCategory, categories]);

  const handleEmojiSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 24));
    onSelect?.(emoji);
    onEmojiSelect?.(emoji);
    setIsOpen(false);
  };

  return (
    <PopoverRoot
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(triggerClassName)}
        >
          <Smile size={20} />
        </Button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" sideOffset={10} className={cn("w-72 p-0", className)}>
        {/* Search */}
        <div className="p-2 border-b border-divider">
          <Input
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search size={14} className="text-muted-foreground" />}
            endContent={
              searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )
            }
            className="text-sm"
          />
        </div>

        {/* Category Tabs */}
        {!searchQuery && (
          <div className="flex items-center gap-1 p-2 border-b border-divider overflow-x-auto">
            {Object.entries(categories).map(([key, category]) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const _CategoryIcon = category.icon;
              const isActive = activeCategory === key;
              const hasItems = key === "recent" ? recentEmojis.length > 0 : true;

              if (!hasItems && key === "recent") return null;

              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key as keyof typeof EMOJI_CATEGORIES)}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                  title={category.label}
                >
                  {key === "recent" ? (
                    <Clock size={16} />
                  ) : (
                    <span className="text-base">{category.emojis[0]}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Emoji Grid */}
        <ScrollShadow className="p-2 max-h-[200px]">
          {filteredEmojis.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              {searchQuery ? "No emojis found" : "No recent emojis"}
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </ScrollShadow>

        {/* Footer */}
        <div className="p-2 border-t border-divider text-xs text-muted-foreground text-center">
          {searchQuery ? (
            `${filteredEmojis.length} results`
          ) : (
            categories[activeCategory].label
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default EmojiPicker;
