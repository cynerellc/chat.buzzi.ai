"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  TrendingUp,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { Button, Card, Badge, Spinner, Chip, Divider } from "@/components/ui";
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

  const generateSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Implement actual AI summary API
      // For now, using mock data
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

  const getSentimentColor = (label: ConversationSummary["sentiment"]["label"]) => {
    switch (label) {
      case "positive":
        return "text-success";
      case "negative":
        return "text-danger";
      default:
        return "text-warning";
    }
  };

  const getUrgencyBadge = (level: ConversationSummary["urgencyLevel"]) => {
    switch (level) {
      case "high":
        return <Badge variant="danger">High Priority</Badge>;
      case "medium":
        return <Badge variant="warning">Medium Priority</Badge>;
      default:
        return <Badge variant="default">Low Priority</Badge>;
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className={cn(
          "flex items-center justify-center w-full p-2 bg-content2 hover:bg-content3 transition-colors rounded-lg",
          className
        )}
      >
        <Sparkles size={16} className="text-primary mr-2" />
        <span className="text-sm">AI Summary</span>
        <ChevronDown size={16} className="ml-2" />
      </button>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-divider bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="font-medium text-sm">AI Summary</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            onClick={generateSummary}
            isDisabled={loading}
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4 text-sm">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
              <span className="ml-2 text-default-500">Analyzing conversation...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-4 text-danger">
              <AlertCircle size={16} className="mr-2" />
              {error}
            </div>
          ) : summary ? (
            <>
              {/* Summary */}
              <div>
                <p className="text-default-700 leading-relaxed">{summary.summary}</p>
                <p className="text-xs text-default-400 mt-2 flex items-center gap-1">
                  <Clock size={12} />
                  Generated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}
                </p>
              </div>

              <Divider />

              {/* Key Points */}
              <div>
                <h4 className="font-medium text-default-600 mb-2">Key Points</h4>
                <ul className="space-y-1">
                  {summary.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-default-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <Divider />

              {/* Customer Intent & Urgency */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium text-default-600 mb-1">Customer Intent</h4>
                  <p className="text-default-500">{summary.customerIntent}</p>
                </div>
                <div>{getUrgencyBadge(summary.urgencyLevel)}</div>
              </div>

              <Divider />

              {/* Sentiment */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-default-500" />
                  <span className="text-default-600">Sentiment</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium capitalize", getSentimentColor(summary.sentiment.label))}>
                    {summary.sentiment.label}
                  </span>
                  <Badge
                    variant={
                      summary.sentiment.trend === "improving"
                        ? "success"
                        : summary.sentiment.trend === "declining"
                        ? "danger"
                        : "default"
                    }
                    className="capitalize text-xs"
                  >
                    {summary.sentiment.trend}
                  </Badge>
                </div>
              </div>

              <Divider />

              {/* Suggested Tags */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={14} className="text-default-500" />
                  <h4 className="font-medium text-default-600">Suggested Tags</h4>
                </div>
                <div className="flex flex-wrap gap-1">
                  {summary.suggestedTags.map((tag) => (
                    <Chip
                      key={tag}
                      size="sm"
                      variant="bordered"
                      className="text-xs cursor-pointer hover:bg-default-100"
                    >
                      {tag}
                    </Chip>
                  ))}
                </div>
              </div>

              <Divider />

              {/* Suggested Responses */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={14} className="text-warning" />
                  <h4 className="font-medium text-default-600">Suggested Responses</h4>
                </div>
                <div className="space-y-2">
                  {summary.suggestedResponses.map((response, index) => (
                    <button
                      key={index}
                      className="w-full p-2 text-left bg-default-50 hover:bg-default-100 rounded-lg text-default-600 transition-colors text-xs"
                      onClick={() => {
                        if (onSuggestedResponse) {
                          onSuggestedResponse(response);
                        } else {
                          navigator.clipboard.writeText(response);
                        }
                      }}
                    >
                      {response}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center text-default-400">
              No summary available
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default AISummaryPanel;
