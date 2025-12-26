"use client";

import { format } from "date-fns";
import { Bot, Pencil, Settings, Users, CreditCard, BarChart3 } from "lucide-react";
import { use, useState } from "react";

import { PageHeader } from "@/components/layouts";
import {
  CompanyOverview,
  CompanySubscription,
  CompanyUsers,
  EditCompanyModal,
} from "@/components/master-admin/companies";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Tabs,
  UserAvatar,
  type BadgeVariant,
  type TabItem,
} from "@/components/ui";
import { useCompany } from "@/hooks/master-admin";

interface CompanyDetailsPageProps {
  params: Promise<{ companyId: string }>;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  trial: "warning",
  past_due: "danger",
  grace_period: "warning",
  expired: "danger",
  cancelled: "default",
};

export default function CompanyDetailsPage({ params }: CompanyDetailsPageProps) {
  const { companyId } = use(params);
  const { company, isLoading, refresh } = useCompany(companyId);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const tabs: TabItem[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "users", label: "Users", icon: Users },
    { key: "subscription", label: "Subscription", icon: CreditCard },
    { key: "agents", label: "Agents", icon: Bot },
    { key: "settings", label: "Settings", icon: Settings },
  ];

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

  if (!company) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
          <p className="text-muted-foreground">
            The company you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title=""
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Companies", href: "/admin/companies" },
          { label: company.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              startContent={<Pencil size={16} />}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit
            </Button>
          </div>
        }
      />

      {/* Company Header */}
      <div className="flex items-start gap-4 mb-6">
        <UserAvatar
          name={company.name}
          src={company.logoUrl ?? undefined}
          size="lg"
          className="w-16 h-16"
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <Badge
              variant={statusBadgeVariants[company.status] ?? "default"}
              size="sm"
            >
              {company.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {company.domain ?? company.slug} &bull; Created{" "}
            {format(new Date(company.createdAt), "MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        items={tabs}
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="mb-6"
      />

      {/* Tab Content */}
      {activeTab === "overview" && <CompanyOverview company={company} />}

      {activeTab === "users" && <CompanyUsers companyId={companyId} />}

      {activeTab === "subscription" && (
        <CompanySubscription companyId={companyId} />
      )}

      {activeTab === "agents" && (
        <Card className="p-6">
          <div className="text-center py-8">
            <Bot size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-semibold mb-2">Agents</h3>
            <p className="text-muted-foreground">
              Agent management will be available in a future update.
            </p>
          </div>
        </Card>
      )}

      {activeTab === "settings" && (
        <Card className="p-6">
          <div className="text-center py-8">
            <Settings size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-semibold mb-2">Settings</h3>
            <p className="text-muted-foreground">
              Company settings will be available in a future update.
            </p>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <EditCompanyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={refresh}
        company={
          company
            ? {
                id: company.id,
                name: company.name,
                slug: company.slug,
                logoUrl: company.logoUrl,
                domain: company.domain,
                status: company.status,
                plan: company.subscription
                  ? {
                      id: company.subscription.planId,
                      name: company.subscription.planName,
                    }
                  : null,
                usersCount: company.stats.users,
                createdAt: company.createdAt,
              }
            : null
        }
      />
    </div>
  );
}
