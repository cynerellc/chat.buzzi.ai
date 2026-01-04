"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

export interface EditorStatusBarProps {
  language: string;
  line?: number;
  column?: number;
  encoding?: string;
  indentation?: string;
  className?: string;
}

function EditorStatusBarComponent({
  language,
  line,
  column,
  encoding = "UTF-8",
  indentation = "Spaces: 2",
  className,
}: EditorStatusBarProps) {
  return (
    <div
      className={cn(
        "h-6 bg-default-50 border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {line !== undefined && column !== undefined && (
          <span>
            Ln {line}, Col {column}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>{indentation}</span>
        <span>{encoding}</span>
        <span className="capitalize">{language}</span>
      </div>
    </div>
  );
}

export const EditorStatusBar = memo(EditorStatusBarComponent);
