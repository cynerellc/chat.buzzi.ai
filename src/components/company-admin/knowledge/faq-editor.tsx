"use client";

import { useState } from "react";
import { Save, Trash2, GripVertical, MessageSquareText } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Select,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  addToast,
} from "@/components/ui";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  priority: number;
  isActive: boolean;
  usageCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface FAQEditorProps {
  faq?: FAQ | null;
  onSave: (data: Omit<FAQ, "id" | "usageCount" | "helpfulCount" | "notHelpfulCount">) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSaving: boolean;
  categories?: string[];
}

const PRIORITY_OPTIONS = [
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
  { value: "4", label: "Very High" },
  { value: "5", label: "Critical" },
];

// Inner component that resets when faq changes
function FAQEditorInner({
  faq,
  onSave,
  onDelete,
  isSaving,
  categories = [],
}: FAQEditorProps) {
  const [question, setQuestion] = useState(faq?.question || "");
  const [answer, setAnswer] = useState(faq?.answer || "");
  const [category, setCategory] = useState(faq?.category || "");
  const [priority, setPriority] = useState(String(faq?.priority || 3));
  const [isActive, setIsActive] = useState(faq?.isActive ?? true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) {
      addToast({ title: "Question and answer are required", color: "danger" });
      return;
    }

    await onSave({
      question: question.trim(),
      answer: answer.trim(),
      category: category || null,
      priority: parseInt(priority, 10),
      isActive,
    });
  };

  const handleDelete = async () => {
    if (faq && onDelete) {
      await onDelete(faq.id);
      setShowDeleteModal(false);
    }
  };

  const hasChanges =
    faq
      ? question !== faq.question ||
        answer !== faq.answer ||
        category !== (faq.category || "") ||
        priority !== String(faq.priority) ||
        isActive !== faq.isActive
      : question || answer;

  const categoryOptions = [
    { value: "none", label: "No Category" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            <h2 className="text-lg font-semibold">
              {faq ? "Edit FAQ" : "New FAQ"}
            </h2>
          </div>
          {faq && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Used {faq.usageCount} times</span>
              <span>|</span>
              <span>{faq.helpfulCount} helpful</span>
              <span>|</span>
              <span>{faq.notHelpfulCount} not helpful</span>
            </div>
          )}
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Question */}
          <Textarea
            label="Question"
            placeholder="What question does this FAQ answer?"
            value={question}
            onValueChange={setQuestion}
            minRows={2}
            isRequired
            description="The question customers might ask"
          />

          {/* Answer */}
          <Textarea
            label="Answer"
            placeholder="Enter the answer to this question..."
            value={answer}
            onValueChange={setAnswer}
            minRows={4}
            isRequired
            description="The answer that the AI will provide"
          />

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              options={categoryOptions}
              selectedKeys={new Set([category || "none"])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setCategory(selected === "none" ? "" : (selected as string));
              }}
            />

            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              selectedKeys={new Set([priority])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setPriority(selected as string);
              }}
              description="Higher priority FAQs are considered first"
            />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Active Status</p>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "This FAQ is active and will be used by the AI"
                  : "This FAQ is inactive and won't be used"}
              </p>
            </div>
            <Button
              variant={isActive ? "success" : "outline"}
              onClick={() => setIsActive(!isActive)}
            >
              {isActive ? "Active" : "Inactive"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {faq && onDelete ? (
              <Button
                variant="destructive"
                startContent={<Trash2 size={16} />}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete FAQ
              </Button>
            ) : (
              <div />
            )}
            <Button
              color="primary"
              startContent={<Save size={16} />}
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!hasChanges || !question.trim() || !answer.trim()}
            >
              {faq ? "Save Changes" : "Create FAQ"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <ModalContent>
          <ModalHeader className="text-danger">Delete FAQ</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete this FAQ?</p>
            <p className="text-sm text-muted-foreground mt-2">
              This action cannot be undone. The FAQ will be permanently removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Delete FAQ
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

// Wrapper component that uses key to reset form state when faq changes
export function FAQEditor(props: FAQEditorProps) {
  // Using key to remount inner component when faq.id changes
  // This is the React-recommended pattern for resetting state from props
  return <FAQEditorInner key={props.faq?.id ?? "new"} {...props} />;
}

// FAQList component for displaying multiple FAQs
interface FAQListProps {
  faqs: FAQ[];
  onEdit: (faq: FAQ) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function FAQList({ faqs, onEdit, onDelete, isLoading }: FAQListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <MessageSquareText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">No FAQs yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first FAQ to help the AI answer common questions
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {faqs.map((faq) => (
        <Card
          key={faq.id}
          onClick={() => onEdit(faq)}
          className="cursor-pointer hover:bg-muted transition-colors"
        >
          <CardBody className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-muted-foreground cursor-grab">
                <GripVertical className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{faq.question}</span>
                  {faq.category && (
                    <Badge variant="default">{faq.category}</Badge>
                  )}
                  {!faq.isActive && (
                    <Badge variant="warning">Inactive</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {faq.answer}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Priority: {PRIORITY_OPTIONS.find((o) => o.value === String(faq.priority))?.label}</span>
                  <span>Used {faq.usageCount} times</span>
                  <span>{faq.helpfulCount} helpful</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
