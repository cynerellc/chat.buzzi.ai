"use client";

import { AlertTriangle, Loader2, CheckCircle, XCircle } from "lucide-react";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@/components/ui";

interface ReindexResult {
  message: string;
  results: {
    sources?: {
      total: number;
      success: number;
      failed: number;
      errors?: { sourceId: string; name: string; error: string }[];
    };
    faqs?: {
      processed: number;
      failed: number;
    };
  };
}

interface ReindexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isReindexing: boolean;
  result: ReindexResult | null | undefined;
  sourceCount: number;
  faqCount: number;
}

export function ReindexModal({
  isOpen,
  onClose,
  onConfirm,
  isReindexing,
  result,
  sourceCount,
  faqCount,
}: ReindexModalProps) {
  const hasCompleted = result != null;
  const totalItems = sourceCount + faqCount;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>
          {hasCompleted ? "Reindex Complete" : "Reindex All Documents"}
        </ModalHeader>
        <ModalBody>
          {isReindexing ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">Reindexing knowledge base...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a while depending on the amount of content.
              </p>
            </div>
          ) : hasCompleted ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {result.results.sources?.failed === 0 &&
                result.results.faqs?.failed === 0 ? (
                  <CheckCircle className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-warning" />
                )}
                <span className="font-medium">{result.message}</span>
              </div>

              {result.results.sources && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Sources</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      {result.results.sources.total}
                    </div>
                    <div>
                      <span className="text-success">Success:</span>{" "}
                      {result.results.sources.success}
                    </div>
                    <div>
                      <span className="text-danger">Failed:</span>{" "}
                      {result.results.sources.failed}
                    </div>
                  </div>

                  {result.results.sources.errors &&
                    result.results.sources.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          Errors:
                        </p>
                        <ul className="text-sm space-y-1">
                          {result.results.sources.errors.map((err, idx) => (
                            <li
                              key={idx}
                              className="text-danger-600 bg-danger-50 rounded p-2"
                            >
                              <span className="font-medium">{err.name}:</span>{" "}
                              {err.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {result.results.faqs && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">FAQs</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-success">Processed:</span>{" "}
                      {result.results.faqs.processed}
                    </div>
                    <div>
                      <span className="text-danger">Failed:</span>{" "}
                      {result.results.faqs.failed}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-warning-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-700">
                    This will reprocess all knowledge sources
                  </p>
                  <p className="text-sm text-warning-600 mt-1">
                    All documents will be re-extracted, re-chunked, and
                    re-embedded. This operation may take several minutes.
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">Sources to reindex:</span>{" "}
                  <span className="font-medium">{sourceCount}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">FAQs to reindex:</span>{" "}
                  <span className="font-medium">{faqCount}</span>
                </p>
                <p className="mt-2">
                  <span className="text-muted-foreground">Total items:</span>{" "}
                  <span className="font-medium">{totalItems}</span>
                </p>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {hasCompleted ? (
            <Button color="primary" onPress={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onPress={onClose} isDisabled={isReindexing}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={onConfirm}
                isLoading={isReindexing}
              >
                Start Reindex
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
