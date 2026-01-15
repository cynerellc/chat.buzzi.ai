/**
 * Schema Consolidation Migration Script
 *
 * This script migrates the database from the old schema to the new consolidated schema:
 *
 * Changes:
 * 1. chatbot_packages: Remove chatbot_type, add enabled_chat boolean
 * 2. chatbots: Remove chatbot_type, add enabled_chat, consolidate widget configs into widget_config JSONB
 * 3. widget_configs: DELETE TABLE - migrate data to chatbots.widget_config.chat
 * 4. chatbot_versions: DELETE TABLE
 * 5. integration_accounts: Move phone_number, webhook_secret into settings JSONB, remove metadata
 * 6. integrations: Remove OAuth fields, add integration_account_id FK
 *
 * Usage:
 *   pnpm tsx scripts/schema-consolidation-migration.ts [--dry-run] [--step N]
 *
 * Options:
 *   --dry-run    Print SQL statements without executing
 *   --step N     Run only step N (1-5)
 */

import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is required");
  process.exit(1);
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const stepIndex = args.indexOf("--step");
const stepOnly = stepIndex !== -1 ? parseInt(args[stepIndex + 1], 10) : null;

const sql = postgres(DATABASE_URL, { max: 1 });

async function runStep(
  stepNumber: number,
  description: string,
  queries: string[]
) {
  if (stepOnly && stepOnly !== stepNumber) {
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Step ${stepNumber}: ${description}`);
  console.log(`${"=".repeat(60)}`);

  for (const query of queries) {
    console.log(`\nSQL:\n${query.trim()}\n`);

    if (!isDryRun) {
      try {
        await sql.unsafe(query);
        console.log("✓ Executed successfully");
      } catch (error) {
        console.error("✗ Error:", error);
        throw error;
      }
    } else {
      console.log("(dry run - not executed)");
    }
  }
}

async function main() {
  console.log("Schema Consolidation Migration");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);
  if (stepOnly) {
    console.log(`Running only step: ${stepOnly}`);
  }

  try {
    // Step 1: Add new columns (non-breaking changes)
    await runStep(1, "Add new columns", [
      // Add enabled_chat to chatbot_packages
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'enabled_chat'
        ) THEN
          ALTER TABLE chatapp.chatbot_packages ADD COLUMN enabled_chat BOOLEAN DEFAULT true NOT NULL;
        END IF;
      END $$;`,

      // Add enabled_chat to chatbots
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'enabled_chat'
        ) THEN
          ALTER TABLE chatapp.chatbots ADD COLUMN enabled_chat BOOLEAN DEFAULT true NOT NULL;
        END IF;
      END $$;`,

      // Add widget_config JSONB to chatbots (if not exists)
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'widget_config'
        ) THEN
          ALTER TABLE chatapp.chatbots ADD COLUMN widget_config JSONB DEFAULT '{"chat":{}, "call":{}}' NOT NULL;
        END IF;
      END $$;`,

      // Add integration_account_id to integrations (if not exists)
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integrations' AND column_name = 'integration_account_id'
        ) THEN
          ALTER TABLE chatapp.integrations ADD COLUMN integration_account_id UUID REFERENCES chatapp.integration_accounts(id);
          CREATE INDEX IF NOT EXISTS integrations_account_idx ON chatapp.integrations(integration_account_id);
        END IF;
      END $$;`,
    ]);

    // Step 2: Migrate chatbot_type to enabled_chat/enabled_call
    await runStep(2, "Migrate chatbot_type to enabled_chat/enabled_call", [
      // Migrate chatbot_packages.chatbot_type to enabled_chat
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'chatbot_type'
        ) THEN
          UPDATE chatapp.chatbot_packages
          SET enabled_chat = (chatbot_type = 'chat' OR chatbot_type IS NULL);
        END IF;
      END $$;`,

      // Migrate chatbots.chatbot_type to enabled_chat
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'chatbot_type'
        ) THEN
          UPDATE chatapp.chatbots
          SET enabled_chat = (chatbot_type = 'chat' OR chatbot_type IS NULL);
        END IF;
      END $$;`,
    ]);

    // Step 3: Migrate widget_configs into chatbots.widget_config.chat
    await runStep(3, "Migrate widget_configs to chatbots.widget_config", [
      // Check if widget_configs table exists and migrate data
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'chatapp' AND table_name = 'widget_configs'
        ) THEN
          -- Migrate widget config data from widget_configs table
          UPDATE chatapp.chatbots c
          SET widget_config = jsonb_build_object(
            'chat', COALESCE(
              (SELECT jsonb_build_object(
                'theme', wc.theme,
                'position', wc.position,
                'placement', wc.placement,
                'primaryColor', wc.primary_color,
                'accentColor', wc.accent_color,
                'userBubbleColor', wc.user_bubble_color,
                'overrideAgentColor', wc.override_agent_color,
                'agentBubbleColor', wc.agent_bubble_color,
                'borderRadius', wc.border_radius,
                'buttonSize', wc.button_size,
                'launcherIcon', wc.launcher_icon,
                'launcherText', wc.launcher_text,
                'launcherIconBorderRadius', wc.launcher_icon_border_radius,
                'launcherIconPulseGlow', wc.launcher_icon_pulse_glow,
                'showLauncherText', wc.show_launcher_text,
                'launcherTextBackgroundColor', wc.launcher_text_background_color,
                'launcherTextColor', wc.launcher_text_color,
                'zIndex', wc.z_index,
                'title', wc.title,
                'subtitle', wc.subtitle,
                'welcomeMessage', wc.welcome_message,
                'logoUrl', wc.logo_url,
                'avatarUrl', wc.avatar_url,
                'showBranding', wc.show_branding,
                'autoOpen', wc.auto_open,
                'autoOpenDelay', wc.auto_open_delay,
                'playSoundOnMessage', wc.play_sound_on_message,
                'persistConversation', wc.persist_conversation,
                'hideLauncherOnMobile', wc.hide_launcher_on_mobile,
                'enableFileUpload', wc.enable_file_upload,
                'enableVoiceMessages', wc.enable_voice_messages,
                'enableFeedback', wc.enable_feedback,
                'requireEmail', wc.require_email,
                'requireName', wc.require_name,
                'showAgentSwitchNotification', wc.show_agent_switch_notification,
                'showThinking', wc.show_thinking,
                'showInstantUpdates', wc.show_instant_updates,
                'showAgentListOnTop', wc.show_agent_list_on_top,
                'agentListMinCards', wc.agent_list_min_cards,
                'agentListingType', wc.agent_listing_type,
                'customCss', wc.custom_css,
                'allowedDomains', wc.allowed_domains,
                'preChatForm', wc.pre_chat_form
              )
              FROM chatapp.widget_configs wc WHERE wc.chatbot_id = c.id),
              '{}'::jsonb
            ),
            'call', COALESCE(c.call_widget_config, '{}'::jsonb)
          )
          WHERE EXISTS (SELECT 1 FROM chatapp.widget_configs wc WHERE wc.chatbot_id = c.id);
        END IF;
      END $$;`,

      // For chatbots without widget_configs entry, just migrate call_widget_config
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'call_widget_config'
        ) THEN
          UPDATE chatapp.chatbots
          SET widget_config = jsonb_build_object(
            'chat', COALESCE((widget_config->>'chat')::jsonb, '{}'::jsonb),
            'call', COALESCE(call_widget_config, '{}'::jsonb)
          )
          WHERE widget_config IS NULL OR widget_config = '{"chat":{}, "call":{}}'::jsonb;
        END IF;
      END $$;`,
    ]);

    // Step 4: Migrate integration_accounts fields to settings
    await runStep(4, "Migrate integration_accounts fields to settings", [
      `DO $$
      BEGIN
        -- Migrate phone_number and webhook_secret to settings
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integration_accounts' AND column_name = 'phone_number'
        ) THEN
          UPDATE chatapp.integration_accounts
          SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
            'phone_number', phone_number,
            'webhook_secret', webhook_secret
          )
          WHERE phone_number IS NOT NULL OR webhook_secret IS NOT NULL;
        END IF;
      END $$;`,
    ]);

    // Step 5: Drop old columns and tables
    await runStep(5, "Drop deprecated columns and tables", [
      // Drop chatbot_type from chatbot_packages
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'chatbot_type'
        ) THEN
          ALTER TABLE chatapp.chatbot_packages DROP COLUMN chatbot_type;
        END IF;
      END $$;`,

      // Drop chatbot_type and call_widget_config from chatbots
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'chatbot_type'
        ) THEN
          ALTER TABLE chatapp.chatbots DROP COLUMN chatbot_type;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'call_widget_config'
        ) THEN
          ALTER TABLE chatapp.chatbots DROP COLUMN call_widget_config;
        END IF;
      END $$;`,

      // Drop phone_number, webhook_secret, metadata from integration_accounts
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integration_accounts' AND column_name = 'phone_number'
        ) THEN
          ALTER TABLE chatapp.integration_accounts DROP COLUMN phone_number;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integration_accounts' AND column_name = 'webhook_secret'
        ) THEN
          ALTER TABLE chatapp.integration_accounts DROP COLUMN webhook_secret;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integration_accounts' AND column_name = 'metadata'
        ) THEN
          ALTER TABLE chatapp.integration_accounts DROP COLUMN metadata;
        END IF;
      END $$;`,

      // Drop OAuth fields from integrations
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integrations' AND column_name = 'access_token'
        ) THEN
          ALTER TABLE chatapp.integrations DROP COLUMN access_token;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integrations' AND column_name = 'refresh_token'
        ) THEN
          ALTER TABLE chatapp.integrations DROP COLUMN refresh_token;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integrations' AND column_name = 'token_expires_at'
        ) THEN
          ALTER TABLE chatapp.integrations DROP COLUMN token_expires_at;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integrations' AND column_name = 'webhook_url'
        ) THEN
          ALTER TABLE chatapp.integrations DROP COLUMN webhook_url;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'chatapp' AND table_name = 'integrations' AND column_name = 'webhook_secret'
        ) THEN
          ALTER TABLE chatapp.integrations DROP COLUMN webhook_secret;
        END IF;
      END $$;`,

      // Drop widget_configs table
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'chatapp' AND table_name = 'widget_configs'
        ) THEN
          DROP TABLE chatapp.widget_configs;
        END IF;
      END $$;`,

      // Drop chatbot_versions table
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'chatapp' AND table_name = 'chatbot_versions'
        ) THEN
          DROP TABLE chatapp.chatbot_versions;
        END IF;
      END $$;`,
    ]);

    console.log("\n" + "=".repeat(60));
    console.log("Migration completed successfully!");
    console.log("=".repeat(60));

    // Print verification queries
    console.log("\nVerification queries to run:");
    console.log(`
-- Check chatbots widget_config migration
SELECT id, name, widget_config->'chat'->>'title' as chat_title, widget_config->'call'->>'enabled' as call_enabled
FROM chatapp.chatbots
LIMIT 5;

-- Check integration_accounts settings migration
SELECT id, display_name, settings->>'phone_number' as phone_number
FROM chatapp.integration_accounts
LIMIT 5;

-- Verify tables were dropped
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'chatapp' AND table_name IN ('widget_configs', 'chatbot_versions');
    `);
  } catch (error) {
    console.error("\nMigration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
