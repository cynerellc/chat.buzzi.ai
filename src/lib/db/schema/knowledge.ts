import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { chatappSchema, knowledgeSourceStatusEnum, knowledgeSourceTypeEnum } from "./enums";

// Knowledge Sources Table
export const knowledgeSources = chatappSchema.table(
  "knowledge_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Source Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: knowledgeSourceTypeEnum("type").notNull(),
    status: knowledgeSourceStatusEnum("status").default("pending").notNull(),

    // Category (optional - stored as name string, managed in companies.settings.knowledgeCategories)
    category: varchar("category", { length: 255 }),

    // Source Details (depends on type)
    // For file: { fileName, fileType, fileSize, storagePath }
    // For url: { url, crawlDepth, lastCrawled }
    // For text: { content }
    sourceConfig: jsonb("source_config").default({}).notNull(),

    // Processing Info
    chunkCount: integer("chunk_count").default(0).notNull(),
    tokenCount: integer("token_count").default(0).notNull(),
    processingError: text("processing_error"),
    lastProcessedAt: timestamp("last_processed_at"),

    // Vector Store Reference
    vectorCollectionId: varchar("vector_collection_id", { length: 255 }),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("knowledge_sources_company_idx").on(table.companyId),
    index("knowledge_sources_type_idx").on(table.type),
    index("knowledge_sources_status_idx").on(table.status),
  ]
);

// FAQ Items Table (structured Q&A for quick responses)
export const faqItems = chatappSchema.table(
  "faq_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // FAQ Content
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: varchar("category", { length: 100 }),
    tags: jsonb("tags").default([]),

    // Matching
    keywords: jsonb("keywords").default([]),
    priority: integer("priority").default(0).notNull(),

    // Analytics
    usageCount: integer("usage_count").default(0).notNull(),
    helpfulCount: integer("helpful_count").default(0).notNull(),
    notHelpfulCount: integer("not_helpful_count").default(0).notNull(),

    // Vector ID for semantic search
    vectorId: varchar("vector_id", { length: 255 }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("faq_items_company_idx").on(table.companyId),
    index("faq_items_category_idx").on(table.category),
  ]
);

// Relations
export const knowledgeSourcesRelations = relations(knowledgeSources, ({ one }) => ({
  company: one(companies, {
    fields: [knowledgeSources.companyId],
    references: [companies.id],
  }),
}));

export const faqItemsRelations = relations(faqItems, ({ one }) => ({
  company: one(companies, {
    fields: [faqItems.companyId],
    references: [companies.id],
  }),
}));

// Company Files Table (for managing uploaded files)
export const companyFiles = chatappSchema.table(
  "company_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // File Info
    name: varchar("name", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    size: integer("size").notNull(), // Size in bytes
    url: varchar("url", { length: 1000 }).notNull(),

    // Categorization
    category: varchar("category", { length: 100 }).default("general").notNull(),

    // Optional link to knowledge source
    knowledgeSourceId: uuid("knowledge_source_id").references(() => knowledgeSources.id, { onDelete: "set null" }),

    // Uploader
    uploadedById: uuid("uploaded_by_id").notNull(),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("company_files_company_idx").on(table.companyId),
    index("company_files_category_idx").on(table.category),
    index("company_files_uploader_idx").on(table.uploadedById),
  ]
);

export const companyFilesRelations = relations(companyFiles, ({ one }) => ({
  company: one(companies, {
    fields: [companyFiles.companyId],
    references: [companies.id],
  }),
  knowledgeSource: one(knowledgeSources, {
    fields: [companyFiles.knowledgeSourceId],
    references: [knowledgeSources.id],
  }),
}));

// Types
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type NewKnowledgeSource = typeof knowledgeSources.$inferInsert;
export type FaqItem = typeof faqItems.$inferSelect;
export type NewFaqItem = typeof faqItems.$inferInsert;
export type CompanyFile = typeof companyFiles.$inferSelect;
export type NewCompanyFile = typeof companyFiles.$inferInsert;
