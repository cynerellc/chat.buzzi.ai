"use client";

import { memo } from "react";
import {
  Save,
  Package,
  Check,
  AlertCircle,
  Settings2,
  Map,
  Hash,
  WrapText,
  Minus,
  Plus,
} from "lucide-react";

import { Button, Dropdown } from "@/components/ui";
import type { EditorPreferences } from "@/lib/monaco/types";

export interface EditorToolbarProps {
  packagePath?: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isPacking?: boolean;
  packSuccess?: boolean;
  canPack?: boolean;
  readOnly?: boolean;
  preferences?: EditorPreferences;
  onSave: () => void;
  onPack?: () => void;
  onPreferencesChange?: (prefs: Partial<EditorPreferences>) => void;
}

function EditorToolbarComponent({
  packagePath,
  hasUnsavedChanges,
  isSaving,
  isPacking = false,
  packSuccess = false,
  canPack = true,
  readOnly = false,
  preferences,
  onSave,
  onPack,
  onPreferencesChange,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      {packagePath && (
        <span className="px-2 py-1 bg-default-100 rounded text-xs text-muted-foreground font-mono hidden lg:block">
          {packagePath}
        </span>
      )}

      {hasUnsavedChanges && (
        <span className="flex items-center gap-1 text-xs text-warning">
          <AlertCircle size={12} />
          <span className="hidden sm:inline">Unsaved changes</span>
        </span>
      )}

      {/* Editor preferences dropdown */}
      {preferences && onPreferencesChange && (
        <Dropdown
          trigger={
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Settings2 size={16} />
            </Button>
          }
          items={[
            {
              key: "font-decrease",
              label: `Font Size: ${preferences.fontSize}px (-)`,
              icon: Minus,
              onClick: () =>
                onPreferencesChange({
                  fontSize: Math.max(10, preferences.fontSize - 1),
                }),
            },
            {
              key: "font-increase",
              label: `Font Size: ${preferences.fontSize}px (+)`,
              icon: Plus,
              onClick: () =>
                onPreferencesChange({
                  fontSize: Math.min(24, preferences.fontSize + 1),
                }),
            },
            {
              key: "minimap",
              label: preferences.minimap ? "Hide Minimap" : "Show Minimap",
              icon: Map,
              onClick: () =>
                onPreferencesChange({ minimap: !preferences.minimap }),
            },
            {
              key: "line-numbers",
              label: preferences.lineNumbers
                ? "Hide Line Numbers"
                : "Show Line Numbers",
              icon: Hash,
              onClick: () =>
                onPreferencesChange({ lineNumbers: !preferences.lineNumbers }),
            },
            {
              key: "word-wrap",
              label: preferences.wordWrap ? "Disable Word Wrap" : "Enable Word Wrap",
              icon: WrapText,
              onClick: () =>
                onPreferencesChange({ wordWrap: !preferences.wordWrap }),
            },
          ]}
        />
      )}

      {!readOnly && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          isLoading={isSaving}
          isDisabled={!hasUnsavedChanges}
          className="gap-2"
        >
          <Save size={16} />
          <span className="hidden sm:inline">Save</span>
        </Button>
      )}

      {onPack && !readOnly && (
        <Button
          color={packSuccess ? "success" : "primary"}
          size="sm"
          onClick={onPack}
          isLoading={isPacking}
          isDisabled={isPacking || !canPack || hasUnsavedChanges}
          className="gap-2"
        >
          {packSuccess ? (
            <>
              <Check size={16} />
              <span className="hidden sm:inline">Packed</span>
            </>
          ) : (
            <>
              <Package size={16} />
              <span className="hidden sm:inline">Pack Code</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export const EditorToolbar = memo(EditorToolbarComponent);
