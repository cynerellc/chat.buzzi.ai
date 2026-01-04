/**
 * Widget Schema Migration Script
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/migrate-widget-schema.ts
 */

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

async function migrate() {
  console.log("Starting widget schema migration...");

  try {
    // Add new columns
    await db.execute(sql`
      ALTER TABLE chatapp.widget_configs
      ADD COLUMN IF NOT EXISTS launcher_icon_border_radius varchar(10) DEFAULT '50' NOT NULL
    `);
    console.log("Added launcher_icon_border_radius");

    await db.execute(sql`
      ALTER TABLE chatapp.widget_configs
      ADD COLUMN IF NOT EXISTS launcher_icon_pulse_glow boolean DEFAULT false NOT NULL
    `);
    console.log("Added launcher_icon_pulse_glow");

    await db.execute(sql`
      ALTER TABLE chatapp.widget_configs
      ADD COLUMN IF NOT EXISTS show_launcher_text boolean DEFAULT false NOT NULL
    `);
    console.log("Added show_launcher_text");

    await db.execute(sql`
      ALTER TABLE chatapp.widget_configs
      ADD COLUMN IF NOT EXISTS launcher_text_background_color varchar(7) DEFAULT '#ffffff' NOT NULL
    `);
    console.log("Added launcher_text_background_color");

    await db.execute(sql`
      ALTER TABLE chatapp.widget_configs
      ADD COLUMN IF NOT EXISTS launcher_text_color varchar(7) DEFAULT '#000000' NOT NULL
    `);
    console.log("Added launcher_text_color");

    // Drop deprecated columns (if they exist)
    try {
      await db.execute(sql`
        ALTER TABLE chatapp.widget_configs DROP COLUMN IF EXISTS company_name
      `);
      console.log("Dropped company_name");
    } catch (e) {
      console.log("company_name column may not exist, skipping");
    }

    try {
      await db.execute(sql`
        ALTER TABLE chatapp.widget_configs DROP COLUMN IF EXISTS offline_message
      `);
      console.log("Dropped offline_message");
    } catch (e) {
      console.log("offline_message column may not exist, skipping");
    }

    try {
      await db.execute(sql`
        ALTER TABLE chatapp.widget_configs DROP COLUMN IF EXISTS blocked_domains
      `);
      console.log("Dropped blocked_domains");
    } catch (e) {
      console.log("blocked_domains column may not exist, skipping");
    }

    try {
      await db.execute(sql`
        ALTER TABLE chatapp.widget_configs DROP COLUMN IF EXISTS show_typing_indicator
      `);
      console.log("Dropped show_typing_indicator");
    } catch (e) {
      console.log("show_typing_indicator column may not exist, skipping");
    }

    try {
      await db.execute(sql`
        ALTER TABLE chatapp.widget_configs DROP COLUMN IF EXISTS enable_emoji
      `);
      console.log("Dropped enable_emoji");
    } catch (e) {
      console.log("enable_emoji column may not exist, skipping");
    }

    console.log("\nWidget schema migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
