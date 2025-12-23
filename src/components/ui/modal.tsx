"use client";

import {
  Modal as HeroModal,
  ModalContent as HeroModalContent,
  ModalHeader as HeroModalHeader,
  ModalBody as HeroModalBody,
  ModalFooter as HeroModalFooter,
  type ModalProps as HeroModalProps,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { modalOverlay, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { Button } from "./button";

export interface ModalProps extends Omit<HeroModalProps, "children"> {
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, description, children, footer, className, ...props }: ModalProps) {
  return (
    <HeroModal className={cn(className)} {...props}>
      <HeroModalContent>
        {title && (
          <HeroModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && <p className="text-sm text-default-500">{description}</p>}
          </HeroModalHeader>
        )}
        <HeroModalBody>{children}</HeroModalBody>
        {footer && <HeroModalFooter>{footer}</HeroModalFooter>}
      </HeroModalContent>
    </HeroModal>
  );
}

// Animated modal overlay
export function AnimatedModalOverlay({ isOpen }: { isOpen: boolean }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={modalOverlay}
          transition={smoothTransition}
        />
      )}
    </AnimatePresence>
  );
}

// Confirmation dialog
export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  icon?: LucideIcon;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDanger = false,
  isLoading = false,
  icon: Icon = isDanger ? AlertTriangle : undefined,
}: ConfirmationDialogProps) {
  return (
    <HeroModal isOpen={isOpen} onClose={onClose} size="sm">
      <HeroModalContent>
        <HeroModalHeader className="flex items-center gap-3">
          {Icon && (
            <div className={cn("p-2 rounded-full", isDanger ? "bg-danger/10" : "bg-primary/10")}>
              <Icon className={isDanger ? "text-danger" : "text-primary"} size={20} />
            </div>
          )}
          <span className="font-semibold">{title}</span>
        </HeroModalHeader>
        <HeroModalBody>
          <p className="text-default-600">{message}</p>
        </HeroModalBody>
        <HeroModalFooter>
          <Button variant="bordered" onPress={onClose} isDisabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            color={isDanger ? "danger" : "primary"}
            onPress={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </HeroModalFooter>
      </HeroModalContent>
    </HeroModal>
  );
}

export { HeroModalContent as ModalContent, HeroModalHeader as ModalHeader, HeroModalBody as ModalBody, HeroModalFooter as ModalFooter };
