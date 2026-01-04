"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  FileCode,
  FileJson,
  FileText,
  FileType,
  Search,
  Clock,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui";
import type { FileTreeNode } from "@/lib/monaco/types";

export interface QuickOpenProps {
  isOpen: boolean;
  files: FileTreeNode[];
  recentPaths?: string[];
  onSelect: (path: string) => void;
  onClose: () => void;
}

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

function flattenFiles(nodes: FileTreeNode[]): { path: string; name: string }[] {
  const result: { path: string; name: string }[] = [];

  function traverse(nodeList: FileTreeNode[]) {
    for (const node of nodeList) {
      if (node.type === "file") {
        result.push({ path: node.path, name: node.name });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Simple substring match
  if (lowerText.includes(lowerQuery)) return true;

  // Fuzzy match: all characters must appear in order
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}

function QuickOpenComponent({
  isOpen,
  files,
  recentPaths = [],
  onSelect,
  onClose,
}: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten file tree
  const allFiles = useMemo(() => flattenFiles(files), [files]);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = allFiles.filter((f) => fuzzyMatch(query, f.name));

    // Sort: recent files first, then alphabetically
    result.sort((a, b) => {
      const aRecent = recentPaths.indexOf(a.path);
      const bRecent = recentPaths.indexOf(b.path);

      if (aRecent !== -1 && bRecent !== -1) {
        return aRecent - bRecent;
      }
      if (aRecent !== -1) return -1;
      if (bRecent !== -1) return 1;

      return a.name.localeCompare(b.name);
    });

    return result;
  }, [allFiles, query, recentPaths]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredFiles.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            onSelect(filteredFiles[selectedIndex].path);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredFiles, selectedIndex, onSelect, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        // This just prevents default, the parent should handle opening
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-background border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-sm"
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto"
        >
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No files found
            </div>
          ) : (
            filteredFiles.map((file, index) => {
              const FileIcon = getFileIcon(file.name);
              const isRecent = recentPaths.includes(file.path);
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={file.path}
                  data-index={index}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 cursor-pointer",
                    isSelected ? "bg-primary/10" : "hover:bg-default-100"
                  )}
                  onClick={() => {
                    onSelect(file.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <FileIcon
                    size={16}
                    className={isSelected ? "text-primary" : "text-muted-foreground"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {file.path}
                    </div>
                  </div>
                  {isRecent && (
                    <Clock size={12} className="text-muted-foreground" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="px-1 py-0.5 bg-default-100 rounded text-[10px]">
              ↑↓
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-default-100 rounded text-[10px]">
              Enter
            </kbd>{" "}
            Open
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-default-100 rounded text-[10px]">
              Esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

export const QuickOpen = memo(QuickOpenComponent);
