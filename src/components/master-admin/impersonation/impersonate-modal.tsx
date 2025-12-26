"use client";

import { UserCheck, Search, AlertTriangle } from "lucide-react";
import { useState, useCallback } from "react";
import useSWR from "swr";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Card,
  Skeleton,
  Avatar,
  Badge,
} from "@/components/ui";
import { startImpersonation } from "@/hooks/master-admin";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
  companyName?: string;
}

interface ImpersonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImpersonateModal({ isOpen, onClose }: ImpersonateModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [reason, setReason] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search users
  const { data: searchResults, isLoading: isSearching } = useSWR<{ users: User[] }>(
    searchQuery.length >= 2
      ? `/api/master-admin/users/search?q=${encodeURIComponent(searchQuery)}`
      : null,
    fetcher
  );

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);
    setError(null);
  }, []);

  const handleSelectUser = useCallback((user: User) => {
    setSelectedUser(user);
    setError(null);
  }, []);

  const handleStartImpersonation = async () => {
    if (!selectedUser) return;

    setIsStarting(true);
    setError(null);

    try {
      await startImpersonation({
        targetUserId: selectedUser.id,
        reason: reason || undefined,
      });

      // Redirect to the user's dashboard based on role
      const redirectUrl =
        selectedUser.role === "chatapp.company_admin"
          ? "/company/dashboard"
          : "/chat";

      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start impersonation");
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedUser(null);
    setReason("");
    setError(null);
    onClose();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "chatapp.company_admin":
        return <Badge variant="info">Admin</Badge>;
      case "chatapp.support_agent":
        return <Badge variant="default">Agent</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <UserCheck size={20} />
          Impersonate User
        </ModalHeader>

        <ModalBody className="space-y-4">
          <div className="p-3 bg-warning-50 text-warning-700 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Impersonation allows you to view the platform as another user. All
              actions will be logged for security purposes.
            </span>
          </div>

          <Input
            label="Search Users"
            placeholder="Search by name or email..."
            value={searchQuery}
            onValueChange={handleSearch}
            startContent={<Search size={16} className="text-default-400" />}
            autoFocus
          />

          {/* Search Results */}
          {isSearching && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isSearching && searchResults?.users && searchResults.users.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.users.map((user) => (
                <button
                  key={user.id}
                  className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-colors hover:bg-default-100 ${
                    selectedUser?.id === user.id
                      ? "ring-2 ring-primary bg-primary-50"
                      : "bg-card"
                  }`}
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={user.name || user.email}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {user.name || user.email}
                        </p>
                        {getRoleBadge(user.role)}
                      </div>
                      <p className="text-sm text-default-500 truncate">
                        {user.email}
                        {user.companyName && ` • ${user.companyName}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching &&
            searchQuery.length >= 2 &&
            searchResults?.users?.length === 0 && (
              <p className="text-sm text-default-500 text-center py-4">
                No users found matching &quot;{searchQuery}&quot;
              </p>
            )}

          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className="text-sm text-default-500 text-center py-4">
              Type at least 2 characters to search
            </p>
          )}

          {selectedUser && (
            <div className="pt-2 border-t">
              <Textarea
                label="Reason for Impersonation (optional)"
                placeholder="E.g., Investigating support ticket #123..."
                value={reason}
                onValueChange={setReason}
                rows={2}
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={handleStartImpersonation}
            disabled={isStarting || !selectedUser}
            startContent={<UserCheck size={16} />}
          >
            {isStarting ? "Starting..." : "Start Impersonation"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
