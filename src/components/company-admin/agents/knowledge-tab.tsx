"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  FolderOpen,
  Plus,
  ExternalLink,
} from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Checkbox,
} from "@/components/ui";

import type { AgentDetail } from "@/hooks/company/useAgents";
import { useKnowledgeCategories } from "@/hooks/company/useKnowledge";

interface KnowledgeTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
}

export function KnowledgeTab({ agent, onSave, isSaving }: KnowledgeTabProps) {
  const { categories, isLoading } = useKnowledgeCategories();
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(agent.knowledgeCategories || [])
  );

  const handleToggleCategory = (categoryName: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryName)) {
      newSelected.delete(categoryName);
    } else {
      newSelected.add(categoryName);
    }
    setSelectedCategories(newSelected);
  };

  const handleSave = async () => {
    await onSave({
      knowledgeCategories: Array.from(selectedCategories),
    });
  };

  const hasChanges = () => {
    const currentCategories = new Set(agent.knowledgeCategories || []);
    if (currentCategories.size !== selectedCategories.size) return true;
    for (const cat of selectedCategories) {
      if (!currentCategories.has(cat)) return true;
    }
    return false;
  };

  const selectedCount = selectedCategories.size;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <Card>
        <CardBody className="p-4">
          <p className="text-sm text-muted-foreground">Selected Categories</p>
          <p className="text-2xl font-bold">
            {selectedCount === 0 ? "All" : selectedCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedCount === 0
              ? "Agent will search all knowledge sources"
              : `Agent will search ${selectedCount} ${selectedCount === 1 ? "category" : "categories"}`}
          </p>
        </CardBody>
      </Card>

      {/* Knowledge Categories */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Knowledge Categories</h2>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/knowledge/new">
              <Plus size={16} />
              Add Source
            </Link>
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select knowledge categories to include in this agent&apos;s context.
            Leave empty to search all categories.
          </p>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p>No knowledge categories found</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                asChild
              >
                <Link href="/knowledge">Create a Category</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => {
                const isSelected = selectedCategories.has(category.name);

                return (
                  <div
                    key={category.name}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                    onClick={() => handleToggleCategory(category.name)}
                  >
                    <Checkbox
                      isSelected={isSelected}
                      onValueChange={() => handleToggleCategory(category.name)}
                    />

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FolderOpen className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{category.name}</span>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{category.sourceCount} sources</span>
                        <span>{category.faqCount} FAQs</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Link to Knowledge Base */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Need more knowledge sources?
            </p>
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link href="/knowledge">
                Manage Knowledge Base
                <ExternalLink size={16} />
              </Link>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          color="primary"
          onPress={handleSave}
          isDisabled={!hasChanges()}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
