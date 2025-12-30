"use client";

import { motion } from "framer-motion";
import {
  Users,
  MoreVertical,
  UserCog,
  UserMinus,
  Shield,
  ShieldCheck,
  Mail,
  Clock,
  UserPlus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardBody,
  Badge,
  Avatar,
  Dropdown,
  type DropdownMenuItemData,
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

const defaultStatusConfig = { color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };

const statusConfig: Record<string, { color: string; bg: string; dot: string }> = {
  active: { color: "text-success", bg: "bg-success/10", dot: "bg-success" },
  inactive: defaultStatusConfig,
  pending: { color: "text-warning", bg: "bg-warning/10", dot: "bg-warning" },
  suspended: { color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" },
};

const defaultRoleConfig = { icon: Shield, color: "text-muted-foreground", bg: "bg-muted", label: "Member" };

const roleConfig: Record<string, { icon: typeof ShieldCheck; color: string; bg: string; label: string }> = {
  "chatapp.company_admin": { icon: ShieldCheck, color: "text-primary", bg: "bg-primary/10", label: "Admin" },
  "chatapp.master_admin": { icon: ShieldCheck, color: "text-warning", bg: "bg-warning/10", label: "Master Admin" },
  "chatapp.support_agent": { icon: Shield, color: "text-muted-foreground", bg: "bg-muted", label: "Support Agent" },
};

const statusToBadgeVariant: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  active: "success",
  inactive: "default",
  pending: "warning",
  suspended: "danger",
};

function getRoleConfig(role: string) {
  return roleConfig[role] ?? defaultRoleConfig;
}

function getStatusConfig(status: string) {
  return statusConfig[status] ?? defaultStatusConfig;
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
            <CardBody className="p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardBody className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No team members yet</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Invite team members to collaborate and manage conversations together
            </p>
          </CardBody>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {members.map((member, index) => {
        const isCurrentUser = member.id === currentUserId;
        const isMasterAdmin = member.role === "chatapp.master_admin";
        const canManage = !isCurrentUser && !isMasterAdmin;
        const role = getRoleConfig(member.role);
        const status = getStatusConfig(member.status);
        const RoleIcon = role.icon;

        const dropdownItems: DropdownMenuItemData[] = [
          { key: "role", label: "Change Role", icon: UserCog },
          { key: "remove", label: "Remove from Team", icon: UserMinus, isDanger: true },
        ];

        return (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="group hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300">
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar
                        src={member.avatarUrl || undefined}
                        name={member.name || member.email}
                        size="lg"
                        className="w-14 h-14 rounded-2xl"
                      />
                      {member.status === "active" && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-success border-2 border-card" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold truncate group-hover:text-primary transition-colors">
                          {member.name || "No name"}
                        </span>
                        {isCurrentUser && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <Dropdown
                      trigger={
                        <button className="p-1.5 hover:bg-muted rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
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

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {/* Role Badge */}
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
                    role.bg, role.color
                  )}>
                    <RoleIcon className="h-3 w-3" />
                    {role.label}
                  </div>

                  {/* Status Badge */}
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize",
                    status.bg, status.color
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot, member.status === "active" && "animate-pulse")} />
                    {member.status}
                  </div>
                </div>

                {/* Dates */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Last login: {formatDate(member.lastLoginAt)}</span>
                  </div>
                  <span>Joined {formatDate(member.createdAt)}</span>
                </div>
              </CardBody>
            </Card>
          </motion.div>
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
        const isMasterAdmin = member.role === "chatapp.master_admin";
        const canManage = !isCurrentUser && !isMasterAdmin;

        const dropdownItems: DropdownMenuItemData[] = [
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
                        variant={statusToBadgeVariant[member.status] ?? "default"}
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
                    {(() => {
                      const roleInfo = getRoleConfig(member.role);
                      const RoleIcon = roleInfo.icon;
                      return <RoleIcon className={cn("h-4 w-4", roleInfo.color)} />;
                    })()}
                    <span className="text-sm">{getRoleConfig(member.role).label}</span>
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
