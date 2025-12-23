import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { userRoleEnum, userStatusEnum } from "./enums";

// Users Table
export const users = pgTable(
  "chatapp_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Auth.js fields
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: timestamp("email_verified"),
    name: varchar("name", { length: 255 }),
    image: varchar("image", { length: 500 }),
    hashedPassword: varchar("hashed_password", { length: 255 }),

    // Platform fields
    companyId: uuid("company_id").references(() => companies.id),
    role: userRoleEnum("role").notNull().default("support_agent"),
    status: userStatusEnum("status").notNull().default("active"),

    // Profile
    phone: varchar("phone", { length: 20 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),

    // Permissions (fine-grained)
    permissions: jsonb("permissions").default({}),

    // Settings
    settings: jsonb("settings").default({}),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at"),

    // Restrictions
    ipAllowlist: jsonb("ip_allowlist").default([]),
    accessExpiresAt: timestamp("access_expires_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("users_company_idx").on(table.companyId),
    index("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ]
);

// Auth.js Accounts Table
export const accounts = pgTable(
  "chatapp_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    idToken: text("id_token"),
    sessionState: varchar("session_state", { length: 255 }),
  },
  (table) => [
    index("accounts_user_idx").on(table.userId),
    index("accounts_provider_idx").on(table.provider, table.providerAccountId),
  ]
);

// Auth.js Sessions Table
export const sessions = pgTable(
  "chatapp_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)]
);

// Auth.js Verification Tokens Table
export const verificationTokens = pgTable(
  "chatapp_verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expires: timestamp("expires").notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// Device Sessions Table - Track user devices/sessions
export const deviceSessions = pgTable(
  "chatapp_device_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),

    // Device info
    deviceName: varchar("device_name", { length: 255 }),
    deviceType: varchar("device_type", { length: 50 }), // desktop, mobile, tablet
    browser: varchar("browser", { length: 100 }),
    os: varchar("os", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    location: varchar("location", { length: 255 }),

    // Trust status
    isTrusted: boolean("is_trusted").default(false).notNull(),
    lastActivity: timestamp("last_activity").defaultNow().notNull(),

    // Expiration
    expiresAt: timestamp("expires_at").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("device_sessions_user_idx").on(table.userId),
    index("device_sessions_token_idx").on(table.sessionToken),
  ]
);

// Magic Link Tokens Table - for passwordless auth
export const magicLinkTokens = pgTable(
  "chatapp_magic_link_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("magic_link_email_idx").on(table.email),
    index("magic_link_token_idx").on(table.token),
  ]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const deviceSessionsRelations = relations(deviceSessions, ({ one }) => ({
  user: one(users, {
    fields: [deviceSessions.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type DeviceSession = typeof deviceSessions.$inferSelect;
export type NewDeviceSession = typeof deviceSessions.$inferInsert;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type NewMagicLinkToken = typeof magicLinkTokens.$inferInsert;
