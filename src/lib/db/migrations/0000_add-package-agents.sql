CREATE SCHEMA "chatapp";
--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('support', 'sales', 'general', 'custom');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'quarterly', 'semi_annual', 'annual');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('web', 'whatsapp', 'telegram', 'messenger', 'instagram', 'slack', 'teams', 'custom');--> statement-breakpoint
CREATE TYPE "public"."company_permission_role" AS ENUM('chatapp.company_admin', 'chatapp.support_agent');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('active', 'waiting_human', 'with_human', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."escalation_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."escalation_status" AS ENUM('pending', 'assigned', 'in_progress', 'resolved', 'returned_to_ai', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('slack', 'zapier', 'salesforce', 'hubspot', 'webhook', 'custom');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_status" AS ENUM('pending', 'processing', 'indexed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('file', 'url', 'text');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'human_agent', 'tool');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'file', 'audio', 'system_event');--> statement-breakpoint
CREATE TYPE "public"."package_agent_type" AS ENUM('worker', 'supervisor');--> statement-breakpoint
CREATE TYPE "public"."package_type" AS ENUM('single_agent', 'multi_agent');--> statement-breakpoint
CREATE TYPE "public"."resolution_type" AS ENUM('ai', 'human', 'abandoned', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'grace_period', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."support_agent_status" AS ENUM('online', 'busy', 'away', 'offline');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('chatapp.master_admin', 'chatapp.user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'pending', 'suspended');--> statement-breakpoint
CREATE TABLE "chatapp"."companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"logo_url" varchar(500),
	"primary_color" varchar(7) DEFAULT '#6437F3',
	"secondary_color" varchar(7) DEFAULT '#2b3dd8',
	"custom_domain" varchar(255),
	"custom_domain_verified" boolean DEFAULT false,
	"timezone" varchar(50) DEFAULT 'UTC',
	"locale" varchar(10) DEFAULT 'en',
	"settings" jsonb DEFAULT '{}'::jsonb,
	"status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"api_key_hash" varchar(255),
	"api_key_prefix" varchar(10),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "chatapp"."device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"device_type" varchar(50),
	"browser" varchar(100),
	"os" varchar(100),
	"ip_address" varchar(45),
	"location" varchar(255),
	"is_trusted" boolean DEFAULT false NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"name" varchar(255),
	"image" varchar(500),
	"hashed_password" varchar(255),
	"role" "user_role" DEFAULT 'chatapp.user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"ip_allowlist" jsonb DEFAULT '[]'::jsonb,
	"access_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."company_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "company_permission_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."company_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"current_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"grace_period_days" integer DEFAULT 7,
	"grace_period_ends_at" timestamp,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"conversations_used" integer DEFAULT 0 NOT NULL,
	"storage_used_mb" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."payment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(50) NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"invoice_url" varchar(500),
	"invoice_number" varchar(50),
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"max_agents" integer NOT NULL,
	"max_conversations_per_month" integer NOT NULL,
	"max_knowledge_sources" integer NOT NULL,
	"max_storage_gb" integer NOT NULL,
	"max_team_members" integer NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_branding" boolean DEFAULT false NOT NULL,
	"priority_support" boolean DEFAULT false NOT NULL,
	"api_access" boolean DEFAULT false NOT NULL,
	"advanced_analytics" boolean DEFAULT false NOT NULL,
	"custom_integrations" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"trial_days" integer DEFAULT 14 NOT NULL,
	"setup_fee" numeric(10, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."agent_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(100),
	"package_type" "package_type" DEFAULT 'single_agent' NOT NULL,
	"bundle_path" varchar(500),
	"bundle_version" varchar(50) DEFAULT '1.0.0',
	"bundle_checksum" varchar(64),
	"default_system_prompt" text DEFAULT '' NOT NULL,
	"default_model_id" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
	"default_temperature" integer DEFAULT 70 NOT NULL,
	"default_behavior" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"execution_config" jsonb DEFAULT '{"maxExecutionTimeMs":30000,"maxMemoryMb":128,"allowedNetworkDomains":[],"sandboxMode":true}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"changelog" text,
	"system_prompt" text NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"temperature" integer NOT NULL,
	"behavior" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"package_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "agent_type" DEFAULT 'support' NOT NULL,
	"status" "agent_status" DEFAULT 'draft' NOT NULL,
	"avatar_url" varchar(500),
	"system_prompt" text NOT NULL,
	"model_id" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
	"temperature" integer DEFAULT 70 NOT NULL,
	"behavior" jsonb DEFAULT '{"greeting":"Hello! How can I help you today?","fallbackMessage":"I am sorry, I do not understand. Let me connect you with a human agent.","maxTurnsBeforeEscalation":10,"autoEscalateOnSentiment":true,"sentimentThreshold":-0.5,"collectEmail":true,"collectName":true,"workingHours":null,"offlineMessage":"We are currently offline. Please leave a message and we will get back to you."}'::jsonb NOT NULL,
	"escalation_enabled" boolean DEFAULT true NOT NULL,
	"escalation_triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"business_hours" jsonb DEFAULT '{"enabled":false,"timezone":"UTC","schedule":{"monday":[{"start":"09:00","end":"17:00"}],"tuesday":[{"start":"09:00","end":"17:00"}],"wednesday":[{"start":"09:00","end":"17:00"}],"thursday":[{"start":"09:00","end":"17:00"}],"friday":[{"start":"09:00","end":"17:00"}],"saturday":[],"sunday":[]}}'::jsonb,
	"knowledge_source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"avg_resolution_time" integer,
	"satisfaction_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chatapp"."package_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"agent_identifier" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"designation" varchar(255),
	"agent_type" "package_agent_type" DEFAULT 'worker' NOT NULL,
	"system_prompt" text NOT NULL,
	"model_id" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
	"temperature" integer DEFAULT 70 NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"managed_agent_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."company_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"url" varchar(1000) NOT NULL,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"knowledge_source_id" uuid,
	"uploaded_by_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."faq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"not_helpful_count" integer DEFAULT 0 NOT NULL,
	"vector_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chatapp"."knowledge_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"slug" varchar(255) NOT NULL,
	"color" varchar(7),
	"icon" varchar(50),
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"vector_id" varchar(255),
	"start_offset" integer,
	"end_offset" integer,
	"page_number" integer,
	"section_title" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "knowledge_source_type" NOT NULL,
	"status" "knowledge_source_status" DEFAULT 'pending' NOT NULL,
	"category_id" uuid,
	"source_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"processing_error" text,
	"last_processed_at" timestamp,
	"vector_collection_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chatapp"."canned_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"shortcut" varchar(50),
	"content" text NOT NULL,
	"category" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_shared" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."conversation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"note_type" varchar(50) DEFAULT 'general' NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"end_user_id" uuid NOT NULL,
	"channel" "channel_type" DEFAULT 'web' NOT NULL,
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"subject" varchar(255),
	"assigned_user_id" uuid,
	"message_count" integer DEFAULT 0 NOT NULL,
	"user_message_count" integer DEFAULT 0 NOT NULL,
	"assistant_message_count" integer DEFAULT 0 NOT NULL,
	"resolution_type" "resolution_type",
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"sentiment" integer,
	"sentiment_history" jsonb DEFAULT '[]'::jsonb,
	"satisfaction_rating" integer,
	"satisfaction_feedback" text,
	"session_id" varchar(255),
	"page_url" varchar(500),
	"referrer" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chatapp"."end_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"external_id" varchar(255),
	"email" varchar(255),
	"phone" varchar(20),
	"name" varchar(255),
	"channel" "channel_type" DEFAULT 'web' NOT NULL,
	"channel_user_id" varchar(255),
	"avatar_url" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"user_agent" text,
	"ip_address" varchar(45),
	"location" jsonb DEFAULT '{}'::jsonb,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"status" "escalation_status" DEFAULT 'pending' NOT NULL,
	"priority" "escalation_priority" DEFAULT 'medium' NOT NULL,
	"assigned_user_id" uuid,
	"assigned_at" timestamp,
	"reason" text,
	"trigger_type" varchar(50),
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"resolution" text,
	"returned_to_ai" boolean DEFAULT false NOT NULL,
	"returned_at" timestamp,
	"wait_time" integer,
	"handle_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"user_id" uuid,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"model_id" varchar(100),
	"token_count" integer,
	"processing_time_ms" integer,
	"tool_calls" jsonb DEFAULT '[]'::jsonb,
	"tool_results" jsonb DEFAULT '[]'::jsonb,
	"source_chunk_ids" jsonb DEFAULT '[]'::jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."support_agent_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'offline' NOT NULL,
	"max_concurrent_chats" integer DEFAULT 5 NOT NULL,
	"current_chat_count" integer DEFAULT 0 NOT NULL,
	"last_status_change" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp,
	CONSTRAINT "support_agent_status_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"user_id" uuid,
	"user_email" varchar(255),
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"success" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" "integration_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "integration_status" DEFAULT 'inactive' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"webhook_url" varchar(500),
	"webhook_secret" varchar(255),
	"last_error" text,
	"last_error_at" timestamp,
	"error_count" jsonb DEFAULT '0'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"invited_by" uuid NOT NULL,
	"accepted_at" timestamp,
	"accepted_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) NOT NULL,
	"status_code" jsonb,
	"response_body" text,
	"error_message" text,
	"attempt" jsonb DEFAULT '1'::jsonb NOT NULL,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"duration_ms" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"url" varchar(500) NOT NULL,
	"secret" varchar(255),
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"max_retries" jsonb DEFAULT '3'::jsonb,
	"retry_delay_seconds" jsonb DEFAULT '60'::jsonb,
	"total_deliveries" jsonb DEFAULT '0'::jsonb,
	"successful_deliveries" jsonb DEFAULT '0'::jsonb,
	"failed_deliveries" jsonb DEFAULT '0'::jsonb,
	"last_delivery_at" timestamp,
	"last_delivery_status" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."widget_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"theme" varchar(20) DEFAULT 'light' NOT NULL,
	"position" varchar(20) DEFAULT 'bottom-right' NOT NULL,
	"primary_color" varchar(7) DEFAULT '#6437F3' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#2b3dd8' NOT NULL,
	"border_radius" varchar(10) DEFAULT '16' NOT NULL,
	"button_size" varchar(10) DEFAULT '60' NOT NULL,
	"title" varchar(100) DEFAULT 'Chat with us' NOT NULL,
	"subtitle" varchar(200),
	"welcome_message" text DEFAULT 'Hi there! How can we help you today?' NOT NULL,
	"offline_message" text DEFAULT 'We''re currently offline. Leave a message and we''ll get back to you.',
	"logo_url" varchar(500),
	"avatar_url" varchar(500),
	"company_name" varchar(100),
	"auto_open" boolean DEFAULT false NOT NULL,
	"auto_open_delay" varchar(10) DEFAULT '5' NOT NULL,
	"show_branding" boolean DEFAULT true NOT NULL,
	"play_sound_on_message" boolean DEFAULT true NOT NULL,
	"show_typing_indicator" boolean DEFAULT true NOT NULL,
	"persist_conversation" boolean DEFAULT true NOT NULL,
	"enable_file_upload" boolean DEFAULT false NOT NULL,
	"enable_voice_messages" boolean DEFAULT false NOT NULL,
	"enable_emoji" boolean DEFAULT true NOT NULL,
	"enable_feedback" boolean DEFAULT true NOT NULL,
	"require_email" boolean DEFAULT false NOT NULL,
	"require_name" boolean DEFAULT false NOT NULL,
	"custom_css" text,
	"allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"z_index" varchar(10) DEFAULT '9999' NOT NULL,
	"launcher_icon" varchar(50) DEFAULT 'chat' NOT NULL,
	"launcher_text" varchar(50),
	"hide_launcher_on_mobile" boolean DEFAULT false NOT NULL,
	"pre_chat_form" jsonb DEFAULT '{"enabled":false,"fields":[]}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "widget_configs_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."daily_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"date" date NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"new_conversations" integer DEFAULT 0 NOT NULL,
	"resolved_conversations" integer DEFAULT 0 NOT NULL,
	"escalated_conversations" integer DEFAULT 0 NOT NULL,
	"abandoned_conversations" integer DEFAULT 0 NOT NULL,
	"ai_resolved_count" integer DEFAULT 0 NOT NULL,
	"human_resolved_count" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"user_messages" integer DEFAULT 0 NOT NULL,
	"assistant_messages" integer DEFAULT 0 NOT NULL,
	"human_agent_messages" integer DEFAULT 0 NOT NULL,
	"avg_first_response_time" integer,
	"avg_response_time" integer,
	"avg_resolution_time" integer,
	"avg_satisfaction_score" numeric(3, 2),
	"satisfaction_responses" integer DEFAULT 0 NOT NULL,
	"avg_sentiment" integer,
	"positive_sentiment_count" integer DEFAULT 0 NOT NULL,
	"neutral_sentiment_count" integer DEFAULT 0 NOT NULL,
	"negative_sentiment_count" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"returning_users" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"channel_breakdown" jsonb DEFAULT '{}'::jsonb,
	"peak_hours" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."hourly_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"hour" timestamp NOT NULL,
	"conversations" integer DEFAULT 0 NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"escalations" integer DEFAULT 0 NOT NULL,
	"avg_response_time_ms" integer,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."platform_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"total_companies" integer DEFAULT 0 NOT NULL,
	"active_companies" integer DEFAULT 0 NOT NULL,
	"new_companies" integer DEFAULT 0 NOT NULL,
	"churned_companies" integer DEFAULT 0 NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"mrr" numeric(12, 2),
	"arr" numeric(12, 2),
	"new_mrr" numeric(12, 2),
	"churned_mrr" numeric(12, 2),
	"plan_distribution" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_analytics_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "chatapp"."topic_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"topic" varchar(255) NOT NULL,
	"category" varchar(100),
	"occurrences" integer DEFAULT 0 NOT NULL,
	"avg_sentiment" integer,
	"resolution_rate" numeric(5, 2),
	"avg_resolution_time" integer,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"sample_conversation_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_limit" integer DEFAULT 1000 NOT NULL,
	"rate_limit_window" integer DEFAULT 3600 NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."channel_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"channel" "channel_type" NOT NULL,
	"webhook_url" varchar(500),
	"webhook_secret" varchar(255),
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_connected_at" timestamp,
	"last_error_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."rate_limit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"identifier_type" varchar(50) NOT NULL,
	"company_id" uuid,
	"user_id" uuid,
	"api_key_id" uuid,
	"limit_type" varchar(50) NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"limit_value" integer NOT NULL,
	"is_exceeded" boolean DEFAULT false NOT NULL,
	"last_request_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatapp"."usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"usage_type" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"model_id" varchar(100),
	"resource_id" uuid,
	"resource_type" varchar(50),
	"unit_cost" integer DEFAULT 0,
	"total_cost" integer DEFAULT 0,
	"billing_period_start" timestamp,
	"billing_period_end" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chatapp"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."device_sessions" ADD CONSTRAINT "device_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."company_permissions" ADD CONSTRAINT "company_permissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."company_permissions" ADD CONSTRAINT "company_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."company_subscriptions" ADD CONSTRAINT "company_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "chatapp"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."payment_history" ADD CONSTRAINT "payment_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."payment_history" ADD CONSTRAINT "payment_history_subscription_id_company_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "chatapp"."company_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."agent_versions" ADD CONSTRAINT "agent_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."agents" ADD CONSTRAINT "agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."agents" ADD CONSTRAINT "agents_package_id_agent_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "chatapp"."agent_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."package_agents" ADD CONSTRAINT "package_agents_package_id_agent_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "chatapp"."agent_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."company_files" ADD CONSTRAINT "company_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."company_files" ADD CONSTRAINT "company_files_knowledge_source_id_knowledge_sources_id_fk" FOREIGN KEY ("knowledge_source_id") REFERENCES "chatapp"."knowledge_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."faq_items" ADD CONSTRAINT "faq_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."knowledge_categories" ADD CONSTRAINT "knowledge_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "chatapp"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."knowledge_sources" ADD CONSTRAINT "knowledge_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."knowledge_sources" ADD CONSTRAINT "knowledge_sources_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "chatapp"."knowledge_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."canned_responses" ADD CONSTRAINT "canned_responses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."canned_responses" ADD CONSTRAINT "canned_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversation_notes" ADD CONSTRAINT "conversation_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chatapp"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversation_notes" ADD CONSTRAINT "conversation_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversations" ADD CONSTRAINT "conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversations" ADD CONSTRAINT "conversations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversations" ADD CONSTRAINT "conversations_end_user_id_end_users_id_fk" FOREIGN KEY ("end_user_id") REFERENCES "chatapp"."end_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversations" ADD CONSTRAINT "conversations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."conversations" ADD CONSTRAINT "conversations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."end_users" ADD CONSTRAINT "end_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."escalations" ADD CONSTRAINT "escalations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chatapp"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."escalations" ADD CONSTRAINT "escalations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."escalations" ADD CONSTRAINT "escalations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "chatapp"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."support_agent_status" ADD CONSTRAINT "support_agent_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."integrations" ADD CONSTRAINT "integrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."invitations" ADD CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."invitations" ADD CONSTRAINT "invitations_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "chatapp"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."webhooks" ADD CONSTRAINT "webhooks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."widget_configs" ADD CONSTRAINT "widget_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."daily_analytics" ADD CONSTRAINT "daily_analytics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."daily_analytics" ADD CONSTRAINT "daily_analytics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."hourly_analytics" ADD CONSTRAINT "hourly_analytics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."hourly_analytics" ADD CONSTRAINT "hourly_analytics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."topic_analytics" ADD CONSTRAINT "topic_analytics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."api_keys" ADD CONSTRAINT "api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."api_keys" ADD CONSTRAINT "api_keys_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "chatapp"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."channel_configs" ADD CONSTRAINT "channel_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."channel_configs" ADD CONSTRAINT "channel_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."rate_limit_records" ADD CONSTRAINT "rate_limit_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."rate_limit_records" ADD CONSTRAINT "rate_limit_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "chatapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."rate_limit_records" ADD CONSTRAINT "rate_limit_records_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "chatapp"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."usage_records" ADD CONSTRAINT "usage_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "chatapp"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatapp"."usage_records" ADD CONSTRAINT "usage_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_slug_idx" ON "chatapp"."companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "chatapp"."companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "chatapp"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_provider_idx" ON "chatapp"."accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "device_sessions_user_idx" ON "chatapp"."device_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_sessions_token_idx" ON "chatapp"."device_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "magic_link_email_idx" ON "chatapp"."magic_link_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "magic_link_token_idx" ON "chatapp"."magic_link_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "chatapp"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "chatapp"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "chatapp"."users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "company_permissions_unique" ON "chatapp"."company_permissions" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "company_permissions_company_idx" ON "chatapp"."company_permissions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_permissions_user_idx" ON "chatapp"."company_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "company_subscriptions_company_idx" ON "chatapp"."company_subscriptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_subscriptions_plan_idx" ON "chatapp"."company_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "company_subscriptions_status_idx" ON "chatapp"."company_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_history_company_idx" ON "chatapp"."payment_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payment_history_subscription_idx" ON "chatapp"."payment_history" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payment_history_status_idx" ON "chatapp"."payment_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_plans_slug_idx" ON "chatapp"."subscription_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "subscription_plans_active_idx" ON "chatapp"."subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agent_packages_slug_idx" ON "chatapp"."agent_packages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "agent_packages_category_idx" ON "chatapp"."agent_packages" USING btree ("category");--> statement-breakpoint
CREATE INDEX "agent_packages_type_idx" ON "chatapp"."agent_packages" USING btree ("package_type");--> statement-breakpoint
CREATE INDEX "agent_versions_agent_idx" ON "chatapp"."agent_versions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_versions_version_idx" ON "chatapp"."agent_versions" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "agents_company_idx" ON "chatapp"."agents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agents_package_idx" ON "chatapp"."agents" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "chatapp"."agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agents_type_idx" ON "chatapp"."agents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "package_agents_package_idx" ON "chatapp"."package_agents" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_agents_identifier_idx" ON "chatapp"."package_agents" USING btree ("package_id","agent_identifier");--> statement-breakpoint
CREATE INDEX "package_agents_type_idx" ON "chatapp"."package_agents" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "company_files_company_idx" ON "chatapp"."company_files" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_files_category_idx" ON "chatapp"."company_files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "company_files_uploader_idx" ON "chatapp"."company_files" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "faq_items_company_idx" ON "chatapp"."faq_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "faq_items_category_idx" ON "chatapp"."faq_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "knowledge_categories_company_idx" ON "chatapp"."knowledge_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "knowledge_categories_slug_idx" ON "chatapp"."knowledge_categories" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "knowledge_categories_parent_idx" ON "chatapp"."knowledge_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "chatapp"."knowledge_chunks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_index_idx" ON "chatapp"."knowledge_chunks" USING btree ("source_id","chunk_index");--> statement-breakpoint
CREATE INDEX "knowledge_sources_company_idx" ON "chatapp"."knowledge_sources" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "knowledge_sources_type_idx" ON "chatapp"."knowledge_sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "knowledge_sources_status_idx" ON "chatapp"."knowledge_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "canned_responses_company_idx" ON "chatapp"."canned_responses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "canned_responses_user_idx" ON "chatapp"."canned_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "canned_responses_shortcut_idx" ON "chatapp"."canned_responses" USING btree ("company_id","shortcut");--> statement-breakpoint
CREATE INDEX "conversation_notes_conversation_idx" ON "chatapp"."conversation_notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_notes_user_idx" ON "chatapp"."conversation_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_notes_type_idx" ON "chatapp"."conversation_notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "conversations_company_idx" ON "chatapp"."conversations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "conversations_agent_idx" ON "chatapp"."conversations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "conversations_end_user_idx" ON "chatapp"."conversations" USING btree ("end_user_id");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "chatapp"."conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_assigned_user_idx" ON "chatapp"."conversations" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "chatapp"."conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "end_users_company_idx" ON "chatapp"."end_users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "end_users_email_idx" ON "chatapp"."end_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "end_users_external_id_idx" ON "chatapp"."end_users" USING btree ("company_id","external_id");--> statement-breakpoint
CREATE INDEX "end_users_channel_user_idx" ON "chatapp"."end_users" USING btree ("channel","channel_user_id");--> statement-breakpoint
CREATE INDEX "escalations_conversation_idx" ON "chatapp"."escalations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "escalations_status_idx" ON "chatapp"."escalations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escalations_assigned_user_idx" ON "chatapp"."escalations" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "escalations_priority_idx" ON "chatapp"."escalations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "chatapp"."messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_role_idx" ON "chatapp"."messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "chatapp"."messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_agent_status_user_idx" ON "chatapp"."support_agent_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_company_idx" ON "chatapp"."audit_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "chatapp"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "chatapp"."audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "chatapp"."audit_logs" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "chatapp"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "integrations_company_idx" ON "chatapp"."integrations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "integrations_type_idx" ON "chatapp"."integrations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "integrations_status_idx" ON "chatapp"."integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_company_idx" ON "chatapp"."invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "chatapp"."invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "chatapp"."invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "chatapp"."invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_idx" ON "chatapp"."webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "chatapp"."webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_created_at_idx" ON "chatapp"."webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhooks_company_idx" ON "chatapp"."webhooks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "webhooks_active_idx" ON "chatapp"."webhooks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "widget_configs_company_idx" ON "chatapp"."widget_configs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "daily_analytics_company_idx" ON "chatapp"."daily_analytics" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "daily_analytics_agent_idx" ON "chatapp"."daily_analytics" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "daily_analytics_date_idx" ON "chatapp"."daily_analytics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "daily_analytics_company_date_idx" ON "chatapp"."daily_analytics" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "hourly_analytics_company_idx" ON "chatapp"."hourly_analytics" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "hourly_analytics_hour_idx" ON "chatapp"."hourly_analytics" USING btree ("hour");--> statement-breakpoint
CREATE INDEX "hourly_analytics_company_hour_idx" ON "chatapp"."hourly_analytics" USING btree ("company_id","hour");--> statement-breakpoint
CREATE INDEX "platform_analytics_date_idx" ON "chatapp"."platform_analytics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "topic_analytics_company_idx" ON "chatapp"."topic_analytics" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "topic_analytics_date_idx" ON "chatapp"."topic_analytics" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "topic_analytics_topic_idx" ON "chatapp"."topic_analytics" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "api_keys_company_idx" ON "chatapp"."api_keys" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "chatapp"."api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_active_idx" ON "chatapp"."api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channel_configs_company_idx" ON "chatapp"."channel_configs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "channel_configs_agent_idx" ON "chatapp"."channel_configs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "channel_configs_channel_idx" ON "chatapp"."channel_configs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "channel_configs_agent_channel_idx" ON "chatapp"."channel_configs" USING btree ("agent_id","channel");--> statement-breakpoint
CREATE INDEX "rate_limit_records_identifier_idx" ON "chatapp"."rate_limit_records" USING btree ("identifier","identifier_type");--> statement-breakpoint
CREATE INDEX "rate_limit_records_window_idx" ON "chatapp"."rate_limit_records" USING btree ("window_start","window_end");--> statement-breakpoint
CREATE INDEX "rate_limit_records_company_idx" ON "chatapp"."rate_limit_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "usage_records_company_idx" ON "chatapp"."usage_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "usage_records_agent_idx" ON "chatapp"."usage_records" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "usage_records_type_idx" ON "chatapp"."usage_records" USING btree ("usage_type");--> statement-breakpoint
CREATE INDEX "usage_records_created_at_idx" ON "chatapp"."usage_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_records_billing_period_idx" ON "chatapp"."usage_records" USING btree ("company_id","billing_period_start","billing_period_end");