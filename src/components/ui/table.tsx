"use client";

import {
  Table as HeroTable,
  TableHeader as HeroTableHeader,
  TableColumn as HeroTableColumn,
  TableBody as HeroTableBody,
  TableRow as HeroTableRow,
  TableCell as HeroTableCell,
  type TableProps as HeroTableProps,
  Pagination,
  Spinner,
} from "@heroui/react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from "lucide-react";
import { type Key, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: number;
  align?: "start" | "center" | "end";
  render?: (item: T, index: number) => ReactNode;
}

export type SortDirection = "ascending" | "descending";

export interface SortDescriptor {
  column: string | number;
  direction: SortDirection;
}

export interface TableProps<T> extends Omit<HeroTableProps, "children" | "sortDescriptor" | "onSortChange"> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  sortDescriptor?: SortDescriptor;
  onSortChange?: (descriptor: SortDescriptor) => void;
  // Pagination
  showPagination?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = "id" as keyof T,
  isLoading = false,
  emptyMessage = "No data available",
  emptyIcon,
  sortDescriptor,
  onSortChange,
  showPagination = false,
  page = 1,
  totalPages = 1,
  onPageChange,
  className,
  ...props
}: TableProps<T>) {
  const getSortIcon = (columnKey: string) => {
    if (sortDescriptor?.column !== columnKey) {
      return <ChevronsUpDown size={14} className="text-default-300" />;
    }
    return sortDescriptor.direction === "ascending" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  const handleSort = (columnKey: Key) => {
    if (!onSortChange) return;

    const column = columns.find((c) => c.key === columnKey);
    if (!column?.sortable) return;

    const newDirection: SortDirection =
      sortDescriptor?.column === columnKey && sortDescriptor.direction === "ascending"
        ? "descending"
        : "ascending";

    onSortChange({ column: columnKey as string | number, direction: newDirection });
  };

  const renderCell = (item: T, column: Column<T>, index: number) => {
    if (column.render) {
      return column.render(item, index);
    }
    return item[column.key] as ReactNode;
  };

  return (
    <div className="space-y-4">
      <HeroTable
        aria-label="Data table"
        className={cn(className)}
        sortDescriptor={sortDescriptor as HeroTableProps["sortDescriptor"]}
        onSortChange={(descriptor) => {
          if (descriptor.column !== undefined) {
            handleSort(descriptor.column);
          }
        }}
        {...props}
      >
        <HeroTableHeader>
          {columns.map((column) => (
            <HeroTableColumn
              key={column.key}
              allowsSorting={column.sortable}
              width={column.width}
            >
              <div className="flex items-center gap-1">
                {column.label}
                {column.sortable && getSortIcon(column.key)}
              </div>
            </HeroTableColumn>
          ))}
        </HeroTableHeader>
        <HeroTableBody
          items={data}
          isLoading={isLoading}
          loadingContent={<Spinner size="lg" />}
          emptyContent={
            <div className="flex flex-col items-center justify-center py-12 text-default-500">
              {emptyIcon ?? <Inbox size={48} className="mb-4" />}
              <p>{emptyMessage}</p>
            </div>
          }
        >
          {(item) => (
            <HeroTableRow key={String(item[keyField])}>
              {columns.map((column, index) => (
                <HeroTableCell key={column.key}>
                  {renderCell(item, column, index)}
                </HeroTableCell>
              ))}
            </HeroTableRow>
          )}
        </HeroTableBody>
      </HeroTable>

      {showPagination && totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            total={totalPages}
            page={page}
            onChange={onPageChange}
            showControls
          />
        </div>
      )}
    </div>
  );
}

// Skeleton table for loading states
export interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-default-200 rounded w-24 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 bg-default-100 rounded animate-pulse"
              style={{ width: `${60 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export {
  HeroTableHeader as TableHeader,
  HeroTableColumn as TableColumn,
  HeroTableBody as TableBody,
  HeroTableRow as TableRow,
  HeroTableCell as TableCell,
};
