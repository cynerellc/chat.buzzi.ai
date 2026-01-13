# Call Feature Database Updates - DELTA CHANGES ONLY

**CRITICAL**: This document contains ONLY the database changes needed to add call features. It does NOT redefine existing tables or structures that already work correctly.

## Legend

- ✅ **EXISTING**: Database structures that already exist and work correctly
- ➕ **ADD**: New tables, columns, or data that need to be created
- 🔄 **MODIFY**: Existing structures that need to be extended
- ⚠️ **DO NOT MODIFY**: Existing database objects that must remain unchanged

---

## Part 1: What Already Exists (DO NOT MODIFY)

### ✅ chatbotType Enum - ALREADY EXISTS

**Location**: `chatbot_packages` table and `chatbots` table

**Current Implementation**:
```sql
-- ALREADY EXISTS - DO NOT MODIFY
chatbotType TEXT CHECK (chatbotType IN ('chat', 'call'))
```

**Status**: ✅ This enum is ALREADY implemented in both tables and supports both 'chat' and 'call' values.

**⚠️ IMPORTANT**: The original plan mistakenly suggested removing this enum. **DO NOT REMOVE OR MODIFY IT**. It already exists and works correctly.

---

### ✅ users.avatarUrl - ALREADY CORRECT TYPE

**Location**: `users` table

**Current Implementation**:
```sql
-- ALREADY EXISTS - DO NOT MODIFY
avatarUrl VARCHAR(500)
```

**Status**: ✅ This column is ALREADY `varchar(500)`, which is the correct type for storing URLs.

**⚠️ IMPORTANT**: **DO NOT MODIFY** this column. The type is already correct.

---

### ✅ Existing Tables - DO NOT REDEFINE

The following tables already exist and work correctly. **DO NOT MODIFY** their existing structures:

- ✅ `companies` - Tenant records with settings JSONB column
- ✅ `users` - User authentication and profiles
- ✅ `company_permissions` - User-company role junction
- ✅ `chatbot_packages` - Master admin chatbot templates (has chatbotType column)
- ✅ `chatbots` - Company chatbot instances (has chatbotType column)
- ✅ `conversations` - Chat session records
- ✅ `messages` - Chat message history
- ✅ `ai_models` - AI model configurations (will be EXTENDED with new column)
- ✅ `integrations` - Existing integration framework
- ✅ `webhooks` - Webhook configuration table
- ✅ All other existing tables in the schema

---

## Part 2: What to Add (New Tables)

### ➕ 1. call_integration_accounts Table - NEW

**Purpose**: Store company-wide integration credentials for Twilio, WhatsApp, and custom voice providers.

**Table Definition**:
```sql
CREATE TABLE chatapp.call_integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('twilio', 'whatsapp', 'custom')),
  account_name VARCHAR(255) NOT NULL,
  description TEXT,
  credentials JSONB NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  webhook_url VARCHAR(500),
  webhook_secret VARCHAR(255),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'error')) DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_call_integration_accounts_company_id ON chatapp.call_integration_accounts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_integration_accounts_account_type ON chatapp.call_integration_accounts(account_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_call_integration_accounts_status ON chatapp.call_integration_accounts(status) WHERE deleted_at IS NULL;
```

**Credentials JSONB Structure Examples**:

**Twilio**:
```json
{
  "accountSid": "AC...",
  "authToken": "...",
  "phoneNumber": "+1234567890"
}
```

**WhatsApp Business**:
```json
{
  "accessToken": "...",
  "phoneNumberId": "...",
  "businessAccountId": "...",
  "phoneNumber": "+1234567890"
}
```

**Multi-Tenancy**: All queries MUST filter by `company_id` for proper isolation.

---

### ➕ 2. calls Table - NEW

**Purpose**: Store call session records and metadata.

**Table Definition**:
```sql
CREATE TABLE chatapp.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id) ON DELETE CASCADE,
  end_user_id UUID REFERENCES chatapp.end_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES chatapp.conversations(id) ON DELETE SET NULL,
  call_sid VARCHAR(255) UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('web', 'whatsapp', 'twilio', 'custom')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer')) DEFAULT 'pending',
  from_number VARCHAR(50),
  to_number VARCHAR(50),
  duration INTEGER,
  recording_url VARCHAR(500),
  transcript_url VARCHAR(500),
  ai_provider VARCHAR(50),
  model_id VARCHAR(100),
  integration_account_id UUID REFERENCES chatapp.call_integration_accounts(id) ON DELETE SET NULL,
  summary TEXT,
  notes TEXT,
  call_quality INTEGER CHECK (call_quality BETWEEN 1 AND 5),
  sentiment_score INTEGER CHECK (sentiment_score BETWEEN -100 AND 100),
  error_message TEXT,
  error_code VARCHAR(50),
  started_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_calls_company_id ON chatapp.calls(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_calls_chatbot_id ON chatapp.calls(chatbot_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_calls_end_user_id ON chatapp.calls(end_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_calls_conversation_id ON chatapp.calls(conversation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_calls_call_sid ON chatapp.calls(call_sid) WHERE deleted_at IS NULL;
CREATE INDEX idx_calls_status ON chatapp.calls(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_calls_created_at ON chatapp.calls(created_at DESC) WHERE deleted_at IS NULL;
```

**Multi-Tenancy**: All queries MUST filter by `company_id` for proper isolation.

**Source Values**:
- `web` - Web widget call
- `whatsapp` - WhatsApp Business call
- `twilio` - Twilio phone call
- `custom` - Custom integration

**Status Values**:
- `pending` - Call initiated, not yet connected
- `ringing` - Call is ringing
- `in_progress` - Call is active
- `completed` - Call ended successfully
- `failed` - Call failed to connect or error occurred
- `no_answer` - Call was not answered

---

### ➕ 3. call_transcripts Table - NEW

**Purpose**: Store turn-by-turn call transcription with timing information.

**Table Definition**:
```sql
CREATE TABLE chatapp.call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER,
  audio_url VARCHAR(500),
  confidence DECIMAL(5, 4) CHECK (confidence BETWEEN 0 AND 1),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_transcripts_call_id ON chatapp.call_transcripts(call_id);
CREATE INDEX idx_call_transcripts_role ON chatapp.call_transcripts(role);
CREATE INDEX idx_call_transcripts_start_time ON chatapp.call_transcripts(call_id, start_time);
```

**Fields Explanation**:
- `start_time` - Milliseconds from call start when this segment began
- `end_time` - Milliseconds from call start when this segment ended
- `duration` - Duration of this segment in milliseconds
- `confidence` - Transcription confidence score (0.0 to 1.0)
- `metadata` - Provider-specific data (JSONB for flexibility)

**Sort Order**: Always order by `start_time ASC` when retrieving transcripts for a call.

---

## Part 3: What to Modify (Extend Existing Tables)

### 🔄 1. ai_models Table - ADD model_type Column

**Current Table**: `chatapp.ai_models` (ALREADY EXISTS)

**Change Required**: ➕ ADD new column `model_type`

**Migration SQL**:
```sql
-- Step 1: Add model_type column with default value
ALTER TABLE chatapp.ai_models
ADD COLUMN model_type TEXT CHECK (model_type IN ('chat', 'call', 'both')) DEFAULT 'chat';

-- Step 2: Update existing models to explicitly set model_type = 'chat'
UPDATE chatapp.ai_models
SET model_type = 'chat'
WHERE model_type IS NULL OR model_type = 'chat';
```

**⚠️ DO NOT**: Modify any other columns in the `ai_models` table. Only add the `model_type` column.

**Purpose**: Distinguish between chat-only models (GPT-5.2, Gemini 3 Pro, etc.) and call-only models (OpenAI Realtime API, Gemini Live API).

**Values**:
- `'chat'` - Model supports only text chat (default for existing models)
- `'call'` - Model supports only voice calls (new call models)
- `'both'` - Model supports both chat and calls (future hybrid models)

---

### 🔄 2. companies.settings JSONB - ADD features.callEnabled

**Current Table**: `chatapp.companies` (ALREADY EXISTS)

**Current Column**: `settings JSONB` (ALREADY EXISTS)

**Change Required**: ➕ ADD new property to JSONB structure

**JSONB Extension**:
```json
{
  "features": {
    "callEnabled": false  // ➕ ADD THIS
  }
}
```

**Migration Strategy**:
- **DO NOT** create new column
- **DO NOT** modify existing JSONB structure
- ➕ Simply ADD the new property when master admin enables call feature
- Default value: `false` (calls disabled until master admin enables)

**Implementation**:
When master admin enables call feature for a company, update:
```sql
UPDATE chatapp.companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features,callEnabled}',
  'true'::jsonb
)
WHERE id = $1;
```

---

### 🔄 3. chatbots.settings JSONB - ADD call Object

**Current Table**: `chatapp.chatbots` (ALREADY EXISTS)

**Current Column**: `settings JSONB` (ALREADY EXISTS)

**Change Required**: ➕ ADD new `call` object to JSONB structure

**JSONB Extension**:
```json
{
  "call": {  // ➕ ADD THIS ENTIRE OBJECT
    "voiceId": "alloy",
    "voiceProvider": "openai",
    "voiceSettings": {
      "pitch": 0,
      "speed": 1.0,
      "stability": 0.5
    },
    "callGreeting": "Hi, I'm your AI assistant. How can I help you today?",
    "endCallPhrase": "goodbye",
    "silenceTimeout": 180,
    "maxCallDuration": 600,
    "recordingEnabled": false,
    "transcriptionEnabled": true,
    "interruptionEnabled": true,
    "callButtonText": "Start Call",
    "callButtonColor": "#10b981",
    "callButtonPosition": "bottom-right",
    "vadThreshold": 0.5,
    "echoCancellation": true,
    "noiseSuppression": true
  }
}
```

**Field Descriptions**:

**Voice Configuration**:
- `voiceId` (string) - Selected voice identifier (e.g., "alloy", "echo", "fable")
- `voiceProvider` (string) - Voice provider ("openai", "google", "elevenlabs")
- `voiceSettings` (object):
  - `pitch` (number) - Voice pitch adjustment
  - `speed` (number) - Speaking speed (0.5 to 2.0)
  - `stability` (number) - Voice stability (0.0 to 1.0)

**Call Behavior**:
- `callGreeting` (string) - Agent greeting when call connects
- `endCallPhrase` (string) - Phrase that triggers call termination
- `silenceTimeout` (integer) - Seconds of silence before auto-disconnect (default: 180)
- `maxCallDuration` (integer) - Maximum call duration in seconds (default: 600)

**Features**:
- `recordingEnabled` (boolean) - Save call recordings (default: false)
- `transcriptionEnabled` (boolean) - Generate real-time transcripts (default: true)
- `interruptionEnabled` (boolean) - Allow user to interrupt agent (default: true)

**Widget Customization**:
- `callButtonText` (string) - Widget call button text
- `callButtonColor` (string) - Widget call button hex color
- `callButtonPosition` (string) - "bottom-right" | "bottom-left"

**Advanced Settings**:
- `vadThreshold` (number) - Voice activity detection sensitivity (0.0 to 1.0, default: 0.5)
- `echoCancellation` (boolean) - Enable echo cancellation (default: true)
- `noiseSuppression` (boolean) - Enable noise suppression (default: true)

**Migration Strategy**:
- **DO NOT** create new column
- **DO NOT** modify existing JSONB structure
- ➕ Simply ADD the new `call` object when company admin configures call settings
- These settings are ONLY used when `chatbots.chatbotType = 'call'`

---

### 🔄 4. chatbot_packages.settings JSONB - ADD enable_chat and enable_call Flags

**Current Table**: `chatapp.chatbot_packages` (ALREADY EXISTS)

**Current Column**: `settings JSONB` (ALREADY EXISTS)

**Change Required**: ➕ ADD new properties to control package capabilities

**JSONB Extension**:
```json
{
  "enable_chat": true,   // ➕ ADD THIS - default true for backward compatibility
  "enable_call": false   // ➕ ADD THIS - default false (opt-in feature)
}
```

**Purpose**:
- Master admin can create packages that support chat only, call only, or both
- When company admin creates chatbot from package, these flags are copied to chatbot record
- Allows creating specialized call-only agents or hybrid chat+call agents

**Default Values**:
- `enable_chat`: `true` (existing packages remain chat-enabled)
- `enable_call`: `false` (new feature, opt-in)

**Migration Strategy**:
```sql
-- Update existing packages to explicitly enable chat
UPDATE chatapp.chatbot_packages
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{enable_chat}',
  'true'::jsonb
)
WHERE settings->>'enable_chat' IS NULL;

-- Add enable_call flag (default false)
UPDATE chatapp.chatbot_packages
SET settings = jsonb_set(
  settings,
  '{enable_call}',
  'false'::jsonb
)
WHERE settings->>'enable_call' IS NULL;
```

---

## Part 4: Seed Data Changes

### ➕ Add 2 New Call Models

**Action**: INSERT 2 new AI models with `model_type = 'call'`

**SQL**:
```sql
-- ➕ OpenAI Realtime API
INSERT INTO chatapp.ai_models (
  id,
  provider,
  name,
  model_id,
  model_type,
  description,
  supports_function_calling,
  supports_vision,
  supports_streaming,
  context_window,
  max_output_tokens,
  cost_per_1m_input_tokens,
  cost_per_1m_output_tokens,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'openai',
  'OpenAI Realtime API',
  'gpt-4o-realtime-preview-2024-10-01',
  'call',  -- ➕ NEW: Call-only model
  'Real-time voice conversation model with low latency, server-side VAD, and interruption support',
  true,
  false,
  true,
  128000,
  4096,
  5.00,
  20.00,
  true,
  NOW(),
  NOW()
);

-- ➕ Gemini Live API
INSERT INTO chatapp.ai_models (
  id,
  provider,
  name,
  model_id,
  model_type,
  description,
  supports_function_calling,
  supports_vision,
  supports_streaming,
  context_window,
  max_output_tokens,
  cost_per_1m_input_tokens,
  cost_per_1m_output_tokens,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'google',
  'Gemini Live API',
  'gemini-2.0-flash-exp',
  'call',  -- ➕ NEW: Call-only model
  'Google Gemini Live API for real-time voice conversations with multimodal capabilities',
  true,
  true,
  true,
  1000000,
  8192,
  0.00,
  0.00,
  true,
  NOW(),
  NOW()
);
```

---

### 🔄 Update Existing 5 Chat Models

**Action**: UPDATE existing chat models to set `model_type = 'chat'`

**SQL**:
```sql
-- 🔄 Update existing models to explicitly set model_type = 'chat'
UPDATE chatapp.ai_models
SET model_type = 'chat'
WHERE model_id IN (
  'gpt-5.2',
  'gpt-5-mini',
  'gpt-5-nano',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview'
);
```

**⚠️ IMPORTANT**: Only update these 5 specific models. Do NOT modify any other fields or models.

---

## Part 5: Migration File Structure

### Migration File: `YYYYMMDDHHMMSS_add_call_features.ts`

**Complete Migration Steps** (in order):

```typescript
import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  // Step 1: Add model_type column to ai_models
  await db.execute(sql`
    ALTER TABLE chatapp.ai_models
    ADD COLUMN model_type TEXT CHECK (model_type IN ('chat', 'call', 'both')) DEFAULT 'chat';
  `);

  // Step 2: Update existing ai_models to set model_type = 'chat'
  await db.execute(sql`
    UPDATE chatapp.ai_models
    SET model_type = 'chat'
    WHERE model_type IS NULL;
  `);

  // Step 3: Create call_integration_accounts table
  await db.execute(sql`
    CREATE TABLE chatapp.call_integration_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
      account_type TEXT NOT NULL CHECK (account_type IN ('twilio', 'whatsapp', 'custom')),
      account_name VARCHAR(255) NOT NULL,
      description TEXT,
      credentials JSONB NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMP WITH TIME ZONE,
      webhook_url VARCHAR(500),
      webhook_secret VARCHAR(255),
      status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'error')) DEFAULT 'active',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_error TEXT,
      last_error_at TIMESTAMP WITH TIME ZONE,
      last_verified_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE
    );
  `);

  // Step 4: Create indexes for call_integration_accounts
  await db.execute(sql`
    CREATE INDEX idx_call_integration_accounts_company_id
    ON chatapp.call_integration_accounts(company_id) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_call_integration_accounts_account_type
    ON chatapp.call_integration_accounts(account_type) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_call_integration_accounts_status
    ON chatapp.call_integration_accounts(status) WHERE deleted_at IS NULL;
  `);

  // Step 5: Create calls table
  await db.execute(sql`
    CREATE TABLE chatapp.calls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
      chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id) ON DELETE CASCADE,
      end_user_id UUID REFERENCES chatapp.end_users(id) ON DELETE SET NULL,
      conversation_id UUID REFERENCES chatapp.conversations(id) ON DELETE SET NULL,
      call_sid VARCHAR(255) UNIQUE,
      source TEXT NOT NULL CHECK (source IN ('web', 'whatsapp', 'twilio', 'custom')),
      direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer')) DEFAULT 'pending',
      from_number VARCHAR(50),
      to_number VARCHAR(50),
      duration INTEGER,
      recording_url VARCHAR(500),
      transcript_url VARCHAR(500),
      ai_provider VARCHAR(50),
      model_id VARCHAR(100),
      integration_account_id UUID REFERENCES chatapp.call_integration_accounts(id) ON DELETE SET NULL,
      summary TEXT,
      notes TEXT,
      call_quality INTEGER CHECK (call_quality BETWEEN 1 AND 5),
      sentiment_score INTEGER CHECK (sentiment_score BETWEEN -100 AND 100),
      error_message TEXT,
      error_code VARCHAR(50),
      started_at TIMESTAMP WITH TIME ZONE,
      answered_at TIMESTAMP WITH TIME ZONE,
      ended_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE
    );
  `);

  // Step 6: Create indexes for calls
  await db.execute(sql`
    CREATE INDEX idx_calls_company_id ON chatapp.calls(company_id) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_calls_chatbot_id ON chatapp.calls(chatbot_id) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_calls_end_user_id ON chatapp.calls(end_user_id) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_calls_conversation_id ON chatapp.calls(conversation_id) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_calls_call_sid ON chatapp.calls(call_sid) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_calls_status ON chatapp.calls(status) WHERE deleted_at IS NULL;
  `);
  await db.execute(sql`
    CREATE INDEX idx_calls_created_at ON chatapp.calls(created_at DESC) WHERE deleted_at IS NULL;
  `);

  // Step 7: Create call_transcripts table
  await db.execute(sql`
    CREATE TABLE chatapp.call_transcripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      start_time INTEGER,
      end_time INTEGER,
      duration INTEGER,
      audio_url VARCHAR(500),
      confidence DECIMAL(5, 4) CHECK (confidence BETWEEN 0 AND 1),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // Step 8: Create indexes for call_transcripts
  await db.execute(sql`
    CREATE INDEX idx_call_transcripts_call_id ON chatapp.call_transcripts(call_id);
  `);
  await db.execute(sql`
    CREATE INDEX idx_call_transcripts_role ON chatapp.call_transcripts(role);
  `);
  await db.execute(sql`
    CREATE INDEX idx_call_transcripts_start_time ON chatapp.call_transcripts(call_id, start_time);
  `);

  // Step 9: Seed 2 new call models
  await db.execute(sql`
    INSERT INTO chatapp.ai_models (
      provider,
      name,
      model_id,
      model_type,
      description,
      supports_function_calling,
      supports_vision,
      supports_streaming,
      context_window,
      max_output_tokens,
      cost_per_1m_input_tokens,
      cost_per_1m_output_tokens,
      is_active
    ) VALUES
    (
      'openai',
      'OpenAI Realtime API',
      'gpt-4o-realtime-preview-2024-10-01',
      'call',
      'Real-time voice conversation model with low latency, server-side VAD, and interruption support',
      true,
      false,
      true,
      128000,
      4096,
      5.00,
      20.00,
      true
    ),
    (
      'google',
      'Gemini Live API',
      'gemini-2.0-flash-exp',
      'call',
      'Google Gemini Live API for real-time voice conversations with multimodal capabilities',
      true,
      true,
      true,
      1000000,
      8192,
      0.00,
      0.00,
      true
    );
  `);

  // Step 10: Update existing chat models
  await db.execute(sql`
    UPDATE chatapp.ai_models
    SET model_type = 'chat'
    WHERE model_id IN (
      'gpt-5.2',
      'gpt-5-mini',
      'gpt-5-nano',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview'
    );
  `);
}

export async function down() {
  // Rollback in reverse order

  // Step 10: Revert existing models (set model_type back to NULL/default)
  await db.execute(sql`
    UPDATE chatapp.ai_models
    SET model_type = DEFAULT
    WHERE model_id IN (
      'gpt-5.2',
      'gpt-5-mini',
      'gpt-5-nano',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview'
    );
  `);

  // Step 9: Delete seeded call models
  await db.execute(sql`
    DELETE FROM chatapp.ai_models
    WHERE model_id IN (
      'gpt-4o-realtime-preview-2024-10-01',
      'gemini-2.0-flash-exp'
    );
  `);

  // Step 8-7: Drop call_transcripts table (indexes drop automatically)
  await db.execute(sql`DROP TABLE IF EXISTS chatapp.call_transcripts;`);

  // Step 6-5: Drop calls table (indexes drop automatically)
  await db.execute(sql`DROP TABLE IF EXISTS chatapp.calls;`);

  // Step 4-3: Drop call_integration_accounts table (indexes drop automatically)
  await db.execute(sql`DROP TABLE IF EXISTS chatapp.call_integration_accounts;`);

  // Step 2-1: Remove model_type column from ai_models
  await db.execute(sql`
    ALTER TABLE chatapp.ai_models DROP COLUMN IF EXISTS model_type;
  `);
}
```

---

## Part 6: Drizzle Schema Definitions

### ➕ Add to /src/lib/db/schema/calls.ts (NEW FILE)

```typescript
import { pgTable, uuid, varchar, text, timestamp, integer, decimal, jsonb, boolean, check } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { chatbots } from './chatbots';
import { endUsers } from './end-users';
import { conversations } from './conversations';

// ➕ NEW TABLE
export const callIntegrationAccounts = pgTable('call_integration_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  accountType: text('account_type').notNull().$type<'twilio' | 'whatsapp' | 'custom'>(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  description: text('description'),
  credentials: jsonb('credentials').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  webhookUrl: varchar('webhook_url', { length: 500 }),
  webhookSecret: varchar('webhook_secret', { length: 255 }),
  status: text('status').notNull().default('active').$type<'active' | 'inactive' | 'error'>(),
  isActive: boolean('is_active').notNull().default(true),
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  accountTypeCheck: check('account_type_check', sql`${table.accountType} IN ('twilio', 'whatsapp', 'custom')`),
  statusCheck: check('status_check', sql`${table.status} IN ('active', 'inactive', 'error')`),
}));

// ➕ NEW TABLE
export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  chatbotId: uuid('chatbot_id').notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  endUserId: uuid('end_user_id').references(() => endUsers.id, { onDelete: 'set null' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  callSid: varchar('call_sid', { length: 255 }).unique(),
  source: text('source').notNull().$type<'web' | 'whatsapp' | 'twilio' | 'custom'>(),
  direction: varchar('direction', { length: 20 }).notNull().$type<'inbound' | 'outbound'>(),
  status: varchar('status', { length: 50 }).notNull().default('pending').$type<'pending' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'no_answer'>(),
  fromNumber: varchar('from_number', { length: 50 }),
  toNumber: varchar('to_number', { length: 50 }),
  duration: integer('duration'),
  recordingUrl: varchar('recording_url', { length: 500 }),
  transcriptUrl: varchar('transcript_url', { length: 500 }),
  aiProvider: varchar('ai_provider', { length: 50 }),
  modelId: varchar('model_id', { length: 100 }),
  integrationAccountId: uuid('integration_account_id').references(() => callIntegrationAccounts.id, { onDelete: 'set null' }),
  summary: text('summary'),
  notes: text('notes'),
  callQuality: integer('call_quality'),
  sentimentScore: integer('sentiment_score'),
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 50 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  sourceCheck: check('source_check', sql`${table.source} IN ('web', 'whatsapp', 'twilio', 'custom')`),
  directionCheck: check('direction_check', sql`${table.direction} IN ('inbound', 'outbound')`),
  statusCheck: check('status_check', sql`${table.status} IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer')`),
  qualityCheck: check('quality_check', sql`${table.callQuality} BETWEEN 1 AND 5`),
  sentimentCheck: check('sentiment_check', sql`${table.sentimentScore} BETWEEN -100 AND 100`),
}));

// ➕ NEW TABLE
export const callTranscripts = pgTable('call_transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'user' | 'assistant' | 'system'>(),
  content: text('content').notNull(),
  startTime: integer('start_time'),
  endTime: integer('end_time'),
  duration: integer('duration'),
  audioUrl: varchar('audio_url', { length: 500 }),
  confidence: decimal('confidence', { precision: 5, scale: 4 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  roleCheck: check('role_check', sql`${table.role} IN ('user', 'assistant', 'system')`),
  confidenceCheck: check('confidence_check', sql`${table.confidence} BETWEEN 0 AND 1`),
}));
```

---

### 🔄 Update /src/lib/db/schema/models.ts (EXISTING FILE)

**Current File**: `/src/lib/db/schema/models.ts` (ALREADY EXISTS)

**Change Required**: ➕ ADD `modelType` field to schema

**Add this field to the existing `aiModels` table definition**:

```typescript
// In the existing aiModels pgTable definition, ADD this field:
modelType: text('model_type')
  .notNull()
  .default('chat')
  .$type<'chat' | 'call' | 'both'>(),
```

**Full Context** (showing where to add it):
```typescript
export const aiModels = pgTable('ai_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  modelId: varchar('model_id', { length: 255 }).notNull(),

  // ➕ ADD THIS LINE:
  modelType: text('model_type').notNull().default('chat').$type<'chat' | 'call' | 'both'>(),

  description: text('description'),
  // ... rest of existing fields
});
```

**⚠️ DO NOT**: Modify any other parts of the file. Only add the `modelType` field.

---

## Part 7: Verification Checklist

After running the migration, verify the following:

### ✅ Verification Steps

1. **Verify chatbotType Still Exists**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'chatapp'
  AND table_name = 'chatbot_packages'
  AND column_name = 'chatbotType';

-- Expected: Should return one row with chatbotType column
```

2. **Verify users.avatarUrl Type**:
```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'chatapp'
  AND table_name = 'users'
  AND column_name = 'avatarUrl';

-- Expected: data_type = 'character varying', character_maximum_length = 500
```

3. **Verify model_type Column Added**:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'chatapp'
  AND table_name = 'ai_models'
  AND column_name = 'model_type';

-- Expected: Should return one row with model_type column, default 'chat'
```

4. **Verify New Tables Created**:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'chatapp'
  AND table_name IN ('call_integration_accounts', 'calls', 'call_transcripts');

-- Expected: Should return 3 rows
```

5. **Verify Indexes Created**:
```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'chatapp'
  AND tablename IN ('call_integration_accounts', 'calls', 'call_transcripts');

-- Expected: Should return 10+ rows (all indexes)
```

6. **Verify Call Models Seeded**:
```sql
SELECT model_id, model_type, name
FROM chatapp.ai_models
WHERE model_type = 'call';

-- Expected: Should return 2 rows (OpenAI Realtime API, Gemini Live API)
```

7. **Verify Existing Models Updated**:
```sql
SELECT model_id, model_type, name
FROM chatapp.ai_models
WHERE model_id IN (
  'gpt-5.2',
  'gpt-5-mini',
  'gpt-5-nano',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview'
);

-- Expected: Should return 5 rows, all with model_type = 'chat'
```

8. **Verify Multi-Tenancy Isolation**:
```sql
-- Create test company
INSERT INTO chatapp.companies (name) VALUES ('Test Company') RETURNING id;

-- Create test integration account
INSERT INTO chatapp.call_integration_accounts (
  company_id,
  account_type,
  account_name,
  credentials
) VALUES (
  'company_id_from_above',
  'twilio',
  'Test Account',
  '{"accountSid": "test"}'::jsonb
);

-- Verify can only query own company's accounts
SELECT * FROM chatapp.call_integration_accounts
WHERE company_id = 'company_id_from_above';

-- Clean up
DELETE FROM chatapp.companies WHERE name = 'Test Company';
```

---

## Part 8: Common Pitfalls to Avoid

### ⚠️ DO NOT DO THESE:

1. **DO NOT Remove chatbotType Enum**
   - ✅ It already exists and works correctly
   - ⚠️ Removing it will break existing chat functionality

2. **DO NOT Modify users.avatarUrl Type**
   - ✅ It's already `varchar(500)`, which is correct
   - ⚠️ Changing it will cause unnecessary migration issues

3. **DO NOT Redefine Existing Tables**
   - ✅ Only add new tables or extend existing ones
   - ⚠️ Redefining will cause conflicts and data loss

4. **DO NOT Modify Existing JSONB Structures**
   - ✅ Only ADD new properties to JSONB columns
   - ⚠️ Modifying existing properties will break current functionality

5. **DO NOT Create Separate enable_chat/enable_call Columns**
   - ✅ Use JSONB settings.enable_chat and settings.enable_call
   - ⚠️ Separate columns violate the existing JSONB pattern

6. **DO NOT Skip Multi-Tenancy Checks**
   - ✅ Always filter by company_id
   - ⚠️ Skipping will cause data leakage across companies

7. **DO NOT Modify Existing Chat Models Beyond model_type**
   - ✅ Only update model_type field for existing models
   - ⚠️ Changing other fields could affect existing chat functionality

---

## Summary

### ➕ What to ADD:
- 3 new tables: `call_integration_accounts`, `calls`, `call_transcripts`
- 1 new column: `ai_models.model_type`
- 2 new AI models: OpenAI Realtime API, Gemini Live API
- JSONB properties: `companies.settings.features.callEnabled`, `chatbots.settings.call`, `chatbot_packages.settings.enable_chat/enable_call`

### 🔄 What to MODIFY:
- Existing AI models: Set `model_type = 'chat'` for 5 chat models
- Existing JSONB structures: Extend with new properties (don't replace)

### ⚠️ What NOT to CHANGE:
- `chatbotType` enum (already exists, works correctly)
- `users.avatarUrl` column type (already correct)
- Existing table structures (only extend, don't modify)
- Existing chat execution code
- Existing conversation/message tables

---

**IMPORTANT REMINDERS**:

1. ✅ The `chatbotType` enum ALREADY EXISTS - DO NOT remove or modify it
2. ✅ The `users.avatarUrl` is ALREADY `varchar(500)` - DO NOT modify it
3. ➕ This migration ADDS new features, it does NOT replace existing ones
4. 🔄 JSONB extensions are additions, not replacements
5. ⚠️ Always test multi-tenancy isolation after migration
6. ⚠️ Verify existing chat functionality still works after migration

---

**Migration Validation Checklist**:

Before deploying:
- [ ] All new tables created with indexes
- [ ] model_type column added to ai_models
- [ ] 2 call models seeded successfully
- [ ] 5 existing chat models updated to model_type='chat'
- [ ] chatbotType enum still exists in both tables
- [ ] users.avatarUrl still varchar(500)
- [ ] Multi-tenancy working (company_id filtering)
- [ ] Foreign keys and cascades working
- [ ] Rollback tested successfully
- [ ] No impact on existing chat functionality
