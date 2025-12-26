import { relations } from "drizzle-orm";
import { index, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { chatappSchema, companyPermissionRoleEnum } from "./enums";
import { users } from "./users";

// Company Permissions Table - Junction table linking users to companies with roles
export const companyPermissions = chatappSchema.table(
  "company_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Role within this company
    role: companyPermissionRoleEnum("role").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure a user can only have one role per company
    uniqueIndex("company_permissions_unique").on(table.companyId, table.userId),
    index("company_permissions_company_idx").on(table.companyId),
    index("company_permissions_user_idx").on(table.userId),
  ]
);

// Relations
export const companyPermissionsRelations = relations(
  companyPermissions,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyPermissions.companyId],
      references: [companies.id],
    }),
    user: one(users, {
      fields: [companyPermissions.userId],
      references: [users.id],
    }),
  })
);

// Types
export type CompanyPermission = typeof companyPermissions.$inferSelect;
export type NewCompanyPermission = typeof companyPermissions.$inferInsert;
export type CompanyPermissionRole =
  | "chatapp.company_admin"
  | "chatapp.support_agent";
