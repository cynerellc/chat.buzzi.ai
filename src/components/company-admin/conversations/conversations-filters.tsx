"use client";

import { Search, Filter, X, Calendar, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Button, Select, Badge, Card, CardBody, Input } from "@/components/ui";

interface ConversationsFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  channelFilter: string;
  onChannelFilterChange: (value: string) => void;
  agentFilter: string;
  onAgentFilterChange: (value: string) => void;
  agents: { id: string; name: string }[];
  dateRange?: { start: Date | null; end: Date | null };
  onDateRangeChange?: (range: { start: Date | null; end: Date | null }) => void;
  onClearFilters: () => void;
  statusCounts?: Record<string, number>;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "waiting_human", label: "Waiting for Human" },
  { value: "with_human", label: "With Human" },
  { value: "resolved", label: "Resolved" },
  { value: "abandoned", label: "Abandoned" },
];

const CHANNEL_OPTIONS = [
  { value: "all", label: "All Channels" },
  { value: "web", label: "Web Widget" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Teams" },
];

export function ConversationsFilters({
  searchValue,
  onSearchChange,
  onSearch,
  statusFilter,
  onStatusFilterChange,
  channelFilter,
  onChannelFilterChange,
  agentFilter,
  onAgentFilterChange,
  agents,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  statusCounts = {},
}: ConversationsFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const agentOptions = [
    { value: "", label: "All Agents" },
    ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
  ];

  const hasActiveFilters =
    searchValue ||
    statusFilter !== "all" ||
    channelFilter !== "all" ||
    agentFilter ||
    (dateRange?.start || dateRange?.end);

  const activeFilterCount =
    (searchValue ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (channelFilter !== "all" ? 1 : 0) +
    (agentFilter ? 1 : 0) +
    (dateRange?.start || dateRange?.end ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => {
          const count =
            status.value === "all"
              ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
              : statusCounts[status.value] || 0;
          const isActive = statusFilter === status.value;

          return (
            <Button
              key={status.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange(status.value)}
            >
              {status.label}
              {count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-muted">
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name, email, or message..."
                value={searchValue}
                onValueChange={onSearchChange}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                startContent={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>

            <Select
              options={agentOptions}
              selectedKeys={new Set([agentFilter || ""])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                onAgentFilterChange(selected as string);
              }}
              className="w-[180px]"
              placeholder="All Agents"
            />

            <Select
              options={CHANNEL_OPTIONS}
              selectedKeys={new Set([channelFilter])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                onChannelFilterChange(selected as string);
              }}
              className="w-[150px]"
            />

            <Button
              variant="outline"
              leftIcon={SlidersHorizontal}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              More Filters
              {activeFilterCount > 0 && (
                <Badge variant="info" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                color="danger"
                leftIcon={X}
                onPress={onClearFilters}
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Range */}
                {onDateRangeChange && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        placeholder="Start date"
                        value={dateRange?.start?.toISOString().split("T")[0] || ""}
                        onChange={(e) =>
                          onDateRangeChange({
                            ...dateRange,
                            start: e.target.value ? new Date(e.target.value) : null,
                            end: dateRange?.end || null,
                          })
                        }
                      />
                      <Input
                        type="date"
                        placeholder="End date"
                        value={dateRange?.end?.toISOString().split("T")[0] || ""}
                        onChange={(e) =>
                          onDateRangeChange({
                            ...dateRange,
                            start: dateRange?.start || null,
                            end: e.target.value ? new Date(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Additional filters can be added here */}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchValue && (
            <Badge variant="info" className="flex items-center gap-1">
              Search: {searchValue}
              <button
                onClick={() => onSearchChange("")}
                className="ml-1 hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="info" className="flex items-center gap-1">
              Status: {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}
              <button
                onClick={() => onStatusFilterChange("all")}
                className="ml-1 hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {channelFilter !== "all" && (
            <Badge variant="info" className="flex items-center gap-1">
              Channel: {CHANNEL_OPTIONS.find((o) => o.value === channelFilter)?.label}
              <button
                onClick={() => onChannelFilterChange("all")}
                className="ml-1 hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {agentFilter && (
            <Badge variant="info" className="flex items-center gap-1">
              Agent: {agentOptions.find((o) => o.value === agentFilter)?.label}
              <button
                onClick={() => onAgentFilterChange("")}
                className="ml-1 hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(dateRange?.start || dateRange?.end) && (
            <Badge variant="info" className="flex items-center gap-1">
              Date: {dateRange?.start?.toLocaleDateString()} -{" "}
              {dateRange?.end?.toLocaleDateString()}
              <button
                onClick={() =>
                  onDateRangeChange?.({ start: null, end: null })
                }
                className="ml-1 hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
