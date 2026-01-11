"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, AlertCircle, Check, ArrowRight, Users, Circle } from "lucide-react";
import { Button, Input, Avatar, Textarea, Badge, ScrollShadow, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
}

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer?: (targetUserId: string, reason?: string) => Promise<void>;
  onTransferComplete?: () => void;
  conversationId: string;
  currentAgentId?: string;
}

export function TransferModal({
  isOpen,
  onClose,
  onTransfer,
  onTransferComplete,
  conversationId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentAgentId: _currentAgentId,
}: TransferModalProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Fetch available agents
  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/support-agent/conversations/${conversationId}/transfer`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
      setSearchQuery("");
      setSelectedAgent(null);
      setReason("");
    }
  }, [isOpen, fetchAgents]);

  // Filter agents based on search
  const filteredAgents = agents.filter((agent) => {
    const query = searchQuery.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(query) ||
      agent.email.toLowerCase().includes(query)
    );
  });

  const handleTransfer = async () => {
    if (!selectedAgent) return;

    setTransferring(true);
    try {
      if (onTransfer) {
        await onTransfer(selectedAgent.id, reason.trim() || undefined);
      } else {
        // Default API call if no onTransfer provided
        const response = await fetch(
          `/api/support-agent/conversations/${conversationId}/transfer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetUserId: selectedAgent.id,
              reason: reason.trim() || undefined,
            }),
          }
        );
        if (!response.ok) {
          throw new Error("Transfer failed");
        }
      }
      onClose();
      onTransferComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "chatapp.company_admin":
        return (
          <Badge variant="info" className="text-[10px] px-1.5 py-0 h-5">
            Admin
          </Badge>
        );
      case "chatapp.support_agent":
        return (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
            Agent
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 border-b border-border/50 pb-4 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/5">
            <UserPlus size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold">Transfer Conversation</h2>
            <p className="text-xs text-muted-foreground">Hand off to another team member</p>
          </div>
        </ModalHeader>

        <ModalBody className="pb-0">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 bg-destructive/10 text-destructive rounded-xl flex items-center gap-2 text-sm"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search size={16} className="text-muted-foreground" />}
            />
          </div>

          {/* Agent List */}
          <div className="border border-border/50 rounded-xl overflow-hidden mb-4">
            <ScrollShadow className="max-h-[220px]">
              {loading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAgents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-10 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Users size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No agents found" : "No available agents"}
                  </p>
                </motion.div>
              ) : (
                <div className="p-1">
                  {filteredAgents.map((agent, index) => {
                    const isSelected = selectedAgent?.id === agent.id;
                    return (
                      <motion.button
                        key={agent.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{ x: 2 }}
                        onClick={() => setSelectedAgent(agent)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200",
                          "border border-transparent",
                          isSelected
                            ? "bg-primary/10 border-primary/20"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="relative">
                          <Avatar
                            name={agent.name ?? agent.email}
                            src={agent.avatarUrl ?? undefined}
                            size="sm"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate text-sm">
                              {agent.name ?? "Unnamed Agent"}
                            </span>
                            {getRoleBadge(agent.role)}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {agent.email}
                          </p>
                        </div>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            >
                              <Check size={12} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </ScrollShadow>
          </div>

          {/* Transfer Reason */}
          <div className="space-y-1.5 mb-4">
            <label className="text-sm font-medium text-foreground">
              Transfer Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Why are you transferring this conversation?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minRows={2}
              className="resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 mb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Circle size={8} className="text-primary fill-primary animate-pulse" />
              The selected agent will receive a notification about this transfer.
            </p>
          </div>
        </ModalBody>

        <ModalFooter className="border-t border-border/50 pt-4">
          <Button variant="ghost" onClick={onClose} isDisabled={transferring}>
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={handleTransfer}
            isLoading={transferring}
            isDisabled={!selectedAgent}
            className="group"
          >
            Transfer to {selectedAgent?.name ?? "Agent"}
            <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default TransferModal;
