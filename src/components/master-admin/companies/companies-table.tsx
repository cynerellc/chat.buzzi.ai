"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

import type { CompanyListItem } from "@/app/api/master-admin/companies/route";
import {
  Badge,
  Checkbox,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Table,
  UserAvatar,
  type BadgeVariant,
  type Column,
  type SortDescriptor,
} from "@/components/ui";
import { Dropdown } from "@heroui/react";

interface CompaniesTableProps {
  companies: CompanyListItem[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (company: CompanyListItem) => void;
  onDelete: (company: CompanyListItem) => void;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  trial: "warning",
  past_due: "danger",
  grace_period: "warning",
  expired: "danger",
  cancelled: "default",
};

export function CompaniesTable({
  companies,
  isLoading,
  selectedIds,
  onSelectionChange,
  sortDescriptor,
  onSortChange,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}: CompaniesTableProps) {
  const toggleSelection = useCallback(
    (id: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange]
  );

  const columns: Column<CompanyListItem>[] = [
    {
      key: "select",
      label: "",
      width: 40,
      render: (item) => (
        <Checkbox
          isSelected={selectedIds.has(item.id)}
          onValueChange={() => toggleSelection(item.id)}
          aria-label={`Select ${item.name}`}
        />
      ),
    },
    {
      key: "name",
      label: "Company",
      sortable: true,
      render: (item) => (
        <Link
          href={`/admin/companies/${item.id}`}
          className="flex items-center gap-3 group"
        >
          <UserAvatar name={item.name} src={item.logoUrl ?? undefined} size="sm" />
          <div className="min-w-0">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {item.name}
            </p>
            <p className="text-xs text-default-400 truncate">
              {item.domain ?? item.slug}
            </p>
          </div>
        </Link>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      render: (item) =>
        item.plan ? (
          <Badge variant="info" size="sm">
            {item.plan.name}
          </Badge>
        ) : (
          <span className="text-default-400 text-sm">No plan</span>
        ),
    },
    {
      key: "usersCount",
      label: "Users",
      sortable: true,
      align: "center",
      render: (item) => (
        <div className="flex items-center gap-1 text-default-600">
          <Users size={14} />
          <span>{item.usersCount}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (item) => (
        <Badge variant={statusBadgeVariants[item.status] ?? "default"} size="sm">
          {item.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-default-500">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      width: 60,
      align: "end",
      render: (item) => (
        <Dropdown>
          <DropdownTrigger>
            <button
              className="p-1.5 rounded-lg hover:bg-default-100 transition-colors"
              aria-label="Actions"
            >
              <MoreHorizontal size={18} className="text-default-500" />
            </button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Company actions">
            <DropdownItem
              key="view"
              href={`/admin/companies/${item.id}`}
              startContent={<Eye size={16} />}
            >
              View Details
            </DropdownItem>
            <DropdownItem
              key="edit"
              startContent={<Pencil size={16} />}
              onPress={() => onEdit(item)}
            >
              Edit Company
            </DropdownItem>
            <DropdownItem
              key="impersonate"
              startContent={<UserCog size={16} />}
              href={`/admin/companies/${item.id}?tab=users`}
            >
              Manage Users
            </DropdownItem>
            <DropdownItem
              key="delete"
              className="text-danger"
              color="danger"
              startContent={<Trash2 size={16} />}
              onPress={() => onDelete(item)}
            >
              Delete Company
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      ),
    },
  ];

  return (
    <Table
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      data={companies as unknown as Record<string, unknown>[]}
      keyField="id"
      isLoading={isLoading}
      emptyMessage="No companies found"
      emptyIcon={<Building2 size={48} className="text-default-300 mb-4" />}
      sortDescriptor={sortDescriptor}
      onSortChange={onSortChange}
      showPagination
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      selectionMode="multiple"
    />
  );
}

// Header with select all checkbox
export function CompaniesTableHeader({
  selectedCount,
  totalCount,
  onSelectAll,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
}) {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

  return (
    <div className="flex items-center gap-3 px-2 py-3 border-b border-divider">
      <Checkbox
        isSelected={isAllSelected}
        isIndeterminate={isIndeterminate}
        onValueChange={onSelectAll}
        aria-label="Select all"
      />
      <span className="text-sm text-default-500">
        {selectedCount > 0
          ? `${selectedCount} selected`
          : `${totalCount} companies`}
      </span>
    </div>
  );
}
