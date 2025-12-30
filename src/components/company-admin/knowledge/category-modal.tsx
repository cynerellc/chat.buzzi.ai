"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@/components/ui";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function CategoryModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: CategoryModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    // Reset state when closing
    setName("");
    setError(null);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Category name is required");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Category name must be at least 2 characters");
      return;
    }

    if (trimmedName.length > 50) {
      setError("Category name must be less than 50 characters");
      return;
    }

    try {
      await onSubmit(trimmedName);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            <span>Create Category</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <Input
            label="Category Name"
            placeholder="e.g., Product Documentation, FAQs, Policies"
            value={name}
            onValueChange={(v) => {
              setName(v);
              setError(null);
            }}
            isInvalid={!!error}
            errorMessage={error ?? undefined}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isSubmitting) {
                handleSubmit();
              }
            }}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Categories help organize your knowledge sources and FAQs. Each category can contain
            multiple sources and FAQs that your AI agents can search through.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onPress={handleClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!name.trim()}
          >
            Create Category
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
