"use client";

import { cva } from "class-variance-authority";
import { Check, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

const tagInputContainerVariants = cva(
  "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[3px] border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
  {
    variants: {
      hasError: {
        true: "border-destructive focus-within:ring-destructive",
        false: "",
      },
    },
    defaultVariants: {
      hasError: false,
    },
  }
);

export interface TagInputProps {
  /** Currently selected tags */
  value: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** Available suggestions for autocomplete */
  suggestions?: string[];
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Error state */
  hasError?: boolean;
  /** Allow creating new tags not in suggestions */
  allowCreate?: boolean;
  /** Maximum number of tags allowed */
  maxTags?: number;
  /** Class name for the container */
  className?: string;
  /** Loading state for suggestions */
  isLoading?: boolean;
}

export const TagInput = forwardRef<HTMLDivElement, TagInputProps>(
  (
    {
      value = [],
      onChange,
      suggestions = [],
      placeholder = "Type to search...",
      disabled = false,
      hasError = false,
      allowCreate = true,
      maxTags,
      className,
      isLoading = false,
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on input and exclude already selected
    const filteredSuggestions = suggestions.filter(
      (suggestion) =>
        !value.includes(suggestion) &&
        suggestion.toLowerCase().includes(inputValue.toLowerCase())
    );

    // Check if current input matches any suggestion exactly
    const exactMatch = suggestions.some(
      (s) => s.toLowerCase() === inputValue.toLowerCase()
    );

    // Show "create new" option if allowCreate and input doesn't match existing
    const showCreateOption =
      allowCreate &&
      inputValue.trim() &&
      !exactMatch &&
      !value.includes(inputValue.trim());

    const allOptions = showCreateOption
      ? [...filteredSuggestions, `__create__:${inputValue.trim()}`]
      : filteredSuggestions;

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current &&
          !inputRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const addTag = (tag: string) => {
      const trimmedTag = tag.trim();
      const shouldAdd = trimmedTag && !value.includes(trimmedTag) && (!maxTags || value.length < maxTags);
      if (shouldAdd) {
        onChange([...value, trimmedTag]);
        setInputValue("");
        setIsOpen(false);
        inputRef.current?.focus();
      }
    };

    const removeTag = (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
      inputRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (isOpen && allOptions.length > 0 && highlightedIndex >= 0) {
            const selected = allOptions[highlightedIndex];
            if (selected?.startsWith("__create__:")) {
              addTag(selected.replace("__create__:", ""));
            } else if (selected) {
              addTag(selected);
            }
          } else if (inputValue.trim() && allowCreate) {
            addTag(inputValue.trim());
          }
          break;

        case "Backspace":
          if (!inputValue && value.length > 0) {
            const lastTag = value[value.length - 1];
            if (lastTag) {
              removeTag(lastTag);
            }
          }
          break;

        case "ArrowDown":
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) =>
              prev < allOptions.length - 1 ? prev + 1 : prev
            );
          } else {
            setIsOpen(true);
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          }
          break;

        case "Escape":
          setIsOpen(false);
          setInputValue("");
          break;

        case "Tab":
          setIsOpen(false);
          break;
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      setHighlightedIndex(0); // Reset highlighted index when input changes
      setIsOpen(true);
    };

    const handleContainerClick = () => {
      if (!disabled) {
        inputRef.current?.focus();
      }
    };

    const handleOptionClick = (option: string) => {
      if (option.startsWith("__create__:")) {
        addTag(option.replace("__create__:", ""));
      } else {
        addTag(option);
      }
    };

    return (
      <div className="relative" ref={ref}>
        <div
          className={cn(
            tagInputContainerVariants({ hasError }),
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          onClick={handleContainerClick}
        >
          {/* Tags */}
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="rounded-full p-0.5 hover:bg-primary/20 focus:outline-none"
                  tabIndex={-1}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled || (maxTags !== undefined && value.length >= maxTags)}
            className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>

        {/* Dropdown */}
        {isOpen && (allOptions.length > 0 || isLoading) && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md"
          >
            {isLoading ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Loading categories...
              </div>
            ) : (
              <>
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    onClick={() => handleOptionClick(suggestion)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                      highlightedIndex === index
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Check
                      size={14}
                      className={cn(
                        "mr-2 opacity-0",
                        value.includes(suggestion) && "opacity-100"
                      )}
                    />
                    {suggestion}
                  </div>
                ))}
                {showCreateOption && (
                  <div
                    onClick={() => handleOptionClick(`__create__:${inputValue.trim()}`)}
                    onMouseEnter={() => setHighlightedIndex(filteredSuggestions.length)}
                    className={cn(
                      "relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                      highlightedIndex === filteredSuggestions.length
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <span className="mr-2 text-xs text-muted-foreground">Create:</span>
                    <span className="font-medium">&quot;{inputValue.trim()}&quot;</span>
                  </div>
                )}
                {filteredSuggestions.length === 0 && !showCreateOption && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No matching categories
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);

TagInput.displayName = "TagInput";

export { tagInputContainerVariants };
