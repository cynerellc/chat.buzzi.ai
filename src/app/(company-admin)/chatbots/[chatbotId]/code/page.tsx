"use client";

import { useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileType,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, Spinner } from "@/components/ui";
import { useChatbotContext } from "../chatbot-context";

interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
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
    case "css":
    case "scss":
      return FileType;
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

export default function ChatbotCodePage() {
  const { chatbot, chatbotId } = useChatbotContext();

  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [fileContent, setFileContent] = useState<string>("");
  const [fileLanguage, setFileLanguage] = useState<string>("typescript");
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageName, setPackageName] = useState<string>("");

  // Fetch file tree
  const fetchFileTree = useCallback(async () => {
    if (!chatbotId) return;

    setIsLoadingTree(true);
    setError(null);

    try {
      const response = await fetch(`/api/company/chatbots/${chatbotId}/code`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch code");
      }

      setFileTree(data.files);
      setPackageName(data.packageName || "Package");

      // Auto-expand root level directories
      const rootDirs = data.files
        .filter((f: FileTreeNode) => f.type === "directory")
        .map((f: FileTreeNode) => f.path);
      setExpandedPaths(new Set(rootDirs));

      // Auto-select index.ts if exists
      const indexFile = data.files.find((f: FileTreeNode) => f.name === "index.ts");
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
      setError(err instanceof Error ? err.message : "Failed to load code");
    } finally {
      setIsLoadingTree(false);
    }
  }, [chatbotId]);

  // Fetch file content
  const fetchFileContent = useCallback(
    async (path: string) => {
      setIsLoadingFile(true);

      try {
        const response = await fetch(
          `/api/company/chatbots/${chatbotId}/code?path=${encodeURIComponent(path)}`
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
    [chatbotId]
  );

  // Load file tree on mount
  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

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

  // Check if this is a custom package
  if (chatbot && !chatbot.isCustomPackage) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="mx-auto mb-4 text-warning" size={48} />
        <h2 className="text-xl font-semibold mb-2">Code Not Available</h2>
        <p className="text-muted-foreground">
          Code viewing is only available for custom packages.
        </p>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Package Code</h2>
        <p className="text-sm text-muted-foreground">
          Read-only view of the custom package code for {chatbot?.name || "this chatbot"}
        </p>
      </div>

      <Card className="h-full flex overflow-hidden">
        {/* File browser */}
        <div className="w-64 flex-shrink-0 border-r border-border bg-default-50/50 flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {packageName}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingTree ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : error ? (
              <div className="text-sm p-4 text-center space-y-2">
                <AlertCircle className="mx-auto text-danger" size={24} />
                <p className="text-danger">{error}</p>
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

        {/* Code viewer */}
        <div className="flex-1 relative flex flex-col">
          {/* File tabs / current file indicator */}
          {selectedPath && (
            <div className="h-9 border-b border-border bg-default-50 flex items-center px-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b-2 border-primary rounded-t text-sm">
                {(() => {
                  const FileIcon = getFileIcon(selectedPath);
                  return <FileIcon size={14} className="text-muted-foreground" />;
                })()}
                <span>{selectedPath}</span>
              </div>
            </div>
          )}

          {/* Editor */}
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
                  <p className="text-sm">{error}</p>
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
                  fontSize: 14,
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
      </Card>
    </div>
  );
}
