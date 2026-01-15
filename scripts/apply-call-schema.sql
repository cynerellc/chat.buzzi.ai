-- Apply Call Feature Schema Changes
-- Run with: psql $DATABASE_URL -f scripts/apply-call-schema.sql

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS chatapp;

-- Create enums (IF NOT EXISTS for idempotency)
DO $$
BEGIN
    -- agent_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_status') THEN
        CREATE TYPE agent_status AS ENUM ('draft', 'active', 'paused', 'archived');
    END IF;

    -- call_source enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_source') THEN
        CREATE TYPE call_source AS ENUM ('web', 'whatsapp', 'twilio', 'vonage');
    END IF;

    -- call_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
        CREATE TYPE call_status AS ENUM ('pending', 'connecting', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'cancelled', 'timeout');
    END IF;

    -- call_ai_provider enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_ai_provider') THEN
        CREATE TYPE call_ai_provider AS ENUM ('OPENAI', 'GEMINI');
    END IF;

    -- integration_account_provider enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_account_provider') THEN
        CREATE TYPE integration_account_provider AS ENUM ('whatsapp', 'twilio', 'vonage', 'bandwidth');
    END IF;

    -- call_transcript_role enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_transcript_role') THEN
        CREATE TYPE call_transcript_role AS ENUM ('user', 'assistant', 'system');
    END IF;

    -- ai_model_type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model_type') THEN
        CREATE TYPE ai_model_type AS ENUM ('chat', 'call', 'both');
    END IF;

    -- chatbot_type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_type') THEN
        CREATE TYPE chatbot_type AS ENUM ('chat', 'call');
    END IF;
END$$;

-- Add columns to chatapp.chatbots table if they don't exist
DO $$
BEGIN
    -- enabled_call column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'enabled_call') THEN
        ALTER TABLE chatapp.chatbots ADD COLUMN enabled_call BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- call_ai_provider column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'call_ai_provider') THEN
        ALTER TABLE chatapp.chatbots ADD COLUMN call_ai_provider call_ai_provider;
    END IF;

    -- voice_config column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'voice_config') THEN
        ALTER TABLE chatapp.chatbots ADD COLUMN voice_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- call_widget_config column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'call_widget_config') THEN
        ALTER TABLE chatapp.chatbots ADD COLUMN call_widget_config JSONB NOT NULL DEFAULT '{"enabled": true, "position": "bottom-right", "callButton": {"style": "orb", "size": 60, "animation": true}, "orb": {"glowIntensity": 0.6, "pulseSpeed": 2}, "callDialog": {"width": 400, "showVisualizer": true, "visualizerStyle": "waveform", "showTranscript": true}, "controls": {"showMuteButton": true, "showEndCallButton": true}}'::jsonb;
    END IF;

    -- chatbot_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbots' AND column_name = 'chatbot_type') THEN
        ALTER TABLE chatapp.chatbots ADD COLUMN chatbot_type chatbot_type NOT NULL DEFAULT 'chat';
    END IF;
END$$;

-- Add columns to chatapp.chatbot_packages table if they don't exist
DO $$
BEGIN
    -- enabled_call column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'enabled_call') THEN
        ALTER TABLE chatapp.chatbot_packages ADD COLUMN enabled_call BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- call_ai_provider column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'call_ai_provider') THEN
        ALTER TABLE chatapp.chatbot_packages ADD COLUMN call_ai_provider call_ai_provider;
    END IF;

    -- default_voice_config column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'default_voice_config') THEN
        ALTER TABLE chatapp.chatbot_packages ADD COLUMN default_voice_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- default_call_widget_config column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'default_call_widget_config') THEN
        ALTER TABLE chatapp.chatbot_packages ADD COLUMN default_call_widget_config JSONB NOT NULL DEFAULT '{"enabled": true, "position": "bottom-right", "callButton": {"style": "orb", "size": 60, "animation": true}}'::jsonb;
    END IF;

    -- chatbot_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages' AND column_name = 'chatbot_type') THEN
        ALTER TABLE chatapp.chatbot_packages ADD COLUMN chatbot_type chatbot_type NOT NULL DEFAULT 'chat';
    END IF;
END$$;

-- Create integration_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS chatapp.integration_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
    provider integration_account_provider NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    webhook_secret VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Create indexes for integration_accounts if they don't exist
CREATE INDEX IF NOT EXISTS integration_accounts_company_idx ON chatapp.integration_accounts(company_id);
CREATE INDEX IF NOT EXISTS integration_accounts_provider_idx ON chatapp.integration_accounts(provider);
CREATE INDEX IF NOT EXISTS integration_accounts_phone_idx ON chatapp.integration_accounts(phone_number);
CREATE INDEX IF NOT EXISTS integration_accounts_active_idx ON chatapp.integration_accounts(is_active);

-- Create calls table if it doesn't exist
CREATE TABLE IF NOT EXISTS chatapp.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES chatapp.conversations(id),
    chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id),
    company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
    end_user_id UUID REFERENCES chatapp.end_users(id),
    source call_source NOT NULL,
    ai_provider call_ai_provider NOT NULL,
    status call_status NOT NULL DEFAULT 'pending',
    integration_account_id UUID REFERENCES chatapp.integration_accounts(id),
    external_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
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
    sentiment_score DECIMAL(5, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for calls if they don't exist
CREATE INDEX IF NOT EXISTS calls_company_idx ON chatapp.calls(company_id);
CREATE INDEX IF NOT EXISTS calls_chatbot_idx ON chatapp.calls(chatbot_id);
CREATE INDEX IF NOT EXISTS calls_end_user_idx ON chatapp.calls(end_user_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON chatapp.calls(status);
CREATE INDEX IF NOT EXISTS calls_source_idx ON chatapp.calls(source);
CREATE INDEX IF NOT EXISTS calls_created_at_idx ON chatapp.calls(created_at);
CREATE INDEX IF NOT EXISTS calls_integration_account_idx ON chatapp.calls(integration_account_id);

-- Create call_transcripts table if it doesn't exist
CREATE TABLE IF NOT EXISTS chatapp.call_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,
    role call_transcript_role NOT NULL,
    content TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    duration_ms INTEGER,
    is_final BOOLEAN NOT NULL DEFAULT true,
    confidence DECIMAL(5, 4),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for call_transcripts if they don't exist
CREATE INDEX IF NOT EXISTS call_transcripts_call_idx ON chatapp.call_transcripts(call_id);
CREATE INDEX IF NOT EXISTS call_transcripts_timestamp_idx ON chatapp.call_transcripts(call_id, timestamp_ms);

-- Add ai_model_type column to ai_models table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'chatapp' AND table_name = 'ai_models' AND column_name = 'model_type') THEN
        ALTER TABLE chatapp.ai_models ADD COLUMN model_type ai_model_type NOT NULL DEFAULT 'chat';
    END IF;
END$$;

-- Done
SELECT 'Call feature schema applied successfully!' AS result;
