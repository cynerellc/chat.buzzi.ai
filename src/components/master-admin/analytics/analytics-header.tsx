"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui";

interface DateRange {
  label: string;
  days: number;
}

const dateRanges: DateRange[] = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
];

interface AnalyticsHeaderProps {
  selectedDays: number;
  onDaysChange: (days: number) => void;
  onExport?: () => void;
}

export function AnalyticsHeader({
  selectedDays,
  onDaysChange,
  onExport,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        {dateRanges.map((range) => (
          <Button
            key={range.days}
            variant={selectedDays === range.days ? "default" : "outline"}
            size="sm"
            onClick={() => onDaysChange(range.days)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {onExport && (
        <Button
          variant="secondary"
          startContent={<Download size={16} />}
          onClick={onExport}
        >
          Export Report
        </Button>
      )}
    </div>
  );
}
