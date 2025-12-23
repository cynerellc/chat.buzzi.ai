"use client";

import { forwardRef, useState, useCallback, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#78716c", "#64748b", "#000000",
];

export interface ColorPickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: string;
  onChange?: (color: string) => void;
  presetColors?: string[];
  showInput?: boolean;
  label?: string;
  helperText?: string;
}

export const ColorPicker = forwardRef<HTMLInputElement, ColorPickerProps>(
  (
    {
      value = "#3b82f6",
      onChange,
      presetColors = PRESET_COLORS,
      showInput = true,
      label,
      helperText,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState(value);

    const handleChange = useCallback(
      (color: string) => {
        setLocalValue(color);
        onChange?.(color);
      },
      [onChange]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      // Only trigger onChange for valid hex colors
      if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
        onChange?.(newValue);
      }
    };

    return (
      <div className={cn("space-y-3", className)}>
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}

        <div className="flex flex-wrap gap-2">
          {presetColors.map((color) => (
            <button
              key={color}
              type="button"
              disabled={disabled}
              onClick={() => handleChange(color)}
              className={cn(
                "relative h-8 w-8 rounded-md border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
                localValue.toLowerCase() === color.toLowerCase()
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "border-transparent",
                disabled && "cursor-not-allowed opacity-50"
              )}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            >
              {localValue.toLowerCase() === color.toLowerCase() && (
                <Check
                  className={cn(
                    "absolute inset-0 m-auto h-4 w-4",
                    isLightColor(color) ? "text-black" : "text-white"
                  )}
                />
              )}
            </button>
          ))}

          {/* Native color picker */}
          <label
            className={cn(
              "relative h-8 w-8 rounded-md border-2 border-dashed border-default-300 cursor-pointer transition-all hover:border-default-400",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <input
              ref={ref}
              type="color"
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              {...props}
            />
            <div
              className="absolute inset-1 rounded"
              style={{ backgroundColor: localValue }}
            />
          </label>
        </div>

        {showInput && (
          <div className="flex items-center gap-2">
            <div
              className="h-9 w-9 rounded-md border border-default-200"
              style={{ backgroundColor: localValue }}
            />
            <input
              type="text"
              value={localValue}
              onChange={handleInputChange}
              disabled={disabled}
              placeholder="#000000"
              className={cn(
                "h-9 w-24 rounded-md border border-default-200 bg-default-50 px-3 text-sm font-mono",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                disabled && "cursor-not-allowed opacity-50"
              )}
            />
          </div>
        )}

        {helperText && (
          <p className="text-xs text-default-400">{helperText}</p>
        )}
      </div>
    );
  }
);

ColorPicker.displayName = "ColorPicker";

// Helper function to determine if a color is light
function isLightColor(hex: string): boolean {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return false;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
