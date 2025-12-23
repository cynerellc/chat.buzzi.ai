"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Progress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import {
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  MessageSquare,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layouts/page-header";
import { useBilling } from "@/hooks/company";

const statusColors: Record<string, "success" | "warning" | "danger" | "default" | "primary"> = {
  active: "success",
  trial: "primary",
  past_due: "warning",
  grace_period: "warning",
  cancelled: "default",
  expired: "danger",
  succeeded: "success",
  failed: "danger",
  pending: "warning",
  refunded: "default",
};

function formatCurrency(amount: string | number, currency: string = "USD") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDaysRemaining(dateString: string) {
  const end = new Date(dateString);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function BillingPage() {
  const { subscription, currentPlan, availablePlans, paymentHistory, isLoading } = useBilling();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Manage your subscription and billing" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const usagePercentConversations = subscription
    ? Math.round((subscription.conversationsUsed / subscription.conversationsLimit) * 100)
    : 0;
  const usagePercentStorage = subscription
    ? Math.round((subscription.storageUsedMb / subscription.storageLimitMb) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        actions={
          <Button
            color="primary"
            startContent={<CreditCard className="w-4 h-4" />}
            isDisabled={!subscription}
          >
            Update Payment Method
          </Button>
        }
      />

      {/* Current Plan Overview */}
      {subscription && currentPlan ? (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">{currentPlan.name}</h2>
                  <Chip color={statusColors[subscription.status]} variant="flat">
                    {subscription.status === "trial" ? "Trial" : subscription.status}
                  </Chip>
                </div>
                <p className="text-default-500">{currentPlan.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-default-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {subscription.status === "trial"
                      ? `Trial ends in ${getDaysRemaining(subscription.trialEndDate!)} days`
                      : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
                  </span>
                  <span>|</span>
                  <span className="capitalize">{subscription.billingCycle} billing</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">
                  {formatCurrency(subscription.currentPrice, subscription.currency)}
                  <span className="text-lg font-normal text-default-500">
                    /{subscription.billingCycle === "monthly" ? "mo" : "yr"}
                  </span>
                </p>
                {subscription.cancelAtPeriodEnd && (
                  <Chip color="warning" variant="flat" size="sm" className="mt-2">
                    Cancels at period end
                  </Chip>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6 text-center">
            <p className="text-default-500 mb-4">No active subscription</p>
            <Button color="primary">Choose a Plan</Button>
          </CardBody>
        </Card>
      )}

      {/* Usage Stats */}
      {subscription && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Conversations</p>
                    <p className="text-sm text-default-500">This billing period</p>
                  </div>
                </div>
                <p className="text-xl font-bold">
                  {subscription.conversationsUsed.toLocaleString()}
                  <span className="text-sm font-normal text-default-500">
                    / {subscription.conversationsLimit.toLocaleString()}
                  </span>
                </p>
              </div>
              <Progress
                value={usagePercentConversations}
                color={usagePercentConversations > 80 ? "warning" : "primary"}
                className="h-2"
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <HardDrive className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium">Storage</p>
                    <p className="text-sm text-default-500">Knowledge base storage</p>
                  </div>
                </div>
                <p className="text-xl font-bold">
                  {(subscription.storageUsedMb / 1024).toFixed(1)} GB
                  <span className="text-sm font-normal text-default-500">
                    / {(subscription.storageLimitMb / 1024).toFixed(0)} GB
                  </span>
                </p>
              </div>
              <Progress
                value={usagePercentStorage}
                color={usagePercentStorage > 80 ? "warning" : "secondary"}
                className="h-2"
              />
            </CardBody>
          </Card>
        </div>
      )}

      {/* Plan Features */}
      {currentPlan && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Your Plan Includes</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-default-100 rounded-lg">
                  <Bot className="w-5 h-5 text-default-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxAgents}</p>
                  <p className="text-sm text-default-500">AI Agents</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-default-100 rounded-lg">
                  <Database className="w-5 h-5 text-default-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxKnowledgeSources}</p>
                  <p className="text-sm text-default-500">Knowledge Sources</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-default-100 rounded-lg">
                  <Users className="w-5 h-5 text-default-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxTeamMembers}</p>
                  <p className="text-sm text-default-500">Team Members</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-default-100 rounded-lg">
                  <HardDrive className="w-5 h-5 text-default-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxStorageGb} GB</p>
                  <p className="text-sm text-default-500">Storage</p>
                </div>
              </div>
            </div>

            <Divider className="my-6" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                {currentPlan.customBranding ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <span className="w-4 h-4 text-default-300">-</span>
                )}
                <span className={currentPlan.customBranding ? "" : "text-default-400"}>
                  Custom Branding
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.prioritySupport ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <span className="w-4 h-4 text-default-300">-</span>
                )}
                <span className={currentPlan.prioritySupport ? "" : "text-default-400"}>
                  Priority Support
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.apiAccess ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <span className="w-4 h-4 text-default-300">-</span>
                )}
                <span className={currentPlan.apiAccess ? "" : "text-default-400"}>
                  API Access
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.advancedAnalytics ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <span className="w-4 h-4 text-default-300">-</span>
                )}
                <span className={currentPlan.advancedAnalytics ? "" : "text-default-400"}>
                  Advanced Analytics
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.customIntegrations ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <span className="w-4 h-4 text-default-300">-</span>
                )}
                <span className={currentPlan.customIntegrations ? "" : "text-default-400"}>
                  Custom Integrations
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Available Plans */}
      {availablePlans.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Available Plans</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`border-2 ${
                    plan.id === currentPlan?.id
                      ? "border-primary"
                      : "border-transparent hover:border-default-200"
                  }`}
                >
                  <CardBody className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold">{plan.name}</h4>
                      {plan.id === currentPlan?.id && (
                        <Chip size="sm" color="primary" variant="flat">
                          Current
                        </Chip>
                      )}
                    </div>
                    <p className="text-3xl font-bold mb-2">
                      {formatCurrency(plan.basePrice, plan.currency)}
                      <span className="text-sm font-normal text-default-500">/mo</span>
                    </p>
                    <p className="text-sm text-default-500 mb-4">{plan.description}</p>
                    <ul className="space-y-2 text-sm mb-6">
                      <li className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-default-400" />
                        {plan.maxAgents} AI Agents
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-default-400" />
                        {plan.maxConversationsPerMonth.toLocaleString()} conversations/mo
                      </li>
                      <li className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-default-400" />
                        {plan.maxTeamMembers} team members
                      </li>
                    </ul>
                    <Button
                      fullWidth
                      color={plan.id === currentPlan?.id ? "default" : "primary"}
                      variant={plan.id === currentPlan?.id ? "flat" : "solid"}
                      isDisabled={plan.id === currentPlan?.id}
                      endContent={
                        plan.id !== currentPlan?.id && <ArrowUpRight className="w-4 h-4" />
                      }
                    >
                      {plan.id === currentPlan?.id ? "Current Plan" : "Upgrade"}
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Payment History</h3>
        </CardHeader>
        <CardBody>
          {paymentHistory.length > 0 ? (
            <Table aria-label="Payment history" removeWrapper>
              <TableHeader>
                <TableColumn>DATE</TableColumn>
                <TableColumn>AMOUNT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>PERIOD</TableColumn>
                <TableColumn>INVOICE</TableColumn>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" color={statusColors[payment.status]} variant="flat">
                        {payment.status}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-default-500">
                      {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                    </TableCell>
                    <TableCell>
                      {payment.invoiceUrl ? (
                        <Button
                          size="sm"
                          variant="light"
                          startContent={<Download className="w-4 h-4" />}
                          as="a"
                          href={payment.invoiceUrl}
                          target="_blank"
                        >
                          Download
                        </Button>
                      ) : (
                        <span className="text-default-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-default-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payment history yet</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Subscription Actions */}
      {subscription && (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h4 className="font-medium">Need to make changes?</h4>
                <p className="text-sm text-default-500">
                  Contact support for plan changes, billing questions, or cancellations.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="flat" startContent={<ExternalLink className="w-4 h-4" />}>
                  Contact Support
                </Button>
                {!subscription.cancelAtPeriodEnd && (
                  <Button color="danger" variant="flat">
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
