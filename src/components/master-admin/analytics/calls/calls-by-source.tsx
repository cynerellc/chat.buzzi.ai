"use client";

import { Globe, MessageCircle, Phone } from "lucide-react";

import { Card, Skeleton, Progress } from "@/components/ui";
import type { CallsBySource } from "@/hooks/master-admin";

interface CallsBySourceListProps {
  data: CallsBySource[];
  isLoading: boolean;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  web: <Globe size={18} />,
  whatsapp: <MessageCircle size={18} />,
  twilio: <Phone size={18} />,
};

const SOURCE_LABELS: Record<string, string> = {
  web: "Web Widget",
  whatsapp: "WhatsApp",
  twilio: "Twilio",
  unknown: "Unknown",
};

const SOURCE_COLORS: Record<string, string> = {
  web: "primary",
  whatsapp: "success",
  twilio: "secondary",
  unknown: "default",
};

export function CallsBySourceList({ data, isLoading }: CallsBySourceListProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Calls by Source</h3>
        <div className="h-[200px] flex items-center justify-center text-default-400">
          No call data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Calls by Source</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.source}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-default-500">
                  {SOURCE_ICONS[item.source] || <Phone size={18} />}
                </span>
                <span className="text-sm font-medium">
                  {SOURCE_LABELS[item.source] || item.source}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-500">
                  {item.count.toLocaleString()} calls
                </span>
                <span className="text-sm font-medium">{item.percentage}%</span>
              </div>
            </div>
            <Progress
              value={item.percentage}
              color={
                SOURCE_COLORS[item.source] as
                  | "primary"
                  | "success"
                  | "secondary"
                  | "default"
              }
              size="sm"
              className="h-2"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
