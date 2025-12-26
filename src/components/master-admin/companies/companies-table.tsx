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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Table,
  UserAvatar,
  type BadgeVariant,
  type Column,
  type SortDescriptor,
} from "@/components/ui";

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
            <p className="text-xs text-muted-foreground truncate">
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
          <span className="text-muted-foreground text-sm">No plan</span>
        ),
    },
    {
      key: "usersCount",
      label: "Users",
      sortable: true,
      align: "center",
      render: (item) => (
        <div className="flex items-center gap-1 text-muted-foreground">
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
        <span className="text-sm text-muted-foreground">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Actions"
            >
              <MoreHorizontal size={18} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/companies/${item.id}`}>
                <Eye size={16} className="mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(item)}>
              <Pencil size={16} className="mr-2" />
              Edit Company
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/companies/${item.id}?tab=users`}>
                <UserCog size={16} className="mr-2" />
                Manage Users
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2 size={16} className="mr-2" />
              Delete Company
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      emptyIcon={<Building2 size={48} className="text-muted-foreground/50 mb-4" />}
      sortDescriptor={sortDescriptor}
      onSortChange={onSortChange}
      showPagination
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
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
  const checkedState = isIndeterminate ? "indeterminate" : isAllSelected;

  return (
    <div className="flex items-center gap-3 px-2 py-3 border-b border-divider">
      <Checkbox
        checked={checkedState}
        onCheckedChange={onSelectAll}
        aria-label="Select all"
      />
      <span className="text-sm text-muted-foreground">
        {selectedCount > 0
          ? `${selectedCount} selected`
          : `${totalCount} companies`}
      </span>
    </div>
  );
}
