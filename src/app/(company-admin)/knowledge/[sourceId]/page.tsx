"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Link as LinkIcon,
  FileType,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
  RefreshCw,
} from "lucide-react";

import { useSetPageTitle } from "@/contexts/page-context";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  addToast,
} from "@/components/ui";
import { useKnowledgeSource, useUpdateKnowledgeSource, useDeleteKnowledgeSource } from "@/hooks/company";

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
};

const defaultStatusConfig: StatusConfig = { label: "Pending", variant: "default", icon: Clock };

const statusConfig: Record<string, StatusConfig> = {
  pending: defaultStatusConfig,
  processing: { label: "Processing", variant: "info", icon: Loader2 },
  indexed: { label: "Indexed", variant: "success", icon: CheckCircle },
  failed: { label: "Failed", variant: "danger", icon: AlertCircle },
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  url: LinkIcon,
  text: FileType,
};

function getStatusConfig(status: string): StatusConfig {
  return statusConfig[status] ?? defaultStatusConfig;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

interface PageProps {
  params: Promise<{ sourceId: string }>;
}

export default function KnowledgeDetailPage({ params }: PageProps) {
  useSetPageTitle("Knowledge Source");
  const { sourceId } = use(params);
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { source, isLoading, mutate } = useKnowledgeSource(sourceId);
  const { updateSource, isUpdating } = useUpdateKnowledgeSource(sourceId);
  const { deleteSource, isDeleting } = useDeleteKnowledgeSource(sourceId);

  const handleStartEdit = () => {
    if (source) {
      setEditName(source.name);
      setEditDescription(source.description || "");
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName("");
    setEditDescription("");
  };

  const handleSaveEdit = async () => {
    try {
      await updateSource({
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      addToast({ title: "Knowledge source updated", color: "success" });
      setIsEditing(false);
      mutate();
    } catch {
      addToast({ title: "Failed to update knowledge source", color: "danger" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSource();
      addToast({ title: "Knowledge source deleted", color: "success" });
      router.push("/knowledge");
    } catch {
      addToast({ title: "Failed to delete knowledge source", color: "danger" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">Knowledge source not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onPress={() => router.push("/knowledge")}
        >
          Back to Knowledge Base
        </Button>
      </div>
    );
  }

  const status = getStatusConfig(source.status);
  const StatusIcon = status.icon;
  const TypeIcon = typeIcons[source.type] || FileText;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.push("/knowledge")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <TypeIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{source.name}</h1>
                <Badge variant={status.variant}>
                  <StatusIcon className={`h-3 w-3 mr-1 ${source.status === "processing" ? "animate-spin" : ""}`} />
                  {status.label}
                </Badge>
              </div>
              {source.description && (
                <p className="text-muted-foreground">{source.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={Edit2}
            onPress={handleStartEdit}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            leftIcon={Trash2}
            className="text-danger"
            onPress={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Source Details */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Source Details</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">{source.type}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{source.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Chunks</dt>
              <dd className="font-medium">{source.chunkCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Tokens</dt>
              <dd className="font-medium">{formatTokenCount(source.tokenCount)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="font-medium">{formatDate(source.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Last Updated</dt>
              <dd className="font-medium">{formatDate(source.updatedAt)}</dd>
            </div>
            {source.lastProcessedAt && (
              <div>
                <dt className="text-sm text-muted-foreground">Last Processed</dt>
                <dd className="font-medium">{formatDate(source.lastProcessedAt)}</dd>
              </div>
            )}
            {source.vectorCollectionId && (
              <div>
                <dt className="text-sm text-muted-foreground">Vector Collection</dt>
                <dd className="font-medium text-xs truncate">{source.vectorCollectionId}</dd>
              </div>
            )}
          </dl>

          {/* Source Config */}
          {source.type === "url" && Boolean(source.sourceConfig.url) && (
            <div className="mt-6 pt-4 border-t border-divider">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Source URL</h3>
              <a
                href={String(source.sourceConfig.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {String(source.sourceConfig.url)}
              </a>
            </div>
          )}

          {source.type === "text" && Boolean(source.sourceConfig.content) && (
            <div className="mt-6 pt-4 border-t border-divider">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Original Content</h3>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-64 overflow-y-auto">
                {String(source.sourceConfig.content)}
              </pre>
            </div>
          )}

          {/* Error Display */}
          {source.processingError && (
            <div className="mt-6 p-4 rounded-lg bg-danger-50 border border-danger-200">
              <div className="flex items-center gap-2 text-danger-600 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Processing Error</span>
              </div>
              <p className="text-danger-600 text-sm">{source.processingError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                leftIcon={RefreshCw}
              >
                Retry Processing
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Indexing Info */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vector Indexing</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium mb-1">
                {source.chunkCount > 0
                  ? `${source.chunkCount} chunks indexed in vector database`
                  : "Content not yet indexed"}
              </p>
              <p className="text-sm text-muted-foreground">
                This content has been processed and stored in the vector database for semantic search.
                The AI agent can retrieve relevant information from this source during conversations.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={isEditing} onClose={handleCancelEdit}>
        <ModalContent>
          <ModalHeader>Edit Knowledge Source</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Name"
              value={editName}
              onValueChange={setEditName}
              isRequired
            />
            <Textarea
              label="Description"
              value={editDescription}
              onValueChange={setEditDescription}
              minRows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSaveEdit}
              isLoading={isUpdating}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalContent>
          <ModalHeader>Delete Knowledge Source</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete &quot;{source.name}&quot;? This action cannot be undone.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              All {source.chunkCount} chunks and vector embeddings will be removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isLoading={isDeleting}
            >
              Delete Source
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
