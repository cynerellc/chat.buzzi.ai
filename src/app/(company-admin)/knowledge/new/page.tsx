"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Link as LinkIcon,
  FileType,
  Upload,
} from "lucide-react";

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardBody,
  Chip,
  Textarea,
  RadioGroup,
  Radio,
  addToast,
} from "@/components/ui";
import { useCreateKnowledgeSource, useCreateFaq, useFaq, useUpdateFaq } from "@/hooks/company";

type SourceType = "file" | "url" | "text";

function KnowledgeNewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFaqMode = searchParams.get("type") === "faq";
  const editFaqId = searchParams.get("edit");
  const isEditMode = Boolean(editFaqId);

  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");

  // FAQ state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const { createSource, isCreating } = useCreateKnowledgeSource();
  const { createFaq, isCreating: isCreatingFaq } = useCreateFaq();
  const { faq: existingFaq, isLoading: isLoadingFaq } = useFaq(editFaqId);
  const { updateFaq, isUpdating: isUpdatingFaq } = useUpdateFaq(editFaqId || "");

  // Initialize form with existing FAQ data when editing
  if (isEditMode && existingFaq && !isInitialized) {
    setQuestion(existingFaq.question);
    setAnswer(existingFaq.answer);
    setCategory(existingFaq.category || "");
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

  const handleSubmitSource = async () => {
    if (!name.trim()) {
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

    try {
      const sourceConfig: Record<string, unknown> = {};

      if (sourceType === "url") {
        sourceConfig.url = url.trim();
        sourceConfig.crawlDepth = 1;
      } else if (sourceType === "text") {
        sourceConfig.content = textContent.trim();
      }

      await createSource({
        name: name.trim(),
        description: description.trim() || undefined,
        type: sourceType,
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
        category: category.trim() || undefined,
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

            <Input
              label="Category"
              placeholder="e.g., Shipping, Returns, Pricing"
              value={category}
              onValueChange={setCategory}
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

      {/* Source Type Selection */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Source Type</h2>
        </CardHeader>
        <CardBody>
          <RadioGroup
            value={sourceType}
            onValueChange={(v) => setSourceType(v as SourceType)}
            orientation="horizontal"
          >
            <Radio value="text">
              <div className="flex items-center gap-2">
                <FileType className="h-4 w-4" />
                Plain Text
              </div>
            </Radio>
            <Radio value="url">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                URL / Website
              </div>
            </Radio>
            <Radio value="file" disabled>
              <div className="flex items-center gap-2 opacity-50">
                <FileText className="h-4 w-4" />
                File Upload (Coming Soon)
              </div>
            </Radio>
          </RadioGroup>
        </CardBody>
      </Card>

      {/* Source Details */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Source Details</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          <Input
            label="Name"
            placeholder="e.g., Product Documentation, FAQ, Company Policies"
            value={name}
            onValueChange={setName}
            isRequired
          />

          <Textarea
            label="Description"
            placeholder="Brief description of what this source contains..."
            value={description}
            onValueChange={setDescription}
            minRows={2}
          />

          {sourceType === "url" && (
            <Input
              label="URL"
              placeholder="https://example.com/docs"
              value={url}
              onValueChange={setUrl}
              type="url"
              isRequired
              description="We'll crawl this page and extract its content"
            />
          )}

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

          {sourceType === "file" && (
            <div className="border-2 border-dashed border-divider rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-muted-foreground text-sm">
                Supported formats: PDF, DOCX, TXT, MD (max 10MB)
              </p>
              <Button variant="outline" className="mt-4" disabled>
                Browse Files
              </Button>
            </div>
          )}
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
          disabled={sourceType === "file"}
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
