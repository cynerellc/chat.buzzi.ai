import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { billingCycleEnum, subscriptionStatusEnum } from "./enums";

// Subscription Plans Table (Master Admin managed)
export const subscriptionPlans = pgTable(
  "chatapp_subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Plan Info
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),

    // Pricing
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    // Limits
    maxAgents: integer("max_agents").notNull(),
    maxConversationsPerMonth: integer("max_conversations_per_month").notNull(),
    maxKnowledgeSources: integer("max_knowledge_sources").notNull(),
    maxStorageGb: integer("max_storage_gb").notNull(),
    maxTeamMembers: integer("max_team_members").notNull(),

    // Features (JSON array of feature keys)
    features: jsonb("features").default([]).notNull(),

    // Feature Flags
    customBranding: boolean("custom_branding").default(false).notNull(),
    prioritySupport: boolean("priority_support").default(false).notNull(),
    apiAccess: boolean("api_access").default(false).notNull(),
    advancedAnalytics: boolean("advanced_analytics").default(false).notNull(),
    customIntegrations: boolean("custom_integrations").default(false).notNull(),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),

    // Trial
    trialDays: integer("trial_days").default(14).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("subscription_plans_slug_idx").on(table.slug),
    index("subscription_plans_active_idx").on(table.isActive),
  ]
);

// Company Subscriptions Table
export const companySubscriptions = pgTable(
  "chatapp_company_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),

    // Billing
    billingCycle: billingCycleEnum("billing_cycle").default("monthly").notNull(),
    status: subscriptionStatusEnum("status").default("trial").notNull(),

    // Pricing (can differ from plan for custom deals)
    currentPrice: numeric("current_price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    // Dates
    trialStartDate: timestamp("trial_start_date"),
    trialEndDate: timestamp("trial_end_date"),
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    cancelledAt: timestamp("cancelled_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),

    // Payment Provider
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),

    // Usage Tracking (current period)
    conversationsUsed: integer("conversations_used").default(0).notNull(),
    storageUsedMb: integer("storage_used_mb").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("company_subscriptions_company_idx").on(table.companyId),
    index("company_subscriptions_plan_idx").on(table.planId),
    index("company_subscriptions_status_idx").on(table.status),
  ]
);

// Payment History Table
export const paymentHistory = pgTable(
  "chatapp_payment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => companySubscriptions.id),

    // Payment Details
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    status: varchar("status", { length: 50 }).notNull(), // succeeded, failed, pending, refunded

    // Stripe
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),

    // Invoice
    invoiceUrl: varchar("invoice_url", { length: 500 }),
    invoiceNumber: varchar("invoice_number", { length: 50 }),

    // Period
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("payment_history_company_idx").on(table.companyId),
    index("payment_history_subscription_idx").on(table.subscriptionId),
    index("payment_history_status_idx").on(table.status),
  ]
);

// Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(companySubscriptions),
}));

export const companySubscriptionsRelations = relations(companySubscriptions, ({ one, many }) => ({
  company: one(companies, {
    fields: [companySubscriptions.companyId],
    references: [companies.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [companySubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  payments: many(paymentHistory),
}));

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  company: one(companies, {
    fields: [paymentHistory.companyId],
    references: [companies.id],
  }),
  subscription: one(companySubscriptions, {
    fields: [paymentHistory.subscriptionId],
    references: [companySubscriptions.id],
  }),
}));

// Types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type NewCompanySubscription = typeof companySubscriptions.$inferInsert;
export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type NewPaymentHistory = typeof paymentHistory.$inferInsert;
