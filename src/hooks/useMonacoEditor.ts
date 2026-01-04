"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useDebouncedCallback } from "./useDebounce";
import {
  configureMonaco,
  getMonacoTheme,
  getEditorOptions,
} from "@/lib/monaco/setup";
import {
  getLanguageFromPath,
  DEFAULT_PREFERENCES,
  type EditorPreferences,
  type EditorTab,
  type FileTreeNode,
} from "@/lib/monaco/types";

interface UseMonacoEditorOptions {
  packageId: string;
  readOnly?: boolean;
  apiBasePath?: string;
  onSaveSuccess?: (path: string) => void;
  onSaveError?: (path: string, error: Error) => void;
}

interface UseMonacoEditorReturn {
  // Editor refs
  editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: React.RefObject<Monaco | null>;

  // File tree state
  fileTree: FileTreeNode[];
  isLoadingTree: boolean;
  treeError: string | null;
  expandedPaths: Set<string>;
  setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Tab management
  tabs: EditorTab[];
  activeTabPath: string | null;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (path: string) => void;
  setActiveTab: (path: string) => void;

  // Content management
  currentContent: string;
  setCurrentContent: (content: string) => void;
  hasUnsavedChanges: boolean;
  modifiedPaths: Set<string>;

  // File operations
  saveFile: (path?: string) => Promise<boolean>;
  createFile: (path: string, content?: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  refreshFileTree: () => Promise<void>;

  // Editor setup
  handleEditorMount: (
    editorInstance: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => void;

  // Theme
  monacoTheme: string;

  // Preferences
  preferences: EditorPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<EditorPreferences>>;
  editorOptions: editor.IStandaloneEditorConstructionOptions;

  // Loading states
  isLoadingFile: boolean;
  isSaving: boolean;

  // Helpers
  getCurrentLanguage: () => string;
}

const PREFERENCES_KEY = "monaco-editor-preferences";

function loadPreferences(): EditorPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PREFERENCES;
}

function savePreferencesToStorage(prefs: EditorPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

export function useMonacoEditor({
  packageId,
  readOnly = false,
  apiBasePath = "/api/master-admin/packages",
  onSaveSuccess,
  onSaveError,
}: UseMonacoEditorOptions): UseMonacoEditorReturn {
  const { theme } = useTheme();

  // Refs
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // File tree state
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Tab state
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Loading/saving state
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<EditorPreferences>(loadPreferences);

  // Persist preferences
  useEffect(() => {
    savePreferencesToStorage(preferences);
  }, [preferences]);

  // Compute derived state
  const activeTab = tabs.find((t) => t.path === activeTabPath);
  const currentContent = activeTab?.content ?? "";
  const modifiedPaths = new Set(tabs.filter((t) => t.isDirty).map((t) => t.path));
  const hasUnsavedChanges = modifiedPaths.size > 0;
  const monacoTheme = getMonacoTheme(theme);
  const editorOptions = getEditorOptions(preferences, readOnly);

  // Debounced content update to mark dirty state
  const debouncedMarkDirty = useDebouncedCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === path
          ? { ...tab, content, isDirty: content !== tab.originalContent }
          : tab
      )
    );
  }, 100);

  // Fetch file tree
  const refreshFileTree = useCallback(async () => {
    if (!packageId) return;

    setIsLoadingTree(true);
    setTreeError(null);

    try {
      const response = await fetch(`${apiBasePath}/${packageId}/files`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `No code directory found. Expected: src/chatbot-packages/${packageId}`
          );
        }
        throw new Error(data.error || "Failed to fetch file tree");
      }

      setFileTree(data.files);

      // Auto-expand root directories
      const rootDirs = data.files
        .filter((f: FileTreeNode) => f.type === "directory")
        .map((f: FileTreeNode) => f.path);
      setExpandedPaths(new Set(rootDirs));
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoadingTree(false);
    }
  }, [packageId, apiBasePath]);

  // Fetch file content
  const fetchFileContent = useCallback(
    async (path: string): Promise<{ content: string; language: string } | null> => {
      try {
        const response = await fetch(
          `${apiBasePath}/${packageId}/files?path=${encodeURIComponent(path)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch file content");
        }
        const data = await response.json();
        return {
          content: data.content,
          language: data.language || getLanguageFromPath(path),
        };
      } catch (err) {
        console.error("Failed to fetch file:", err);
        return null;
      }
    },
    [packageId, apiBasePath]
  );

  // Open file (creates a tab)
  const openFile = useCallback(
    async (path: string) => {
      // Check if tab already exists
      const existingTab = tabs.find((t) => t.path === path);
      if (existingTab) {
        setActiveTabPath(path);
        return;
      }

      setIsLoadingFile(true);

      try {
        const result = await fetchFileContent(path);
        if (!result) {
          throw new Error("Failed to load file");
        }

        const newTab: EditorTab = {
          path,
          content: result.content,
          originalContent: result.content,
          language: result.language,
          isDirty: false,
          viewState: null,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabPath(path);
      } catch (err) {
        console.error("Failed to open file:", err);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [tabs, fetchFileContent]
  );

  // Close tab
  const closeTab = useCallback(
    (path: string) => {
      const tabIndex = tabs.findIndex((t) => t.path === path);
      if (tabIndex === -1) return;

      const newTabs = tabs.filter((t) => t.path !== path);
      setTabs(newTabs);

      // Update active tab
      if (activeTabPath === path) {
        if (newTabs.length === 0) {
          setActiveTabPath(null);
        } else {
          // Select adjacent tab
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          const nextTab = newTabs[newIndex];
          if (nextTab) {
            setActiveTabPath(nextTab.path);
          }
        }
      }
    },
    [tabs, activeTabPath]
  );

  // Close all tabs
  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabPath(null);
  }, []);

  // Close other tabs
  const closeOtherTabs = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (tab) {
        setTabs([tab]);
        setActiveTabPath(path);
      }
    },
    [tabs]
  );

  // Set active tab (with view state preservation)
  const setActiveTab = useCallback(
    (path: string) => {
      // Save current view state before switching
      if (activeTabPath && editorRef.current) {
        const viewState = editorRef.current.saveViewState();
        setTabs((prev) =>
          prev.map((tab) =>
            tab.path === activeTabPath ? { ...tab, viewState } : tab
          )
        );
      }
      setActiveTabPath(path);
    },
    [activeTabPath]
  );

  // Set content for current file
  const setCurrentContent = useCallback(
    (content: string) => {
      if (!activeTabPath) return;
      debouncedMarkDirty(activeTabPath, content);
      // Immediate update for editor display
      setTabs((prev) =>
        prev.map((tab) => (tab.path === activeTabPath ? { ...tab, content } : tab))
      );
    },
    [activeTabPath, debouncedMarkDirty]
  );

  // Save file
  const saveFile = useCallback(
    async (path?: string): Promise<boolean> => {
      const targetPath = path ?? activeTabPath;
      if (!targetPath) return false;

      const tab = tabs.find((t) => t.path === targetPath);
      if (!tab) return false;

      setIsSaving(true);

      try {
        const response = await fetch(`${apiBasePath}/${packageId}/files`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: targetPath,
            content: tab.content,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to save file");
        }

        // Update tab state
        setTabs((prev) =>
          prev.map((t) =>
            t.path === targetPath
              ? { ...t, originalContent: t.content, isDirty: false }
              : t
          )
        );

        onSaveSuccess?.(targetPath);
        return true;
      } catch (err) {
        onSaveError?.(targetPath, err instanceof Error ? err : new Error("Save failed"));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [tabs, activeTabPath, packageId, apiBasePath, onSaveSuccess, onSaveError]
  );

  // Create file
  const createFile = useCallback(
    async (path: string, content?: string): Promise<boolean> => {
      try {
        const response = await fetch(`${apiBasePath}/${packageId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            content: content ?? "",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create file");
        }

        await refreshFileTree();
        await openFile(path);
        return true;
      } catch (err) {
        console.error("Failed to create file:", err);
        return false;
      }
    },
    [packageId, apiBasePath, refreshFileTree, openFile]
  );

  // Delete file
  const deleteFile = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `${apiBasePath}/${packageId}/files?path=${encodeURIComponent(path)}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete file");
        }

        // Close tab if open
        closeTab(path);
        await refreshFileTree();
        return true;
      } catch (err) {
        console.error("Failed to delete file:", err);
        return false;
      }
    },
    [packageId, apiBasePath, closeTab, refreshFileTree]
  );

  // Handle editor mount
  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
      editorRef.current = editorInstance;
      monacoRef.current = monacoInstance;

      // Configure Monaco
      configureMonaco(monacoInstance);

      // Restore view state if available
      const tab = tabs.find((t) => t.path === activeTabPath);
      if (tab?.viewState) {
        editorInstance.restoreViewState(tab.viewState);
      }

      // Add save shortcut
      editorInstance.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
        () => {
          saveFile();
        }
      );
    },
    [tabs, activeTabPath, saveFile]
  );

  // Get current language
  const getCurrentLanguage = useCallback(() => {
    return activeTab?.language ?? "typescript";
  }, [activeTab]);

  // Initialize file tree
  useEffect(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  return {
    // Editor refs
    editorRef,
    monacoRef,

    // File tree state
    fileTree,
    isLoadingTree,
    treeError,
    expandedPaths,
    setExpandedPaths,

    // Tab management
    tabs,
    activeTabPath,
    openFile,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    setActiveTab,

    // Content management
    currentContent,
    setCurrentContent,
    hasUnsavedChanges,
    modifiedPaths,

    // File operations
    saveFile,
    createFile,
    deleteFile,
    refreshFileTree,

    // Editor setup
    handleEditorMount,

    // Theme
    monacoTheme,

    // Preferences
    preferences,
    setPreferences,
    editorOptions,

    // Loading states
    isLoadingFile,
    isSaving,

    // Helpers
    getCurrentLanguage,
  };
}
