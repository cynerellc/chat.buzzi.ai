"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Link as LinkIcon,
  FileType,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Badge,
  Textarea,
  Tabs,
} from "@/components/ui";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
  category?: string;
}

interface FileUpload {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".docx",
  ".doc",
  ".xlsx",
  ".json",
  ".html",
];

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
  "text/html",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  category = "knowledge",
}: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<string>("file");
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const [text, setText] = useState("");
  const [textName, setTextName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is too large (max 10MB)`;
    }
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_MIME_TYPES.includes(file.type)) {
      return `${file.name} has an unsupported format`;
    }
    return null;
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);

    const validFiles: FileUpload[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
      } else {
        validFiles.push({
          file,
          progress: 0,
          status: "pending",
        });
      }
    });

    if (errors.length > 0) {
      setError(errors.join(", "));
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset the input so the same file can be selected again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (fileUpload: FileUpload, index: number): Promise<boolean> => {
    const formData = new FormData();
    formData.append("file", fileUpload.file);
    formData.append("category", category);
    formData.append("name", fileUpload.file.name);

    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: "uploading" as const, progress: 0 } : f
      )
    );

    try {
      const response = await fetch("/api/company/files", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "success" as const, progress: 100 } : f
        )
      );
      return true;
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: "error" as const, error: err instanceof Error ? err.message : "Upload failed" }
            : f
        )
      );
      return false;
    }
  };

  const uploadUrl = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/company/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "url",
          name: urlName || url,
          sourceUrl: url,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add URL");
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add URL");
      return false;
    }
  };

  const uploadText = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/company/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          name: textName || "Text content",
          rawContent: text,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add text");
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add text");
      return false;
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setError(null);
    let success = false;

    try {
      if (activeTab === "file" && files.length > 0) {
        const results = await Promise.all(
          files.map((f, i) => uploadFile(f, i))
        );
        success = results.some((r) => r);
      } else if (activeTab === "url" && url) {
        success = await uploadUrl();
      } else if (activeTab === "text" && text) {
        success = await uploadText();
      }

      if (success) {
        onUploadComplete?.();
        handleClose();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setUrl("");
    setUrlName("");
    setText("");
    setTextName("");
    setError(null);
    setActiveTab("file");
    onClose();
  };

  const canUpload =
    (activeTab === "file" && files.length > 0 && files.some((f) => f.status === "pending")) ||
    (activeTab === "url" && url.trim()) ||
    (activeTab === "text" && text.trim());

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalContent>
        <ModalHeader>Upload Content</ModalHeader>
        <ModalBody>
          <Tabs
            items={[
              { key: "file", label: "File", icon: FileText },
              { key: "url", label: "URL", icon: LinkIcon },
              { key: "text", label: "Text", icon: FileType },
            ]}
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
          />

          <div className="mt-4">
            {activeTab === "file" && (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30 hover:border-primary hover:bg-muted"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {isDragActive ? (
                    <p className="text-primary font-medium">Drop files here...</p>
                  ) : (
                    <>
                      <p className="font-medium">Drag & drop files here</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground mt-4">
                    Supported: PDF, TXT, MD, CSV, DOCX, DOC, XLSX, JSON, HTML (max 10MB)
                  </p>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((f, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{f.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(f.file.size)}
                          </p>
                        </div>
                        {f.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onPress={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {f.status === "uploading" && (
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        )}
                        {f.status === "success" && (
                          <CheckCircle className="h-5 w-5 text-success" />
                        )}
                        {f.status === "error" && (
                          <Badge variant="danger">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {f.error || "Error"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "url" && (
              <div className="space-y-4">
                <Input
                  label="URL"
                  placeholder="https://example.com/page"
                  value={url}
                  onValueChange={setUrl}
                  startContent={<LinkIcon className="h-4 w-4 text-muted-foreground" />}
                />
                <Input
                  label="Name (optional)"
                  placeholder="Enter a name for this source"
                  value={urlName}
                  onValueChange={setUrlName}
                />
                <p className="text-sm text-muted-foreground">
                  The content from this URL will be fetched and processed as a knowledge source.
                </p>
              </div>
            )}

            {activeTab === "text" && (
              <div className="space-y-4">
                <Input
                  label="Name"
                  placeholder="Enter a name for this content"
                  value={textName}
                  onValueChange={setTextName}
                />
                <Textarea
                  label="Content"
                  placeholder="Paste or type your text content here..."
                  value={text}
                  onValueChange={setText}
                  minRows={8}
                />
                <p className="text-sm text-muted-foreground">
                  This text will be processed and added to your knowledge base.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger-50 text-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleUpload}
            isDisabled={!canUpload}
            isLoading={isUploading}
            leftIcon={Upload}
          >
            Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
