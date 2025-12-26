"use client";

import { format } from "date-fns";
import { CreditCard, RefreshCw } from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  Skeleton,
  type BadgeVariant,
} from "@/components/ui";
import {
  updateCompanySubscription,
  useCompanySubscription,
  usePlans,
} from "@/hooks/master-admin";

interface CompanySubscriptionProps {
  companyId: string;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  trial: "warning",
  past_due: "danger",
  grace_period: "warning",
  expired: "danger",
  cancelled: "default",
};

export function CompanySubscription({ companyId }: CompanySubscriptionProps) {
  const { subscription, isLoading, refresh } = useCompanySubscription(companyId);
  const { plans } = usePlans();
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePlan = async () => {
    if (!selectedPlanId) return;

    setIsSubmitting(true);
    try {
      await updateCompanySubscription(companyId, { planId: selectedPlanId });
      setIsChangePlanOpen(false);
      refresh();
    } catch (error) {
      console.error("Failed to change plan:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <CreditCard size={48} className="mx-auto mb-4 text-default-300" />
          <h3 className="font-semibold mb-2">No Subscription</h3>
          <p className="text-default-500 mb-4">
            This company doesn&apos;t have an active subscription.
          </p>
          <Button color="primary" onPress={() => setIsChangePlanOpen(true)}>
            Add Subscription
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Current Plan</h3>
            <Button
              size="sm"
              variant="secondary"
              startContent={<RefreshCw size={16} />}
              onPress={() => setIsChangePlanOpen(true)}
            >
              Change Plan
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-default-500">Plan</dt>
                  <dd>
                    <Badge variant="info" size="sm">
                      {subscription.plan.name}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-default-500">Status</dt>
                  <dd>
                    <Badge
                      variant={statusBadgeVariants[subscription.status] ?? "default"}
                      size="sm"
                    >
                      {subscription.status.replace("_", " ")}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-default-500">Billing Cycle</dt>
                  <dd className="capitalize">{subscription.billingCycle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-default-500">Price</dt>
                  <dd className="font-medium">
                    ${subscription.currentPrice}/{subscription.billingCycle === "monthly" ? "mo" : "yr"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-default-500">Current Period Start</dt>
                  <dd>
                    {format(new Date(subscription.currentPeriodStart), "MMM d, yyyy")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-default-500">Current Period End</dt>
                  <dd>
                    {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                  </dd>
                </div>
                {subscription.trialEndDate && (
                  <div className="flex justify-between">
                    <dt className="text-default-500">Trial Ends</dt>
                    <dd>
                      {format(new Date(subscription.trialEndDate), "MMM d, yyyy")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-default-500">Cancel at Period End</dt>
                  <dd>{subscription.cancelAtPeriodEnd ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>

        {/* Plan Limits */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Plan Limits</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Max Agents</p>
              <p className="text-2xl font-semibold">{subscription.plan.maxAgents}</p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Max Conversations/Month</p>
              <p className="text-2xl font-semibold">
                {subscription.plan.maxConversationsPerMonth.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Max Knowledge Sources</p>
              <p className="text-2xl font-semibold">{subscription.plan.maxKnowledgeSources}</p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Max Storage</p>
              <p className="text-2xl font-semibold">{subscription.plan.maxStorageGb} GB</p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Max Team Members</p>
              <p className="text-2xl font-semibold">{subscription.plan.maxTeamMembers}</p>
            </div>
          </div>
        </Card>

        {/* Usage */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Current Usage</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Conversations Used</p>
              <p className="text-2xl font-semibold">
                {subscription.conversationsUsed.toLocaleString()}{" "}
                <span className="text-sm text-default-400 font-normal">
                  / {subscription.plan.maxConversationsPerMonth.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500">Storage Used</p>
              <p className="text-2xl font-semibold">
                {(subscription.storageUsedMb / 1024).toFixed(2)} GB{" "}
                <span className="text-sm text-default-400 font-normal">
                  / {subscription.plan.maxStorageGb} GB
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Change Plan Modal */}
      <Modal
        isOpen={isChangePlanOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsChangePlanOpen(false);
            setSelectedPlanId("");
          }
        }}
        size="md"
      >
        <ModalContent>
          <ModalHeader>Change Subscription Plan</ModalHeader>
          <ModalBody>
            <Select
              label="Select Plan"
              placeholder="Choose a plan"
              selectedKeys={selectedPlanId ? new Set([selectedPlanId]) : new Set()}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setSelectedPlanId(selected ?? "");
              }}
              options={plans.map((plan) => ({
                value: plan.id,
                label: `${plan.name} - $${plan.basePrice}/mo`,
              }))}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onPress={() => setIsChangePlanOpen(false)}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleChangePlan}
              isLoading={isSubmitting}
              isDisabled={!selectedPlanId}
            >
              Change Plan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
