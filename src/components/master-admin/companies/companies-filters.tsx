"use client";

import { Search, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button, Input, Select } from "@/components/ui";

interface CompaniesFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  planId: string;
  onPlanChange: (planId: string) => void;
  plans: Array<{ id: string; name: string }>;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "past_due", label: "Past Due" },
  { value: "grace_period", label: "Grace Period" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

export function CompaniesFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  planId,
  onPlanChange,
  plans,
}: CompaniesFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      // Simple debounce using setTimeout
      const timeoutId = setTimeout(() => {
        onSearchChange(value);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [onSearchChange]
  );

  const clearFilters = useCallback(() => {
    setLocalSearch("");
    onSearchChange("");
    onStatusChange("");
    onPlanChange("");
  }, [onSearchChange, onStatusChange, onPlanChange]);

  const hasFilters = search || status || planId;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 max-w-md">
        <Input
          placeholder="Search companies..."
          value={localSearch}
          onValueChange={handleSearchChange}
          startContent={<Search size={18} className="text-default-400" />}
          endContent={
            localSearch ? (
              <button
                onClick={() => handleSearchChange("")}
                className="p-0.5 rounded hover:bg-default-200"
              >
                <X size={14} />
              </button>
            ) : null
          }
          isClearable={false}
        />
      </div>

      <Select
        placeholder="Status"
        selectedKeys={status ? new Set([status]) : new Set()}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as string;
          onStatusChange(selected ?? "");
        }}
        className="w-40"
        options={statusOptions.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
      />

      <Select
        placeholder="Plan"
        selectedKeys={planId ? new Set([planId]) : new Set()}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as string;
          onPlanChange(selected ?? "");
        }}
        className="w-40"
        options={[
          { value: "", label: "All Plans" },
          ...plans.map((plan) => ({
            value: plan.id,
            label: plan.name,
          })),
        ]}
      />

      {hasFilters && (
        <Button variant="flat" size="sm" onPress={clearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}
