"use client";

import { useState, useRef, useCallback } from "react";
import {
  Paperclip,
  X,
  FileText,
  Film,
  Music,
  Upload,
  Loader2,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  type: "image" | "file" | "video" | "audio";
  size: number;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
}

interface FileUploadProgress {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

export interface FileAttachmentUploadProps {
  conversationId?: string;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: string) => void;
  onFilesSelected?: (files: File[]) => void;
  maxSizeMB?: number;
  maxFiles?: number;
  allowedTypes?: string[];
  className?: string;
}

const FILE_TYPE_ICONS: Record<string, LucideIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  file: FileText,
};

const ALLOWED_EXTENSIONS = [
  // Images
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  // Documents
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv",
  // Videos
  ".mp4", ".webm", ".mov",
  // Audio
  ".mp3", ".wav", ".ogg",
  // Archives
  ".zip", ".rar", ".7z",
];

const getFileType = (mimeType: string): "image" | "file" | "video" | "audio" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileAttachmentUpload({
  conversationId,
  onUploadComplete,
  onUploadError,
  onFilesSelected,
  maxSizeMB = 10,
  maxFiles = 10,
  allowedTypes = ALLOWED_EXTENSIONS,
  className,
}: FileAttachmentUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const uploadId = crypto.randomUUID();

    // Add to uploads list
    setUploads((prev) => [
      ...prev,
      { id: uploadId, name: file.name, progress: 0, status: "uploading" },
    ]);

    try {
      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File too large. Max size: ${maxSizeMB}MB`);
      }

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // For demo purposes, we'll simulate upload with a mock URL
      // In production, this would upload to your file storage (S3, Cloudinary, etc.)

      // Simulate upload progress
      for (let i = 10; i <= 90; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progress: i } : u))
        );
      }

      // Generate a mock URL (in production, this comes from your upload API)
      const mockUrl = URL.createObjectURL(file);
      const fileType = getFileType(file.type);

      // Create attachment via API
      const response = await fetch(
        `/api/support-agent/conversations/${conversationId}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: fileType,
            name: file.name,
            url: mockUrl, // In production, use the uploaded file URL
            size: file.size,
            mimeType: file.type,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save attachment");
      }

      const data = await response.json();

      // Update progress to complete
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, progress: 100, status: "completed" } : u
        )
      );

      const uploadedFile: UploadedFile = {
        id: data.attachment.id,
        name: file.name,
        type: fileType,
        size: file.size,
        url: mockUrl,
        mimeType: file.type,
      };

      onUploadComplete?.(uploadedFile);

      // Remove from list after a delay
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      }, 2000);

      return uploadedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";

      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, status: "error", error: errorMessage } : u
        )
      );

      onUploadError?.(errorMessage);
      return null;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).slice(0, maxFiles);

    // If onFilesSelected is provided, just pass the files without uploading
    if (onFilesSelected) {
      onFilesSelected(fileArray);
      setIsOpen(false);
      return;
    }

    // Otherwise, upload the files
    for (const file of fileArray) {
      await uploadFile(file);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      await handleFileSelect(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeUpload = (uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="top-start"
      offset={10}
    >
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          className={cn("relative", className)}
        >
          <Paperclip size={20} />
          {uploads.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
              {uploads.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0">
        {/* Header */}
        <div className="p-3 border-b border-divider">
          <h4 className="font-medium text-sm">Attach Files</h4>
          <p className="text-xs text-default-500">Max {maxSizeMB}MB per file</p>
        </div>

        {/* Drop Zone */}
        <div
          className={cn(
            "m-3 p-4 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-default-300 hover:border-primary/50"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload size={24} className="mx-auto mb-2 text-default-400" />
          <p className="text-sm">
            {isDragging ? "Drop files here" : "Click or drag files"}
          </p>
          <p className="text-xs text-default-400 mt-1">
            Images, documents, videos
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(",")}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* Upload Progress */}
        {uploads.length > 0 && (
          <div className="px-3 pb-3 space-y-2">
            {uploads.map((upload) => {
              const Icon = FILE_TYPE_ICONS.file as LucideIcon;
              return (
                <div
                  key={upload.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg text-sm",
                    upload.status === "error" ? "bg-danger/10" : "bg-default-100"
                  )}
                >
                  {upload.status === "uploading" ? (
                    <Loader2 size={16} className="animate-spin text-primary" />
                  ) : upload.status === "error" ? (
                    <X size={16} className="text-danger" />
                  ) : (
                    <Icon size={16} className="text-success" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{upload.name}</p>
                    {upload.status === "uploading" && (
                      <div className="h-1 bg-default-200 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}
                    {upload.status === "error" && (
                      <p className="text-xs text-danger truncate">{upload.error}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeUpload(upload.id)}
                    className="text-default-400 hover:text-default-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default FileAttachmentUpload;
