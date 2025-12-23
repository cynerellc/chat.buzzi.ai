"use client";

import { Search, Filter, X } from "lucide-react";
import { Input as HeroInput } from "@heroui/react";

import { Button, Select, Badge } from "@/components/ui";

interface AgentsFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Draft" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "faq", label: "FAQ" },
  { value: "custom", label: "Custom" },
];

export function AgentsFilters({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  onClearFilters,
}: AgentsFiltersProps) {
  const hasActiveFilters =
    searchValue ||
    statusFilter !== "all" ||
    typeFilter !== "all";

  const activeFilterCount =
    (searchValue ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <HeroInput
            placeholder="Search agents by name..."
            value={searchValue}
            onValueChange={onSearchChange}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => onSearchChange("")}
          />
        </div>

        <Select
          options={STATUS_OPTIONS}
          selectedKeys={new Set([statusFilter])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            onStatusFilterChange(selected as string);
          }}
          className="w-[150px]"
        />

        <Select
          options={TYPE_OPTIONS}
          selectedKeys={new Set([typeFilter])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            onTypeFilterChange(selected as string);
          }}
          className="w-[150px]"
        />

        {hasActiveFilters && (
          <Button
            variant="bordered"
            leftIcon={X}
            onPress={onClearFilters}
          >
            Clear Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

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
          {typeFilter !== "all" && (
            <Badge variant="info" className="flex items-center gap-1">
              Type: {TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label}
              <button
                onClick={() => onTypeFilterChange("all")}
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
