"use client";

import { AlertTriangle, Info, CheckCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui";

export type ConfirmationVariant = "default" | "danger" | "warning" | "success";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
  icon?: LucideIcon;
}

const variantConfig: Record<ConfirmationVariant, { icon: LucideIcon; color: string; bgColor: string; buttonColor: "default" | "primary" | "secondary" | "success" | "warning" | "danger" }> = {
  default: { icon: Info, color: "text-primary", bgColor: "bg-primary/10", buttonColor: "primary" },
  danger: { icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10", buttonColor: "danger" },
  warning: { icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/10", buttonColor: "warning" },
  success: { icon: CheckCircle, color: "text-success", bgColor: "bg-success/10", buttonColor: "success" },
};

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
  icon,
}: ConfirmationDialogProps) {
  const config = variantConfig[variant];
  const Icon = icon ?? config.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full", config.bgColor)}>
            <Icon className={config.color} size={20} />
          </div>
          <span className="font-semibold">{title}</span>
        </ModalHeader>
        <ModalBody>
          {typeof message === "string" ? (
            <p className="text-muted-foreground">{message}</p>
          ) : (
            message
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onPress={onClose} isDisabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            color={config.buttonColor}
            onPress={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
