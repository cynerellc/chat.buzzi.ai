"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import Editor from "@monaco-editor/react";

import { cn } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui";

interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId: string;
  packageName: string;
}

// Get icon for file type
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return FileCode;
    case "json":
      return FileJson;
    default:
      return FileText;
  }
}

// File tree item component
function FileTreeItem({
  node,
  level,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
}: {
  node: FileTreeNode;
  level: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === "directory";

  const renderFileIcon = () => {
    const iconClassName = cn(
      "flex-shrink-0",
      isDirectory
        ? "text-amber-500"
        : isSelected
          ? "text-primary"
          : "text-muted-foreground"
    );

    if (isDirectory) {
      return isExpanded ? (
        <FolderOpen size={16} className={iconClassName} />
      ) : (
        <Folder size={16} className={iconClassName} />
      );
    }

    const FileIcon = getFileIcon(node.name);
    return <FileIcon size={16} className={iconClassName} />;
  };

  return (
    <div>
      <button
        onClick={() => {
          if (isDirectory) {
            onToggle(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
          "hover:bg-default-100",
          isSelected && !isDirectory && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isExpanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}
        {renderFileIcon()}
        <span className="truncate">{node.name}</span>
      </button>
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CodeViewerModal({
  isOpen,
  onClose,
  packageId,
  packageName,
}: CodeViewerModalProps) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [fileContent, setFileContent] = useState<string>("");
  const [fileLanguage, setFileLanguage] = useState<string>("typescript");
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch file tree
  const fetchFileTree = useCallback(async () => {
    if (!packageId) return;

    setIsLoadingTree(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/master-admin/packages/${packageId}/files`
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No code directory found for this package. Expected: src/chatbot-packages/${packageId}`);
        }
        throw new Error(data.error || "Failed to fetch file tree");
      }

      setFileTree(data.files);

      // Auto-expand root level directories
      const rootDirs = data.files
        .filter((f: FileTreeNode) => f.type === "directory")
        .map((f: FileTreeNode) => f.path);
      setExpandedPaths(new Set(rootDirs));

      // Auto-select first file (index.ts if exists)
      const indexFile = data.files.find(
        (f: FileTreeNode) => f.name === "index.ts"
      );
      if (indexFile) {
        setSelectedPath(indexFile.path);
        fetchFileContent(indexFile.path);
      } else {
        // Find first file recursively
        const findFirstFile = (nodes: FileTreeNode[]): FileTreeNode | null => {
          for (const node of nodes) {
            if (node.type === "file") return node;
            if (node.children) {
              const found = findFirstFile(node.children);
              if (found) return found;
            }
          }
          return null;
        };
        const firstFile = findFirstFile(data.files);
        if (firstFile) {
          setSelectedPath(firstFile.path);
          fetchFileContent(firstFile.path);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoadingTree(false);
    }
  }, [packageId]);

  // Fetch file content
  const fetchFileContent = useCallback(
    async (path: string) => {
      setIsLoadingFile(true);

      try {
        const response = await fetch(
          `/api/master-admin/packages/${packageId}/files?path=${encodeURIComponent(path)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch file content");
        }
        const data = await response.json();
        setFileContent(data.content);
        setFileLanguage(data.language);
      } catch (err) {
        setFileContent(`// Error loading file: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [packageId]
  );

  // Load file tree when modal opens
  useEffect(() => {
    if (isOpen && packageId) {
      fetchFileTree();
    }
  }, [isOpen, packageId, fetchFileTree]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFileTree([]);
      setSelectedPath(null);
      setExpandedPaths(new Set());
      setFileContent("");
      setError(null);
    }
  }, [isOpen]);

  // Handle file selection
  const handleFileSelect = (path: string) => {
    setSelectedPath(path);
    fetchFileContent(path);
  };

  // Handle directory toggle
  const handleToggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

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
                  Close Editor
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 bg-default-100 rounded">
                  src/chatbot-packages/{packageId}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* File browser */}
              <div className="w-64 flex-shrink-0 border-r border-border bg-default-50/50 overflow-y-auto">
                <div className="p-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Files
                  </h3>
                </div>
                <div className="p-2">
                  {isLoadingTree ? (
                    <div className="flex items-center justify-center py-8">
                      <Spinner size="sm" />
                    </div>
                  ) : error ? (
                    <div className="text-sm p-4 text-center space-y-2">
                      <p className="text-danger">{error}</p>
                      <p className="text-muted-foreground text-xs">
                        Create a directory with this package ID to view its code.
                      </p>
                    </div>
                  ) : fileTree.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">
                      No files found
                    </div>
                  ) : (
                    fileTree.map((node) => (
                      <FileTreeItem
                        key={node.path}
                        node={node}
                        level={0}
                        selectedPath={selectedPath}
                        expandedPaths={expandedPaths}
                        onSelect={handleFileSelect}
                        onToggle={handleToggle}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Code editor */}
              <div className="flex-1 relative">
                {isLoadingFile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {error ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground bg-default-50">
                    <div className="text-center max-w-md">
                      <FileCode size={48} className="mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium mb-2">No Code Available</p>
                      <p className="text-sm">
                        This package doesn&apos;t have a code directory yet.
                      </p>
                      <p className="text-xs mt-4 font-mono bg-default-100 p-2 rounded">
                        src/chatbot-packages/{packageId}
                      </p>
                    </div>
                  </div>
                ) : selectedPath ? (
                  <Editor
                    height="100%"
                    language={fileLanguage}
                    value={fileContent}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      folding: true,
                      renderLineHighlight: "line",
                      cursorStyle: "line",
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                      padding: { top: 16 },
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <FileCode size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Select a file to view its contents</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
