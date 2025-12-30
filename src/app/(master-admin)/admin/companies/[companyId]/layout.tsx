"use client";

import { format } from "date-fns";
import {
  BarChart3,
  Users,
  CreditCard,
  Bot,
  Database,
  MessageSquare,
  Receipt,
  Settings,
  Pencil,
  Plus,
  Plug,
  PlayCircle,
  AlertTriangle,
} from "lucide-react";
import { use, useState, type ReactNode } from "react";

import { PageHeader } from "@/components/layouts";
import { EditCompanyModal } from "@/components/master-admin/companies";
import { SecondaryNav, type SecondaryNavItem, type SecondaryNavSubItem, type SecondaryNavThirdLevelItem } from "@/components/shared";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  UserAvatar,
  type BadgeVariant,
} from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import { useCompany, useCompanyChatbots } from "@/hooks/master-admin";

import { CompanyContext } from "./company-context";

interface CompanyDetailsLayoutProps {
  children: ReactNode;
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

export default function CompanyDetailsLayout({ children, params }: CompanyDetailsLayoutProps) {
  useSetPageTitle("Company Details");
  const { companyId } = use(params);
  const companyData = useCompany(companyId);
  const { company, isLoading, refresh } = companyData;
  const { chatbots } = useCompanyChatbots(companyId);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Build chatbot sub-items with nested navigation
  const chatbotSubItems: SecondaryNavSubItem[] = chatbots.map((chatbot) => {
    const chatbotBasePath = `/admin/companies/${companyId}/chatbots/${chatbot.id}`;

    // Build agent third-level items
    const agentThirdLevelItems: SecondaryNavThirdLevelItem[] = (chatbot.agentsList ?? []).map((agent) => ({
      key: agent.agent_identifier,
      label: agent.name,
      href: `${chatbotBasePath}/agents/${agent.agent_identifier}`,
      icon: Bot,
      badge: agent.agent_type === "supervisor" ? (
        <Badge variant="info" size="sm">sup</Badge>
      ) : undefined,
    }));

    // Define individual chatbot section items
    const generalItem: SecondaryNavThirdLevelItem = {
      key: "general",
      label: "General",
      href: `${chatbotBasePath}/general`,
      icon: Settings,
    };

    const escalationItem: SecondaryNavThirdLevelItem = {
      key: "escalation",
      label: "Escalation Rules",
      href: `${chatbotBasePath}/escalation`,
      icon: AlertTriangle,
    };

    const integrationItem: SecondaryNavThirdLevelItem = {
      key: "integration",
      label: "Integration",
      href: `${chatbotBasePath}/integration`,
      icon: Plug,
    };

    const testItem: SecondaryNavThirdLevelItem = {
      key: "test",
      label: "Test Chatbot",
      href: `${chatbotBasePath}/test`,
      icon: PlayCircle,
    };

    // Build the full list of chatbot sub-items
    const allChatbotSubItems: SecondaryNavThirdLevelItem[] = [
      generalItem,
      // Agents section header (only if there are agents)
      ...(agentThirdLevelItems.length > 0 ? [{
        key: "agents-header",
        label: "[AGENTS]",
        href: `${chatbotBasePath}/agents`,
        icon: Users,
      } as SecondaryNavThirdLevelItem] : []),
      // Individual agents (indented)
      ...agentThirdLevelItems.map(agent => ({
        ...agent,
        icon: Bot,
        label: `  ${agent.label}`, // Indent agent names
      })),
      escalationItem,
      integrationItem,
      testItem,
    ];

    return {
      key: chatbot.id,
      label: chatbot.name,
      href: `${chatbotBasePath}/general`,
       icon: Bot,
      badge: chatbot.status === "active" ? (
        <Badge variant="success" size="sm">active</Badge>
      ) : chatbot.status === "paused" ? (
        <Badge variant="warning" size="sm">paused</Badge>
      ) : undefined,
      subItems: allChatbotSubItems,
      defaultExpanded: false,
    };
  });

  const navItems: SecondaryNavItem[] = [
    { key: "overview", label: "Overview", href: `/admin/companies/${companyId}/overview`, icon: BarChart3 },
    { key: "team", label: "Team", href: `/admin/companies/${companyId}/team`, icon: Users },
    { key: "subscription", label: "Subscription", href: `/admin/companies/${companyId}/subscription`, icon: CreditCard },
    {
      key: "chatbots",
      label: "Chatbots",
      href: `/admin/companies/${companyId}/chatbots`,
      icon: Bot,
      subItems: chatbotSubItems,
      defaultExpanded: true,
      action: {
        icon: Plus,
        href: `/admin/companies/${companyId}/chatbots/new`,
        label: "Add Chatbot",
      },
    },
    { key: "knowledge", label: "Knowledge Base", href: `/admin/companies/${companyId}/knowledge`, icon: Database },
    { key: "conversations", label: "Conversations", href: `/admin/companies/${companyId}/conversations`, icon: MessageSquare },
    { key: "billing", label: "Billing", href: `/admin/companies/${companyId}/billing`, icon: Receipt },
    { key: "settings", label: "Settings", href: `/admin/companies/${companyId}/settings`, icon: Settings },
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
    <CompanyContext.Provider value={{ ...companyData, companyId }}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 pb-0">
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
        </div>

        {/* Main Content with Secondary Nav */}
        <div className="flex flex-1 min-h-0">
          <SecondaryNav items={navItems} />
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>

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
    </CompanyContext.Provider>
  );
}
