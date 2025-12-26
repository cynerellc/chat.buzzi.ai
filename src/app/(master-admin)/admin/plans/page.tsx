"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layouts";
import { PlanEditorModal, PlansGrid } from "@/components/master-admin/plans";
import { Button } from "@/components/ui";
import { usePlans, type PlanListItem } from "@/hooks/master-admin";

export default function PlansPage() {
  const { plans, isLoading, refresh } = usePlans();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanListItem | null>(null);

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setIsEditorOpen(true);
  };

  const handleEditPlan = (plan: PlanListItem) => {
    setEditingPlan(plan);
    setIsEditorOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingPlan(null);
  };

  const handleEditorSuccess = () => {
    refresh();
    handleEditorClose();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Subscription Plans"
        description="Manage subscription plans and pricing for your customers"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Plans" },
        ]}
        actions={
          <Button
            color="primary"
            startContent={<Plus size={16} />}
            onClick={handleCreatePlan}
          >
            Create Plan
          </Button>
        }
      />

      <PlansGrid plans={plans} isLoading={isLoading} onEdit={handleEditPlan} />

      <PlanEditorModal
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        onSuccess={handleEditorSuccess}
        plan={editingPlan}
      />
    </div>
  );
}
