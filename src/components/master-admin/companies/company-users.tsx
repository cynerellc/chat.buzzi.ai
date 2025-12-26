"use client";

import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { useState } from "react";

import type { CompanyUserItem } from "@/app/api/master-admin/companies/[companyId]/users/route";
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  Table,
  UserAvatar,
  type BadgeVariant,
  type Column,
} from "@/components/ui";
import { addCompanyUser, useCompanyUsers } from "@/hooks/master-admin";

interface CompanyUsersProps {
  companyId: string;
}

const roleBadgeVariants: Record<string, BadgeVariant> = {
  "chatapp.company_admin": "info",
  "chatapp.support_agent": "default",
};

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  pending: "warning",
  inactive: "default",
  suspended: "danger",
};

export function CompanyUsers({ companyId }: CompanyUsersProps) {
  const { users, isLoading, refresh } = useCompanyUsers(companyId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "chatapp.support_agent" as "chatapp.company_admin" | "chatapp.support_agent",
    sendInvite: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddUser = async () => {
    if (!formData.email || !formData.name) {
      setError("Name and email are required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addCompanyUser(companyId, formData);
      setFormData({
        email: "",
        name: "",
        role: "chatapp.support_agent",
        sendInvite: true,
      });
      setIsAddModalOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<CompanyUserItem>[] = [
    {
      key: "user",
      label: "User",
      render: (item) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={item.name ?? item.email} size="sm" />
          <div>
            <p className="font-medium">{item.name ?? "No name"}</p>
            <p className="text-xs text-muted-foreground">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (item) => (
        <Badge variant={roleBadgeVariants[item.role] ?? "default"} size="sm">
          {item.role.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item) => (
        <Badge variant={statusBadgeVariants[item.status] ?? "default"} size="sm">
          {item.status}
        </Badge>
      ),
    },
    {
      key: "lastLogin",
      label: "Last Login",
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.lastLoginAt
            ? formatDistanceToNow(new Date(item.lastLoginAt), { addSuffix: true })
            : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      width: 60,
      align: "end",
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Actions"
            >
              <MoreHorizontal size={18} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit User</DropdownMenuItem>
            <DropdownMenuItem>Change Role</DropdownMenuItem>
            <DropdownMenuItem>Resend Invite</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Remove User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Company Users</h3>
          <Button
            size="sm"
            startContent={<UserPlus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add User
          </Button>
        </div>

        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={users as unknown as Record<string, unknown>[]}
          keyField="id"
          isLoading={isLoading}
          emptyMessage="No users found"
          emptyIcon={<Plus size={48} className="text-muted-foreground/50 mb-4" />}
        />
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsAddModalOpen(false);
            setError(null);
          }
        }}
        size="md"
      >
        <ModalContent>
          <ModalHeader>Add User</ModalHeader>
          <ModalBody className="gap-4">
            {error && (
              <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              label="Name"
              placeholder="Enter user name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />

            <Input
              label="Email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />

            <Select
              label="Role"
              selectedKeys={new Set([formData.role])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as "chatapp.company_admin" | "chatapp.support_agent";
                setFormData((prev) => ({ ...prev, role: selected }));
              }}
              options={[
                { value: "chatapp.support_agent", label: "Support Agent" },
                { value: "chatapp.company_admin", label: "Company Admin" },
              ]}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add User"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
