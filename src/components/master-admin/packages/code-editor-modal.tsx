"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileCode } from "lucide-react";

import { Button } from "@/components/ui";
import { CodeEditor } from "@/components/shared/code-editor";

interface CodeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId: string;
  packageName: string;
}

export function CodeEditorModal({
  isOpen,
  onClose,
  packageId,
  packageName,
}: CodeEditorModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!packageId) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal - Full viewport with minimal padding */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-2 z-50 flex flex-col bg-background border border-border rounded-xl overflow-hidden shadow-2xl"
          >
            {/* Custom header with close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-default-50">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="gap-2"
                >
                  <X size={16} />
                  Close
                </Button>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <FileCode size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{packageName}</span>
                  <span className="text-xs text-muted-foreground">
                    Code Editor (Modal)
                  </span>
                </div>
              </div>
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                packageId={packageId}
                packageName={packageName}
                apiBasePath="/api/master-admin/packages"
                showHeader={false}
                showPackButton={true}
                className="h-full"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
