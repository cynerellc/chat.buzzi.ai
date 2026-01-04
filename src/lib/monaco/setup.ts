"use client";

import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { DEFAULT_PREFERENCES, type EditorPreferences } from "./types";

export function configureMonaco(monaco: Monaco) {
  // Configure TypeScript/JavaScript compiler options
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowJs: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    lib: ["esnext", "dom"],
  });

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    jsx: monaco.languages.typescript.JsxEmit.React,
    allowJs: true,
    checkJs: false,
  });

  // Enable diagnostics
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
}

export function getEditorOptions(
  preferences: EditorPreferences = DEFAULT_PREFERENCES,
  readOnly = false
): editor.IStandaloneEditorConstructionOptions {
  return {
    readOnly,
    minimap: { enabled: preferences.minimap },
    fontSize: preferences.fontSize,
    lineNumbers: preferences.lineNumbers ? "on" : "off",
    wordWrap: preferences.wordWrap ? "on" : "off",
    tabSize: preferences.tabSize,
    insertSpaces: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    folding: true,
    foldingStrategy: "auto",
    renderLineHighlight: "line",
    cursorStyle: "line",
    cursorBlinking: "smooth",
    smoothScrolling: true,
    padding: { top: 16, bottom: 16 },
    formatOnPaste: true,
    formatOnType: true,
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    suggest: {
      preview: true,
      showMethods: true,
      showFunctions: true,
      showConstructors: true,
      showFields: true,
      showVariables: true,
      showClasses: true,
      showStructs: true,
      showInterfaces: true,
      showModules: true,
      showProperties: true,
      showEvents: true,
      showOperators: true,
      showUnits: true,
      showValues: true,
      showConstants: true,
      showEnums: true,
      showEnumMembers: true,
      showKeywords: true,
      showWords: true,
      showColors: true,
      showFiles: true,
      showReferences: true,
      showSnippets: true,
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    parameterHints: { enabled: true },
    hover: { enabled: true, delay: 300 },
    contextmenu: true,
    links: true,
    colorDecorators: true,
  };
}

export function getMonacoTheme(theme: string | undefined): string {
  if (!theme || theme === "system") {
    // Check system preference
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "vs-dark"
        : "vs";
    }
    return "vs-dark";
  }
  return theme === "dark" ? "vs-dark" : "vs";
}

export function getDefaultFileContent(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return `// ${filename}\n\nexport {};\n`;
    case "tsx":
      return `// ${filename}\n\nimport React from "react";\n\nexport default function Component() {\n  return <div>New Component</div>;\n}\n`;
    case "js":
      return `// ${filename}\n\nexport {};\n`;
    case "jsx":
      return `// ${filename}\n\nimport React from "react";\n\nexport default function Component() {\n  return <div>New Component</div>;\n}\n`;
    case "json":
      return `{\n  \n}\n`;
    case "css":
      return `/* ${filename} */\n\n`;
    case "scss":
      return `// ${filename}\n\n`;
    case "md":
      return `# ${filename.replace(/\.md$/, "")}\n\n`;
    default:
      return "";
  }
}
