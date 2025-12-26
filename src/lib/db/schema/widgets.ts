import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { chatappSchema } from "./enums";

// Widget Configuration Table (per company)
export const widgetConfigs = chatappSchema.table(
  "widget_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" })
      .unique(), // One config per company

    // Appearance
    theme: varchar("theme", { length: 20 }).default("light").notNull(), // light, dark, auto
    position: varchar("position", { length: 20 }).default("bottom-right").notNull(), // bottom-right, bottom-left
    primaryColor: varchar("primary_color", { length: 7 }).default("#6437F3").notNull(),
    accentColor: varchar("accent_color", { length: 7 }).default("#2b3dd8").notNull(),
    borderRadius: varchar("border_radius", { length: 10 }).default("16").notNull(), // in pixels
    buttonSize: varchar("button_size", { length: 10 }).default("60").notNull(), // in pixels

    // Branding
    title: varchar("title", { length: 100 }).default("Chat with us").notNull(),
    subtitle: varchar("subtitle", { length: 200 }),
    welcomeMessage: text("welcome_message").default("Hi there! How can we help you today?").notNull(),
    offlineMessage: text("offline_message").default("We're currently offline. Leave a message and we'll get back to you."),
    logoUrl: varchar("logo_url", { length: 500 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    companyName: varchar("company_name", { length: 100 }),

    // Behavior
    autoOpen: boolean("auto_open").default(false).notNull(),
    autoOpenDelay: varchar("auto_open_delay", { length: 10 }).default("5").notNull(), // in seconds
    showBranding: boolean("show_branding").default(true).notNull(),
    playSoundOnMessage: boolean("play_sound_on_message").default(true).notNull(),
    showTypingIndicator: boolean("show_typing_indicator").default(true).notNull(),
    persistConversation: boolean("persist_conversation").default(true).notNull(),

    // Features
    enableFileUpload: boolean("enable_file_upload").default(false).notNull(),
    enableVoiceMessages: boolean("enable_voice_messages").default(false).notNull(),
    enableEmoji: boolean("enable_emoji").default(true).notNull(),
    enableFeedback: boolean("enable_feedback").default(true).notNull(),
    requireEmail: boolean("require_email").default(false).notNull(),
    requireName: boolean("require_name").default(false).notNull(),

    // Advanced
    customCss: text("custom_css"),
    allowedDomains: jsonb("allowed_domains").default([]).notNull(), // Array of allowed domains
    blockedDomains: jsonb("blocked_domains").default([]).notNull(), // Array of blocked domains
    zIndex: varchar("z_index", { length: 10 }).default("9999").notNull(),

    // Launcher Customization
    launcherIcon: varchar("launcher_icon", { length: 50 }).default("chat").notNull(), // chat, message, help, custom
    launcherText: varchar("launcher_text", { length: 50 }),
    hideLauncherOnMobile: boolean("hide_launcher_on_mobile").default(false).notNull(),

    // Pre-chat Form
    preChatForm: jsonb("pre_chat_form").default({
      enabled: false,
      fields: [],
    }).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("widget_configs_company_idx").on(table.companyId)]
);

// Relations
export const widgetConfigsRelations = relations(widgetConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [widgetConfigs.companyId],
    references: [companies.id],
  }),
}));

// Types
export type WidgetConfig = typeof widgetConfigs.$inferSelect;
export type NewWidgetConfig = typeof widgetConfigs.$inferInsert;
