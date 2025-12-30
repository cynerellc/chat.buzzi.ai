"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  X,
  Plus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, Badge, Input, Separator, PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui";
import { cn } from "@/lib/utils";

interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  color?: "default" | "primary" | "success" | "warning" | "danger";
  shortcut?: string;
  bgColor?: string;
  hoverColor?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: "resolve", label: "Resolve", icon: Check, color: "success", shortcut: "R", bgColor: "bg-success/10", hoverColor: "hover:bg-success/20" },
  { key: "star", label: "Star", icon: Star, color: "warning", shortcut: "S", bgColor: "bg-warning/10", hoverColor: "hover:bg-warning/20" },
  { key: "snooze", label: "Snooze", icon: Clock, shortcut: "Z", bgColor: "bg-muted", hoverColor: "hover:bg-muted/80" },
  { key: "transfer", label: "Transfer", icon: Users, shortcut: "T", bgColor: "bg-blue-500/10", hoverColor: "hover:bg-blue-500/20" },
  { key: "returnToAi", label: "Return to AI", icon: Bot, color: "primary", bgColor: "bg-primary/10", hoverColor: "hover:bg-primary/20" },
  { key: "block", label: "Block User", icon: Ban, color: "danger", bgColor: "bg-destructive/10", hoverColor: "hover:bg-destructive/20" },
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

  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    copyConversationLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
            <Zap size={14} className="text-primary" />
          </div>
          <h3 className="font-semibold text-sm">Quick Actions</h3>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCopyLink}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            copied ? "bg-success/10 text-success" : "hover:bg-muted text-muted-foreground"
          )}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </motion.button>
      </div>

      <div className="p-4 space-y-4">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.slice(0, 4).map((action, index) => {
            const Icon = action.icon;
            const isActive = action.key === "star" ? isStarred : false;
            const isLoading = loading === action.key;

            return (
              <motion.button
                key={action.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAction(action.key)}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  "border border-border/50",
                  isActive
                    ? "bg-warning/10 text-warning border-warning/30"
                    : cn(action.bgColor, action.hoverColor),
                  isLoading && "opacity-50 pointer-events-none"
                )}
              >
                <Icon size={14} className={isActive ? "text-warning fill-warning" : ""} />
                <span className="flex-1 text-left">{action.label}</span>
                {action.shortcut && (
                  <kbd className="text-[10px] px-1.5 py-0.5 bg-background/50 rounded border border-border/50 opacity-60">
                    {action.shortcut}
                  </kbd>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* More Actions */}
        <div className="flex gap-2">
          {QUICK_ACTIONS.slice(4).map((action, index) => {
            const Icon = action.icon;
            const isLoading = loading === action.key;
            return (
              <motion.button
                key={action.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 4) * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAction(action.key)}
                disabled={isLoading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  "border border-border/50",
                  action.bgColor,
                  action.hoverColor,
                  isLoading && "opacity-50 pointer-events-none"
                )}
              >
                <Icon size={14} />
                {action.label}
              </motion.button>
            );
          })}
        </div>

        <Separator className="bg-border/50" />

        {/* Tags Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                <Tag size={12} className="text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Tags</span>
              {tags.length > 0 && (
                <span className="text-xs text-muted-foreground">({tags.length})</span>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowTagInput(!showTagInput)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={12} />
              Add
            </motion.button>
          </div>

          {/* Existing Tags */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <AnimatePresence mode="popLayout">
              {tags.length === 0 ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground py-1"
                >
                  No tags added yet
                </motion.span>
              ) : (
                tags.map((tag) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                  >
                    <Badge
                      size="sm"
                      variant="default"
                      className="gap-1 pr-1 bg-primary/10 text-primary border-primary/20"
                    >
                      {tag}
                      <button
                        onClick={() => onRemoveTag?.(tag)}
                        className="ml-0.5 p-0.5 rounded hover:bg-primary/20 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </Badge>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Tag Input */}
          <AnimatePresence>
            {showTagInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="flex-1"
                  />
                  <Button size="sm" color="primary" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>

                {/* Common Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
                    <motion.button
                      key={tag}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onAddTag?.(tag)}
                      className="text-xs px-2.5 py-1 bg-muted hover:bg-muted/80 rounded-lg transition-colors font-medium"
                    >
                      {tag}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Separator className="bg-border/50" />

        {/* Snooze Options */}
        <PopoverRoot>
          <PopoverTrigger asChild>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-border/50">
                <Clock size={14} />
                Snooze until...
              </Button>
            </motion.div>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-52 p-2">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
              Remind me in
            </p>
            <div className="space-y-0.5">
              {[
                { label: "1 hour", value: 1, icon: "1h" },
                { label: "3 hours", value: 3, icon: "3h" },
                { label: "Tomorrow", value: 24, icon: "24h" },
                { label: "Next week", value: 168, icon: "7d" },
              ].map((option) => (
                <motion.button
                  key={option.value}
                  whileHover={{ x: 2 }}
                  onClick={() => handleAction(`snooze:${option.value}`)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[10px] font-medium">
                    {option.icon}
                  </span>
                  {option.label}
                </motion.button>
              ))}
            </div>
          </PopoverContent>
        </PopoverRoot>

        {/* Keyboard Shortcuts Hint */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">?</kbd> for shortcuts
          </p>
        </div>
      </div>
    </Card>
  );
}

export default QuickActionsPanel;
