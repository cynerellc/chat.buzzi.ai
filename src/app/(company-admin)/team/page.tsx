"use client";

import {
  addToast,
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from "@heroui/react";
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
import { useState } from "react";

import { PageHeader } from "@/components/layouts/page-header";
import {
  useInviteTeamMember,
  useRemoveTeamMember,
  useRevokeInvitation,
  useTeam,
  useUpdateTeamMember,
} from "@/hooks/company";

const roleOptions = [
  { key: "company_admin", label: "Admin", description: "Full access to company settings" },
  { key: "support_agent", label: "Support Agent", description: "Handle conversations and support" },
];

const statusColors: Record<string, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  inactive: "default",
  pending: "warning",
  suspended: "danger",
};

function getRoleIcon(role: string) {
  switch (role) {
    case "company_admin":
      return <ShieldCheck className="w-4 h-4" />;
    case "support_agent":
      return <Shield className="w-4 h-4" />;
    default:
      return <Shield className="w-4 h-4" />;
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case "company_admin":
      return "Admin";
    case "support_agent":
      return "Support Agent";
    case "master_admin":
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

export default function TeamPage() {
  const { members, invitations, isLoading, mutate } = useTeam();
  const { invite, isInviting } = useInviteTeamMember();
  const { revoke, isRevoking } = useRevokeInvitation();
  const { updateMember, isUpdating } = useUpdateTeamMember();
  const { removeMember, isRemoving } = useRemoveTeamMember();

  const inviteModal = useDisclosure();
  const removeModal = useDisclosure();
  const roleModal = useDisclosure();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"company_admin" | "support_agent">("support_agent");
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [newRole, setNewRole] = useState<"company_admin" | "support_agent">("support_agent");

  const handleInvite = async () => {
    if (!inviteEmail) return;

    try {
      await invite({ email: inviteEmail, role: inviteRole });
      addToast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail}`,
        color: "success",
      });
      setInviteEmail("");
      setInviteRole("support_agent");
      inviteModal.onClose();
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        color: "danger",
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revoke({ invitationId });
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
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedMember) return;

    try {
      await updateMember({ userId: selectedMember.id, role: newRole });
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
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    try {
      await removeMember({ userId: selectedMember.id });
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
    }
  };

  const openRoleModal = (member: { id: string; name: string | null; email: string; role: string }) => {
    setSelectedMember(member);
    setNewRole(member.role as "company_admin" | "support_agent");
    roleModal.onOpen();
  };

  const openRemoveModal = (member: { id: string; name: string | null; email: string }) => {
    setSelectedMember(member);
    removeModal.onOpen();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Manage your team members and invitations"
        actions={
          <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={inviteModal.onOpen}>
            Invite Member
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-default-500">Total Members</p>
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
              <p className="text-sm text-default-500">Admins</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 rounded-lg" />
              ) : (
                <p className="text-2xl font-bold">
                  {members.filter((m) => m.role === "company_admin").length}
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
              <p className="text-sm text-default-500">Pending Invites</p>
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
          <Table aria-label="Team members table" removeWrapper>
            <TableHeader>
              <TableColumn>MEMBER</TableColumn>
              <TableColumn>ROLE</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>LAST LOGIN</TableColumn>
              <TableColumn>JOINED</TableColumn>
              <TableColumn width={80}>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody
              isLoading={isLoading}
              loadingContent={<Skeleton className="h-16 w-full rounded-lg" />}
              emptyContent="No team members found"
            >
              {members.map((member, index) => (
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
                          {index === 0 && (
                            <Chip size="sm" variant="flat" color="primary" className="ml-2">
                              You
                            </Chip>
                          )}
                        </p>
                        <p className="text-xs text-default-500">{member.email}</p>
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
                    <Chip size="sm" color={statusColors[member.status]} variant="flat">
                      {member.status}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">{formatDate(member.lastLoginAt)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-default-500">{formatDate(member.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    {index !== 0 && member.role !== "master_admin" && (
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="light">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Member actions">
                          <DropdownItem
                            key="role"
                            startContent={<UserCog className="w-4 h-4" />}
                            onPress={() => openRoleModal(member)}
                          >
                            Change Role
                          </DropdownItem>
                          <DropdownItem
                            key="remove"
                            startContent={<UserMinus className="w-4 h-4" />}
                            className="text-danger"
                            color="danger"
                            onPress={() => openRemoveModal(member)}
                          >
                            Remove from Team
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Pending Invitations</h3>
          </CardHeader>
          <CardBody>
            <Table aria-label="Pending invitations table" removeWrapper>
              <TableHeader>
                <TableColumn>EMAIL</TableColumn>
                <TableColumn>ROLE</TableColumn>
                <TableColumn>EXPIRES</TableColumn>
                <TableColumn>INVITED BY</TableColumn>
                <TableColumn width={80}>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-default-400" />
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
                        <Clock className="w-4 h-4 text-default-400" />
                        <span className={isExpired(invitation.expiresAt) ? "text-danger" : ""}>
                          {isExpired(invitation.expiresAt)
                            ? "Expired"
                            : formatDate(invitation.expiresAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-default-500">
                        {invitation.invitedBy.name || invitation.invitedBy.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        isLoading={isRevoking}
                        onPress={() => handleRevokeInvitation(invitation.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                startContent={<Mail className="w-4 h-4 text-default-400" />}
              />
              <Select
                label="Role"
                placeholder="Select a role"
                selectedKeys={[inviteRole]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) setInviteRole(selected as "company_admin" | "support_agent");
                }}
              >
                {roleOptions.map((role) => (
                  <SelectItem key={role.key} textValue={role.label}>
                    <div>
                      <p className="font-medium">{role.label}</p>
                      <p className="text-xs text-default-500">{role.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={inviteModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isInviting}
              isDisabled={!inviteEmail}
              onPress={handleInvite}
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
            <p className="text-default-500 mb-4">
              Change role for <strong>{selectedMember?.name || selectedMember?.email}</strong>
            </p>
            <Select
              label="New Role"
              placeholder="Select a role"
              selectedKeys={[newRole]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) setNewRole(selected as "company_admin" | "support_agent");
              }}
            >
              {roleOptions.map((role) => (
                <SelectItem key={role.key} textValue={role.label}>
                  <div>
                    <p className="font-medium">{role.label}</p>
                    <p className="text-xs text-default-500">{role.description}</p>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={roleModal.onClose}>
              Cancel
            </Button>
            <Button color="primary" isLoading={isUpdating} onPress={handleUpdateRole}>
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
              <strong>{selectedMember?.name || selectedMember?.email}</strong> from your team?
            </p>
            <p className="text-sm text-default-500">
              They will lose access to all company resources immediately.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={removeModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isRemoving} onPress={handleRemoveMember}>
              Remove Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
