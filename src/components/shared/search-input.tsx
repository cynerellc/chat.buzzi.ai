"use client";

import { Input } from "@heroui/react";
import { Search, X, Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  onClear?: () => void;
  shortcutHint?: string;
  className?: string;
  autoFocus?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "Search...",
      isLoading = false,
      onClear,
      shortcutHint,
      className,
      autoFocus,
    },
    ref
  ) => {
    const handleClear = () => {
      onChange("");
      onClear?.();
    };

    return (
      <Input
        ref={ref}
        type="search"
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(className)}
        classNames={{
          inputWrapper: "h-10",
        }}
        startContent={
          isLoading ? (
            <Loader2 size={18} className="text-default-400 animate-spin" />
          ) : (
            <Search size={18} className="text-default-400" />
          )
        }
        endContent={
          <div className="flex items-center gap-1">
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded hover:bg-default-100"
              >
                <X size={14} className="text-default-400" />
              </button>
            )}
            {shortcutHint && !value && (
              <kbd className="hidden sm:block px-1.5 py-0.5 text-xs bg-default-100 rounded text-default-500">
                {shortcutHint}
              </kbd>
            )}
          </div>
        }
      />
    );
  }
);

SearchInput.displayName = "SearchInput";
