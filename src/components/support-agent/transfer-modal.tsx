"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, AlertCircle, Check } from "lucide-react";
import { Button, Input, Avatar, Spinner, Textarea, Badge, ScrollShadow } from "@/components/ui";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
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
  currentAgentId,
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
      case "company_admin":
        return <Badge variant="info">Admin</Badge>;
      case "support_agent":
        return <Badge variant="default">Agent</Badge>;
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <UserPlus size={20} className="text-primary" />
          Transfer Conversation
        </ModalHeader>

        <ModalBody className="pb-0">
          {error && (
            <div className="mb-4 p-3 bg-danger/10 text-danger rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Search */}
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search size={16} className="text-default-400" />}
            size="sm"
            className="mb-4"
          />

          {/* Agent List */}
          <div className="border border-divider rounded-lg overflow-hidden mb-4">
            <ScrollShadow className="max-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="py-8 text-center text-default-500">
                  {searchQuery ? "No agents found" : "No available agents"}
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {filteredAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left hover:bg-content2 transition-colors",
                        selectedAgent?.id === agent.id && "bg-primary/10"
                      )}
                    >
                      <Avatar
                        name={agent.name ?? agent.email}
                        src={agent.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {agent.name ?? "Unnamed Agent"}
                          </span>
                          {getRoleBadge(agent.role)}
                        </div>
                        <p className="text-xs text-default-500 truncate">
                          {agent.email}
                        </p>
                      </div>
                      {selectedAgent?.id === agent.id && (
                        <Check size={18} className="text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollShadow>
          </div>

          {/* Transfer Reason */}
          <Textarea
            label="Transfer Reason (optional)"
            placeholder="Why are you transferring this conversation?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minRows={2}
            maxRows={4}
            className="mb-2"
          />

          <p className="text-xs text-default-400 mb-4">
            The selected agent will receive a notification about this transfer.
          </p>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} isDisabled={transferring}>
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={handleTransfer}
            isLoading={transferring}
            isDisabled={!selectedAgent}
          >
            Transfer to {selectedAgent?.name ?? "Agent"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default TransferModal;
