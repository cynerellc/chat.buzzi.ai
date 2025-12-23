"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, MessageSquare, Hash, User, Building2, X } from "lucide-react";
import { Input, Badge, Spinner, ScrollShadow } from "@/components/ui";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import { cn } from "@/lib/utils";

interface CannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string | null;
  tags: string[];
  usageCount: number;
  isPersonal: boolean;
}

export interface CannedResponsesPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (response: CannedResponse) => void;
  conversationId?: string;
}

export function CannedResponsesPicker({
  isOpen,
  onClose,
  onSelect,
  conversationId,
}: CannedResponsesPickerProps) {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch responses
  const fetchResponses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/support-agent/responses");
      if (response.ok) {
        const data = await response.json();
        setResponses(data.responses || []);
      }
    } catch (error) {
      console.error("Failed to fetch responses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchResponses();
      setSearchQuery("");
      setSelectedIndex(0);
      // Focus search input after modal opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchResponses]);

  // Filter responses based on search
  const filteredResponses = useMemo(() => {
    if (!searchQuery.trim()) return responses;

    const query = searchQuery.toLowerCase();
    return responses.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.content.toLowerCase().includes(query) ||
        r.shortcut?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query)
    );
  }, [responses, searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredResponses.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredResponses[selectedIndex]) {
          handleSelect(filteredResponses[selectedIndex]);
        }
        break;
      case "Escape":
        onClose();
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleSelect = (response: CannedResponse) => {
    onSelect(response);
    onClose();
    // Update usage count
    fetch(`/api/support-agent/responses/${response.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incrementUsage: true }),
    }).catch(() => {});
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      hideCloseButton
      classNames={{
        base: "max-h-[80vh]",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 border-b border-divider pb-3">
          <MessageSquare size={18} className="text-primary" />
          <span>Canned Responses</span>
          <span className="text-xs text-default-400 ml-auto">
            Press <kbd className="bg-default-100 px-1.5 py-0.5 rounded text-xs">Esc</kbd> to close
          </span>
        </ModalHeader>
        <ModalBody className="p-0" onKeyDown={handleKeyDown}>
          {/* Search Input */}
          <div className="p-3 border-b border-divider sticky top-0 bg-content1 z-10">
            <Input
              ref={searchInputRef}
              placeholder="Search responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search size={16} className="text-default-400" />}
              endContent={
                searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-default-400 hover:text-default-600"
                  >
                    <X size={14} />
                  </button>
                )
              }
              size="sm"
              autoFocus
            />
            <p className="text-xs text-default-400 mt-2">
              Type to search or use <kbd className="bg-default-100 px-1 rounded">/shortcut</kbd>
            </p>
          </div>

          {/* Responses List */}
          <ScrollShadow className="max-h-[400px]" ref={listRef}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="py-8 text-center text-default-500">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery
                    ? "No responses found"
                    : "No canned responses yet"}
                </p>
                {!searchQuery && (
                  <p className="text-xs mt-1">
                    Create responses in Settings to use them here
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {filteredResponses.map((response, index) => (
                  <button
                    key={response.id}
                    data-index={index}
                    onClick={() => handleSelect(response)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-content2 transition-colors",
                      index === selectedIndex && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {response.title}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {response.shortcut && (
                          <Badge variant="default" className="text-xs">
                            <Hash size={10} className="mr-0.5" />
                            {response.shortcut}
                          </Badge>
                        )}
                        {response.isPersonal ? (
                          <Badge variant="info" className="text-xs">
                            <User size={10} className="mr-0.5" />
                            Personal
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            <Building2 size={10} className="mr-0.5" />
                            Team
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-default-500 line-clamp-2">
                      {response.content}
                    </p>
                    {response.category && (
                      <Badge variant="default" size="sm" className="mt-1">
                        {response.category}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollShadow>

          {/* Footer */}
          <div className="p-3 border-t border-divider bg-content2/50 text-xs text-default-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="bg-default-100 px-1.5 py-0.5 rounded">↑</kbd>
                  <kbd className="bg-default-100 px-1.5 py-0.5 rounded ml-0.5">↓</kbd>
                  {" "}Navigate
                </span>
                <span>
                  <kbd className="bg-default-100 px-1.5 py-0.5 rounded">Enter</kbd>
                  {" "}Select
                </span>
              </div>
              <span>{filteredResponses.length} responses</span>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default CannedResponsesPicker;
