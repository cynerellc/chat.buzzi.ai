"use client";

import { Upload, X, File as FileIcon, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { forwardRef, useState, useCallback, type InputHTMLAttributes, type DragEvent } from "react";

import { cn } from "@/lib/utils";

export interface FileUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: File[];
  onChange?: (files: File[]) => void;
  onRemove?: (file: File) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string;
  helperText?: string;
  isLoading?: boolean;
  showPreview?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return ImageIcon;
  if (file.type.includes("pdf") || file.type.includes("document")) return FileText;
  return FileIcon;
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  (
    {
      value = [],
      onChange,
      onRemove,
      maxFiles = 10,
      maxSize = 10 * 1024 * 1024, // 10MB default
      accept,
      helperText,
      isLoading,
      showPreview = true,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFiles = useCallback(
      (files: FileList | null) => {
        if (!files || !onChange) return;

        setError(null);
        const fileArray = Array.from(files);

        // Check max files
        if (value.length + fileArray.length > maxFiles) {
          setError(`Maximum ${maxFiles} files allowed`);
          return;
        }

        // Validate and filter files
        const validFiles = fileArray.filter((file) => {
          if (file.size > maxSize) {
            setError(`File ${file.name} exceeds maximum size of ${formatFileSize(maxSize)}`);
            return false;
          }
          return true;
        });

        onChange([...value, ...validFiles]);
      },
      [value, onChange, maxFiles, maxSize]
    );

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled && !isLoading) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (!disabled && !isLoading) {
        handleFiles(e.dataTransfer.files);
      }
    };

    const handleRemove = (file: File) => {
      if (onRemove) {
        onRemove(file);
      } else if (onChange) {
        onChange(value.filter((f) => f !== file));
      }
    };

    return (
      <div className={cn("space-y-3", className)}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            isDragging && "border-primary bg-primary-50",
            !isDragging && "border-default-300 hover:border-default-400",
            (disabled || isLoading) && "cursor-not-allowed opacity-60"
          )}
        >
          <input
            ref={ref}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            disabled={disabled || isLoading}
            onChange={(e) => handleFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            {...props}
          />

          {isLoading ? (
            <Loader2 className="h-10 w-10 text-default-400 animate-spin" />
          ) : (
            <Upload className="h-10 w-10 text-default-400" />
          )}

          <p className="mt-2 text-sm text-default-600">
            <span className="font-medium text-primary">Click to upload</span> or drag and drop
          </p>

          {helperText && (
            <p className="mt-1 text-xs text-default-400">{helperText}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {showPreview && value.length > 0 && (
          <div className="space-y-2">
            {value.map((file, index) => {
              const Icon = getFileIcon(file);
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-default-200 bg-default-50 p-3"
                >
                  <Icon className="h-5 w-5 text-default-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-default-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(file)}
                    className="rounded-md p-1 hover:bg-default-200 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4 text-default-500" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

FileUpload.displayName = "FileUpload";
