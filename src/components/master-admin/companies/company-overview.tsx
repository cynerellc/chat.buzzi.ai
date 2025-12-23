"use client";

import { format } from "date-fns";
import {
  Bot,
  Calendar,
  CreditCard,
  Globe,
  Mail,
  MessageSquare,
  Users,
} from "lucide-react";

import type { CompanyDetails } from "@/app/api/master-admin/companies/[companyId]/route";
import { Badge, Card, Progress, StatCard, type BadgeVariant } from "@/components/ui";

interface CompanyOverviewProps {
  company: CompanyDetails;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  trial: "warning",
  past_due: "danger",
  grace_period: "warning",
  expired: "danger",
  cancelled: "default",
};

export function CompanyOverview({ company }: CompanyOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Users"
          value={company.stats.users}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          title="Agents"
          value={company.stats.agents}
          icon={Bot}
          iconColor="text-success"
        />
        <StatCard
          title="Conversations"
          value={company.stats.conversations.toLocaleString()}
          icon={MessageSquare}
          iconColor="text-warning"
        />
        <StatCard
          title="Messages"
          value={company.stats.messages.toLocaleString()}
          icon={MessageSquare}
          iconColor="text-info"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Company Details */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Company Details</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-default-500">ID</dt>
              <dd className="font-mono text-sm">{company.id.slice(0, 8)}...</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-default-500">Slug</dt>
              <dd>{company.slug}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-default-500 flex items-center gap-2">
                <Globe size={16} />
                Domain
              </dt>
              <dd>
                {company.domain ? (
                  <a
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {company.domain}
                  </a>
                ) : (
                  <span className="text-default-400">Not set</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-default-500">Status</dt>
              <dd>
                <Badge
                  variant={statusBadgeVariants[company.status] ?? "default"}
                  size="sm"
                >
                  {company.status.replace("_", " ")}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-default-500 flex items-center gap-2">
                <Calendar size={16} />
                Created
              </dt>
              <dd>{format(new Date(company.createdAt), "MMM d, yyyy")}</dd>
            </div>
          </dl>
        </Card>

        {/* Admin Contact */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Admin Contact</h3>
          {company.admin ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-default-500">Name</dt>
                <dd className="font-medium">{company.admin.name ?? "N/A"}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-default-500 flex items-center gap-2">
                  <Mail size={16} />
                  Email
                </dt>
                <dd>
                  <a
                    href={`mailto:${company.admin.email}`}
                    className="text-primary hover:underline"
                  >
                    {company.admin.email}
                  </a>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-default-400">No admin assigned</p>
          )}
        </Card>

        {/* Subscription */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Subscription</h3>
          {company.subscription ? (
            <dl className="space-y-3">
              <div className="flex justify-between items-center">
                <dt className="text-default-500 flex items-center gap-2">
                  <CreditCard size={16} />
                  Plan
                </dt>
                <dd>
                  <Badge variant="info" size="sm">
                    {company.subscription.planName}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-default-500">Billing</dt>
                <dd className="capitalize">{company.subscription.billingCycle}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-default-500">Status</dt>
                <dd>
                  <Badge
                    variant={statusBadgeVariants[company.subscription.status] ?? "default"}
                    size="sm"
                  >
                    {company.subscription.status.replace("_", " ")}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-default-500">Next billing</dt>
                <dd>
                  {format(new Date(company.subscription.currentPeriodEnd), "MMM d, yyyy")}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-default-400">No subscription</p>
          )}
        </Card>

        {/* Usage This Month (placeholder) */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Usage This Month</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-default-500">Messages</span>
                <span>0 / 50,000</span>
              </div>
              <Progress value={0} size="sm" color="primary" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-default-500">Storage</span>
                <span>0 GB / 10 GB</span>
              </div>
              <Progress value={0} size="sm" color="success" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-default-500">API Calls</span>
                <span>0 / 100,000</span>
              </div>
              <Progress value={0} size="sm" color="warning" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
