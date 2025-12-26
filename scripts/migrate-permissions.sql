-- Migration script to restructure permission system
-- WARNING: This will drop and recreate tables in the chatapp schema

-- Start transaction
BEGIN;

-- Step 1: Drop all tables in chatapp schema that have foreign key dependencies
-- Note: CASCADE will handle foreign key constraints

-- Drop tables in order of dependencies (child tables first)
DROP TABLE IF EXISTS chatapp.escalations CASCADE;
DROP TABLE IF EXISTS chatapp.escalation_assignments CASCADE;
DROP TABLE IF EXISTS chatapp.customer_sessions CASCADE;
DROP TABLE IF EXISTS chatapp.messages CASCADE;
DROP TABLE IF EXISTS chatapp.conversations CASCADE;
DROP TABLE IF EXISTS chatapp.customers CASCADE;
DROP TABLE IF EXISTS chatapp.knowledge_embeddings CASCADE;
DROP TABLE IF EXISTS chatapp.knowledge_chunks CASCADE;
DROP TABLE IF EXISTS chatapp.knowledge_sources CASCADE;
DROP TABLE IF EXISTS chatapp.agent_channels CASCADE;
DROP TABLE IF EXISTS chatapp.agent_versions CASCADE;
DROP TABLE IF EXISTS chatapp.agents CASCADE;
DROP TABLE IF EXISTS chatapp.agent_packages CASCADE;
DROP TABLE IF EXISTS chatapp.widget_configs CASCADE;
DROP TABLE IF EXISTS chatapp.integrations CASCADE;
DROP TABLE IF EXISTS chatapp.webhooks CASCADE;
DROP TABLE IF EXISTS chatapp.invitations CASCADE;
DROP TABLE IF EXISTS chatapp.audit_logs CASCADE;
DROP TABLE IF EXISTS chatapp.api_keys CASCADE;
DROP TABLE IF EXISTS chatapp.rate_limits CASCADE;
DROP TABLE IF EXISTS chatapp.usage_records CASCADE;
DROP TABLE IF EXISTS chatapp.channel_configs CASCADE;
DROP TABLE IF EXISTS chatapp.payment_history CASCADE;
DROP TABLE IF EXISTS chatapp.company_subscriptions CASCADE;
DROP TABLE IF EXISTS chatapp.subscription_plans CASCADE;
DROP TABLE IF EXISTS chatapp.magic_link_tokens CASCADE;
DROP TABLE IF EXISTS chatapp.device_sessions CASCADE;
DROP TABLE IF EXISTS chatapp.verification_tokens CASCADE;
DROP TABLE IF EXISTS chatapp.sessions CASCADE;
DROP TABLE IF EXISTS chatapp.accounts CASCADE;
DROP TABLE IF EXISTS chatapp.users CASCADE;
DROP TABLE IF EXISTS chatapp.companies CASCADE;
DROP TABLE IF EXISTS chatapp.company_permissions CASCADE;

-- Drop analytics tables
DROP TABLE IF EXISTS chatapp.conversation_analytics CASCADE;
DROP TABLE IF EXISTS chatapp.agent_analytics CASCADE;
DROP TABLE IF EXISTS chatapp.daily_analytics CASCADE;

-- Step 2: Drop existing enums
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.company_permission_role CASCADE;

-- Step 3: Create new enums
CREATE TYPE public.user_role AS ENUM ('chatapp.master_admin', 'chatapp.user');
CREATE TYPE public.company_permission_role AS ENUM ('chatapp.company_admin', 'chatapp.support_agent');

-- Step 4: Commit transaction
COMMIT;

-- Note: After running this script, run `pnpm drizzle-kit push` to recreate the tables
