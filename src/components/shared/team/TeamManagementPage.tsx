"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Clock,
  Mail,
  MoreVertical,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";

import {
  addToast,
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Dropdown,
  type DropdownMenuItemData,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  Skeleton,
  TableRoot,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { useDisclosure } from "@/hooks/useDisclosure";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: {
    name: string | null;
    email: string;
  };
}

const roleOptions = [
  { key: "chatapp.company_admin", label: "Admin", description: "Full access to company settings" },
  { key: "chatapp.support_agent", label: "Support Agent", description: "Handle conversations and support" },
];

const statusColors: Record<string, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  inactive: "default",
  pending: "warning",
  suspended: "danger",
};

function getRoleIcon(role: string) {
  switch (role) {
    case "chatapp.company_admin":
      return <ShieldCheck className="w-4 h-4" />;
    case "chatapp.support_agent":
      return <Shield className="w-4 h-4" />;
    default:
      return <Shield className="w-4 h-4" />;
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case "chatapp.company_admin":
      return "Admin";
    case "chatapp.support_agent":
      return "Support Agent";
    case "chatapp.master_admin":
      return "Master Admin";
    default:
      return role;
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isExpired(dateString: string) {
  return new Date(dateString) < new Date();
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TeamManagementPageProps {
  title?: string;
  subtitle?: string;
  baseApiUrl: string;
  showCurrentUserBadge?: boolean;
}

export function TeamManagementPage({
  title = "Team Management",
  subtitle = "Manage your team members and invitations",
  baseApiUrl,
  showCurrentUserBadge = true,
}: TeamManagementPageProps) {
  const { data, isLoading, mutate } = useSWR<{
    members: TeamMember[];
    invitations: Invitation[];
  }>(baseApiUrl, fetcher);

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];

  const inviteModal = useDisclosure();
  const removeModal = useDisclosure();
  const roleModal = useDisclosure();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"chatapp.company_admin" | "chatapp.support_agent">("chatapp.support_agent");
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [newRole, setNewRole] = useState<"chatapp.company_admin" | "chatapp.support_agent">("chatapp.support_agent");
  const [isInviting, setIsInviting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail) return;

    setIsInviting(true);
    try {
      const response = await fetch(`${baseApiUrl}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invitation");
      }

      addToast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail}`,
        color: "success",
      });
      setInviteEmail("");
      setInviteRole("chatapp.support_agent");
      inviteModal.onClose();
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        color: "danger",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setIsRevoking(true);
    try {
      const response = await fetch(`${baseApiUrl}/invite?id=${invitationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to revoke invitation");
      }

      addToast({
        title: "Invitation Revoked",
        description: "The invitation has been revoked",
        color: "success",
      });
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke invitation",
        color: "danger",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedMember) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`${baseApiUrl}/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }

      addToast({
        title: "Role Updated",
        description: `${selectedMember.name || selectedMember.email}'s role has been updated`,
        color: "success",
      });
      roleModal.onClose();
      setSelectedMember(null);
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update role",
        color: "danger",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setIsRemoving(true);
    try {
      const response = await fetch(`${baseApiUrl}/${selectedMember.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      addToast({
        title: "Member Removed",
        description: `${selectedMember.name || selectedMember.email} has been removed from the team`,
        color: "success",
      });
      removeModal.onClose();
      setSelectedMember(null);
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove member",
        color: "danger",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const openRoleModal = (member: { id: string; name: string | null; email: string; role: string }) => {
    setSelectedMember(member);
    setNewRole(member.role as "chatapp.company_admin" | "chatapp.support_agent");
    roleModal.onOpen();
  };

  const openRemoveModal = (member: { id: string; name: string | null; email: string }) => {
    setSelectedMember(member);
    removeModal.onOpen();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button color="primary" leftIcon={Plus} onClick={inviteModal.onOpen}>
          Invite Member
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 rounded-lg" />
              ) : (
                <p className="text-2xl font-bold">{members.length}</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-row items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admins</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 rounded-lg" />
              ) : (
                <p className="text-2xl font-bold">
                  {members.filter((m) => m.role === "chatapp.company_admin").length}
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-row items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Mail className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Invites</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 rounded-lg" />
              ) : (
                <p className="text-2xl font-bold">{invitations.length}</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Team Members</h3>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No team members found</p>
          ) : (
            <TableRoot>
              <TableHeader>
                <TableRow>
                  <TableHead>MEMBER</TableHead>
                  <TableHead>ROLE</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>LAST LOGIN</TableHead>
                  <TableHead>JOINED</TableHead>
                  <TableHead className="w-20">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member, index) => {
                  const memberDropdownItems: DropdownMenuItemData[] = [
                    { key: "role", label: "Change Role", icon: UserCog },
                    { key: "remove", label: "Remove from Team", icon: UserMinus, isDanger: true },
                  ];
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={member.avatarUrl ?? undefined}
                            name={member.name || member.email}
                            size="sm"
                          />
                          <div>
                            <p className="font-medium">
                              {member.name || "No name"}
                              {showCurrentUserBadge && index === 0 && (
                                <Chip color="primary" className="ml-2">
                                  You
                                </Chip>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(member.role)}
                          <span>{getRoleLabel(member.role)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip color={statusColors[member.status]}>
                          {member.status}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{formatDate(member.lastLoginAt)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{formatDate(member.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        {(!showCurrentUserBadge || index !== 0) && member.role !== "chatapp.master_admin" && (
                          <Dropdown
                            trigger={
                              <Button size="icon" variant="ghost">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            }
                            items={memberDropdownItems}
                            onAction={(key) => {
                              if (key === "role") openRoleModal(member);
                              else if (key === "remove") openRemoveModal(member);
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </TableRoot>
          )}
        </CardBody>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Pending Invitations</h3>
          </CardHeader>
          <CardBody>
            <TableRoot>
              <TableHeader>
                <TableRow>
                  <TableHead>EMAIL</TableHead>
                  <TableHead>ROLE</TableHead>
                  <TableHead>EXPIRES</TableHead>
                  <TableHead>INVITED BY</TableHead>
                  <TableHead className="w-20">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{invitation.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(invitation.role)}
                        <span>{getRoleLabel(invitation.role)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className={isExpired(invitation.expiresAt) ? "text-danger" : ""}>
                          {isExpired(invitation.expiresAt)
                            ? "Expired"
                            : formatDate(invitation.expiresAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {invitation.invitedBy.name || invitation.invitedBy.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        color="danger"
                        isLoading={isRevoking}
                        onClick={() => handleRevokeInvitation(invitation.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableRoot>
          </CardBody>
        </Card>
      )}

      {/* Invite Modal */}
      <Modal isOpen={inviteModal.isOpen} onClose={inviteModal.onClose}>
        <ModalContent>
          <ModalHeader>Invite Team Member</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Email Address"
                placeholder="colleague@company.com"
                type="email"
                value={inviteEmail}
                onValueChange={setInviteEmail}
                startContent={<Mail className="w-4 h-4 text-muted-foreground" />}
              />
              <Select
                label="Role"
                placeholder="Select a role"
                options={roleOptions.map((role) => ({ value: role.key, label: role.label }))}
                selectedKeys={new Set([inviteRole])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) setInviteRole(selected as "chatapp.company_admin" | "chatapp.support_agent");
                }}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={inviteModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isInviting}
              disabled={!inviteEmail}
              onClick={handleInvite}
            >
              Send Invitation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Change Role Modal */}
      <Modal isOpen={roleModal.isOpen} onClose={roleModal.onClose}>
        <ModalContent>
          <ModalHeader>Change Role</ModalHeader>
          <ModalBody>
            <p className="text-muted-foreground mb-4">
              Change role for <strong>{selectedMember?.name || selectedMember?.email}</strong>
            </p>
            <Select
              label="New Role"
              placeholder="Select a role"
              options={roleOptions.map((role) => ({ value: role.key, label: role.label }))}
              selectedKeys={new Set([newRole])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) setNewRole(selected as "chatapp.company_admin" | "chatapp.support_agent");
              }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={roleModal.onClose}>
              Cancel
            </Button>
            <Button color="primary" isLoading={isUpdating} onClick={handleUpdateRole}>
              Update Role
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Remove Member Modal */}
      <Modal isOpen={removeModal.isOpen} onClose={removeModal.onClose}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-danger">
            <UserX className="w-5 h-5" />
            Remove Team Member
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to remove{" "}
              <strong>{selectedMember?.name || selectedMember?.email}</strong> from the team?
            </p>
            <p className="text-sm text-muted-foreground">
              They will lose access to all company resources immediately.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={removeModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isRemoving} onClick={handleRemoveMember}>
              Remove Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
