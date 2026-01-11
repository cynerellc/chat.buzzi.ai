"use client";

import { useRef, memo } from "react";
import dynamic from "next/dynamic";
import type { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Dynamically import Monaco to reduce initial bundle size
const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-default-50">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export interface MonacoEditorProps {
  value: string;
  language: string;
  theme?: string;
  options?: editor.IStandaloneEditorConstructionOptions;
  onChange?: OnChange;
  onMount?: OnMount;
  className?: string;
  height?: string | number;
}

function MonacoEditorComponent({
  value,
  language,
  theme = "vs-dark",
  options,
  onChange,
  onMount,
  className,
  height = "100%",
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} style={{ height }}>
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={theme}
        onChange={onChange}
        onMount={onMount}
        options={options}
        loading={
          <div className="flex items-center justify-center h-full bg-default-50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      />
    </div>
  );
}

export const MonacoEditor = memo(MonacoEditorComponent);
