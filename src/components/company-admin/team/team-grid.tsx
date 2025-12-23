"use client";

import {
  Users,
  MoreVertical,
  UserCog,
  UserMinus,
  Shield,
  ShieldCheck,
  Mail,
  Clock,
} from "lucide-react";

import {
  Card,
  CardBody,
  Badge,
  Avatar,
  Dropdown,
  type DropdownMenuItem,
  Skeleton,
} from "@/components/ui";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface TeamGridProps {
  members: TeamMember[];
  isLoading: boolean;
  currentUserId?: string;
  onChangeRole: (member: TeamMember) => void;
  onRemoveMember: (member: TeamMember) => void;
}

const statusColors: Record<string, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  inactive: "default",
  pending: "warning",
  suspended: "danger",
};

function getRoleIcon(role: string) {
  switch (role) {
    case "company_admin":
      return <ShieldCheck className="w-4 h-4 text-primary" />;
    case "master_admin":
      return <ShieldCheck className="w-4 h-4 text-warning" />;
    case "support_agent":
      return <Shield className="w-4 h-4 text-default-500" />;
    default:
      return <Shield className="w-4 h-4 text-default-500" />;
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

export function TeamGrid({
  members,
  isLoading,
  currentUserId,
  onChangeRole,
  onRemoveMember,
}: TeamGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Users className="h-12 w-12 mx-auto mb-4 text-default-300" />
          <p className="text-default-500 font-medium">No team members found</p>
          <p className="text-sm text-default-400">
            Invite team members to get started
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => {
        const isCurrentUser = member.id === currentUserId;
        const isMasterAdmin = member.role === "master_admin";
        const canManage = !isCurrentUser && !isMasterAdmin;

        const dropdownItems: DropdownMenuItem[] = [
          { key: "role", label: "Change Role", icon: UserCog },
          { key: "remove", label: "Remove from Team", icon: UserMinus, isDanger: true },
        ];

        return (
          <Card key={member.id}>
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={member.avatarUrl || undefined}
                    name={member.name || member.email}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {member.name || "No name"}
                      </span>
                      {isCurrentUser && (
                        <Badge variant="info" className="shrink-0">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-default-500 truncate">{member.email}</p>
                  </div>
                </div>

                {canManage && (
                  <Dropdown
                    trigger={
                      <button className="p-1 hover:bg-default-100 rounded-lg">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    }
                    items={dropdownItems}
                    onAction={(key) => {
                      if (key === "role") {
                        onChangeRole(member);
                      } else if (key === "remove") {
                        onRemoveMember(member);
                      }
                    }}
                  />
                )}
              </div>

              <div className="mt-4 space-y-2">
                {/* Role */}
                <div className="flex items-center gap-2">
                  {getRoleIcon(member.role)}
                  <span className="text-sm">{getRoleLabel(member.role)}</span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusColors[member.status] || "default"}
                    className="capitalize"
                  >
                    {member.status}
                  </Badge>
                </div>

                {/* Dates */}
                <div className="text-xs text-default-400 space-y-1 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Last login: {formatDate(member.lastLoginAt)}</span>
                  </div>
                  <p>Joined: {formatDate(member.createdAt)}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

// List view variant
export function TeamList({
  members,
  isLoading,
  currentUserId,
  onChangeRole,
  onRemoveMember,
}: TeamGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Users className="h-12 w-12 mx-auto mb-4 text-default-300" />
          <p className="text-default-500 font-medium">No team members found</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const isCurrentUser = member.id === currentUserId;
        const isMasterAdmin = member.role === "master_admin";
        const canManage = !isCurrentUser && !isMasterAdmin;

        const dropdownItems: DropdownMenuItem[] = [
          { key: "role", label: "Change Role", icon: UserCog },
          { key: "remove", label: "Remove from Team", icon: UserMinus, isDanger: true },
        ];

        return (
          <Card key={member.id}>
            <CardBody className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={member.avatarUrl || undefined}
                    name={member.name || member.email}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {member.name || "No name"}
                      </span>
                      {isCurrentUser && (
                        <Badge variant="info" className="shrink-0">You</Badge>
                      )}
                      <Badge
                        variant={statusColors[member.status] || "default"}
                        className="capitalize shrink-0"
                      >
                        {member.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-default-500 truncate">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(member.role)}
                    <span className="text-sm">{getRoleLabel(member.role)}</span>
                  </div>

                  <span className="text-xs text-default-400">
                    Last login: {formatDate(member.lastLoginAt)}
                  </span>

                  {canManage && (
                    <Dropdown
                      trigger={
                        <button className="p-1 hover:bg-default-100 rounded-lg">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      }
                      items={dropdownItems}
                      onAction={(key) => {
                        if (key === "role") {
                          onChangeRole(member);
                        } else if (key === "remove") {
                          onRemoveMember(member);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
