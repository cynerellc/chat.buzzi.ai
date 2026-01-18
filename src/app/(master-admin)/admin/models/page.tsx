"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layouts";
import { ModelsFilters, ModelsGrid, ModelEditorModal } from "@/components/master-admin/models";
import { Button, ConfirmationDialog } from "@/components/ui";
import { useSetBreadcrumbs } from "@/contexts/page-context";
import { useModels, deleteModel, type ModelListItem } from "@/hooks/master-admin/useModels";

export default function ModelsPage() {
  useSetBreadcrumbs([{ label: "AI Models" }]);
  const [provider, setProvider] = useState("all");
  const [editingModel, setEditingModel] = useState<ModelListItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModelListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { models, isLoading, refresh } = useModels({
    provider: provider === "all" ? undefined : (provider as "openai" | "google" | "anthropic"),
  });

  const handleCreateModel = () => {
    setEditingModel(null);
    setIsEditorOpen(true);
  };

  const handleEditModel = (model: ModelListItem) => {
    setEditingModel(model);
    setIsEditorOpen(true);
  };

  const handleDeleteModel = (model: ModelListItem) => {
    setDeleteTarget(model);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteModel(deleteTarget.id);
      toast.success("Model deleted successfully");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete model");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="AI Models"
        description="Manage AI models available for chatbot agents"
        actions={
          <Button
            color="primary"
            startContent={<Plus size={16} />}
            onClick={handleCreateModel}
          >
            Add Model
          </Button>
        }
      />

      <ModelsFilters
        selectedProvider={provider}
        onProviderChange={setProvider}
      />

      <ModelsGrid
        models={models}
        isLoading={isLoading}
        onEdit={handleEditModel}
        onDelete={handleDeleteModel}
      />

      {/* Model Editor Modal */}
      <ModelEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        model={editingModel}
        onSuccess={refresh}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Model"
        message={
          <>
            Are you sure you want to delete <strong>{deleteTarget?.displayName}</strong>?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
