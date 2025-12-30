"use client";

import { Plus } from "lucide-react";
import { useCallback, useState } from "react";

import type { CompanyListItem } from "@/app/api/master-admin/companies/route";
import { PageHeader } from "@/components/layouts";
import {
  AddCompanyModal,
  BulkActions,
  CompaniesFilters,
  CompaniesTable,
  EditCompanyModal,
} from "@/components/master-admin/companies";
import { Button, Card, ConfirmationDialog } from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  deleteCompanies,
  updateCompaniesStatus,
  useCompanies,
  usePlans,
  type UseCompaniesOptions,
} from "@/hooks/master-admin";
import type { SortDescriptor } from "@/components/ui";

export default function CompaniesPage() {
  useSetPageTitle("Companies");
  // Filters state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [planId, setPlanId] = useState("");
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<CompanyListItem | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<CompanyListItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Build query options
  const options: UseCompaniesOptions = {
    page,
    pageSize: 10,
    search,
    status: status || undefined,
    planId: planId || undefined,
    sortBy: sortDescriptor.column as string,
    sortOrder: sortDescriptor.direction === "ascending" ? "asc" : "desc",
  };

  const { companies, pagination, isLoading: isLoadingCompanies, refresh } = useCompanies(options);
  const { plans } = usePlans();

  // Handle sort change
  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    setPage(1);
  }, []);

  // Handle search change - reset to page 1
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Handle status change - reset to page 1
  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  // Handle plan change - reset to page 1
  const handlePlanChange = useCallback((value: string) => {
    setPlanId(value);
    setPage(1);
  }, []);

  // Bulk actions
  const handleBulkActivate = useCallback(async () => {
    setIsLoading(true);
    try {
      await updateCompaniesStatus(Array.from(selectedIds), "active");
      setSelectedIds(new Set());
      refresh();
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, refresh]);

  const handleBulkSuspend = useCallback(async () => {
    setIsLoading(true);
    try {
      await updateCompaniesStatus(Array.from(selectedIds), "cancelled");
      setSelectedIds(new Set());
      refresh();
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, refresh]);

  const handleBulkDelete = useCallback(async () => {
    setIsLoading(true);
    try {
      await deleteCompanies(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
      refresh();
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, refresh]);

  const handleBulkExport = useCallback(() => {
    // TODO: Implement export functionality
    console.log("Export companies:", Array.from(selectedIds));
  }, [selectedIds]);

  // Single delete
  const handleDeleteCompany = useCallback(async () => {
    if (!deleteCompany) return;
    setIsLoading(true);
    try {
      await deleteCompanies([deleteCompany.id]);
      setDeleteCompany(null);
      refresh();
    } finally {
      setIsLoading(false);
    }
  }, [deleteCompany, refresh]);

  return (
    <div className="p-6">
      <PageHeader
        title="Companies"
        description="Manage all companies on the platform"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Companies" },
        ]}
        actions={
          <Button
            color="primary"
            startContent={<Plus size={18} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Company
          </Button>
        }
      />

      <Card className="p-4">
        <div className="space-y-4">
          {/* Filters */}
          <CompaniesFilters
            search={search}
            onSearchChange={handleSearchChange}
            status={status}
            onStatusChange={handleStatusChange}
            planId={planId}
            onPlanChange={handlePlanChange}
            plans={plans}
          />

          {/* Bulk Actions */}
          <BulkActions
            selectedCount={selectedIds.size}
            onActivate={handleBulkActivate}
            onSuspend={handleBulkSuspend}
            onDelete={() => setIsBulkDeleteOpen(true)}
            onExport={handleBulkExport}
            isLoading={isLoading}
          />

          {/* Table */}
          <CompaniesTable
            companies={companies}
            isLoading={isLoadingCompanies}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            sortDescriptor={sortDescriptor}
            onSortChange={handleSortChange}
            page={page}
            totalPages={pagination?.totalPages ?? 1}
            onPageChange={setPage}
            onEdit={setEditCompany}
            onDelete={setDeleteCompany}
          />
        </div>
      </Card>

      {/* Add Company Modal */}
      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={refresh}
        plans={plans}
      />

      {/* Edit Company Modal */}
      <EditCompanyModal
        isOpen={!!editCompany}
        onClose={() => setEditCompany(null)}
        onSuccess={refresh}
        company={editCompany}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteCompany}
        onClose={() => setDeleteCompany(null)}
        title="Delete Company"
        message={`Are you sure you want to delete "${deleteCompany?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger
        onConfirm={handleDeleteCompany}
        isLoading={isLoading}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        title="Delete Companies"
        message={`Are you sure you want to delete ${selectedIds.size} selected companies? This action cannot be undone.`}
        confirmLabel="Delete All"
        isDanger
        onConfirm={handleBulkDelete}
        isLoading={isLoading}
      />
    </div>
  );
}
