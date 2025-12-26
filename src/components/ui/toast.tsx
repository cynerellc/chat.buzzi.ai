"use client";

import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

// Re-export Sonner's Toaster with our default configuration
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "group border-border",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  );
}

// Legacy interface for backwards compatibility
interface ToastOptions {
  type?: "default" | "info" | "success" | "warning" | "error";
  // HeroUI uses 'color' instead of 'type'
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  title?: string;
  message?: string;
  description?: string;
  duration?: number;
}

// Map HeroUI color to toast type
function mapColorToType(
  color?: ToastOptions["color"]
): "default" | "info" | "success" | "warning" | "error" {
  switch (color) {
    case "success":
      return "success";
    case "danger":
      return "error";
    case "warning":
      return "warning";
    case "primary":
    case "secondary":
      return "info";
    default:
      return "default";
  }
}

/**
 * Legacy addToast function for backwards compatibility
 * Maps to sonner's toast API
 * Supports both old API (type) and HeroUI API (color)
 */
export function addToast(options: ToastOptions) {
  const { type, color, title, message, description, duration } = options;

  // Determine the toast type from either 'type' or 'color' prop
  const resolvedType = type || mapColorToType(color);
  const resolvedDescription = description || message;

  const toastOptions = {
    description: resolvedDescription,
    duration,
  };

  switch (resolvedType) {
    case "success":
      sonnerToast.success(title || "Success", toastOptions);
      break;
    case "error":
      sonnerToast.error(title || "Error", toastOptions);
      break;
    case "warning":
      sonnerToast.warning(title || "Warning", toastOptions);
      break;
    case "info":
      sonnerToast.info(title || "Info", toastOptions);
      break;
    default:
      if (title) {
        sonnerToast(title, toastOptions);
      } else if (resolvedDescription) {
        sonnerToast(resolvedDescription, { duration });
      }
  }
}

/**
 * Legacy useToast hook for backwards compatibility
 * Returns an object matching the old API shape
 */
export function useToast() {
  return {
    toasts: [], // Not used in sonner
    addToast,
    removeToast: (id: string) => sonnerToast.dismiss(id),
    toast: {
      default: (message: string, title?: string) =>
        title ? sonnerToast(title, { description: message }) : sonnerToast(message),
      info: (message: string, title?: string) =>
        sonnerToast.info(title || message, title ? { description: message } : undefined),
      success: (message: string, title?: string) =>
        sonnerToast.success(title || message, title ? { description: message } : undefined),
      warning: (message: string, title?: string) =>
        sonnerToast.warning(title || message, title ? { description: message } : undefined),
      error: (message: string, title?: string) =>
        sonnerToast.error(title || message, title ? { description: message } : undefined),
    },
  };
}

// Direct toast API (preferred for new code)
export const toast = {
  default: (message: string, options?: { description?: string; duration?: number }) =>
    sonnerToast(message, options),
  info: (message: string, options?: { description?: string; duration?: number }) =>
    sonnerToast.info(message, options),
  success: (message: string, options?: { description?: string; duration?: number }) =>
    sonnerToast.success(message, options),
  warning: (message: string, options?: { description?: string; duration?: number }) =>
    sonnerToast.warning(message, options),
  error: (message: string, options?: { description?: string; duration?: number }) =>
    sonnerToast.error(message, options),
  promise: sonnerToast.promise,
  loading: sonnerToast.loading,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
};

// Legacy ToastProvider - now a no-op since Sonner handles its own state
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
