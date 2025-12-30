"use client";

import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Mail,
  Shield,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";

import { PageHeader } from "@/components/layouts";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Textarea,
  UserAvatar,
  type BadgeVariant,
} from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import { startImpersonation } from "@/hooks/master-admin";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

interface CompanyUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoUrl: string | null;
}

interface ImpersonationPageProps {
  params: Promise<{ companyId: string }>;
}

const roleBadgeVariants: Record<string, BadgeVariant> = {
  "chatapp.company_admin": "info",
  "chatapp.support_agent": "default",
};

export default function ImpersonationPage({ params }: ImpersonationPageProps) {
  useSetPageTitle("Impersonate User");
  const { companyId } = use(params);
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [reason, setReason] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch company details
  const { data: companyData, isLoading: companyLoading } = useSWR<CompanyData>(
    `/api/master-admin/companies/${companyId}`,
    fetcher
  );

  // Fetch company users
  const { data: usersData, isLoading: usersLoading } = useSWR<{
    users: CompanyUser[];
  }>(`/api/master-admin/companies/${companyId}/users`, fetcher);

  const handleStartImpersonation = async () => {
    if (!selectedUser) return;

    setIsStarting(true);
    setError(null);

    try {
      await startImpersonation({
        targetUserId: selectedUser.id,
        reason: reason || `Impersonating user from company: ${companyData?.name}`,
      });

      // Redirect based on role
      const redirectUrl =
        selectedUser.role === "chatapp.company_admin" ? "/company/dashboard" : "/chat";

      window.location.href = redirectUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start impersonation"
      );
      setIsStarting(false);
    }
  };

  const isLoading = companyLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The company you&apos;re looking for doesn&apos;t exist or has been
            deleted.
          </p>
          <Button
            variant="secondary"
            startContent={<ArrowLeft size={16} />}
            onClick={() => router.push("/admin/companies")}
          >
            Back to Companies
          </Button>
        </Card>
      </div>
    );
  }

  const activeUsers = usersData?.users?.filter((u) => u.isActive) ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title={`Impersonate User - ${companyData.name}`}
        description="Select a user from this company to impersonate"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Companies", href: "/admin/companies" },
          { label: companyData.name, href: `/admin/companies/${companyId}` },
          { label: "Impersonate" },
        ]}
      />

      {/* Warning Banner */}
      <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={20}
            className="text-warning-600 shrink-0 mt-0.5"
          />
          <div>
            <h3 className="font-semibold text-warning-800 mb-1">
              Impersonation Warning
            </h3>
            <p className="text-sm text-warning-700">
              Impersonation allows you to view and interact with the platform as
              another user. All actions performed during impersonation will be
              logged for security and audit purposes.
            </p>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={companyData.name}
            src={companyData.logoUrl ?? undefined}
            size="lg"
            className="w-16 h-16"
          />
          <div>
            <h2 className="text-xl font-semibold">{companyData.name}</h2>
            <p className="text-muted-foreground">{companyData.slug}</p>
          </div>
          <div className="ml-auto">
            <Badge
              variant={companyData.status === "active" ? "success" : "default"}
            >
              {companyData.status}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} />
              <h3 className="font-semibold">Company Users</h3>
              <Badge variant="default" size="sm">
                {activeUsers.length} active
              </Badge>
            </div>

            {activeUsers.length === 0 ? (
              <div className="text-center py-8">
                <User size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No active users found in this company.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activeUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedUser?.id === user.id
                        ? "border-primary bg-primary-50 ring-2 ring-primary"
                        : "border-divider hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedUser(user)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedUser(user);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={user.name ?? user.email}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {user.name ?? user.email}
                          </p>
                          <Badge
                            variant={roleBadgeVariants[user.role] ?? "default"}
                            size="sm"
                          >
                            {user.role === "chatapp.company_admin"
                              ? "Admin"
                              : "Support Agent"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail size={14} />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                      {selectedUser?.id === user.id && (
                        <Shield size={20} className="text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Impersonation Panel */}
        <div>
          <Card className="p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck size={20} />
              <h3 className="font-semibold">Start Impersonation</h3>
            </div>

            {selectedUser ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Selected User</p>
                  <p className="font-medium">
                    {selectedUser.name ?? selectedUser.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Joined{" "}
                    {format(new Date(selectedUser.createdAt), "MMM d, yyyy")}
                  </p>
                </div>

                <Textarea
                  label="Reason for Impersonation"
                  placeholder="E.g., Investigating support ticket #123..."
                  value={reason}
                  onValueChange={setReason}
                  minRows={3}
                  description="Optional but recommended for audit purposes"
                />

                {error && (
                  <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Button
                  color="warning"
                  className="w-full"
                  startContent={<UserCheck size={16} />}
                  onClick={handleStartImpersonation}
                  isLoading={isStarting}
                >
                  Start Impersonation
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  You will be logged in as this user. Click the banner at the
                  top to end the session.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <User size={40} className="mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  Select a user from the list to impersonate them.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
