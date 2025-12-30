"use client";

import { useState, Suspense, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Link as LinkIcon,
  FileType,
  Upload,
  X,
  Loader2,
  CheckCircle,
  FolderOpen,
  AlertCircle,
} from "lucide-react";

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardBody,
  Chip,
  Textarea,
  Tabs,
  addToast,
  Badge,
} from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  useCreateKnowledgeSource,
  useCreateFaq,
  useFaq,
  useUpdateFaq,
  useFileUpload,
} from "@/hooks/company";

type SourceType = "file" | "url" | "text";

function KnowledgeNewPageContent() {
  useSetPageTitle("New Knowledge Source");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFaqMode = searchParams.get("type") === "faq";
  const editFaqId = searchParams.get("edit");
  const categoryFromUrl = searchParams.get("category");
  const isEditMode = Boolean(editFaqId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceType, setSourceType] = useState<SourceType>("file");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    storagePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);

  // FAQ state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Hooks
  const { createSource, isCreating } = useCreateKnowledgeSource();
  const { createFaq, isCreating: isCreatingFaq } = useCreateFaq();
  const { faq: existingFaq, isLoading: isLoadingFaq } = useFaq(editFaqId);
  const { updateFaq, isUpdating: isUpdatingFaq } = useUpdateFaq(editFaqId || "");
  const { uploadFile, isUploading } = useFileUpload();

  // Redirect if no category is provided (except for edit mode)
  useEffect(() => {
    if (!categoryFromUrl && !isEditMode) {
      addToast({
        title: "Category required",
        description: "Please select a category first",
        color: "warning",
      });
      router.push("/knowledge");
    }
  }, [categoryFromUrl, isEditMode, router]);

  // Initialize form with existing FAQ data when editing
  if (isEditMode && existingFaq && !isInitialized) {
    setQuestion(existingFaq.question);
    setAnswer(existingFaq.answer);
    setTags(existingFaq.tags || []);
    setPriority(existingFaq.priority);
    setIsInitialized(true);
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // File handling - auto-set name from filename
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    // Auto-generate name from filename (without extension)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setName(nameWithoutExt);

    try {
      const result = await uploadFile(file);
      setUploadResult(result);
      addToast({ title: "File uploaded successfully", color: "success" });
    } catch (err) {
      addToast({
        title: err instanceof Error ? err.message : "Failed to upload file",
        color: "danger",
      });
      setSelectedFile(null);
    }
  }, [uploadFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileSelect(files[0]!);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]!);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Extract domain from URL for auto-naming
  const extractDomainFromUrl = (urlString: string): string => {
    try {
      const parsedUrl = new URL(urlString);
      return parsedUrl.hostname.replace(/^www\./, "");
    } catch {
      return urlString;
    }
  };

  const handleSubmitSource = async () => {
    // For text type, name is required
    if (sourceType === "text" && !name.trim()) {
      addToast({ title: "Please enter a name", color: "warning" });
      return;
    }

    if (sourceType === "url" && !url.trim()) {
      addToast({ title: "Please enter a URL", color: "warning" });
      return;
    }

    if (sourceType === "text" && !textContent.trim()) {
      addToast({ title: "Please enter some content", color: "warning" });
      return;
    }

    if (sourceType === "file" && !uploadResult) {
      addToast({ title: "Please upload a file", color: "warning" });
      return;
    }

    try {
      const sourceConfig: Record<string, unknown> = {};
      let sourceName = name.trim();

      if (sourceType === "url") {
        sourceConfig.url = url.trim();
        sourceConfig.crawlDepth = 1;
        // Auto-generate name from URL domain if not manually set
        if (!sourceName) {
          sourceName = extractDomainFromUrl(url.trim());
        }
      } else if (sourceType === "text") {
        sourceConfig.content = textContent.trim();
      } else if (sourceType === "file" && uploadResult) {
        sourceConfig.storagePath = uploadResult.storagePath;
        sourceConfig.fileName = uploadResult.fileName;
        sourceConfig.fileSize = uploadResult.fileSize;
        sourceConfig.fileType = uploadResult.mimeType;
        // Use filename as name
        if (!sourceName) {
          sourceName = uploadResult.fileName.replace(/\.[^/.]+$/, "");
        }
      }

      await createSource({
        name: sourceName,
        description: description.trim() || undefined,
        type: sourceType,
        category: categoryFromUrl ? decodeURIComponent(categoryFromUrl) : undefined,
        sourceConfig,
      });

      addToast({ title: "Knowledge source created successfully", color: "success" });
      router.push("/knowledge");
    } catch {
      addToast({ title: "Failed to create knowledge source", color: "danger" });
    }
  };

  const handleSubmitFaq = async () => {
    if (!question.trim()) {
      addToast({ title: "Please enter a question", color: "warning" });
      return;
    }

    if (!answer.trim()) {
      addToast({ title: "Please enter an answer", color: "warning" });
      return;
    }

    try {
      const faqData = {
        question: question.trim(),
        answer: answer.trim(),
        category: categoryFromUrl ? decodeURIComponent(categoryFromUrl) : undefined,
        tags,
        priority,
      };

      if (isEditMode) {
        await updateFaq(faqData);
        addToast({ title: "FAQ updated successfully", color: "success" });
      } else {
        await createFaq(faqData);
        addToast({ title: "FAQ created successfully", color: "success" });
      }
      router.push("/knowledge");
    } catch {
      addToast({ title: isEditMode ? "Failed to update FAQ" : "Failed to create FAQ", color: "danger" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Don't render if no category (will redirect)
  if (!categoryFromUrl && !isEditMode) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // FAQ Mode
  if (isFaqMode) {
    if (isEditMode && isLoadingFaq) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading FAQ...</div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.push("/knowledge")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditMode ? "Edit FAQ" : "Add FAQ"}</h1>
            <p className="text-muted-foreground">
              {isEditMode
                ? "Update this frequently asked question"
                : "Create a frequently asked question for quick responses"}
            </p>
          </div>
        </div>

        {/* Category Badge */}
        {categoryFromUrl && (
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Category:</span>
            <Badge variant="secondary">{decodeURIComponent(categoryFromUrl)}</Badge>
          </div>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">FAQ Details</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            <Textarea
              label="Question"
              placeholder="What is your return policy?"
              value={question}
              onValueChange={setQuestion}
              minRows={2}
              isRequired
            />

            <Textarea
              label="Answer"
              placeholder="Our return policy allows returns within 30 days of purchase..."
              value={answer}
              onValueChange={setAnswer}
              minRows={4}
              isRequired
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    onClose={() => handleRemoveTag(tag)}
                  >
                    {tag}
                  </Chip>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={tagInput}
                  onValueChange={setTagInput}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  className="flex-1"
                />
                <Button variant="outline" onPress={handleAddTag}>
                  Add
                </Button>
              </div>
            </div>

            <Input
              type="number"
              label="Priority"
              placeholder="0"
              value={priority.toString()}
              onValueChange={(v) => setPriority(parseInt(v) || 0)}
              description="Higher priority FAQs are matched first (0 = default)"
            />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onPress={() => router.push("/knowledge")}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmitFaq}
            isLoading={isEditMode ? isUpdatingFaq : isCreatingFaq}
          >
            {isEditMode ? "Save Changes" : "Create FAQ"}
          </Button>
        </div>
      </div>
    );
  }

  // Source Mode
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.push("/knowledge")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Knowledge Source</h1>
          <p className="text-muted-foreground">
            Add documents, URLs, or text to train your AI agents
          </p>
        </div>
      </div>

      {/* Category Badge */}
      {categoryFromUrl && (
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Category:</span>
          <Badge variant="secondary">{decodeURIComponent(categoryFromUrl)}</Badge>
        </div>
      )}

      {/* Source Type Selection */}
    
          <Tabs
            items={[
               { key: "file", label: "File Upload", icon: FileText },
             
              { key: "url", label: "URL / Website", icon: LinkIcon },
              { key: "text", label: "Plain Text", icon: FileType },
            ]}
            selectedKey={sourceType}
            onSelectionChange={(key) => {
              setSourceType(key as SourceType);
              // Clear name when switching types (will be auto-generated)
              if (key !== "text") {
                setName("");
              }
            }}
            variant="underlined"
          />
        

      {/* Source Details */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {sourceType === "text" && "Enter Text Content"}
            {sourceType === "url" && "Enter URL"}
            {sourceType === "file" && "Upload File"}
          </h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Name field only for text type */}
          {sourceType === "text" && (
            <Input
              label="Name"
              placeholder="e.g., Company Policies, Product Information"
              value={name}
              onValueChange={setName}
              isRequired
            />
          )}

          {/* URL Input */}
          {sourceType === "url" && (
            <div className="space-y-4">
              <Input
                label="URL"
                placeholder="https://example.com/docs"
                value={url}
                onValueChange={setUrl}
                type="url"
                isRequired
                description="We'll fetch and index the content from this page"
              />
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  The source will be automatically named using the domain and page title.
                </p>
              </div>
            </div>
          )}

          {/* Text Content */}
          {sourceType === "text" && (
            <Textarea
              label="Content"
              placeholder="Paste your text content here..."
              value={textContent}
              onValueChange={setTextContent}
              minRows={10}
              isRequired
              description="This content will be indexed and made searchable by your AI agents"
            />
          )}

          {/* File Upload */}
          {sourceType === "file" && (
            <>
              {selectedFile && uploadResult ? (
                <div className="border rounded-lg p-4 bg-success-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(selectedFile.size)} - Uploaded successfully
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onPress={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-start gap-2 p-2 rounded bg-muted/50">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      The source will be named &quot;{selectedFile.name.replace(/\.[^/.]+$/, "")}&quot;
                    </p>
                  </div>
                </div>
              ) : selectedFile && isUploading ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Uploading...
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-divider hover:border-primary/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-2">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Supported formats: PDF, DOCX, DOC, TXT, MD, CSV, HTML (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md,.csv,.html,.htm"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="mt-4"
                    onPress={() => fileInputRef.current?.click()}
                    isLoading={isUploading}
                  >
                    Browse Files
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Optional Description */}
          <Textarea
            label="Description (optional)"
            placeholder="Brief description of what this source contains..."
            value={description}
            onValueChange={setDescription}
            minRows={2}
          />
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={() => router.push("/knowledge")}>
          Cancel
        </Button>
        <Button
          color="primary"
          onPress={handleSubmitSource}
          isLoading={isCreating}
          isDisabled={sourceType === "file" && !uploadResult}
        >
          Create Source
        </Button>
      </div>
    </div>
  );
}

export default function KnowledgeNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <KnowledgeNewPageContent />
    </Suspense>
  );
}
