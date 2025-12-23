"use client";

import {
  AlertTriangle,
  Check,
  FileCode,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

import {
  Button,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Select,
  Textarea,
} from "@/components/ui";

interface PackageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  packageId?: string; // If provided, upload as new version
}

type UploadStatus = "idle" | "validating" | "uploading" | "processing" | "complete" | "error";

const categoryOptions = [
  { value: "support", label: "Customer Support" },
  { value: "sales", label: "Sales Assistant" },
  { value: "faq", label: "FAQ Bot" },
  { value: "custom", label: "Custom" },
];

export function PackageUploadModal({
  isOpen,
  onClose,
  onSuccess,
  packageId,
}: PackageUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Form data for new package
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom",
    version: "1.0.0",
    changelog: "",
  });

  const isNewPackage = !packageId;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFileType(droppedFile)) {
        setFile(droppedFile);
        validatePackage(droppedFile);
      }
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFileType(selectedFile)) {
        setFile(selectedFile);
        validatePackage(selectedFile);
      }
    }
  }, []);

  const validateFileType = (file: File): boolean => {
    const validTypes = [".zip", ".tar.gz", ".tgz"];
    const fileName = file.name.toLowerCase();
    const isValid = validTypes.some((type) => fileName.endsWith(type));
    if (!isValid) {
      setError("Invalid file type. Please upload a .zip, .tar.gz, or .tgz file.");
    }
    return isValid;
  };

  const validatePackage = async (file: File) => {
    setStatus("validating");
    setProgress(20);

    // Simulate validation (in production, this would call an API)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock validation results
    const mockValidation = {
      valid: true,
      errors: [] as string[],
      warnings: ["No README.md found in package"] as string[],
    };

    setValidationResults(mockValidation);
    setProgress(40);
    setStatus("idle");
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(50);
    setError(null);

    try {
      // Create form data
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("version", formData.version);
      uploadData.append("changelog", formData.changelog);

      if (isNewPackage) {
        uploadData.append("name", formData.name);
        uploadData.append("description", formData.description);
        uploadData.append("category", formData.category);
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const endpoint = isNewPackage
        ? "/api/master-admin/packages/upload"
        : `/api/master-admin/packages/${packageId}/versions`;

      const res = await fetch(endpoint, {
        method: "POST",
        body: uploadData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Upload failed");
      }

      setProgress(100);
      setStatus("complete");

      // Wait a moment before closing
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onSuccess();
      handleClose();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleClose = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError(null);
    setValidationResults(null);
    setFormData({
      name: "",
      description: "",
      category: "custom",
      version: "1.0.0",
      changelog: "",
    });
    onClose();
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="2xl">
      <ModalContent>
        <ModalHeader>
          {isNewPackage ? "Upload New Package" : "Upload New Version"}
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary-50"
                : "border-divider hover:border-default-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 p-3 bg-default-100 rounded-lg">
                  <FileCode size={24} className="text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-default-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    variant="flat"
                    size="sm"
                    onPress={() => {
                      setFile(null);
                      setValidationResults(null);
                    }}
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Upload size={40} className="mx-auto mb-3 text-default-400" />
                <p className="font-medium mb-1">
                  Drag and drop your package file here
                </p>
                <p className="text-sm text-default-500 mb-3">
                  or click to browse (ZIP, TAR.GZ supported)
                </p>
                <label>
                  <input
                    type="file"
                    accept=".zip,.tar.gz,.tgz"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button as="span" variant="flat" className="cursor-pointer">
                    Choose File
                  </Button>
                </label>
              </>
            )}
          </div>

          {/* Validation Results */}
          {validationResults && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {validationResults.valid ? (
                  <Check size={20} className="text-success" />
                ) : (
                  <X size={20} className="text-danger" />
                )}
                <span className="font-medium">
                  {validationResults.valid
                    ? "Package validation passed"
                    : "Package validation failed"}
                </span>
              </div>
              {validationResults.errors.length > 0 && (
                <ul className="text-sm text-danger space-y-1 mt-2">
                  {validationResults.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <X size={14} className="shrink-0 mt-0.5" />
                      {error}
                    </li>
                  ))}
                </ul>
              )}
              {validationResults.warnings.length > 0 && (
                <ul className="text-sm text-warning-700 space-y-1 mt-2">
                  {validationResults.warnings.map((warning, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Package Details (for new packages) */}
          {isNewPackage && file && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Package Name"
                  value={formData.name}
                  onValueChange={(v) => updateField("name", v)}
                  placeholder="My Agent Package"
                  isRequired
                />
                <Select
                  label="Category"
                  selectedKeys={new Set([formData.category])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    updateField("category", selected ?? "custom");
                  }}
                  options={categoryOptions}
                />
              </div>
              <Textarea
                label="Description"
                value={formData.description}
                onValueChange={(v) => updateField("description", v)}
                placeholder="Brief description of this package"
                minRows={2}
              />
            </div>
          )}

          {/* Version Info */}
          {file && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Version"
                value={formData.version}
                onValueChange={(v) => updateField("version", v)}
                placeholder="1.0.0"
                description="Semantic versioning (e.g., 1.0.0)"
              />
              <Input
                label="Changelog Entry"
                value={formData.changelog}
                onValueChange={(v) => updateField("changelog", v)}
                placeholder="Initial release"
                description="What's new in this version"
              />
            </div>
          )}

          {/* Progress */}
          {status !== "idle" && status !== "error" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-default-500">
                  {status === "validating" && "Validating package..."}
                  {status === "uploading" && "Uploading package..."}
                  {status === "processing" && "Processing..."}
                  {status === "complete" && "Upload complete!"}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress
                value={progress}
                color={status === "complete" ? "success" : "primary"}
                size="sm"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            startContent={<Upload size={16} />}
            onPress={handleUpload}
            isDisabled={
              !file ||
              !validationResults?.valid ||
              (isNewPackage && !formData.name) ||
              status === "uploading" ||
              status === "processing"
            }
            isLoading={status === "uploading" || status === "processing"}
          >
            Upload {isNewPackage ? "Package" : "Version"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
