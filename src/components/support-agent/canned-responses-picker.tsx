"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, MessageSquare, Hash, User, Building2, X, Sparkles, TrendingUp } from "lucide-react";
import { Input, Badge, Spinner, ScrollShadow, Modal, ModalContent, ModalHeader, ModalBody, Skeleton } from "@/components/ui";
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
      className="max-h-[80vh]"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 border-b border-border/50 pb-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
            <MessageSquare size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Canned Responses</h2>
            <p className="text-xs text-muted-foreground">Quick replies for common questions</p>
          </div>
          <span className="text-xs text-muted-foreground">
            Press <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">Esc</kbd> to close
          </span>
        </ModalHeader>
        <ModalBody className="p-0" onKeyDown={handleKeyDown}>
          {/* Search Input */}
          <div className="p-4 border-b border-border/50 sticky top-0 bg-card z-10">
            <Input
              ref={searchInputRef}
              placeholder="Search responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search size={16} className="text-muted-foreground" />}
              endContent={
                searchQuery && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSearchQuery("")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={14} />
                  </motion.button>
                )
              }
              size="sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              Type to search or use <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">/shortcut</kbd>
            </p>
          </div>

          {/* Responses List */}
          <ScrollShadow className="max-h-[400px]" ref={listRef}>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3 rounded-xl border border-border/50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-12 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4 mt-1" />
                  </div>
                ))}
              </div>
            ) : filteredResponses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-12 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">
                  {searchQuery
                    ? "No responses found"
                    : "No canned responses yet"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Create responses in Settings to use them here
                  </p>
                )}
              </motion.div>
            ) : (
              <div className="p-2">
                <AnimatePresence>
                  {filteredResponses.map((response, index) => (
                    <motion.button
                      key={response.id}
                      data-index={index}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      whileHover={{ x: 2 }}
                      onClick={() => handleSelect(response)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl mb-1 transition-all duration-200",
                        "border border-transparent",
                        index === selectedIndex
                          ? "bg-primary/10 border-primary/20"
                          : "hover:bg-muted/50 hover:border-border/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-medium text-sm truncate text-foreground">
                          {response.title}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {response.usageCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <TrendingUp size={10} />
                              {response.usageCount}
                            </span>
                          )}
                          {response.shortcut && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20">
                              <Hash size={8} className="mr-0.5" />
                              {response.shortcut}
                            </Badge>
                          )}
                          {response.isPersonal ? (
                            <Badge variant="info" className="text-[10px] px-1.5 py-0 h-5">
                              <User size={8} className="mr-0.5" />
                              Personal
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
                              <Building2 size={8} className="mr-0.5" />
                              Team
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {response.content}
                      </p>
                      {response.category && (
                        <Badge variant="default" size="sm" className="mt-2 text-[10px] bg-muted">
                          {response.category}
                        </Badge>
                      )}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollShadow>

          {/* Footer */}
          <div className="p-3 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="bg-background px-1.5 py-0.5 rounded border border-border/50 text-[10px]">↑</kbd>
                  <kbd className="bg-background px-1.5 py-0.5 rounded border border-border/50 text-[10px]">↓</kbd>
                  <span className="ml-1">Navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-background px-1.5 py-0.5 rounded border border-border/50 text-[10px]">Enter</kbd>
                  <span className="ml-1">Select</span>
                </span>
              </div>
              <span className="font-medium">{filteredResponses.length} responses</span>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default CannedResponsesPicker;
