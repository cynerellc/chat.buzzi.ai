"use client";

import { useState } from "react";
import {
  Tag,
  Users,
  Clock,
  Star,
  Check,
  Ban,
  Copy,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, Chip, Input, Divider } from "@/components/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { cn } from "@/lib/utils";

interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  color?: "default" | "primary" | "success" | "warning" | "danger";
  shortcut?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: "resolve", label: "Resolve", icon: Check, color: "success", shortcut: "R" },
  { key: "star", label: "Star", icon: Star, color: "warning", shortcut: "S" },
  { key: "snooze", label: "Snooze", icon: Clock, shortcut: "Z" },
  { key: "transfer", label: "Transfer", icon: Users, shortcut: "T" },
  { key: "returnToAi", label: "Return to AI", icon: Bot, color: "primary" },
  { key: "block", label: "Block User", icon: Ban, color: "danger" },
];

const COMMON_TAGS = [
  "billing",
  "refund",
  "technical",
  "urgent",
  "follow-up",
  "resolved",
  "feedback",
  "question",
];

export interface QuickActionsPanelProps {
  conversationId: string;
  isStarred?: boolean;
  tags?: string[];
  className?: string;
  onAction?: (action: string, data?: unknown) => void;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
}

export function QuickActionsPanel({
  conversationId,
  isStarred = false,
  tags = [],
  className,
  onAction,
  onAddTag,
  onRemoveTag,
}: QuickActionsPanelProps) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      await onAction?.(action);
    } finally {
      setLoading(null);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      onAddTag?.(newTag.trim().toLowerCase());
      setNewTag("");
      setShowTagInput(false);
    }
  };

  const copyConversationLink = () => {
    const url = `${window.location.origin}/inbox/${conversationId}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-divider">
        <h3 className="font-medium text-sm">Quick Actions</h3>
        <Button variant="ghost" size="sm" isIconOnly onClick={copyConversationLink}>
          <Copy size={14} />
        </Button>
      </div>

      <div className="p-3 space-y-4">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.slice(0, 4).map((action) => {
            const Icon = action.icon;
            const isActive = action.key === "star" ? isStarred : false;

            return (
              <Button
                key={action.key}
                variant={isActive ? "flat" : "bordered"}
                color={isActive ? (action.color as "warning") : "default"}
                size="sm"
                className="justify-start"
                onClick={() => handleAction(action.key)}
                isLoading={loading === action.key}
              >
                <Icon size={14} />
                {action.label}
                {action.shortcut && (
                  <kbd className="ml-auto text-[10px] bg-default-100 px-1 rounded opacity-50">
                    {action.shortcut}
                  </kbd>
                )}
              </Button>
            );
          })}
        </div>

        {/* More Actions */}
        <div className="flex gap-2">
          {QUICK_ACTIONS.slice(4).map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.key}
                variant="bordered"
                color={action.color}
                size="sm"
                className="flex-1 justify-start"
                onClick={() => handleAction(action.key)}
                isLoading={loading === action.key}
              >
                <Icon size={14} />
                {action.label}
              </Button>
            );
          })}
        </div>

        <Divider />

        {/* Tags Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-default-500" />
              <span className="text-sm font-medium">Tags</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTagInput(!showTagInput)}
            >
              + Add
            </Button>
          </div>

          {/* Existing Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.length === 0 ? (
              <span className="text-xs text-default-400">No tags</span>
            ) : (
              tags.map((tag) => (
                <Chip
                  key={tag}
                  size="sm"
                  variant="flat"
                  onClose={() => onRemoveTag?.(tag)}
                >
                  {tag}
                </Chip>
              ))
            )}
          </div>

          {/* Tag Input */}
          {showTagInput && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  size="sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  className="flex-1"
                />
                <Button size="sm" color="primary" onClick={handleAddTag}>
                  Add
                </Button>
              </div>

              {/* Common Tags */}
              <div className="flex flex-wrap gap-1">
                {COMMON_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onAddTag?.(tag)}
                    className="text-xs px-2 py-1 bg-default-100 hover:bg-default-200 rounded transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Snooze Options */}
        <Popover placement="top">
          <PopoverTrigger>
            <Button variant="bordered" size="sm" className="w-full justify-start">
              <Clock size={14} />
              Snooze until...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="p-1 space-y-1">
              <p className="text-xs font-medium text-default-500 px-2 py-1">
                Remind me in:
              </p>
              {[
                { label: "1 hour", value: 1 },
                { label: "3 hours", value: 3 },
                { label: "Tomorrow", value: 24 },
                { label: "Next week", value: 168 },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAction(`snooze:${option.value}`)}
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-default-100 rounded transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Keyboard Shortcuts Hint */}
        <div className="pt-2 border-t border-divider">
          <p className="text-xs text-default-400 text-center">
            Press <kbd className="bg-default-100 px-1 rounded">?</kbd> for shortcuts
          </p>
        </div>
      </div>
    </Card>
  );
}

export default QuickActionsPanel;
