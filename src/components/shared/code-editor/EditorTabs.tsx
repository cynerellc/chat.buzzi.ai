"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import {
  X,
  FileCode,
  FileJson,
  FileText,
  FileType,
  MoreHorizontal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Dropdown } from "@/components/ui";
import type { EditorTab } from "@/lib/monaco/types";

export interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabPath: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
  onCloseAll?: () => void;
  onCloseOthers?: (path: string) => void;
  readOnly?: boolean;
}

// Render file icon inline to avoid creating components during render
function FileIconComponent({ filename, size, className }: { filename: string; size: number; className?: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode size={size} className={className} />;
    case "json":
      return <FileJson size={size} className={className} />;
    case "css":
    case "scss":
      return <FileType size={size} className={className} />;
    default:
      return <FileText size={size} className={className} />;
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers?: () => void;
  canClose: boolean;
}

function TabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCloseOthers: _onCloseOthers,
  canClose,
}: TabItemProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showContextMenu, _setShowContextMenu] = useState(false);
  const fileName = getFileName(tab.path);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    _setShowContextMenu(true);
  }, []);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 text-sm border-r border-border cursor-pointer transition-colors",
        "hover:bg-default-100",
        isActive
          ? "bg-background border-b-2 border-b-primary text-foreground"
          : "bg-default-50 text-muted-foreground"
      )}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
    >
      <FileIconComponent filename={fileName} size={14} className={isActive ? "text-primary" : ""} />
      <span className="max-w-32 truncate">{fileName}</span>
      {tab.isDirty && (
        <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
      )}
      {canClose && (
        <button
          className={cn(
            "p-0.5 rounded hover:bg-default-200 transition-opacity",
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onClick={handleClose}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function EditorTabsComponent({
  tabs,
  activeTabPath,
  onTabSelect,
  onTabClose,
  onCloseAll,
  onCloseOthers,
  readOnly = false,
}: EditorTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab
  useEffect(() => {
    if (containerRef.current && activeTabPath) {
      const activeTab = containerRef.current.querySelector(
        `[data-path="${activeTabPath}"]`
      );
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeTabPath]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="h-9 border-b border-border bg-default-50 flex items-center">
      <div
        ref={containerRef}
        className="flex-1 flex items-center overflow-x-auto scrollbar-thin"
      >
        {tabs.map((tab) => (
          <div key={tab.path} data-path={tab.path}>
            <TabItem
              tab={tab}
              isActive={tab.path === activeTabPath}
              onSelect={() => onTabSelect(tab.path)}
              onClose={() => onTabClose(tab.path)}
              onCloseOthers={onCloseOthers ? () => onCloseOthers(tab.path) : undefined}
              canClose={!readOnly}
            />
          </div>
        ))}
      </div>
      {tabs.length > 1 && !readOnly && (
        <div className="flex-shrink-0 px-2 border-l border-border">
          <Dropdown
            trigger={
              <button className="p-1 hover:bg-default-100 rounded">
                <MoreHorizontal size={14} />
              </button>
            }
            items={[
              ...(onCloseOthers && activeTabPath
                ? [
                    {
                      key: "close-others",
                      label: "Close Other Tabs",
                      onClick: () => onCloseOthers(activeTabPath),
                    },
                  ]
                : []),
              ...(onCloseAll
                ? [
                    {
                      key: "close-all",
                      label: "Close All Tabs",
                      onClick: onCloseAll,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}
    </div>
  );
}

export const EditorTabs = memo(EditorTabsComponent);
