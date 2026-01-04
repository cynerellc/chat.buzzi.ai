"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileCode, Eye } from "lucide-react";

import { Button } from "@/components/ui";
import { CodeEditor } from "@/components/shared/code-editor";

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId: string;
  packageName: string;
}

export function CodeViewerModal({
  isOpen,
  onClose,
  packageId,
  packageName,
}: CodeViewerModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-4 z-50 flex flex-col bg-background border border-border rounded-xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
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
                    (Read-only)
                  </span>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-2 py-1 bg-default-100 rounded text-xs text-muted-foreground">
                <Eye size={12} />
                Read-only view
              </span>
            </div>

            {/* Code Editor in read-only mode */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                packageId={packageId}
                packageName={packageName}
                apiBasePath="/api/master-admin/packages"
                readOnly={true}
                showHeader={false}
                showPackButton={false}
                className="h-full"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
