import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { knowledgeSourceStatusEnum, knowledgeSourceTypeEnum } from "./enums";

// Knowledge Categories Table (for organizing knowledge sources)
export const knowledgeCategories = pgTable(
  "chatapp_knowledge_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Category Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    slug: varchar("slug", { length: 255 }).notNull(),
    color: varchar("color", { length: 7 }), // Hex color for UI
    icon: varchar("icon", { length: 50 }), // Icon name for UI

    // Hierarchy (optional parent for nested categories)
    parentId: uuid("parent_id"),

    // Ordering
    sortOrder: integer("sort_order").default(0).notNull(),

    // Settings
    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_categories_company_idx").on(table.companyId),
    index("knowledge_categories_slug_idx").on(table.companyId, table.slug),
    index("knowledge_categories_parent_idx").on(table.parentId),
  ]
);

// Knowledge Sources Table
export const knowledgeSources = pgTable(
  "chatapp_knowledge_sources",
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

    // Category Reference (optional)
    categoryId: uuid("category_id").references(() => knowledgeCategories.id, { onDelete: "set null" }),

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

// Knowledge Chunks Table (for tracking individual chunks)
export const knowledgeChunks = pgTable(
  "chatapp_knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Source Reference
    sourceId: uuid("source_id")
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade" }),

    // Chunk Info
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),

    // Vector ID (reference to vector store)
    vectorId: varchar("vector_id", { length: 255 }),

    // Metadata (section, page number, etc.)
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_chunks_source_idx").on(table.sourceId),
    index("knowledge_chunks_index_idx").on(table.sourceId, table.chunkIndex),
  ]
);

// FAQ Items Table (structured Q&A for quick responses)
export const faqItems = pgTable(
  "chatapp_faq_items",
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
export const knowledgeCategoriesRelations = relations(knowledgeCategories, ({ one, many }) => ({
  company: one(companies, {
    fields: [knowledgeCategories.companyId],
    references: [companies.id],
  }),
  parent: one(knowledgeCategories, {
    fields: [knowledgeCategories.parentId],
    references: [knowledgeCategories.id],
    relationName: "parent_child",
  }),
  children: many(knowledgeCategories, {
    relationName: "parent_child",
  }),
  sources: many(knowledgeSources),
}));

export const knowledgeSourcesRelations = relations(knowledgeSources, ({ one, many }) => ({
  company: one(companies, {
    fields: [knowledgeSources.companyId],
    references: [companies.id],
  }),
  category: one(knowledgeCategories, {
    fields: [knowledgeSources.categoryId],
    references: [knowledgeCategories.id],
  }),
  chunks: many(knowledgeChunks),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  source: one(knowledgeSources, {
    fields: [knowledgeChunks.sourceId],
    references: [knowledgeSources.id],
  }),
}));

export const faqItemsRelations = relations(faqItems, ({ one }) => ({
  company: one(companies, {
    fields: [faqItems.companyId],
    references: [companies.id],
  }),
}));

// Company Files Table (for managing uploaded files)
export const companyFiles = pgTable(
  "chatapp_company_files",
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
export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type NewKnowledgeCategory = typeof knowledgeCategories.$inferInsert;
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type NewKnowledgeSource = typeof knowledgeSources.$inferInsert;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
export type FaqItem = typeof faqItems.$inferSelect;
export type NewFaqItem = typeof faqItems.$inferInsert;
export type CompanyFile = typeof companyFiles.$inferSelect;
export type NewCompanyFile = typeof companyFiles.$inferInsert;
