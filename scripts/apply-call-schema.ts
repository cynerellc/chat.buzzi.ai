/**
 * Script to apply call feature schema changes
 * Run with: npx tsx scripts/apply-call-schema.ts
 *
 * This script adds:
 * 1. New enum types for call feature
 * 2. New columns to ai_models table (model_type, supports_audio)
 * 3. New tables: integration_accounts, calls, call_transcripts
 */

import "dotenv/config";
import postgres from "postgres";

async function applyCallSchema() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("Applying call feature schema changes...\n");

  try {
    // 1. Create enum types (if they don't exist)
    console.log("Creating enum types...");

    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.call_source AS ENUM ('web', 'whatsapp', 'twilio', 'vonage');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - call_source enum: OK");

    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.call_status AS ENUM ('pending', 'connecting', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'cancelled', 'timeout');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - call_status enum: OK");

    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.call_ai_provider AS ENUM ('OPENAI', 'GEMINI');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - call_ai_provider enum: OK");

    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.integration_account_provider AS ENUM ('whatsapp', 'twilio', 'vonage', 'bandwidth');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - integration_account_provider enum: OK");

    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.call_transcript_role AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - call_transcript_role enum: OK");

    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.ai_model_type AS ENUM ('chat', 'call', 'both');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - ai_model_type enum: OK");

    // Also need chatbot_type enum
    await sql`
      DO $$ BEGIN
        CREATE TYPE chatapp.chatbot_type AS ENUM ('chat', 'call');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    console.log("  - chatbot_type enum: OK");

    // 2. Add columns to ai_models (if they don't exist)
    console.log("\nAdding columns to ai_models table...");

    await sql`
      ALTER TABLE chatapp.ai_models
      ADD COLUMN IF NOT EXISTS model_type chatapp.ai_model_type DEFAULT 'chat' NOT NULL
    `;
    console.log("  - model_type column: OK");

    await sql`
      ALTER TABLE chatapp.ai_models
      ADD COLUMN IF NOT EXISTS supports_audio BOOLEAN DEFAULT false NOT NULL
    `;
    console.log("  - supports_audio column: OK");

    // 2b. Add call feature columns to chatbots table
    console.log("\nAdding call columns to chatbots table...");

    await sql`
      ALTER TABLE chatapp.chatbots
      ADD COLUMN IF NOT EXISTS enabled_call BOOLEAN DEFAULT false NOT NULL
    `;
    console.log("  - enabled_call column: OK");

    await sql`
      ALTER TABLE chatapp.chatbots
      ADD COLUMN IF NOT EXISTS call_ai_provider chatapp.call_ai_provider
    `;
    console.log("  - call_ai_provider column: OK");

    await sql`
      ALTER TABLE chatapp.chatbots
      ADD COLUMN IF NOT EXISTS voice_config JSONB DEFAULT '{}' NOT NULL
    `;
    console.log("  - voice_config column: OK");

    await sql`
      ALTER TABLE chatapp.chatbots
      ADD COLUMN IF NOT EXISTS call_widget_config JSONB DEFAULT '{"enabled": true, "position": "bottom-right", "callButton": {"style": "orb", "size": 60, "animation": true}}' NOT NULL
    `;
    console.log("  - call_widget_config column: OK");

    await sql`
      ALTER TABLE chatapp.chatbots
      ADD COLUMN IF NOT EXISTS chatbot_type chatapp.chatbot_type DEFAULT 'chat' NOT NULL
    `;
    console.log("  - chatbot_type column: OK");

    // 2c. Add call feature columns to chatbot_packages table
    console.log("\nAdding call columns to chatbot_packages table...");

    await sql`
      ALTER TABLE chatapp.chatbot_packages
      ADD COLUMN IF NOT EXISTS enabled_call BOOLEAN DEFAULT false NOT NULL
    `;
    console.log("  - enabled_call column: OK");

    await sql`
      ALTER TABLE chatapp.chatbot_packages
      ADD COLUMN IF NOT EXISTS call_ai_provider chatapp.call_ai_provider
    `;
    console.log("  - call_ai_provider column: OK");

    await sql`
      ALTER TABLE chatapp.chatbot_packages
      ADD COLUMN IF NOT EXISTS default_voice_config JSONB DEFAULT '{}' NOT NULL
    `;
    console.log("  - default_voice_config column: OK");

    await sql`
      ALTER TABLE chatapp.chatbot_packages
      ADD COLUMN IF NOT EXISTS default_call_widget_config JSONB DEFAULT '{"enabled": true, "position": "bottom-right", "callButton": {"style": "orb", "size": 60, "animation": true}}' NOT NULL
    `;
    console.log("  - default_call_widget_config column: OK");

    await sql`
      ALTER TABLE chatapp.chatbot_packages
      ADD COLUMN IF NOT EXISTS chatbot_type chatapp.chatbot_type DEFAULT 'chat' NOT NULL
    `;
    console.log("  - chatbot_type column: OK");

    // 3. Create integration_accounts table
    console.log("\nCreating integration_accounts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.integration_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
        provider chatapp.integration_account_provider NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50),
        is_verified BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        credentials JSONB NOT NULL DEFAULT '{}',
        settings JSONB NOT NULL DEFAULT '{}',
        webhook_secret VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      )
    `;
    console.log("  - Table created: OK");

    // Create indexes for integration_accounts
    await sql`CREATE INDEX IF NOT EXISTS integration_accounts_company_idx ON chatapp.integration_accounts(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS integration_accounts_provider_idx ON chatapp.integration_accounts(provider)`;
    await sql`CREATE INDEX IF NOT EXISTS integration_accounts_phone_idx ON chatapp.integration_accounts(phone_number)`;
    await sql`CREATE INDEX IF NOT EXISTS integration_accounts_active_idx ON chatapp.integration_accounts(is_active)`;
    console.log("  - Indexes created: OK");

    // 4. Create calls table
    console.log("\nCreating calls table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES chatapp.conversations(id),
        chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id),
        company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
        end_user_id UUID REFERENCES chatapp.end_users(id),
        source chatapp.call_source NOT NULL,
        ai_provider chatapp.call_ai_provider NOT NULL,
        status chatapp.call_status NOT NULL DEFAULT 'pending',
        integration_account_id UUID REFERENCES chatapp.integration_accounts(id),
        external_refs JSONB NOT NULL DEFAULT '{}',
        caller_info JSONB DEFAULT '{}',
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        answered_at TIMESTAMP,
        duration_seconds INTEGER,
        recording_url VARCHAR(1000),
        recording_storage_path VARCHAR(500),
        recording_duration_seconds INTEGER,
        total_turns INTEGER NOT NULL DEFAULT 0,
        interruption_count INTEGER NOT NULL DEFAULT 0,
        voice_config JSONB DEFAULT '{}',
        end_reason VARCHAR(100),
        summary TEXT,
        sentiment_score DECIMAL(5,2),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log("  - Table created: OK");

    // Create indexes for calls
    await sql`CREATE INDEX IF NOT EXISTS calls_company_idx ON chatapp.calls(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS calls_chatbot_idx ON chatapp.calls(chatbot_id)`;
    await sql`CREATE INDEX IF NOT EXISTS calls_end_user_idx ON chatapp.calls(end_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS calls_status_idx ON chatapp.calls(status)`;
    await sql`CREATE INDEX IF NOT EXISTS calls_source_idx ON chatapp.calls(source)`;
    await sql`CREATE INDEX IF NOT EXISTS calls_created_at_idx ON chatapp.calls(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS calls_integration_account_idx ON chatapp.calls(integration_account_id)`;
    console.log("  - Indexes created: OK");

    // 5. Create call_transcripts table
    console.log("\nCreating call_transcripts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.call_transcripts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,
        role chatapp.call_transcript_role NOT NULL,
        content TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL,
        duration_ms INTEGER,
        is_final BOOLEAN NOT NULL DEFAULT true,
        confidence DECIMAL(5,4),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log("  - Table created: OK");

    // Create indexes for call_transcripts
    await sql`CREATE INDEX IF NOT EXISTS call_transcripts_call_idx ON chatapp.call_transcripts(call_id)`;
    await sql`CREATE INDEX IF NOT EXISTS call_transcripts_timestamp_idx ON chatapp.call_transcripts(call_id, timestamp_ms)`;
    console.log("  - Indexes created: OK");

    console.log("\n✅ All schema changes applied successfully!");

  } catch (error) {
    console.error("❌ Error applying schema:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyCallSchema().catch((error) => {
  console.error(error);
  process.exit(1);
});
