"use client";

import { useState } from "react";
import {
  FileText,
  Upload,
  Search,
  Download,
  Trash2,
  MoreVertical,
  File,
  Image,
  FileVideo,
  FileAudio,
  FileArchive,
  Eye,
  FolderOpen,
} from "lucide-react";
import useSWR, { mutate } from "swr";

import {
  Button,
  Card,
  CardBody,
  Select,
  Badge,
  Dropdown,
  type DropdownMenuItemData,
  Skeleton,
  Input,
  addToast,
} from "@/components/ui";
import { UploadModal } from "@/components/company-admin/knowledge/upload-modal";

interface CompanyFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface FilesResponse {
  files: CompanyFile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "document", label: "Documents" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Other" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "knowledge", label: "Knowledge Base" },
  { value: "widget", label: "Widget Assets" },
  { value: "general", label: "General" },
];

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return FileArchive;
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  )
    return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function FilesPage() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    type: "all",
    category: "all",
  });
  const [searchValue, setSearchValue] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const queryParams = new URLSearchParams({
    page: filters.page.toString(),
    limit: filters.limit.toString(),
    ...(filters.type !== "all" && { type: filters.type }),
    ...(filters.category !== "all" && { category: filters.category }),
    ...(searchValue && { search: searchValue }),
  });

  const { data, isLoading } = useSWR<FilesResponse>(
    `/api/company/files?${queryParams}`,
    fetcher
  );

  const files = data?.files ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleDelete = async (fileId: string) => {
    try {
      const response = await fetch(`/api/company/files?id=${fileId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        addToast({ title: "File deleted", color: "success" });
        mutate(`/api/company/files?${queryParams}`);
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      addToast({ title: "Failed to delete file", color: "danger" });
    }
  };

  const handleDownload = (file: CompanyFile) => {
    window.open(file.url, "_blank");
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    mutate(`/api/company/files?${queryParams}`);
    addToast({ title: "File uploaded successfully", color: "success" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">File Manager</h1>
          <p className="text-muted-foreground">
            Upload and manage files for your knowledge base and widget
          </p>
        </div>
        <Button
          color="primary"
          leftIcon={Upload}
          onPress={() => setShowUploadModal(true)}
        >
          Upload File
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search files..."
                value={searchValue}
                onValueChange={setSearchValue}
                startContent={<Search className="h-4 w-4 text-muted-foreground" />}
                isClearable
                onClear={() => setSearchValue("")}
              />
            </div>

            <Select
              options={TYPE_OPTIONS}
              selectedKeys={new Set([filters.type])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                handleFilterChange("type", selected as string);
              }}
              className="w-[150px]"
            />

            <Select
              options={CATEGORY_OPTIONS}
              selectedKeys={new Set([filters.category])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                handleFilterChange("category", selected as string);
              }}
              className="w-[180px]"
            />
          </div>
        </CardBody>
      </Card>

      {/* Files List */}
      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No files found</p>
              <p className="text-muted-foreground text-sm mb-4">
                Upload files to get started
              </p>
              <Button
                color="primary"
                leftIcon={Upload}
                onPress={() => setShowUploadModal(true)}
              >
                Upload Your First File
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {files.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);

                const dropdownItems: DropdownMenuItemData[] = [
                  { key: "preview", label: "Preview", icon: Eye },
                  { key: "download", label: "Download", icon: Download },
                  { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
                ];

                return (
                  <div key={file.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FileIcon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{file.name}</span>
                          <Badge variant="default">{file.category}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <span>Uploaded {formatDate(file.createdAt)}</span>
                          <span>
                            by {file.uploadedBy.name || file.uploadedBy.email}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                        items={dropdownItems}
                        onAction={(key) => {
                          if (key === "preview" || key === "download") {
                            handleDownload(file);
                          } else if (key === "delete") {
                            handleDelete(file.id);
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} files
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onPress={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onPress={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
