"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CreditCard,
  Database,
  Download,
  HardDrive,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Users,
  X,
  Clock,
  AlertTriangle,
} from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Separator,
  Skeleton,
  Progress,
  TableRoot,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  addToast,
} from "@/components/ui";
import {
  useCompanyBilling,
  useUpdateCompanySubscription,
  useAddCompanyPayment,
  useResetCompanyUsage,
  useExtendCompanyTrial,
  useCancelCompanySubscription,
  useReactivateCompanySubscription,
} from "@/hooks/master-admin/useCompanyBilling";

import { useCompanyContext } from "../company-context";

const statusColors: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  active: "success",
  trial: "info",
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

export default function CompanyBillingPage() {
  const { company } = useCompanyContext();
  const companyId = company?.id ?? "";

  const {
    subscription,
    currentPlan,
    availablePlans,
    paymentHistory,
    isLoading,
    mutate,
  } = useCompanyBilling(companyId);

  const { updateSubscription, isUpdating } = useUpdateCompanySubscription(companyId);
  const { addPayment, isAdding } = useAddCompanyPayment(companyId);
  const { resetUsage, isResetting } = useResetCompanyUsage(companyId);
  const { extendTrial, isExtending } = useExtendCompanyTrial(companyId);
  const { cancelSubscription, isCancelling } = useCancelCompanySubscription(companyId);
  const { reactivateSubscription, isReactivating } = useReactivateCompanySubscription(companyId);

  // Modal states
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState("7");
  const [cancelImmediate, setCancelImmediate] = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    status: "succeeded" as const,
    periodStart: "",
    periodEnd: "",
    invoiceNumber: "",
  });

  const handleChangePlan = async () => {
    if (!selectedPlanId) return;

    try {
      const newPlan = availablePlans.find((p) => p.id === selectedPlanId);
      await updateSubscription({
        planId: selectedPlanId,
        currentPrice: newPlan?.basePrice,
      });
      addToast({
        title: "Plan Updated",
        description: `Subscription changed to ${newPlan?.name}`,
        color: "success",
      });
      mutate();
      setShowChangePlanModal(false);
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change plan",
        color: "danger",
      });
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.amount || !paymentForm.periodStart || !paymentForm.periodEnd) {
      addToast({
        title: "Error",
        description: "Please fill in all required fields",
        color: "danger",
      });
      return;
    }

    try {
      await addPayment({
        amount: paymentForm.amount,
        status: paymentForm.status,
        periodStart: new Date(paymentForm.periodStart).toISOString(),
        periodEnd: new Date(paymentForm.periodEnd).toISOString(),
        invoiceNumber: paymentForm.invoiceNumber || undefined,
      });
      addToast({
        title: "Payment Added",
        description: "Payment record has been added successfully",
        color: "success",
      });
      mutate();
      setShowAddPaymentModal(false);
      setPaymentForm({
        amount: "",
        status: "succeeded",
        periodStart: "",
        periodEnd: "",
        invoiceNumber: "",
      });
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add payment",
        color: "danger",
      });
    }
  };

  const handleResetUsage = async () => {
    try {
      await resetUsage();
      addToast({
        title: "Usage Reset",
        description: "Conversation usage has been reset to 0",
        color: "success",
      });
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset usage",
        color: "danger",
      });
    }
  };

  const handleExtendTrial = async () => {
    const days = parseInt(trialDays);
    if (isNaN(days) || days < 1) {
      addToast({
        title: "Error",
        description: "Please enter a valid number of days",
        color: "danger",
      });
      return;
    }

    try {
      await extendTrial(days);
      addToast({
        title: "Trial Extended",
        description: `Trial extended by ${days} days`,
        color: "success",
      });
      mutate();
      setShowExtendTrialModal(false);
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to extend trial",
        color: "danger",
      });
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription(cancelImmediate);
      addToast({
        title: "Subscription Cancelled",
        description: cancelImmediate
          ? "Subscription has been cancelled immediately"
          : "Subscription will be cancelled at period end",
        color: "success",
      });
      mutate();
      setShowCancelModal(false);
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel subscription",
        color: "danger",
      });
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateSubscription();
      addToast({
        title: "Subscription Reactivated",
        description: "The subscription is now active",
        color: "success",
      });
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate subscription",
        color: "danger",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Manage subscription and billing for {company?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={Plus}
            onPress={() => setShowAddPaymentModal(true)}
            isDisabled={!subscription}
          >
            Add Payment
          </Button>
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onPress={handleResetUsage}
            isDisabled={!subscription || isResetting}
            isLoading={isResetting}
          >
            Reset Usage
          </Button>
        </div>
      </div>

      {/* Current Plan Overview */}
      {subscription && currentPlan ? (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                  <Badge variant={statusColors[subscription.status]}>
                    {subscription.status === "trial" ? "Trial" : subscription.status}
                  </Badge>
                  {subscription.cancelAtPeriodEnd && (
                    <Badge variant="warning">Cancelling</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{currentPlan.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
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
                  <span className="text-lg font-normal text-muted-foreground">
                    /{subscription.billingCycle === "monthly" ? "mo" : "yr"}
                  </span>
                </p>
                <div className="flex gap-2 mt-3 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setSelectedPlanId(currentPlan.id);
                      setShowChangePlanModal(true);
                    }}
                  >
                    Change Plan
                  </Button>
                  {subscription.status === "trial" && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={Clock}
                      onPress={() => setShowExtendTrialModal(true)}
                    >
                      Extend Trial
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-warning" />
            <p className="text-muted-foreground mb-4">No active subscription</p>
            <Button color="primary" onPress={() => setShowChangePlanModal(true)}>
              Create Subscription
            </Button>
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
                    <p className="text-sm text-muted-foreground">This billing period</p>
                  </div>
                </div>
                <p className="text-xl font-bold">
                  {subscription.conversationsUsed.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {subscription.conversationsLimit.toLocaleString()}
                  </span>
                </p>
              </div>
              <Progress
                value={usagePercentConversations}
                color={usagePercentConversations > 80 ? "warning" : "primary"}
                className="h-2"
              />
              {usagePercentConversations > 90 && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Approaching limit
                </p>
              )}
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
                    <p className="text-sm text-muted-foreground">Knowledge base storage</p>
                  </div>
                </div>
                <p className="text-xl font-bold">
                  {(subscription.storageUsedMb / 1024).toFixed(1)} GB
                  <span className="text-sm font-normal text-muted-foreground">
                    / {(subscription.storageLimitMb / 1024).toFixed(0)} GB
                  </span>
                </p>
              </div>
              <Progress
                value={usagePercentStorage}
                color={usagePercentStorage > 80 ? "warning" : "secondary"}
                className="h-2"
              />
              {usagePercentStorage > 90 && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Approaching limit
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Plan Features */}
      {currentPlan && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Plan Includes</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Bot className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxAgents}</p>
                  <p className="text-sm text-muted-foreground">Chatbots</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Database className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxKnowledgeSources}</p>
                  <p className="text-sm text-muted-foreground">Knowledge Sources</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxTeamMembers}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentPlan.maxStorageGb} GB</p>
                  <p className="text-sm text-muted-foreground">Storage</p>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                {currentPlan.customBranding ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={currentPlan.customBranding ? "" : "text-muted-foreground"}>
                  Custom Branding
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.prioritySupport ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={currentPlan.prioritySupport ? "" : "text-muted-foreground"}>
                  Priority Support
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.apiAccess ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={currentPlan.apiAccess ? "" : "text-muted-foreground"}>
                  API Access
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.advancedAnalytics ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={currentPlan.advancedAnalytics ? "" : "text-muted-foreground"}>
                  Advanced Analytics
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan.customIntegrations ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <X className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={currentPlan.customIntegrations ? "" : "text-muted-foreground"}>
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
                      : "border-transparent hover:border-muted"
                  }`}
                >
                  <CardBody className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold">{plan.name}</h4>
                      {plan.id === currentPlan?.id && (
                        <Badge variant="info">Current</Badge>
                      )}
                    </div>
                    <p className="text-3xl font-bold mb-2">
                      {formatCurrency(plan.basePrice, plan.currency)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    <ul className="space-y-2 text-sm mb-6">
                      <li className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-muted-foreground" />
                        {plan.maxAgents} Chatbots
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        {plan.maxConversationsPerMonth.toLocaleString()} conversations/mo
                      </li>
                      <li className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {plan.maxTeamMembers} team members
                      </li>
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.id === currentPlan?.id ? "ghost" : "default"}
                      isDisabled={plan.id === currentPlan?.id}
                      rightIcon={plan.id !== currentPlan?.id ? ArrowUpRight : undefined}
                      onPress={() => {
                        setSelectedPlanId(plan.id);
                        setShowChangePlanModal(true);
                      }}
                    >
                      {plan.id === currentPlan?.id ? "Current Plan" : "Switch to Plan"}
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
            <TableRoot aria-label="Payment history">
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
                      <Badge variant={statusColors[payment.status]}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                    </TableCell>
                    <TableCell>
                      {payment.invoiceUrl ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2"
                          >
                            <Download size={16} />
                            Download
                          </a>
                        </Button>
                      ) : payment.invoiceNumber ? (
                        <span className="text-muted-foreground">
                          #{payment.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableRoot>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
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
                <h4 className="font-medium">Subscription Management</h4>
                <p className="text-sm text-muted-foreground">
                  Manage subscription status for this company
                </p>
              </div>
              <div className="flex gap-2">
                {(subscription.status === "cancelled" || subscription.cancelAtPeriodEnd) && (
                  <Button
                    variant="outline"
                    leftIcon={RotateCcw}
                    onPress={handleReactivate}
                    isLoading={isReactivating}
                    isDisabled={isReactivating}
                  >
                    Reactivate
                  </Button>
                )}
                {subscription.status !== "cancelled" && !subscription.cancelAtPeriodEnd && (
                  <Button
                    color="danger"
                    variant="ghost"
                    onPress={() => setShowCancelModal(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Change Plan Modal */}
      <Modal isOpen={showChangePlanModal} onOpenChange={setShowChangePlanModal}>
        <ModalContent>
          <ModalHeader>Change Subscription Plan</ModalHeader>
          <ModalBody>
            <Select
              label="Select Plan"
              options={availablePlans.map((plan) => ({
                value: plan.id,
                label: `${plan.name} - ${formatCurrency(plan.basePrice)}/mo`,
              }))}
              selectedKeys={selectedPlanId ? new Set([selectedPlanId]) : new Set()}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0];
                setSelectedPlanId(key as string);
              }}
            />
            {selectedPlanId && selectedPlanId !== currentPlan?.id && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Note:</strong> Changing the plan will take effect immediately.
                  The price will be prorated for the current billing period.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowChangePlanModal(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleChangePlan}
              isLoading={isUpdating}
              isDisabled={isUpdating || !selectedPlanId || selectedPlanId === currentPlan?.id}
            >
              Change Plan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Payment Modal */}
      <Modal isOpen={showAddPaymentModal} onOpenChange={setShowAddPaymentModal}>
        <ModalContent>
          <ModalHeader>Add Payment Record</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Amount"
              placeholder="99.00"
              type="number"
              step="0.01"
              startContent={<span className="text-muted-foreground">$</span>}
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
            <Select
              label="Status"
              options={[
                { value: "succeeded", label: "Succeeded" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
                { value: "refunded", label: "Refunded" },
              ]}
              selectedKeys={new Set([paymentForm.status])}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0];
                setPaymentForm({ ...paymentForm, status: key as typeof paymentForm.status });
              }}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Period Start"
                type="date"
                value={paymentForm.periodStart}
                onChange={(e) => setPaymentForm({ ...paymentForm, periodStart: e.target.value })}
              />
              <Input
                label="Period End"
                type="date"
                value={paymentForm.periodEnd}
                onChange={(e) => setPaymentForm({ ...paymentForm, periodEnd: e.target.value })}
              />
            </div>
            <Input
              label="Invoice Number (optional)"
              placeholder="INV-001"
              value={paymentForm.invoiceNumber}
              onChange={(e) => setPaymentForm({ ...paymentForm, invoiceNumber: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowAddPaymentModal(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleAddPayment}
              isLoading={isAdding}
              isDisabled={isAdding}
            >
              Add Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Extend Trial Modal */}
      <Modal isOpen={showExtendTrialModal} onOpenChange={setShowExtendTrialModal}>
        <ModalContent>
          <ModalHeader>Extend Trial Period</ModalHeader>
          <ModalBody>
            <Input
              label="Number of Days"
              type="number"
              min="1"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              description="The trial will be extended by this many days from the current end date"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowExtendTrialModal(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleExtendTrial}
              isLoading={isExtending}
              isDisabled={isExtending}
            >
              Extend Trial
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal isOpen={showCancelModal} onOpenChange={setShowCancelModal}>
        <ModalContent>
          <ModalHeader>Cancel Subscription</ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to cancel this company&apos;s subscription?
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!cancelImmediate}
                  onChange={() => setCancelImmediate(false)}
                  className="w-4 h-4"
                />
                <span>Cancel at period end ({subscription?.currentPeriodEnd && formatDate(subscription.currentPeriodEnd)})</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={cancelImmediate}
                  onChange={() => setCancelImmediate(true)}
                  className="w-4 h-4"
                />
                <span className="text-danger">Cancel immediately</span>
              </label>
            </div>
            {cancelImmediate && (
              <div className="p-3 bg-danger/10 rounded-lg">
                <p className="text-sm text-danger">
                  <strong>Warning:</strong> Immediate cancellation will revoke access immediately.
                  This action cannot be undone.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowCancelModal(false)}>
              Keep Subscription
            </Button>
            <Button
              color="danger"
              onPress={handleCancelSubscription}
              isLoading={isCancelling}
              isDisabled={isCancelling}
            >
              Cancel Subscription
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
