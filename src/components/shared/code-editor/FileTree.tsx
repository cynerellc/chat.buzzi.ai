"use client";

import { memo, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileType,
  ChevronRight,
  ChevronDown,
  Trash2,
  FilePlus,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui";
import type { FileTreeNode } from "@/lib/monaco/types";

export interface FileTreeProps {
  files: FileTreeNode[];
  selectedPath: string | null;
  expandedPaths: Set<string>;
  modifiedPaths: Set<string>;
  isLoading: boolean;
  error: string | null;
  readOnly?: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onDelete?: (path: string, isDirectory: boolean) => void;
  onCreateFile?: (parentPath: string | null) => void;
  onRefresh?: () => void;
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

interface FileTreeItemProps {
  node: FileTreeNode;
  level: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  modifiedPaths: Set<string>;
  readOnly: boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onDelete?: (path: string, isDirectory: boolean) => void;
  onCreateFile?: (parentPath: string) => void;
}

function FileTreeItem({
  node,
  level,
  selectedPath,
  expandedPaths,
  modifiedPaths,
  readOnly,
  onSelect,
  onToggle,
  onDelete,
  onCreateFile,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === "directory";
  const isModified = modifiedPaths.has(node.path);

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggle(node.path);
    } else {
      onSelect(node.path);
    }
  }, [isDirectory, node.path, onSelect, onToggle]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isDirectory && onCreateFile) {
        onCreateFile(node.path);
      }
    },
    [isDirectory, node.path, onCreateFile]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(node.path, isDirectory);
    },
    [node.path, isDirectory, onDelete]
  );

  const iconClassName = cn(
    "flex-shrink-0",
    isDirectory
      ? "text-amber-500"
      : isSelected
        ? "text-primary"
        : "text-muted-foreground"
  );

  const renderIcon = () => {
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
      <div
        className={cn(
          "group w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors text-left cursor-pointer",
          "hover:bg-default-100",
          isSelected && !isDirectory && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
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
        {renderIcon()}
        <span className="truncate flex-1">{node.name}</span>
        {isModified && (
          <span
            className="w-2 h-2 rounded-full bg-warning flex-shrink-0"
            title="Unsaved changes"
          />
        )}
        {!readOnly && onDelete && (
          <button
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-default-200 rounded transition-opacity"
            onClick={handleDelete}
          >
            <Trash2
              size={12}
              className="text-muted-foreground hover:text-danger"
            />
          </button>
        )}
      </div>
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              modifiedPaths={modifiedPaths}
              readOnly={readOnly}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              onCreateFile={onCreateFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileTreeComponent({
  files,
  selectedPath,
  expandedPaths,
  modifiedPaths,
  isLoading,
  error,
  readOnly = false,
  onSelect,
  onToggle,
  onDelete,
  onCreateFile,
  onRefresh,
}: FileTreeProps) {
  const handleToggle = useCallback(
    (path: string) => {
      onToggle(path);
    },
    [onToggle]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm p-4 text-center space-y-2">
        <AlertCircle className="mx-auto text-danger" size={24} />
        <p className="text-danger">{error}</p>
        <p className="text-muted-foreground text-xs">
          Create a directory with this package ID to start coding.
        </p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        <p>No files found</p>
        {!readOnly && onCreateFile && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => onCreateFile(null)}
          >
            <FilePlus size={14} className="mr-1" />
            Create File
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </h3>
        <div className="flex items-center gap-1">
          {!readOnly && onCreateFile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onCreateFile(null)}
              title="New File"
            >
              <FilePlus size={14} />
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onRefresh}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {files.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            level={0}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            modifiedPaths={modifiedPaths}
            readOnly={readOnly}
            onSelect={onSelect}
            onToggle={handleToggle}
            onDelete={onDelete}
            onCreateFile={onCreateFile}
          />
        ))}
      </div>
    </div>
  );
}

export const FileTree = memo(FileTreeComponent);
