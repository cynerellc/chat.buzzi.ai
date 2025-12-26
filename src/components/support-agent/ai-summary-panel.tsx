"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Lightbulb,
  Target,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { Button, Card, CardHeader, CardBody, Badge, Spinner, Chip, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ConversationSummary {
  summary: string;
  keyPoints: string[];
  suggestedTags: string[];
  sentiment: {
    score: number;
    label: "positive" | "neutral" | "negative";
    trend: "improving" | "stable" | "declining";
  };
  suggestedResponses: string[];
  customerIntent: string;
  urgencyLevel: "low" | "medium" | "high";
  generatedAt: string;
}

export interface AISummaryPanelProps {
  conversationId: string;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSuggestedResponse?: (response: string) => void;
}

const urgencyConfig = {
  high: { label: "High Priority", color: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  medium: { label: "Medium Priority", color: "bg-warning/10 text-warning", dot: "bg-warning" },
  low: { label: "Low Priority", color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const sentimentConfig = {
  positive: { color: "text-success", bg: "bg-success/10", icon: TrendingUp },
  neutral: { color: "text-amber-500", bg: "bg-amber-500/10", icon: Minus },
  negative: { color: "text-destructive", bg: "bg-destructive/10", icon: TrendingDown },
};

const trendConfig = {
  improving: { color: "text-success", bg: "bg-success/10" },
  stable: { color: "text-muted-foreground", bg: "bg-muted" },
  declining: { color: "text-destructive", bg: "bg-destructive/10" },
};

export function AISummaryPanel({
  conversationId,
  className,
  collapsed = false,
  onToggleCollapse,
  onSuggestedResponse,
}: AISummaryPanelProps) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockSummary: ConversationSummary = {
        summary:
          "Customer is inquiring about a refund for their recent order. They mentioned the product arrived damaged and are seeking either a replacement or full refund.",
        keyPoints: [
          "Product arrived damaged",
          "Order placed 3 days ago",
          "Requesting refund or replacement",
          "Has attached photos of damage",
        ],
        suggestedTags: ["refund", "damaged-product", "urgent"],
        sentiment: {
          score: 35,
          label: "neutral",
          trend: "stable",
        },
        suggestedResponses: [
          "I apologize for the inconvenience. Let me process your refund right away.",
          "I understand your frustration. I can arrange a replacement to be shipped today.",
        ],
        customerIntent: "Request refund or replacement for damaged product",
        urgencyLevel: "medium",
        generatedAt: new Date().toISOString(),
      };

      setSummary(mockSummary);
    } catch (err) {
      setError("Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!collapsed) {
      generateSummary();
    }
  }, [conversationId, collapsed, generateSummary]);

  const handleCopyResponse = (response: string, index: number) => {
    if (onSuggestedResponse) {
      onSuggestedResponse(response);
    } else {
      navigator.clipboard.writeText(response);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (collapsed) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleCollapse}
        className={cn(
          "flex items-center justify-center w-full p-3 rounded-xl transition-all duration-200",
          "bg-gradient-to-r from-primary/10 to-violet-500/10 hover:from-primary/15 hover:to-violet-500/15",
          "border border-primary/20",
          className
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 mr-3">
          <Sparkles size={16} className="text-primary" />
        </div>
        <span className="text-sm font-medium">AI Summary</span>
        <ChevronDown size={16} className="ml-auto text-muted-foreground" />
      </motion.button>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/15">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Summary</h3>
            {summary && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={10} />
                {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onPress={generateSummary}
            isDisabled={loading}
            className="h-7 w-7"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardBody className="p-4 space-y-4 text-sm">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 py-4">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 animate-pulse" />
                      <motion.div
                        className="absolute inset-0 rounded-xl border-2 border-primary/30"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-12 rounded-xl" />
                    <Skeleton className="h-12 rounded-xl" />
                  </div>
                </div>
              ) : error ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-6 text-destructive"
                >
                  <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-3">
                    <AlertCircle size={24} />
                  </div>
                  <p className="font-medium">{error}</p>
                  <Button variant="ghost" size="sm" className="mt-2" onPress={generateSummary}>
                    Try again
                  </Button>
                </motion.div>
              ) : summary ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* Summary Text */}
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-foreground leading-relaxed">{summary.summary}</p>
                  </div>

                  {/* Urgency & Sentiment Row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Urgency */}
                    <div className={cn(
                      "p-3 rounded-xl",
                      urgencyConfig[summary.urgencyLevel].color
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("h-2 w-2 rounded-full animate-pulse", urgencyConfig[summary.urgencyLevel].dot)} />
                        <span className="text-xs font-medium uppercase tracking-wider">Priority</span>
                      </div>
                      <p className="font-semibold">{urgencyConfig[summary.urgencyLevel].label.split(" ")[0]}</p>
                    </div>

                    {/* Sentiment */}
                    <div className={cn(
                      "p-3 rounded-xl",
                      sentimentConfig[summary.sentiment.label].bg
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        {(() => {
                          const Icon = sentimentConfig[summary.sentiment.label].icon;
                          return <Icon size={12} className={sentimentConfig[summary.sentiment.label].color} />;
                        })()}
                        <span className="text-xs font-medium uppercase tracking-wider">Sentiment</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn("font-semibold capitalize", sentimentConfig[summary.sentiment.label].color)}>
                          {summary.sentiment.label}
                        </p>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded capitalize",
                          trendConfig[summary.sentiment.trend].bg,
                          trendConfig[summary.sentiment.trend].color
                        )}>
                          {summary.sentiment.trend}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Points */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Key Points
                    </h4>
                    <ul className="space-y-1.5">
                      {summary.keyPoints.map((point, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-2 text-foreground"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          {point}
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* Customer Intent */}
                  <div className="p-3 rounded-xl border border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={14} className="text-primary" />
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Customer Intent
                      </h4>
                    </div>
                    <p className="text-foreground">{summary.customerIntent}</p>
                  </div>

                  {/* Suggested Tags */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag size={14} className="text-muted-foreground" />
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Suggested Tags
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.suggestedTags.map((tag) => (
                        <motion.button
                          key={tag}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {tag}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Responses */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} className="text-amber-500" />
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Suggested Responses
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {summary.suggestedResponses.map((response, index) => (
                        <motion.button
                          key={index}
                          whileHover={{ scale: 1.01, x: 2 }}
                          className={cn(
                            "group w-full p-3 text-left rounded-xl transition-all duration-200",
                            "bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-primary/20",
                            "text-foreground text-xs leading-relaxed"
                          )}
                          onClick={() => handleCopyResponse(response, index)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span>{response}</span>
                            <div className={cn(
                              "shrink-0 h-6 w-6 rounded-lg flex items-center justify-center transition-all",
                              copiedIndex === index
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100"
                            )}>
                              {copiedIndex === index ? (
                                <Check size={12} />
                              ) : (
                                <ArrowRight size={12} />
                              )}
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="py-6 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Sparkles size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No summary available</p>
                </div>
              )}
            </CardBody>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default AISummaryPanel;
