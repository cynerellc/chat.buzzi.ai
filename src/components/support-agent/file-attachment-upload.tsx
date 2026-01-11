"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  Check,
  Cloud,
  type LucideIcon,
} from "lucide-react";
import { Button, PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui";
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _formatFileSize = (bytes: number): string => {
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
    <PopoverRoot
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
          >
            <Paperclip size={20} />
            <AnimatePresence>
              {uploads.length > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-medium rounded-full flex items-center justify-center"
                >
                  {uploads.length}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" sideOffset={10} className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
            <Cloud size={14} className="text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Attach Files</h4>
            <p className="text-xs text-muted-foreground">Max {maxSizeMB}MB per file</p>
          </div>
        </div>

        {/* Drop Zone */}
        <motion.div
          className={cn(
            "m-4 p-6 border-2 border-dashed rounded-xl text-center transition-all duration-200 cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          whileHover={{ scale: 1.01 }}
        >
          <motion.div
            animate={isDragging ? { y: -5 } : { y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Upload size={20} className={cn("text-muted-foreground", isDragging && "text-primary")} />
            </div>
            <p className="text-sm font-medium">
              {isDragging ? "Drop files here" : "Click or drag files"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images, documents, videos
            </p>
          </motion.div>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(",")}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* Upload Progress */}
        <AnimatePresence>
          {uploads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 space-y-2"
            >
              {uploads.map((upload) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _Icon = FILE_TYPE_ICONS.file as LucideIcon;
                return (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl text-sm transition-colors",
                      upload.status === "error"
                        ? "bg-destructive/10 border border-destructive/20"
                        : upload.status === "completed"
                        ? "bg-success/10 border border-success/20"
                        : "bg-muted border border-border/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      upload.status === "error"
                        ? "bg-destructive/20"
                        : upload.status === "completed"
                        ? "bg-success/20"
                        : "bg-primary/20"
                    )}>
                      {upload.status === "uploading" ? (
                        <Loader2 size={14} className="animate-spin text-primary" />
                      ) : upload.status === "error" ? (
                        <X size={14} className="text-destructive" />
                      ) : (
                        <Check size={14} className="text-success" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">{upload.name}</p>
                      {upload.status === "uploading" && (
                        <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${upload.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                      {upload.status === "error" && (
                        <p className="text-xs text-destructive truncate mt-0.5">{upload.error}</p>
                      )}
                      {upload.status === "completed" && (
                        <p className="text-xs text-success mt-0.5">Upload complete</p>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeUpload(upload.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={14} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default FileAttachmentUpload;
