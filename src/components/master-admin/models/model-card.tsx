"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Sparkles,
  Zap,
  Edit,
  Trash2,
  Star,
  DollarSign,
  MessageSquare,
  Phone,
  PhoneCall,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ModelListItem } from "@/hooks/master-admin/useModels";
import { Button, Card } from "@/components/ui";

interface ModelCardProps {
  model: ModelListItem;
  onEdit: (model: ModelListItem) => void;
  onDelete: (model: ModelListItem) => void;
}

const providerConfig: Record<string, { icon: typeof Brain; gradient: string; iconBg: string; label: string }> = {
  openai: {
    icon: Sparkles,
    gradient: "from-emerald-500/20 to-emerald-600/10",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    label: "OpenAI",
  },
  google: {
    icon: Brain,
    gradient: "from-blue-500/20 to-blue-600/10",
    iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    label: "Google",
  },
  anthropic: {
    icon: Zap,
    gradient: "from-amber-500/20 to-amber-600/10",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    label: "Anthropic",
  },
};

const modelTypeConfig: Record<string, { icon: typeof MessageSquare; bg: string; label: string }> = {
  chat: {
    icon: MessageSquare,
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "Chat",
  },
  call: {
    icon: Phone,
    bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    label: "Call",
  },
  both: {
    icon: PhoneCall,
    bg: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "Chat & Call",
  },
};

function formatTokenLimit(limit: number): string {
  if (limit >= 1_000_000) {
    return `${(limit / 1_000_000).toFixed(1)}M`;
  }
  if (limit >= 1_000) {
    return `${(limit / 1_000).toFixed(0)}K`;
  }
  return String(limit);
}

function formatPrice(price: string | null): string {
  if (!price) return "-";
  const num = parseFloat(price);
  if (num < 0.01) return `$${num.toFixed(4)}`;
  if (num < 1) return `$${num.toFixed(3)}`;
  return `$${num.toFixed(2)}`;
}

export function ModelCard({ model, onEdit, onDelete }: ModelCardProps) {
  const providerKey = model.provider ?? "openai";
  // providerConfig.openai is guaranteed to exist in the object literal above
  const { icon: Icon, iconBg, label: providerLabel } = providerConfig[providerKey] ?? providerConfig.openai!;
  const modelTypeKey = model.modelType ?? "chat";
  const { icon: TypeIcon, bg: typeBg, label: typeLabel } = modelTypeConfig[modelTypeKey] ?? modelTypeConfig.chat!;
  const settingsCount = Object.keys(model.settingsSchema || {}).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group p-5 flex flex-col h-full hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-3 rounded-2xl transition-all duration-300",
            iconBg,
            "group-hover:scale-110 group-hover:shadow-lg"
          )}>
            <Icon size={24} />
          </div>
          <div className="flex flex-col items-end gap-2">
            {model.isDefault && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Star size={11} />
                Default
              </div>
            )}
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              model.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", model.isActive ? "bg-success animate-pulse" : "bg-muted-foreground")} />
              {model.isActive ? "Active" : "Inactive"}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{model.displayName}</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium",
            iconBg
          )}>
            {providerLabel}
          </span>
          <span className={cn(
            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium",
            typeBg
          )}>
            <TypeIcon size={11} />
            {typeLabel}
          </span>
          {model.supportsAudio && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-pink-500/10 text-pink-600 dark:text-pink-400">
              Audio
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1 font-mono">{model.modelId}</p>

        {model.description && (
          <p className="text-sm text-muted-foreground flex-1 mt-3 line-clamp-2">
            {model.description}
          </p>
        )}

        {/* Token Limits & Pricing */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Context:</span>
            <span className="font-medium">{formatTokenLimit(model.inputLimit)} / {formatTokenLimit(model.outputLimit)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign size={12} />
              Pricing (per 1M):
            </span>
            <span className="font-medium text-xs">
              {formatPrice(model.inputPricePerMillion)} in / {formatPrice(model.outputPricePerMillion)} out
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Settings:</span>
            <span className="font-medium">{settingsCount} {settingsCount === 1 ? "parameter" : "parameters"}</span>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border/50 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
            onPress={() => onEdit(model)}
          >
            <Edit size={14} className="mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onPress={() => onDelete(model)}
            isDisabled={model.isDefault}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
