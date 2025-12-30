"use client";

import { Search } from "lucide-react";

import { Input, Select } from "@/components/ui";

const actionOptions = [
  { value: "all", label: "All Actions" },
  { value: "company", label: "Company Actions" },
  { value: "user", label: "User Actions" },
  { value: "agent", label: "Agent Actions" },
  { value: "plan", label: "Plan Actions" },
  { value: "package", label: "Package Actions" },
  { value: "settings", label: "Settings Actions" },
  { value: "auth", label: "Auth Actions" },
];

const resourceOptions = [
  { value: "all", label: "All Resources" },
  { value: "company", label: "Company" },
  { value: "user", label: "User" },
  { value: "agent", label: "Agent" },
  { value: "plan", label: "Plan" },
  { value: "package", label: "Package" },
  { value: "settings", label: "Settings" },
  { value: "auth", label: "Auth" },
];

interface AuditLogsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  action: string;
  onActionChange: (value: string) => void;
  resource: string;
  onResourceChange: (value: string) => void;
}

export function AuditLogsFilters({
  search,
  onSearchChange,
  action,
  onActionChange,
  resource,
  onResourceChange,
}: AuditLogsFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1">
        <Input
          placeholder="Search logs..."
          value={search}
          onValueChange={onSearchChange}
          startContent={<Search size={16} className="text-default-400" />}
        />
      </div>

      <div className="flex gap-2">
        <Select
          aria-label="Filter by action"
          selectedKeys={new Set([action || "all"])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            onActionChange(selected === "all" ? "" : selected);
          }}
          options={actionOptions}
          className="w-40"
        />

        <Select
          aria-label="Filter by resource"
          selectedKeys={new Set([resource || "all"])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            onResourceChange(selected === "all" ? "" : selected);
          }}
          options={resourceOptions}
          className="w-40"
        />
      </div>
    </div>
  );
}
