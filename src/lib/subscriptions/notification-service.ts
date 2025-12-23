/**
 * Subscription Notification Service
 *
 * Handles notifications related to subscription lifecycle events:
 * - Trial ending reminders
 * - Payment failures
 * - Plan upgrades/downgrades
 * - Usage limit warnings
 * - Grace period notifications
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Types
export type SubscriptionNotificationType =
  | "trial_ending"
  | "trial_ended"
  | "payment_failed"
  | "payment_succeeded"
  | "plan_upgraded"
  | "plan_downgraded"
  | "usage_warning"
  | "usage_limit_reached"
  | "grace_period_started"
  | "grace_period_ending"
  | "subscription_cancelled"
  | "subscription_renewed";

export interface SubscriptionNotification {
  type: SubscriptionNotificationType;
  companyId: string;
  companyName: string;
  recipientEmails: string[];
  data: NotificationData;
  sentAt?: Date;
  error?: string;
}

export interface NotificationData {
  planName?: string;
  trialEndsAt?: Date;
  daysRemaining?: number;
  usagePercentage?: number;
  limitType?: string;
  currentUsage?: number;
  limit?: number;
  amount?: number;
  currency?: string;
  nextBillingDate?: Date;
  gracePeriodEndsAt?: Date;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  htmlBody?: string;
}

/**
 * Template definitions for each notification type
 */
const NOTIFICATION_TEMPLATES: Record<SubscriptionNotificationType, NotificationTemplate> = {
  trial_ending: {
    subject: "Your trial is ending soon",
    body: `Your trial for {{planName}} ends in {{daysRemaining}} days. Upgrade now to continue using all features.`,
  },
  trial_ended: {
    subject: "Your trial has ended",
    body: `Your trial for {{planName}} has ended. Upgrade now to continue using all features.`,
  },
  payment_failed: {
    subject: "Payment failed - Action required",
    body: `We were unable to process your payment of {{currency}} {{amount}}. Please update your payment method to avoid service interruption.`,
  },
  payment_succeeded: {
    subject: "Payment received - Thank you!",
    body: `We've successfully processed your payment of {{currency}} {{amount}}. Your next billing date is {{nextBillingDate}}.`,
  },
  plan_upgraded: {
    subject: "Plan upgrade successful",
    body: `Your subscription has been upgraded to {{planName}}. Enjoy your new features!`,
  },
  plan_downgraded: {
    subject: "Plan change confirmation",
    body: `Your subscription has been changed to {{planName}}. Changes take effect at the end of your current billing period.`,
  },
  usage_warning: {
    subject: "Usage approaching limit",
    body: `You've used {{usagePercentage}}% of your {{limitType}} limit ({{currentUsage}}/{{limit}}). Consider upgrading to avoid interruption.`,
  },
  usage_limit_reached: {
    subject: "Usage limit reached",
    body: `You've reached your {{limitType}} limit ({{currentUsage}}/{{limit}}). Upgrade now to continue using this feature.`,
  },
  grace_period_started: {
    subject: "Account in grace period",
    body: `Your payment is overdue. You have until {{gracePeriodEndsAt}} to update your payment method before service is suspended.`,
  },
  grace_period_ending: {
    subject: "Grace period ending soon",
    body: `Your grace period ends in {{daysRemaining}} days. Update your payment method now to avoid service suspension.`,
  },
  subscription_cancelled: {
    subject: "Subscription cancelled",
    body: `Your subscription has been cancelled. You'll continue to have access until the end of your current billing period.`,
  },
  subscription_renewed: {
    subject: "Subscription renewed",
    body: `Your subscription to {{planName}} has been renewed. Thank you for your continued support!`,
  },
};

/**
 * Subscription Notification Service
 */
export class SubscriptionNotificationService {
  /**
   * Send a subscription notification
   */
  async send(notification: Omit<SubscriptionNotification, "sentAt">): Promise<boolean> {
    const template = NOTIFICATION_TEMPLATES[notification.type];
    const { subject, body } = this.renderTemplate(template, notification.data);

    try {
      // In production, integrate with email service (SendGrid, SES, etc.)
      // For now, log and store the notification
      console.log(`[Subscription Notification] ${notification.type}`, {
        to: notification.recipientEmails,
        subject,
        body,
      });

      // Store notification record
      await db.execute(sql`
        INSERT INTO chatapp_subscription_notifications
        (id, company_id, type, data, sent_at, created_at)
        VALUES (
          gen_random_uuid(),
          ${notification.companyId},
          ${notification.type},
          ${JSON.stringify(notification.data)}::jsonb,
          NOW(),
          NOW()
        )
      `);

      return true;
    } catch (error) {
      console.error("[Subscription Notification] Failed to send:", error);
      return false;
    }
  }

  /**
   * Check and send trial ending notifications
   */
  async checkTrialEndingNotifications(): Promise<number> {
    // Find companies with trials ending in 3, 7, or 1 days
    const companies = await db.execute<{
      id: string;
      name: string;
      admin_email: string;
      plan_name: string;
      trial_ends_at: Date;
      days_remaining: number;
    }>(sql`
      SELECT
        c.id,
        c.name,
        u.email as admin_email,
        p.name as plan_name,
        s.trial_ends_at,
        EXTRACT(DAY FROM s.trial_ends_at - NOW())::int as days_remaining
      FROM chatapp_companies c
      JOIN chatapp_subscriptions s ON c.id = s.company_id
      JOIN chatapp_subscription_plans p ON s.plan_id = p.id
      JOIN chatapp_users u ON c.id = u.company_id AND u.role = 'admin'
      WHERE s.status = 'trialing'
        AND s.trial_ends_at > NOW()
        AND EXTRACT(DAY FROM s.trial_ends_at - NOW()) IN (1, 3, 7)
        AND NOT EXISTS (
          SELECT 1 FROM chatapp_subscription_notifications n
          WHERE n.company_id = c.id
            AND n.type = 'trial_ending'
            AND n.created_at > NOW() - INTERVAL '1 day'
        )
    `);

    let sent = 0;
    for (const company of companies) {
      const success = await this.send({
        type: "trial_ending",
        companyId: company.id,
        companyName: company.name,
        recipientEmails: [company.admin_email],
        data: {
          planName: company.plan_name,
          trialEndsAt: company.trial_ends_at,
          daysRemaining: company.days_remaining,
        },
      });
      if (success) sent++;
    }

    return sent;
  }

  /**
   * Check and send usage warning notifications
   */
  async checkUsageWarnings(): Promise<number> {
    // Find companies approaching their limits (80% or 90%)
    const companies = await db.execute<{
      id: string;
      name: string;
      admin_email: string;
      limit_type: string;
      current_usage: number;
      limit_value: number;
      usage_percentage: number;
    }>(sql`
      SELECT
        c.id,
        c.name,
        u.email as admin_email,
        'messages' as limit_type,
        COALESCE(ur.total_messages, 0) as current_usage,
        p.limits->>'messages' as limit_value,
        CASE WHEN (p.limits->>'messages')::int > 0
          THEN (COALESCE(ur.total_messages, 0)::float / (p.limits->>'messages')::int * 100)
          ELSE 0
        END as usage_percentage
      FROM chatapp_companies c
      JOIN chatapp_subscriptions s ON c.id = s.company_id
      JOIN chatapp_subscription_plans p ON s.plan_id = p.id
      JOIN chatapp_users u ON c.id = u.company_id AND u.role = 'admin'
      LEFT JOIN (
        SELECT company_id, SUM(message_count) as total_messages
        FROM chatapp_usage_records
        WHERE DATE_TRUNC('month', recorded_at) = DATE_TRUNC('month', NOW())
        GROUP BY company_id
      ) ur ON c.id = ur.company_id
      WHERE s.status = 'active'
        AND (p.limits->>'messages')::int > 0
        AND (COALESCE(ur.total_messages, 0)::float / (p.limits->>'messages')::int * 100) >= 80
        AND NOT EXISTS (
          SELECT 1 FROM chatapp_subscription_notifications n
          WHERE n.company_id = c.id
            AND n.type = 'usage_warning'
            AND n.created_at > NOW() - INTERVAL '1 day'
        )
    `);

    let sent = 0;
    for (const company of companies) {
      const notificationType: SubscriptionNotificationType =
        company.usage_percentage >= 100 ? "usage_limit_reached" : "usage_warning";

      const success = await this.send({
        type: notificationType,
        companyId: company.id,
        companyName: company.name,
        recipientEmails: [company.admin_email],
        data: {
          limitType: company.limit_type,
          currentUsage: company.current_usage,
          limit: parseInt(company.limit_value as unknown as string, 10),
          usagePercentage: Math.round(company.usage_percentage),
        },
      });
      if (success) sent++;
    }

    return sent;
  }

  /**
   * Check and send grace period notifications
   */
  async checkGracePeriodNotifications(): Promise<number> {
    const companies = await db.execute<{
      id: string;
      name: string;
      admin_email: string;
      grace_period_ends_at: Date;
      days_remaining: number;
    }>(sql`
      SELECT
        c.id,
        c.name,
        u.email as admin_email,
        s.grace_period_ends_at,
        EXTRACT(DAY FROM s.grace_period_ends_at - NOW())::int as days_remaining
      FROM chatapp_companies c
      JOIN chatapp_subscriptions s ON c.id = s.company_id
      JOIN chatapp_users u ON c.id = u.company_id AND u.role = 'admin'
      WHERE s.status = 'past_due'
        AND s.grace_period_ends_at IS NOT NULL
        AND s.grace_period_ends_at > NOW()
        AND EXTRACT(DAY FROM s.grace_period_ends_at - NOW()) IN (1, 3, 7)
        AND NOT EXISTS (
          SELECT 1 FROM chatapp_subscription_notifications n
          WHERE n.company_id = c.id
            AND n.type LIKE 'grace_period%'
            AND n.created_at > NOW() - INTERVAL '1 day'
        )
    `);

    let sent = 0;
    for (const company of companies) {
      const success = await this.send({
        type: company.days_remaining <= 3 ? "grace_period_ending" : "grace_period_started",
        companyId: company.id,
        companyName: company.name,
        recipientEmails: [company.admin_email],
        data: {
          gracePeriodEndsAt: company.grace_period_ends_at,
          daysRemaining: company.days_remaining,
        },
      });
      if (success) sent++;
    }

    return sent;
  }

  /**
   * Run all notification checks
   */
  async runAllChecks(): Promise<{ trialEnding: number; usageWarnings: number; gracePeriod: number }> {
    const [trialEnding, usageWarnings, gracePeriod] = await Promise.all([
      this.checkTrialEndingNotifications(),
      this.checkUsageWarnings(),
      this.checkGracePeriodNotifications(),
    ]);

    return { trialEnding, usageWarnings, gracePeriod };
  }

  /**
   * Render template with data
   */
  private renderTemplate(
    template: NotificationTemplate,
    data: NotificationData
  ): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    // Replace placeholders
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const displayValue = value instanceof Date
        ? value.toLocaleDateString()
        : String(value);
      subject = subject.replace(new RegExp(placeholder, "g"), displayValue);
      body = body.replace(new RegExp(placeholder, "g"), displayValue);
    }

    return { subject, body };
  }
}

// Singleton instance
let serviceInstance: SubscriptionNotificationService | null = null;

export function getSubscriptionNotificationService(): SubscriptionNotificationService {
  if (!serviceInstance) {
    serviceInstance = new SubscriptionNotificationService();
  }
  return serviceInstance;
}

// Convenience functions for cron jobs
export async function runSubscriptionNotifications(): Promise<{
  trialEnding: number;
  usageWarnings: number;
  gracePeriod: number;
}> {
  return getSubscriptionNotificationService().runAllChecks();
}
