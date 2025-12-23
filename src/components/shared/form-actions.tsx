"use client";

import { type ReactNode } from "react";
import { Save, X, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "../ui";

export interface FormActionsProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  deleteLabel?: string;
  submitIcon?: LucideIcon;
  isLoading?: boolean;
  isDisabled?: boolean;
  showDelete?: boolean;
  align?: "left" | "center" | "right" | "between";
  className?: string;
  children?: ReactNode;
}

export function FormActions({
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  deleteLabel = "Delete",
  submitIcon = Save,
  isLoading = false,
  isDisabled = false,
  showDelete = false,
  align = "right",
  className,
  children,
}: FormActionsProps) {
  const alignClasses = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
    between: "justify-between",
  };

  return (
    <div className={cn("flex items-center gap-3 pt-4", alignClasses[align], className)}>
      {align === "between" && showDelete && onDelete && (
        <Button
          variant="light"
          color="danger"
          leftIcon={Trash2}
          onPress={onDelete}
          isDisabled={isLoading || isDisabled}
        >
          {deleteLabel}
        </Button>
      )}

      <div className="flex items-center gap-3">
        {children}

        {onCancel && (
          <Button
            variant="bordered"
            leftIcon={X}
            onPress={onCancel}
            isDisabled={isLoading}
          >
            {cancelLabel}
          </Button>
        )}

        {onSubmit && (
          <Button
            color="primary"
            leftIcon={submitIcon}
            onPress={onSubmit}
            isLoading={isLoading}
            isDisabled={isDisabled}
          >
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// Sticky form actions for long forms
export interface StickyFormActionsProps extends FormActionsProps {
  visible?: boolean;
}

export function StickyFormActions({ visible = true, className, ...props }: StickyFormActionsProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-sm border-t border-divider",
        className
      )}
    >
      <FormActions {...props} />
    </div>
  );
}

// Form footer with additional info
export interface FormFooterProps extends FormActionsProps {
  helpText?: string;
  lastSaved?: Date;
}

export function FormFooter({ helpText, lastSaved, className, ...props }: FormFooterProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <FormActions {...props} />
      {(helpText || lastSaved) && (
        <div className="flex items-center justify-between text-xs text-default-400">
          {helpText && <span>{helpText}</span>}
          {lastSaved && (
            <span>
              Last saved:{" "}
              {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
