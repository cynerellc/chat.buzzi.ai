import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { agents } from "./agents";
import { subscriptionStatusEnum } from "./enums";
import { companySubscriptions } from "./subscriptions";
import { users } from "./users";

// Companies (Tenants) Table
export const companies = pgTable(
  "chatapp_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Basic Info
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),

    // Branding
    logoUrl: varchar("logo_url", { length: 500 }),
    primaryColor: varchar("primary_color", { length: 7 }).default("#6437F3"),
    secondaryColor: varchar("secondary_color", { length: 7 }).default("#2b3dd8"),

    // Custom Domain Configuration
    customDomain: varchar("custom_domain", { length: 255 }).unique(),
    customDomainVerified: boolean("custom_domain_verified").default(false),

    // Settings
    timezone: varchar("timezone", { length: 50 }).default("UTC"),
    locale: varchar("locale", { length: 10 }).default("en"),
    settings: jsonb("settings").default({}),

    // Status
    status: subscriptionStatusEnum("status").default("trial").notNull(),

    // API Access
    apiKeyHash: varchar("api_key_hash", { length: 255 }),
    apiKeyPrefix: varchar("api_key_prefix", { length: 10 }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("companies_slug_idx").on(table.slug),
    index("companies_status_idx").on(table.status),
  ]
);

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  agents: many(agents),
  subscriptions: many(companySubscriptions),
}));

// Types
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
