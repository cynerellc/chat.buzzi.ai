"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { ArrowLeft, FileCode, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, ConfirmationDialog, Input, addToast } from "@/components/ui";
import { useMonacoEditor } from "@/hooks/useMonacoEditor";
import { getDefaultFileContent } from "@/lib/monaco/setup";

import { MonacoEditor } from "./MonacoEditor";
import { FileTree } from "./FileTree";
import { EditorTabs } from "./EditorTabs";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusBar } from "./EditorStatusBar";
import { QuickOpen } from "./QuickOpen";

export interface CodeEditorProps {
  packageId: string;
  packageName?: string;
  packageSlug?: string;
  apiBasePath?: string;
  readOnly?: boolean;
  showHeader?: boolean;
  showPackButton?: boolean;
  onBack?: () => void;
  onPackSuccess?: () => void;
  className?: string;
}

function CodeEditorComponent({
  packageId,
  packageName = "Package",
  packageSlug,
  apiBasePath = "/api/master-admin/packages",
  readOnly = false,
  showHeader = true,
  showPackButton = true,
  onBack,
  onPackSuccess,
  className,
}: CodeEditorProps) {
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [isPacking, setIsPacking] = useState(false);
  const [packSuccess, setPackSuccess] = useState(false);

  // New file dialog state
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileParentPath, setNewFileParentPath] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    path: string;
    isDirectory: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const editor = useMonacoEditor({
    packageId,
    readOnly,
    apiBasePath,
    onSaveSuccess: (path) => {
      addToast({
        title: "File Saved",
        description: `${path} saved successfully`,
        color: "success",
      });
    },
    onSaveError: (path, error) => {
      addToast({
        title: "Save Failed",
        description: error.message,
        color: "danger",
      });
    },
  });

  // Track recent paths
  const handleFileOpen = useCallback(
    async (path: string) => {
      await editor.openFile(path);
      setRecentPaths((prev) => {
        const filtered = prev.filter((p) => p !== path);
        return [path, ...filtered].slice(0, 10);
      });
    },
    [editor]
  );

  // Handle directory toggle
  const handleToggle = useCallback(
    (path: string) => {
      editor.setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [editor]
  );

  // Handle create file
  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    const filePath = newFileParentPath
      ? `${newFileParentPath}/${newFileName}`
      : newFileName;

    const content = getDefaultFileContent(newFileName);
    const success = await editor.createFile(filePath, content);

    if (success) {
      addToast({
        title: "File Created",
        description: `${filePath} created successfully`,
        color: "success",
      });
      setIsNewFileDialogOpen(false);
      setNewFileName("");
      setNewFileParentPath(null);
    } else {
      addToast({
        title: "Create Failed",
        description: "Failed to create file",
        color: "danger",
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    const success = await editor.deleteFile(deleteTarget.path);

    if (success) {
      addToast({
        title: deleteTarget.isDirectory ? "Folder Deleted" : "File Deleted",
        description: `${deleteTarget.path} deleted successfully`,
        color: "success",
      });
    } else {
      addToast({
        title: "Delete Failed",
        description: "Failed to delete",
        color: "danger",
      });
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  };

  // Handle pack code
  const handlePackCode = async () => {
    if (isPacking) return;

    if (editor.hasUnsavedChanges) {
      addToast({
        title: "Unsaved Changes",
        description: "Please save all files before packing",
        color: "warning",
      });
      return;
    }

    setIsPacking(true);
    setPackSuccess(false);

    try {
      const response = await fetch(`${apiBasePath}/${packageId}/pack`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to pack code");
      }

      setPackSuccess(true);
      addToast({
        title: "Package Code Packed",
        description: `Successfully uploaded ${data.sourceFilesCount} files and created package bundle.`,
        color: "success",
      });
      onPackSuccess?.();
    } catch (err) {
      addToast({
        title: "Pack Failed",
        description: err instanceof Error ? err.message : "Failed to pack code",
        color: "danger",
      });
    } finally {
      setIsPacking(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setIsQuickOpenVisible(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        editor.saveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  return (
    <div className={cn("h-full flex flex-col bg-background", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-default-50">
          <div className="flex items-center gap-3">
            {onBack && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="gap-2"
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">Back</span>
                </Button>
                <div className="h-4 w-px bg-border" />
              </>
            )}
            <div className="flex items-center gap-2">
              <FileCode size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">{packageName}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {readOnly ? "Code Viewer" : "Code Editor"}
              </span>
            </div>
          </div>
          <EditorToolbar
            packagePath={packageSlug ? `src/chatbot-packages/${packageSlug}` : undefined}
            hasUnsavedChanges={editor.hasUnsavedChanges}
            isSaving={editor.isSaving}
            isPacking={isPacking}
            packSuccess={packSuccess}
            canPack={!editor.treeError}
            readOnly={readOnly}
            preferences={editor.preferences}
            onSave={() => editor.saveFile()}
            onPack={showPackButton ? handlePackCode : undefined}
            onPreferencesChange={(prefs) =>
              editor.setPreferences((prev) => ({ ...prev, ...prefs }))
            }
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File browser */}
        <div className="w-64 flex-shrink-0 border-r border-border bg-default-50/50 flex flex-col">
          <FileTree
            files={editor.fileTree}
            selectedPath={editor.activeTabPath}
            expandedPaths={editor.expandedPaths}
            modifiedPaths={editor.modifiedPaths}
            isLoading={editor.isLoadingTree}
            error={editor.treeError}
            readOnly={readOnly}
            onSelect={handleFileOpen}
            onToggle={handleToggle}
            onDelete={readOnly ? undefined : (path, isDir) => setDeleteTarget({ path, isDirectory: isDir })}
            onCreateFile={
              readOnly
                ? undefined
                : (parentPath) => {
                    setNewFileParentPath(parentPath);
                    setIsNewFileDialogOpen(true);
                  }
            }
            onRefresh={editor.refreshFileTree}
          />
        </div>

        {/* Code editor */}
        <div className="flex-1 relative flex flex-col">
          {/* Tabs */}
          <EditorTabs
            tabs={editor.tabs}
            activeTabPath={editor.activeTabPath}
            onTabSelect={editor.setActiveTab}
            onTabClose={editor.closeTab}
            onCloseAll={editor.closeAllTabs}
            onCloseOthers={editor.closeOtherTabs}
            readOnly={readOnly}
          />

          {/* Editor */}
          <div className="flex-1 relative">
            {editor.isLoadingFile && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {editor.treeError ? (
              <div className="flex items-center justify-center h-full text-muted-foreground bg-default-50">
                <div className="text-center max-w-md">
                  <FileCode size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">No Code Directory</p>
                  <p className="text-sm">
                    Create a package directory to start editing code.
                  </p>
                  <p className="text-xs mt-4 font-mono bg-default-100 p-2 rounded">
                    src/chatbot-packages/{packageId}
                  </p>
                </div>
              </div>
            ) : editor.activeTabPath ? (
              <MonacoEditor
                value={editor.currentContent}
                language={editor.getCurrentLanguage()}
                theme={editor.monacoTheme}
                options={editor.editorOptions}
                onChange={(value) => editor.setCurrentContent(value ?? "")}
                onMount={editor.handleEditorMount}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <FileCode size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select a file to {readOnly ? "view" : "edit"}</p>
                  <p className="text-xs mt-2">
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 bg-default-100 rounded text-xs">
                      ⌘P
                    </kbd>{" "}
                    to search files
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          {editor.activeTabPath && (
            <EditorStatusBar
              language={editor.getCurrentLanguage()}
              indentation={`Spaces: ${editor.preferences.tabSize}`}
            />
          )}
        </div>
      </div>

      {/* Quick Open */}
      <QuickOpen
        isOpen={isQuickOpenVisible}
        files={editor.fileTree}
        recentPaths={recentPaths}
        onSelect={handleFileOpen}
        onClose={() => setIsQuickOpenVisible(false)}
      />

      {/* New File Dialog */}
      <ConfirmationDialog
        isOpen={isNewFileDialogOpen}
        onClose={() => {
          setIsNewFileDialogOpen(false);
          setNewFileName("");
          setNewFileParentPath(null);
        }}
        onConfirm={handleCreateFile}
        title="Create New File"
        message={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {newFileParentPath
                ? `Create a new file in ${newFileParentPath}/`
                : "Create a new file in the root directory"}
            </p>
            <Input
              label="File Name"
              placeholder="e.g., component.tsx, utils.ts, styles.css"
              value={newFileName}
              onValueChange={setNewFileName}
              autoFocus
            />
          </div>
        }
        confirmLabel="Create"
        isLoading={false}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.isDirectory ? "Delete Folder" : "Delete File"}
        message={`Are you sure you want to delete "${deleteTarget?.path}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}

export const CodeEditor = memo(CodeEditorComponent);
