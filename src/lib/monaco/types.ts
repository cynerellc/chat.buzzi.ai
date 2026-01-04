"use client";

import type { editor } from "monaco-editor";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface EditorTab {
  path: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
  viewState?: editor.ICodeEditorViewState | null;
}

export interface EditorPreferences {
  fontSize: number;
  minimap: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
}

export const DEFAULT_PREFERENCES: EditorPreferences = {
  fontSize: 14,
  minimap: true,
  lineNumbers: true,
  wordWrap: true,
  tabSize: 2,
};

export const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".json": "json",
  ".css": "css",
  ".scss": "scss",
  ".md": "markdown",
  ".txt": "plaintext",
  ".html": "html",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

export function getLanguageFromPath(filepath: string): string {
  const ext = filepath.substring(filepath.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_MAP[ext] ?? "plaintext";
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.substring(lastDot + 1).toLowerCase() : "";
}
