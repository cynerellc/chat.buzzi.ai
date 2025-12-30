"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Copy,
  MoreHorizontal,
  Hash,
  User,
  Building2,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/layouts";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  Card,
  Badge,
  Button,
  Input,
  Tabs,
  Dropdown,
  Spinner,
  EmptyState,
  Modal,
  Textarea,
} from "@/components/ui";
import type { TabItem, DropdownMenuItemData } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface CannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string | null;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ResponseFormData {
  title: string;
  shortcut: string;
  content: string;
  category: string;
  isPersonal: boolean;
}

type ScopeFilter = "all" | "personal" | "company";

export default function CannedResponsesPage() {
  useSetPageTitle("Canned Responses");
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<ScopeFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [formData, setFormData] = useState<ResponseFormData>({
    title: "",
    shortcut: "",
    content: "",
    category: "",
    isPersonal: true,
  });
  const [saving, setSaving] = useState(false);

  // Fetch responses
  const fetchResponses = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedScope !== "all") params.set("scope", selectedScope);
      if (selectedCategory) params.set("category", selectedCategory);

      const response = await fetch(`/api/support-agent/responses?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch responses");
      }

      const data = await response.json();
      setResponses(data.responses);
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedScope, selectedCategory]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchResponses();
  };

  // Open modal for create/edit
  const openModal = (response?: CannedResponse) => {
    if (response) {
      setEditingResponse(response);
      setFormData({
        title: response.title,
        shortcut: response.shortcut ?? "",
        content: response.content,
        category: response.category ?? "",
        isPersonal: response.isPersonal,
      });
    } else {
      setEditingResponse(null);
      setFormData({
        title: "",
        shortcut: "",
        content: "",
        category: "",
        isPersonal: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingResponse(null);
    setFormData({
      title: "",
      shortcut: "",
      content: "",
      category: "",
      isPersonal: true,
    });
  };

  // Save response
  const handleSave = async () => {
    if (!formData.title || !formData.content) return;

    try {
      setSaving(true);

      const url = editingResponse
        ? `/api/support-agent/responses/${editingResponse.id}`
        : "/api/support-agent/responses";

      const method = editingResponse ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          shortcut: formData.shortcut || undefined,
          content: formData.content,
          category: formData.category || undefined,
          isPersonal: formData.isPersonal,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save response");
      }

      closeModal();
      fetchResponses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Delete response
  const handleDelete = async (responseId: string) => {
    if (!confirm("Are you sure you want to delete this response?")) return;

    try {
      const response = await fetch(`/api/support-agent/responses/${responseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete response");
      }

      fetchResponses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Copy response content
  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    // TODO: Show toast notification
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canned Responses"
        description="Manage pre-written responses for quick replies"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              isLoading={refreshing}
            >
              <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
            </Button>
            <Button
              color="primary"
              size="sm"
              leftIcon={Plus}
              onClick={() => openModal()}
            >
              New Response
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs
          selectedKey={selectedScope}
          onSelectionChange={(key) => setSelectedScope(key as ScopeFilter)}
          variant="underlined"
          size="sm"
          items={[
            { key: "all", label: "All" },
            { key: "personal", label: "My Responses" },
            { key: "company", label: "Team Responses" },
          ] satisfies TabItem[]}
        />

        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search responses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search size={16} className="text-muted-foreground" />}
            className="w-full sm:w-64"
          />
          {categories.length > 0 && (
            <Dropdown
              trigger={
                <Button variant="outline" size="sm">
                  <Filter size={16} />
                  {selectedCategory ?? "Category"}
                </Button>
              }
              items={[
                { key: "all", label: "All Categories" },
                ...categories.map((cat) => ({ key: cat, label: cat })),
              ]}
              onAction={(key) => setSelectedCategory(key === "all" ? null : key as string)}
            />
          )}
        </div>
      </div>

      {/* Responses Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-8">
          <EmptyState
            icon={MessageSquare}
            title="Error loading responses"
            description={error}
            action={{
              label: "Try Again",
              onClick: handleRefresh,
              variant: "ghost",
            }}
          />
        </Card>
      ) : responses.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={MessageSquare}
            title="No responses yet"
            description="Create your first canned response to speed up your replies"
            action={{
              label: "Create Response",
              onClick: () => openModal(),
              icon: Plus,
              color: "primary",
            }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {responses.map((response) => (
            <Card key={response.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-medium truncate">{response.title}</h3>
                  {response.isPersonal ? (
                    <Badge variant="info" className="flex-shrink-0">
                      <User size={10} className="mr-1" />
                      Personal
                    </Badge>
                  ) : (
                    <Badge variant="default" className="flex-shrink-0">
                      <Building2 size={10} className="mr-1" />
                      Team
                    </Badge>
                  )}
                </div>
                <Dropdown
                  trigger={
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal size={16} />
                    </Button>
                  }
                  items={[
                    { key: "copy", label: "Copy Content" },
                    { key: "edit", label: "Edit" },
                    { key: "delete", label: "Delete", isDanger: true },
                  ] satisfies DropdownMenuItemData[]}
                  onAction={(key) => {
                    if (key === "copy") handleCopy(response.content);
                    if (key === "edit") openModal(response);
                    if (key === "delete") handleDelete(response.id);
                  }}
                />
              </div>

              {response.shortcut && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <Hash size={12} />
                  <code className="bg-muted px-1 rounded text-xs">
                    /{response.shortcut}
                  </code>
                </div>
              )}

              <p className="text-sm text-foreground line-clamp-3 mb-3">
                {response.content}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used {response.usageCount} times</span>
                {response.lastUsedAt && (
                  <span>
                    Last used {formatDistanceToNow(new Date(response.lastUsedAt), { addSuffix: true })}
                  </span>
                )}
              </div>

              {response.category && (
                <div className="mt-2">
                  <Badge variant="default" size="sm">
                    {response.category}
                  </Badge>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingResponse ? "Edit Response" : "New Response"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Response title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            isRequired
          />

          <Input
            label="Shortcut"
            placeholder="e.g., greet (use /greet to insert)"
            value={formData.shortcut}
            onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
            startContent={<span className="text-muted-foreground">/</span>}
          />

          <Textarea
            label="Content"
            placeholder="Type your response..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            minRows={4}
            isRequired
          />

          <Input
            label="Category"
            placeholder="e.g., Greetings, Support, Billing"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={formData.isPersonal}
                onChange={() => setFormData({ ...formData, isPersonal: true })}
                className="accent-primary"
              />
              <span className="text-sm">
                <User size={14} className="inline mr-1" />
                Personal (only you can see)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!formData.isPersonal}
                onChange={() => setFormData({ ...formData, isPersonal: false })}
                className="accent-primary"
              />
              <span className="text-sm">
                <Building2 size={14} className="inline mr-1" />
                Team (everyone can see)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={handleSave}
              isLoading={saving}
              disabled={!formData.title || !formData.content}
            >
              {editingResponse ? "Save Changes" : "Create Response"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
