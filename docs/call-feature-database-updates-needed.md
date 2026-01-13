# Call Feature Database Updates - Complete Schema Changes

## Document Purpose

This document provides comprehensive database schema changes, migration strategy, and data structure specifications required to integrate voice call capabilities into the chat.buzzi.ai multi-tenant platform.

---

## Schema Changes Overview

### Summary of Database Modifications

The call feature integration requires modifications to existing tables and creation of new tables to support:

1. **Capability-Based Architecture**: Replace single chatbotType column with dual boolean flags (enable_chat, enable_call) for flexible chatbot capabilities
2. **Integration Management**: New integration_accounts table for company-wide third-party service credentials (Twilio, WhatsApp Business)
3. **Call Session Tracking**: New calls table to record all call sessions with metadata, duration, and outcomes
4. **Transcript Storage**: New call_transcripts table for turn-by-turn call transcription with timing information
5. **AI Model Classification**: Add model_type field to ai_models table to distinguish chat vs call vs hybrid models
6. **Extended User Data**: Change users.avatar_url from varchar(500) to text to support longer URLs (data URIs, CDN paths with tokens)
7. **Feature Flags**: Add callEnabled flag to companies.settings.features for master admin control
8. **Call Configuration**: Extend chatbots.settings JSONB with comprehensive call settings object

### Migration Dependencies

**Critical**: Migrations must be executed in the exact order specified to maintain referential integrity and avoid data loss.

```
Migration Order:
1. Update users.avatar_url type (independent change)
2. Add enable_chat, enable_call to chatbot_packages (new columns)
3. Add enabled_chat, enabled_call to chatbots (new columns)
4. Backfill existing chatbots with enabled_chat=true (preserve behavior)
5. Remove chatbotType from chatbot_packages (cleanup)
6. Remove chatbotType from chatbots (cleanup)
7. Add model_type to ai_models (new column)
8. Backfill existing ai_models with model_type='chat' (default)
9. Create integration_accounts table (new table)
10. Create calls table (new table)
11. Create call_transcripts table (new table, depends on calls)
12. Update companies.settings JSONB structure (data migration)
13. Seed call-capable AI models (data seeding)
```

### Tables Affected

**Modified Tables**:
- `chatapp.users` - Type change on avatar_url
- `chatapp.chatbot_packages` - Remove chatbotType, add enable_chat, enable_call
- `chatapp.chatbots` - Remove chatbotType, add enabled_chat, enabled_call
- `chatapp.ai_models` - Add model_type column
- `chatapp.companies` - Extend settings JSONB with callEnabled flag
- `chatapp.chatbots` (settings) - Extend settings JSONB with call configuration object

**New Tables**:
- `chatapp.integration_accounts` - Company-wide integration credentials
- `chatapp.calls` - Call session records
- `chatapp.call_transcripts` - Turn-by-turn call transcripts

---

## 1. Remove chatbotType Column

### Background

The current implementation uses a chatbotType enum column to distinguish between 'chat' and 'call' chatbot types. This creates an artificial constraint where a chatbot can only support one capability. The new architecture uses dual boolean flags to enable chatbots that support:
- Chat only (enable_chat=true, enable_call=false)
- Call only (enable_chat=false, enable_call=true)
- Both chat and call (enable_chat=true, enable_call=true)

### Tables Affected

1. **chatapp.chatbot_packages**
   - Current: `chatbotType` varchar(50) or enum ('chat', 'call')
   - Action: DROP COLUMN after capability flags are added and backfilled

2. **chatapp.chatbots**
   - Current: `chatbotType` varchar(50) or enum ('chat', 'call')
   - Action: DROP COLUMN after capability flags are added and backfilled

### Migration Steps

**Step 1: Verify Current Usage**
```sql
-- Check distribution of chatbotType values in packages
SELECT chatbotType, COUNT(*) as count
FROM chatapp.chatbot_packages
WHERE deletedAt IS NULL
GROUP BY chatbotType;

-- Check distribution of chatbotType values in chatbots
SELECT chatbotType, COUNT(*) as count
FROM chatapp.chatbots
WHERE deletedAt IS NULL
GROUP BY chatbotType;
```

**Step 2: Add New Capability Flags First**
(See next section for detailed migration)

**Step 3: Backfill Based on chatbotType**
```sql
-- For chatbot_packages: Map chatbotType to capability flags
UPDATE chatapp.chatbot_packages
SET
  enable_chat = CASE
    WHEN chatbotType = 'chat' THEN true
    WHEN chatbotType = 'call' THEN false
    ELSE true -- Default to chat if null or unknown
  END,
  enable_call = CASE
    WHEN chatbotType = 'call' THEN true
    WHEN chatbotType = 'chat' THEN false
    ELSE false -- Default to no call capability
  END
WHERE deletedAt IS NULL;

-- For chatbots: Map chatbotType to capability flags
UPDATE chatapp.chatbots
SET
  enabled_chat = CASE
    WHEN chatbotType = 'chat' THEN true
    WHEN chatbotType = 'call' THEN false
    ELSE true
  END,
  enabled_call = CASE
    WHEN chatbotType = 'call' THEN true
    WHEN chatbotType = 'chat' THEN false
    ELSE false
  END
WHERE deletedAt IS NULL;
```

**Step 4: Verify Backfill**
```sql
-- Ensure all non-deleted records have capability flags set
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN enable_chat THEN 1 ELSE 0 END) as chat_enabled,
  SUM(CASE WHEN enable_call THEN 1 ELSE 0 END) as call_enabled,
  SUM(CASE WHEN enable_chat AND enable_call THEN 1 ELSE 0 END) as both_enabled
FROM chatapp.chatbot_packages
WHERE deletedAt IS NULL;

SELECT
  COUNT(*) as total,
  SUM(CASE WHEN enabled_chat THEN 1 ELSE 0 END) as chat_enabled,
  SUM(CASE WHEN enabled_call THEN 1 ELSE 0 END) as call_enabled,
  SUM(CASE WHEN enabled_chat AND enabled_call THEN 1 ELSE 0 END) as both_enabled
FROM chatapp.chatbots
WHERE deletedAt IS NULL;
```

**Step 5: Remove chatbotType Column**
```sql
-- Drop from chatbot_packages
ALTER TABLE chatapp.chatbot_packages
DROP COLUMN chatbotType;

-- Drop from chatbots
ALTER TABLE chatapp.chatbots
DROP COLUMN chatbotType;
```

### Code References to Update

After removing the chatbotType column, search and update all code references:

**TypeScript Types**:
- Remove `chatbotType: 'chat' | 'call'` from type definitions
- Add `enableChat: boolean` and `enableCall: boolean` to ChatbotPackage type
- Add `enabledChat: boolean` and `enabledCall: boolean` to Chatbot type

**Database Queries**:
- Search for: `WHERE chatbotType =`, `SELECT chatbotType`, `INSERT ... chatbotType`
- Replace with capability flag checks: `WHERE enabled_chat = true AND enabled_call = true`

**Enum Usage**:
- Remove ChatbotTypeEnum if defined as TypeScript enum or Zod enum
- Update Drizzle schema definitions

**Forms and UI**:
- Replace chatbotType dropdown with two checkboxes: "Enable Chat" and "Enable Call"
- Update validation to ensure at least one capability is enabled

### Rollback Strategy

If rollback is required:

```sql
-- Re-add chatbotType column
ALTER TABLE chatapp.chatbot_packages
ADD COLUMN chatbotType VARCHAR(50);

ALTER TABLE chatapp.chatbots
ADD COLUMN chatbotType VARCHAR(50);

-- Restore values from capability flags
UPDATE chatapp.chatbot_packages
SET chatbotType = CASE
  WHEN enable_chat AND enable_call THEN 'chat' -- Prioritize chat for hybrid
  WHEN enable_call THEN 'call'
  ELSE 'chat'
END
WHERE deletedAt IS NULL;

UPDATE chatapp.chatbots
SET chatbotType = CASE
  WHEN enabled_chat AND enabled_call THEN 'chat'
  WHEN enabled_call THEN 'call'
  ELSE 'chat'
END
WHERE deletedAt IS NULL;

-- Add NOT NULL constraint if needed
ALTER TABLE chatapp.chatbot_packages
ALTER COLUMN chatbotType SET NOT NULL;

ALTER TABLE chatapp.chatbots
ALTER COLUMN chatbotType SET NOT NULL;
```

---

## 2. Add Capability Flags

### Purpose

Enable fine-grained control over chatbot capabilities with independent boolean flags for chat and call features. This architecture allows:
- Future expansion to additional capabilities (email, SMS, etc.) without schema changes
- A/B testing of features by enabling/disabling capabilities per chatbot
- Gradual rollout of call features to specific chatbots
- Dual-mode chatbots that support both chat and call interactions

### Schema Changes

#### chatbot_packages Table

**New Columns**:

```sql
ALTER TABLE chatapp.chatbot_packages
ADD COLUMN enable_chat BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN enable_call BOOLEAN NOT NULL DEFAULT false;
```

**Column Specifications**:
- `enable_chat` (boolean, NOT NULL, default: true)
  - Purpose: Master admin configures whether chatbots created from this package can handle text chat
  - Default: true (preserve existing behavior - all packages support chat by default)
  - Use Case: Master admin can create call-only packages by setting enable_chat=false

- `enable_call` (boolean, NOT NULL, default: false)
  - Purpose: Master admin configures whether chatbots created from this package can handle voice calls
  - Default: false (call feature is opt-in, not enabled by default)
  - Use Case: Master admin explicitly enables call capability for premium packages

**Constraints**:
```sql
-- Ensure at least one capability is enabled
ALTER TABLE chatapp.chatbot_packages
ADD CONSTRAINT chatbot_packages_capability_check
CHECK (enable_chat = true OR enable_call = true);
```

**Index** (optional, for query optimization):
```sql
-- Index for filtering packages by capabilities
CREATE INDEX idx_chatbot_packages_capabilities
ON chatapp.chatbot_packages(enable_chat, enable_call)
WHERE deletedAt IS NULL;
```

#### chatbots Table

**New Columns**:

```sql
ALTER TABLE chatapp.chatbots
ADD COLUMN enabled_chat BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN enabled_call BOOLEAN NOT NULL DEFAULT false;
```

**Column Specifications**:
- `enabled_chat` (boolean, NOT NULL, default: true)
  - Purpose: Indicates whether this specific chatbot instance handles text chat
  - Inherited From: Copied from chatbot_packages.enable_chat on chatbot creation
  - Override: Company admin can toggle this (if allowed by business rules)
  - Default: true (preserve existing behavior)

- `enabled_call` (boolean, NOT NULL, default: false)
  - Purpose: Indicates whether this specific chatbot instance handles voice calls
  - Inherited From: Copied from chatbot_packages.enable_call on chatbot creation
  - Override: Company admin can toggle this (if allowed by business rules)
  - Default: false (call feature is opt-in)

**Constraints**:
```sql
-- Ensure at least one capability is enabled
ALTER TABLE chatapp.chatbots
ADD CONSTRAINT chatbots_capability_check
CHECK (enabled_chat = true OR enabled_call = true);
```

**Index** (for query optimization):
```sql
-- Index for filtering chatbots by capabilities (commonly used in widget API)
CREATE INDEX idx_chatbots_capabilities
ON chatapp.chatbots(enabled_chat, enabled_call)
WHERE deletedAt IS NULL;

-- Index for company admin dashboard queries
CREATE INDEX idx_chatbots_company_capabilities
ON chatapp.chatbots(company_id, enabled_chat, enabled_call)
WHERE deletedAt IS NULL;
```

### Migration Steps

**Step 1: Add Columns with Defaults**
```sql
-- Add to chatbot_packages
ALTER TABLE chatapp.chatbot_packages
ADD COLUMN enable_chat BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN enable_call BOOLEAN NOT NULL DEFAULT false;

-- Add to chatbots
ALTER TABLE chatapp.chatbots
ADD COLUMN enabled_chat BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN enabled_call BOOLEAN NOT NULL DEFAULT false;
```

**Step 2: Backfill Existing Records**
```sql
-- For chatbot_packages: Set enable_chat=true for all existing packages
-- (This is already done by the DEFAULT value, but explicit update for clarity)
UPDATE chatapp.chatbot_packages
SET
  enable_chat = true,
  enable_call = false
WHERE deletedAt IS NULL;

-- For chatbots: Set enabled_chat=true for all existing chatbots
UPDATE chatapp.chatbots
SET
  enabled_chat = true,
  enabled_call = false
WHERE deletedAt IS NULL;
```

**Step 3: Add Constraints**
```sql
-- Add check constraint to chatbot_packages
ALTER TABLE chatapp.chatbot_packages
ADD CONSTRAINT chatbot_packages_capability_check
CHECK (enable_chat = true OR enable_call = true);

-- Add check constraint to chatbots
ALTER TABLE chatapp.chatbots
ADD CONSTRAINT chatbots_capability_check
CHECK (enabled_chat = true OR enabled_call = true);
```

**Step 4: Create Indexes**
```sql
CREATE INDEX idx_chatbot_packages_capabilities
ON chatapp.chatbot_packages(enable_chat, enable_call)
WHERE deletedAt IS NULL;

CREATE INDEX idx_chatbots_capabilities
ON chatapp.chatbots(enabled_chat, enabled_call)
WHERE deletedAt IS NULL;

CREATE INDEX idx_chatbots_company_capabilities
ON chatapp.chatbots(company_id, enabled_chat, enabled_call)
WHERE deletedAt IS NULL;
```

### Default Values Rationale

**enable_chat / enabled_chat = true (default)**:
- Preserves current behavior where all chatbots support text chat
- Ensures backward compatibility with existing chatbots
- Prevents breaking changes for companies that don't need call features
- New chatbots default to chat-enabled unless explicitly configured otherwise

**enable_call / enabled_call = false (default)**:
- Call feature is opt-in, not enabled by default
- Requires master admin to explicitly enable in package definition
- Requires company admin to configure call settings before use
- Prevents accidental call feature activation without proper setup
- Ensures companies are aware of potential additional costs (OpenAI Realtime, Gemini Live, Twilio, WhatsApp fees)

### Inheritance Pattern: Package → Chatbot

When a new chatbot is created from a package:

```typescript
// Pseudo-code for chatbot creation logic
const chatbot = {
  ...otherFields,
  enabled_chat: package.enable_chat,  // Copy from package
  enabled_call: package.enable_call,  // Copy from package
};
```

**Override Rules**:
- Company admin CANNOT enable a capability that the package doesn't allow
  - If package.enable_call = false, chatbot cannot have enabled_call = true
- Company admin CAN disable a capability that the package allows
  - If package.enable_call = true, chatbot can choose enabled_call = false or true
- Validation enforced at API layer and database constraint level

### Usage in Application Logic

**Widget API** (`/api/widget/config`):
```typescript
// Return configuration based on chatbot capabilities
const config = {
  chatEnabled: chatbot.enabled_chat,
  callEnabled: chatbot.enabled_call,
  // Widget shows chat button if chatEnabled=true
  // Widget shows call button if callEnabled=true
};
```

**Chatbot Settings UI**:
```typescript
// Conditionally render tabs based on capabilities
{chatbot.enabled_chat && <ChatSettingsTab />}
{chatbot.enabled_call && <CallSettingsTab />}
```

**Package Creation Form**:
```typescript
// Master admin selects capabilities
<Checkbox
  label="Enable Chat"
  checked={enableChat}
  onChange={setEnableChat}
/>
<Checkbox
  label="Enable Call"
  checked={enableCall}
  onChange={setEnableCall}
/>
```

**Query Examples**:
```sql
-- Find all chatbots with call capability enabled
SELECT * FROM chatapp.chatbots
WHERE enabled_call = true
  AND deletedAt IS NULL;

-- Find packages that support both chat and call
SELECT * FROM chatapp.chatbot_packages
WHERE enable_chat = true
  AND enable_call = true
  AND deletedAt IS NULL;

-- Find call-only chatbots
SELECT * FROM chatapp.chatbots
WHERE enabled_call = true
  AND enabled_chat = false
  AND deletedAt IS NULL;
```

### Rollback Strategy

```sql
-- Remove constraints
ALTER TABLE chatapp.chatbot_packages
DROP CONSTRAINT IF EXISTS chatbot_packages_capability_check;

ALTER TABLE chatapp.chatbots
DROP CONSTRAINT IF EXISTS chatbots_capability_check;

-- Drop indexes
DROP INDEX IF EXISTS chatapp.idx_chatbot_packages_capabilities;
DROP INDEX IF EXISTS chatapp.idx_chatbots_capabilities;
DROP INDEX IF EXISTS chatapp.idx_chatbots_company_capabilities;

-- Remove columns
ALTER TABLE chatapp.chatbot_packages
DROP COLUMN enable_chat,
DROP COLUMN enable_call;

ALTER TABLE chatapp.chatbots
DROP COLUMN enabled_chat,
DROP COLUMN enabled_call;
```

---

## 3. Update users Table

### Purpose

Extend the avatar_url column to support longer URLs that include:
- Data URIs for inline base64-encoded images (can exceed 10KB encoded)
- CDN URLs with authentication tokens and query parameters
- Signed URLs from services like AWS S3, Cloudflare R2 (often >500 characters)
- OAuth provider profile images with long access tokens in URL

### Current Schema

```sql
-- Current definition
avatar_url VARCHAR(500)
```

**Limitation**: Many modern avatar systems generate URLs exceeding 500 characters:
- AWS S3 presigned URLs: ~600-800 characters
- Data URIs: `data:image/png;base64,iVBORw0KG...` (can be 10KB+)
- Social OAuth URLs with tokens: 500-1000 characters

### Schema Change

```sql
ALTER TABLE chatapp.users
ALTER COLUMN avatar_url TYPE TEXT;
```

**New Column Specification**:
- `avatar_url` (text, nullable)
  - Purpose: Store user profile avatar URL or data URI
  - Type: TEXT (unlimited length in PostgreSQL, practical limit ~1GB but typically <100KB)
  - Nullable: Yes (users may not have avatars)
  - Index: No index needed (not used in WHERE clauses typically)

### Migration Steps

**Step 1: Analyze Current Data**
```sql
-- Check for any URLs approaching the 500 character limit
SELECT
  id,
  LENGTH(avatar_url) as url_length,
  LEFT(avatar_url, 100) as url_preview
FROM chatapp.users
WHERE avatar_url IS NOT NULL
  AND LENGTH(avatar_url) > 400
ORDER BY LENGTH(avatar_url) DESC
LIMIT 20;

-- Check total count and max length
SELECT
  COUNT(*) as total_users,
  COUNT(avatar_url) as users_with_avatar,
  MAX(LENGTH(avatar_url)) as max_url_length,
  AVG(LENGTH(avatar_url)) as avg_url_length
FROM chatapp.users;
```

**Step 2: Perform Type Change**
```sql
-- This is a safe operation in PostgreSQL (no data loss)
-- VARCHAR(N) to TEXT is always safe since TEXT can hold more data
ALTER TABLE chatapp.users
ALTER COLUMN avatar_url TYPE TEXT;
```

**Step 3: Verify Change**
```sql
-- Confirm column type change
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'chatapp'
  AND table_name = 'users'
  AND column_name = 'avatar_url';

-- Should return: data_type = 'text', character_maximum_length = NULL
```

### Performance Considerations

**Storage**: TEXT columns in PostgreSQL use TOAST (The Oversized-Attribute Storage Technique) for values >2KB. This is transparent and efficient.

**Indexing**: No index needed on avatar_url since:
- Not used in WHERE clauses
- Not used in JOINs
- Only accessed via SELECT for display purposes

**Application Impact**: None. TEXT and VARCHAR are compatible types in PostgreSQL. No application code changes required.

### Rollback Strategy

```sql
-- Check if any URLs exceed 500 characters before rollback
SELECT COUNT(*)
FROM chatapp.users
WHERE LENGTH(avatar_url) > 500;

-- If count is 0, safe to rollback
ALTER TABLE chatapp.users
ALTER COLUMN avatar_url TYPE VARCHAR(500);

-- If count > 0, truncate or reject rollback
-- Option 1: Truncate long URLs (data loss)
UPDATE chatapp.users
SET avatar_url = LEFT(avatar_url, 500)
WHERE LENGTH(avatar_url) > 500;

ALTER TABLE chatapp.users
ALTER COLUMN avatar_url TYPE VARCHAR(500);

-- Option 2: Reject rollback and keep TEXT type
```

---

## 4. Update ai_models Table

### Purpose

Classify AI models by their capability to support chat, call, or both interaction types. This enables:
- Filtering models in UI dropdowns (show only call-capable models in call settings)
- Cost optimization (call models typically more expensive than chat models)
- Provider-specific model selection (OpenAI Realtime for calls, GPT-4 for chat)
- Future-proofing for new model types (vision, multimodal, etc.)

### Current Schema

The ai_models table currently lacks a field to distinguish between chat and call models. All models are treated equally.

### Schema Change

```sql
ALTER TABLE chatapp.ai_models
ADD COLUMN model_type VARCHAR(20) NOT NULL DEFAULT 'chat'
  CHECK (model_type IN ('chat', 'call', 'both'));
```

**New Column Specification**:
- `model_type` (varchar(20), NOT NULL, default: 'chat')
  - Purpose: Classify model by supported interaction type
  - Values:
    - `'chat'`: Text-based chat models (GPT-4, Claude, Gemini Pro)
    - `'call'`: Voice call models (OpenAI Realtime, Gemini Live)
    - `'both'`: Hybrid models that support both chat and call (future-proofing)
  - Default: 'chat' (preserve existing behavior, all current models are chat models)
  - Constraint: CHECK ensures only valid values
  - Index: Yes (for filtering in dropdowns)

### Migration Steps

**Step 1: Add Column with Default**
```sql
-- Add column with 'chat' as default for existing models
ALTER TABLE chatapp.ai_models
ADD COLUMN model_type VARCHAR(20) NOT NULL DEFAULT 'chat';

-- Add CHECK constraint
ALTER TABLE chatapp.ai_models
ADD CONSTRAINT ai_models_model_type_check
CHECK (model_type IN ('chat', 'call', 'both'));
```

**Step 2: Backfill Existing Models**
```sql
-- All existing models default to 'chat'
-- This is already handled by the DEFAULT value, but explicit update for clarity
UPDATE chatapp.ai_models
SET model_type = 'chat'
WHERE model_type IS NULL;
```

**Step 3: Create Index**
```sql
-- Index for filtering models by type in UI dropdowns
CREATE INDEX idx_ai_models_model_type
ON chatapp.ai_models(model_type, provider)
WHERE deletedAt IS NULL;
```

### Model Categorization Examples

**Chat Models** (model_type = 'chat'):
```sql
-- OpenAI Chat Models
INSERT INTO chatapp.ai_models (provider, model_type, model_name, display_name) VALUES
('openai', 'chat', 'gpt-4-turbo', 'GPT-4 Turbo'),
('openai', 'chat', 'gpt-4', 'GPT-4'),
('openai', 'chat', 'gpt-3.5-turbo', 'GPT-3.5 Turbo');

-- Anthropic Chat Models
INSERT INTO chatapp.ai_models (provider, model_type, model_name, display_name) VALUES
('anthropic', 'chat', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet'),
('anthropic', 'chat', 'claude-3-opus-20240229', 'Claude 3 Opus'),
('anthropic', 'chat', 'claude-3-haiku-20240307', 'Claude 3 Haiku');

-- Google Chat Models
INSERT INTO chatapp.ai_models (provider, model_type, model_name, display_name) VALUES
('google', 'chat', 'gemini-1.5-pro', 'Gemini 1.5 Pro'),
('google', 'chat', 'gemini-1.5-flash', 'Gemini 1.5 Flash'),
('google', 'chat', 'gemini-pro', 'Gemini Pro');
```

**Call Models** (model_type = 'call'):
```sql
-- OpenAI Realtime Models
INSERT INTO chatapp.ai_models (provider, model_type, model_name, display_name, supports_audio) VALUES
('openai', 'call', 'gpt-4o-realtime-preview-2024-10-01', 'GPT-4 Realtime (Preview)', true),
('openai', 'call', 'gpt-4o-realtime-preview', 'GPT-4 Realtime Latest', true);

-- Google Gemini Live Models
INSERT INTO chatapp.ai_models (provider, model_type, model_name, display_name, supports_audio) VALUES
('google', 'call', 'gemini-2.0-flash-exp', 'Gemini 2.0 Flash (Live)', true);
```

**Hybrid Models** (model_type = 'both'):
```sql
-- Future: Models that support both text chat and voice calls
-- Example: Gemini Multimodal (if it supports both chat and live voice)
INSERT INTO chatapp.ai_models (provider, model_type, model_name, display_name, supports_audio) VALUES
('google', 'both', 'gemini-2.0-ultra', 'Gemini 2.0 Ultra (Multimodal)', true);
```

### Usage in Application Logic

**Call Settings Dropdown** (filter to show only call-capable models):
```typescript
// API endpoint: GET /api/company/chatbots/[chatbotId]/call-models
const callModels = await db
  .select()
  .from(aiModels)
  .where(
    and(
      isNull(aiModels.deletedAt),
      or(
        eq(aiModels.modelType, 'call'),
        eq(aiModels.modelType, 'both')
      )
    )
  )
  .orderBy(aiModels.displayName);
```

**Chat Settings Dropdown** (filter to show only chat-capable models):
```typescript
// API endpoint: GET /api/company/chatbots/[chatbotId]/chat-models
const chatModels = await db
  .select()
  .from(aiModels)
  .where(
    and(
      isNull(aiModels.deletedAt),
      or(
        eq(aiModels.modelType, 'chat'),
        eq(aiModels.modelType, 'both')
      )
    )
  )
  .orderBy(aiModels.displayName);
```

**Validation** (ensure correct model type for capability):
```typescript
// When saving call settings, validate model_type
const model = await db.query.aiModels.findFirst({
  where: eq(aiModels.id, modelId),
});

if (!model || (model.modelType !== 'call' && model.modelType !== 'both')) {
  throw new Error('Selected model does not support call interactions');
}
```

### Data Seeding Requirements

After migration, seed the database with call-capable models:

```sql
-- OpenAI Realtime Models
INSERT INTO chatapp.ai_models (
  id,
  provider,
  model_type,
  model_name,
  display_name,
  description,
  supports_audio,
  input_cost_per_token,
  output_cost_per_token,
  audio_cost_per_second_input,
  audio_cost_per_second_output,
  created_at
) VALUES
(
  gen_random_uuid(),
  'openai',
  'call',
  'gpt-4o-realtime-preview-2024-10-01',
  'GPT-4 Realtime (Oct 2024)',
  'Real-time voice conversation model with low latency and natural dialogue',
  true,
  0.000005,  -- $5 per 1M tokens for text input
  0.000020,  -- $20 per 1M tokens for text output
  0.10,      -- $0.10 per second for audio input
  0.20,      -- $0.20 per second for audio output
  NOW()
);

-- Gemini Live Models
INSERT INTO chatapp.ai_models (
  id,
  provider,
  model_type,
  model_name,
  display_name,
  description,
  supports_audio,
  input_cost_per_token,
  output_cost_per_token,
  audio_cost_per_second_input,
  audio_cost_per_second_output,
  created_at
) VALUES
(
  gen_random_uuid(),
  'google',
  'call',
  'gemini-2.0-flash-exp',
  'Gemini 2.0 Flash Live',
  'Experimental multimodal model with real-time voice capabilities',
  true,
  0.00000075, -- $0.075 per 1M tokens for input
  0.0000030,  -- $0.30 per 1M tokens for output
  0.05,       -- Estimated audio cost (subject to Google pricing)
  0.10,
  NOW()
);
```

### Rollback Strategy

```sql
-- Check if any models have non-'chat' type before rollback
SELECT model_type, COUNT(*) as count
FROM chatapp.ai_models
GROUP BY model_type;

-- Drop index
DROP INDEX IF EXISTS chatapp.idx_ai_models_model_type;

-- Remove constraint
ALTER TABLE chatapp.ai_models
DROP CONSTRAINT IF EXISTS ai_models_model_type_check;

-- Drop column
ALTER TABLE chatapp.ai_models
DROP COLUMN model_type;
```

---

## 5. New integration_accounts Table

### Purpose

Store company-wide integration credentials for third-party services (Twilio, WhatsApp Business, Custom SIP providers). This centralized approach:
- Allows one integration account to be shared across multiple chatbots
- Enables master admin to audit all integration connections
- Supports multiple accounts per company (e.g., different WhatsApp numbers for different departments)
- Provides health monitoring and error tracking for integrations
- Secures sensitive credentials with encryption and token management

### Complete Table Schema

```sql
CREATE TABLE chatapp.integration_accounts (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,

  -- Account Configuration
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('twilio', 'whatsapp', 'custom')),
  account_name VARCHAR(255) NOT NULL, -- User-friendly name (e.g., "Main Support Line")
  description TEXT, -- Optional admin notes

  -- Credentials (encrypted JSONB storage)
  credentials JSONB NOT NULL, -- Provider-specific credentials (encrypted)
  access_token TEXT, -- For OAuth integrations
  refresh_token TEXT, -- For token refresh
  token_expires_at TIMESTAMP WITH TIME ZONE, -- Token expiration

  -- Webhook Configuration
  webhook_url VARCHAR(500) UNIQUE, -- System-generated webhook endpoint
  webhook_secret VARCHAR(255), -- For HMAC signature verification

  -- Health Monitoring
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_error TEXT, -- Last error message from provider
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE, -- Last successful connection test

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes
CREATE INDEX idx_integration_accounts_company_id
  ON chatapp.integration_accounts(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_integration_accounts_account_type
  ON chatapp.integration_accounts(account_type, company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_integration_accounts_status
  ON chatapp.integration_accounts(status)
  WHERE deleted_at IS NULL AND status = 'error';

CREATE UNIQUE INDEX idx_integration_accounts_webhook_url
  ON chatapp.integration_accounts(webhook_url)
  WHERE deleted_at IS NULL AND webhook_url IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_integration_accounts_updated_at
  BEFORE UPDATE ON chatapp.integration_accounts
  FOR EACH ROW
  EXECUTE FUNCTION chatapp.update_updated_at_column();
```

### Column Specifications

#### Identity Columns

**id** (uuid, primary key):
- Unique identifier for the integration account
- Generated automatically with gen_random_uuid()

**company_id** (uuid, NOT NULL, foreign key):
- Links integration account to owning company
- Foreign key to companies(id) with CASCADE DELETE
- Multi-tenancy: All queries MUST filter by company_id
- Indexed for fast company-specific queries

#### Account Configuration

**account_type** (varchar(50), NOT NULL, check constraint):
- Type of integration service
- Valid values: 'twilio', 'whatsapp', 'custom'
- Check constraint ensures data integrity
- Used to determine credential structure and API endpoints

**account_name** (varchar(255), NOT NULL):
- User-friendly display name set by company admin
- Examples: "Main Support Line", "Sales WhatsApp", "After-Hours Twilio"
- Displayed in dropdowns and integration lists
- Not unique (company can have multiple accounts with similar names)

**description** (text, nullable):
- Optional admin notes about the integration
- Use cases: "Connected to main company phone number +1-555-0100"
- Freeform text for documentation purposes

#### Credentials Storage

**credentials** (jsonb, NOT NULL):
- Provider-specific configuration stored as JSON
- **MUST be encrypted at rest** using AES-256-GCM or similar
- Structure varies by account_type:

**Twilio Credentials Schema**:
```json
{
  "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "authToken": "encrypted_auth_token_here",
  "phoneNumber": "+15550100",
  "apiKeySid": "SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "apiKeySecret": "encrypted_api_key_secret"
}
```

**WhatsApp Credentials Schema**:
```json
{
  "businessAccountId": "123456789012345",
  "phoneNumberId": "987654321098765",
  "phoneNumber": "+15550200",
  "accessToken": "encrypted_long_lived_access_token",
  "appId": "123456789012345",
  "appSecret": "encrypted_app_secret",
  "wabizPhoneNumberId": "alternate_id_format"
}
```

**Custom SIP/WebRTC Credentials Schema**:
```json
{
  "sipUri": "sip:username@provider.com",
  "username": "sip_username",
  "password": "encrypted_sip_password",
  "domain": "sip.provider.com",
  "proxyServer": "proxy.provider.com:5060",
  "stunServers": ["stun:stun.provider.com:3478"],
  "turnServers": [
    {
      "urls": "turn:turn.provider.com:3478",
      "username": "turn_user",
      "credential": "encrypted_turn_password"
    }
  ]
}
```

**access_token** (text, nullable):
- OAuth access token (for WhatsApp Business API, etc.)
- Encrypted separately from credentials JSONB
- Refreshed automatically via refresh_token

**refresh_token** (text, nullable):
- OAuth refresh token for obtaining new access tokens
- Encrypted at rest
- Used in token refresh flows

**token_expires_at** (timestamp with time zone, nullable):
- Expiration timestamp for access_token
- System checks this before API calls and refreshes if needed
- Example: WhatsApp access tokens expire after 60 days

#### Webhook Configuration

**webhook_url** (varchar(500), unique, nullable):
- System-generated webhook endpoint for this integration
- Format examples:
  - Twilio: `https://chat.buzzi.ai/api/webhooks/twilio/voice/{accountId}`
  - WhatsApp: `https://chat.buzzi.ai/api/webhooks/whatsapp/call/{accountId}`
- Unique constraint prevents webhook URL collisions
- Must be configured in external service (Twilio Console, Meta Business Manager)

**webhook_secret** (varchar(255), nullable):
- Secret key for HMAC-SHA256 signature verification
- Generated automatically on account creation
- Used to validate incoming webhook requests are legitimate
- Never exposed in API responses
- Rotated on security incidents

#### Health Monitoring

**status** (varchar(50), NOT NULL, default: 'active'):
- Current health status of the integration
- Valid values:
  - `'active'`: Integration working correctly, recent verification successful
  - `'inactive'`: Temporarily disabled by admin or system
  - `'error'`: Connection issues, authentication failures, or API errors
  - `'pending'`: Initial setup incomplete, awaiting verification
- Check constraint ensures valid values
- Indexed for quick filtering of errored integrations

**is_active** (boolean, NOT NULL, default: true):
- Simple on/off toggle controlled by company admin
- Soft disable without deleting configuration
- If false, all calls to this integration are rejected with user-friendly message

**last_error** (text, nullable):
- Most recent error message from integration provider
- Examples:
  - "Twilio authentication failed: Invalid Auth Token"
  - "WhatsApp webhook verification failed"
  - "Rate limit exceeded: 429 Too Many Requests"
- Displayed to company admin for troubleshooting
- Cleared when connection is re-verified successfully

**last_error_at** (timestamp with time zone, nullable):
- Timestamp of last error occurrence
- Used to determine if error is stale or ongoing
- Alerts triggered if errors persist >1 hour

**last_verified_at** (timestamp with time zone, nullable):
- Timestamp of last successful connection verification
- Updated on:
  - Manual "Test Connection" button click
  - Successful webhook receipt
  - Successful outbound call initiation
- Used to display "Last verified: 2 hours ago" in UI

#### Audit Columns

**created_at** (timestamp with time zone, NOT NULL, default: NOW()):
- Record creation timestamp

**updated_at** (timestamp with time zone, NOT NULL, default: NOW()):
- Record last modification timestamp
- Automatically updated via trigger

**deleted_at** (timestamp with time zone, nullable):
- Soft delete timestamp
- NULL = active record
- Non-NULL = soft deleted (excluded from queries with `WHERE deleted_at IS NULL`)

### Indexes Rationale

1. **idx_integration_accounts_company_id**: Fast lookup of all integrations for a company (admin dashboard)
2. **idx_integration_accounts_account_type**: Filter integrations by type for specific chatbot settings
3. **idx_integration_accounts_status**: Quick identification of errored integrations for monitoring dashboards
4. **idx_integration_accounts_webhook_url**: Ensure webhook URL uniqueness and fast webhook routing

### Security Considerations

**Encryption at Rest**:
```typescript
// Example encryption helper (application layer)
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

function encryptCredentials(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decryptCredentials(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Webhook Signature Verification**:
```typescript
// Example signature verification for Twilio webhooks
function verifyTwilioSignature(webhookUrl: string, params: Record<string, string>, signature: string, secret: string): boolean {
  const crypto = require('crypto');

  // Twilio concatenates URL and sorted params
  const data = webhookUrl + Object.keys(params).sort().map(key => key + params[key]).join('');

  const expectedSignature = crypto
    .createHmac('sha1', secret)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Migration Steps

**Step 1: Create Table**
```sql
CREATE TABLE chatapp.integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('twilio', 'whatsapp', 'custom')),
  account_name VARCHAR(255) NOT NULL,
  description TEXT,
  credentials JSONB NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  webhook_url VARCHAR(500) UNIQUE,
  webhook_secret VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

**Step 2: Create Indexes**
```sql
CREATE INDEX idx_integration_accounts_company_id
  ON chatapp.integration_accounts(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_integration_accounts_account_type
  ON chatapp.integration_accounts(account_type, company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_integration_accounts_status
  ON chatapp.integration_accounts(status)
  WHERE deleted_at IS NULL AND status = 'error';

CREATE UNIQUE INDEX idx_integration_accounts_webhook_url
  ON chatapp.integration_accounts(webhook_url)
  WHERE deleted_at IS NULL AND webhook_url IS NOT NULL;
```

**Step 3: Create Trigger**
```sql
CREATE TRIGGER update_integration_accounts_updated_at
  BEFORE UPDATE ON chatapp.integration_accounts
  FOR EACH ROW
  EXECUTE FUNCTION chatapp.update_updated_at_column();
```

**Step 4: Verify Table Creation**
```sql
-- Check table exists
SELECT * FROM information_schema.tables
WHERE table_schema = 'chatapp' AND table_name = 'integration_accounts';

-- Check constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'chatapp' AND table_name = 'integration_accounts';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'chatapp' AND tablename = 'integration_accounts';
```

### Rollback Strategy

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS update_integration_accounts_updated_at ON chatapp.integration_accounts;

-- Drop indexes
DROP INDEX IF EXISTS chatapp.idx_integration_accounts_company_id;
DROP INDEX IF EXISTS chatapp.idx_integration_accounts_account_type;
DROP INDEX IF EXISTS chatapp.idx_integration_accounts_status;
DROP INDEX IF EXISTS chatapp.idx_integration_accounts_webhook_url;

-- Drop table (cascades will delete references)
DROP TABLE IF EXISTS chatapp.integration_accounts CASCADE;
```

---

## 6. New calls Table

### Purpose

Record all call sessions with comprehensive metadata for:
- Call history and analytics dashboards
- Billing and usage tracking (call duration, AI provider costs)
- Quality monitoring (call success rate, duration distribution)
- Conversation threading (link calls to conversations)
- Customer relationship management (link calls to end users)
- Compliance and audit trails
- Escalation tracking (AI → human handoff)

### Complete Table Schema

```sql
CREATE TABLE chatapp.calls (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id) ON DELETE CASCADE,
  end_user_id UUID REFERENCES chatapp.end_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES chatapp.conversations(id) ON DELETE SET NULL,

  -- External References
  call_sid VARCHAR(255) UNIQUE, -- Provider call identifier (Twilio SID, WhatsApp call ID)

  -- Call Routing
  source VARCHAR(50) NOT NULL CHECK (source IN ('web', 'whatsapp', 'twilio', 'custom')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Call Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'canceled')),

  -- Contact Information
  from_number VARCHAR(50), -- Caller phone number (E.164 format: +15550100)
  to_number VARCHAR(50), -- Recipient phone number

  -- Call Metrics
  duration INTEGER, -- Total call duration in seconds

  -- Recording and Transcription
  recording_url VARCHAR(500), -- URL to call recording (signed URL from Supabase/S3)
  transcript_url VARCHAR(500), -- URL to full transcript JSON file

  -- AI Configuration
  ai_provider VARCHAR(50) CHECK (ai_provider IN ('openai', 'google', 'anthropic')),
  model_id VARCHAR(100), -- AI model identifier used for this call

  -- Integration Reference
  integration_account_id UUID REFERENCES chatapp.integration_accounts(id) ON DELETE SET NULL,

  -- Analysis
  summary TEXT, -- AI-generated call summary
  notes TEXT, -- Admin manual notes
  call_quality INTEGER CHECK (call_quality >= 1 AND call_quality <= 5), -- User rating 1-5
  sentiment_score INTEGER CHECK (sentiment_score >= -100 AND sentiment_score <= 100), -- AI sentiment analysis

  -- Error Tracking
  error_message TEXT, -- Error description if status='failed'
  error_code VARCHAR(50), -- Error categorization code

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE, -- Call initiated
  answered_at TIMESTAMP WITH TIME ZONE, -- Call answered (actual start of conversation)
  ended_at TIMESTAMP WITH TIME ZONE, -- Call terminated
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes
CREATE INDEX idx_calls_company_id
  ON chatapp.calls(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_chatbot_id
  ON chatapp.calls(chatbot_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_end_user_id
  ON chatapp.calls(end_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_conversation_id
  ON chatapp.calls(conversation_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_calls_call_sid
  ON chatapp.calls(call_sid)
  WHERE deleted_at IS NULL AND call_sid IS NOT NULL;

CREATE INDEX idx_calls_status
  ON chatapp.calls(status, company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_date_range
  ON chatapp.calls(company_id, started_at)
  WHERE deleted_at IS NULL AND started_at IS NOT NULL;

CREATE INDEX idx_calls_integration_account
  ON chatapp.calls(integration_account_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON chatapp.calls
  FOR EACH ROW
  EXECUTE FUNCTION chatapp.update_updated_at_column();
```

### Column Specifications

#### Identity Columns

**id** (uuid, primary key):
- Unique identifier for the call record
- Generated automatically
- Used in call_transcripts foreign key

**company_id** (uuid, NOT NULL, foreign key):
- Multi-tenancy: Links call to owning company
- Foreign key to companies(id) with CASCADE DELETE
- All queries MUST filter by company_id for data isolation
- Indexed with created_at for efficient dashboard queries

**chatbot_id** (uuid, NOT NULL, foreign key):
- Links call to specific chatbot instance
- Foreign key to chatbots(id) with CASCADE DELETE
- Used for per-chatbot analytics and settings lookup

**end_user_id** (uuid, nullable, foreign key):
- Links call to identified end user (if authenticated or identified)
- Foreign key to end_users(id) with SET NULL on delete
- Nullable: Anonymous callers don't have end_user_id
- Enables customer call history across all touchpoints

**conversation_id** (uuid, nullable, foreign key):
- Links call to a conversation thread (if call is part of ongoing conversation)
- Foreign key to conversations(id) with SET NULL on delete
- Use case: User starts chat, then escalates to call → same conversation_id
- Enables unified conversation view (chat + call)

#### External References

**call_sid** (varchar(255), unique, nullable):
- External provider's call identifier
- Examples:
  - Twilio: `CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (34 characters)
  - WhatsApp: UUID or custom identifier from Meta
  - Web: NULL (no external provider)
- Unique constraint prevents duplicate processing of same call
- Indexed for fast webhook lookups

#### Call Routing

**source** (varchar(50), NOT NULL, check constraint):
- Channel through which call was initiated
- Valid values: 'web', 'whatsapp', 'twilio', 'custom'
- Maps to integration type
- Used for analytics (calls by channel) and routing logic

**direction** (varchar(20), NOT NULL, check constraint):
- Call direction relative to the system
- Valid values:
  - 'inbound': User called the system (phone number, WhatsApp)
  - 'outbound': System called the user (proactive call, callback)
- Currently: Most calls are 'inbound' (user-initiated)
- Future: Outbound calls for appointment reminders, follow-ups

#### Call Status

**status** (varchar(50), NOT NULL, default: 'pending', check constraint):
- Current state of the call lifecycle
- Valid values:
  - `'pending'`: Call record created, connection not yet established
  - `'ringing'`: Outbound call ringing (before answer)
  - `'in_progress'`: Active call, audio streaming
  - `'completed'`: Call ended successfully
  - `'failed'`: Call failed due to error (see error_message)
  - `'no_answer'`: Outbound call not answered
  - `'busy'`: Recipient was busy
  - `'canceled'`: Call canceled by user before connection
- State transitions:
  - pending → ringing → in_progress → completed
  - pending → failed
  - ringing → no_answer
  - ringing → canceled
- Indexed for filtering active calls and analytics

#### Contact Information

**from_number** (varchar(50), nullable):
- Caller's phone number in E.164 format: +15550100
- Nullable: Web widget calls don't have phone numbers
- Used for:
  - Caller ID display
  - End user identification (match to existing users)
  - Analytics (geographic distribution)
  - Return call functionality

**to_number** (varchar(50), nullable):
- Recipient's phone number in E.164 format
- For inbound calls: Company's Twilio/WhatsApp number
- For outbound calls: Customer's phone number
- Used for routing and analytics

#### Call Metrics

**duration** (integer, nullable):
- Total call duration in seconds
- Measured from answered_at to ended_at
- NULL if call was never answered
- Used for:
  - Billing calculations
  - Analytics (average call duration)
  - Performance metrics
  - Cost estimation (AI provider charges per second)

#### Recording and Transcription

**recording_url** (varchar(500), nullable):
- URL to call recording audio file
- Storage options:
  - Supabase Storage: `https://{project}.supabase.co/storage/v1/object/call-recordings/{companyId}/{callId}.mp3`
  - AWS S3: Signed URL with expiration
  - Twilio: Twilio-hosted recording URL
- Security: Use signed URLs with short expiration (10 minutes)
- Nullable: Recording is optional (chatbot setting: recordingEnabled)

**transcript_url** (varchar(500), nullable):
- URL to full transcript JSON file
- Format: Array of transcript entries with timestamps
- Storage: Same as recording (Supabase/S3)
- Alternative: Store inline in call_transcripts table
- Nullable: Transcription is optional (chatbot setting: transcriptionEnabled)

#### AI Configuration

**ai_provider** (varchar(50), nullable, check constraint):
- AI provider used for this call
- Valid values: 'openai', 'google', 'anthropic'
- Determined by chatbot's selected call model
- Used for:
  - Cost attribution
  - Analytics (calls by provider)
  - Provider-specific error handling

**model_id** (varchar(100), nullable):
- Specific AI model identifier used
- Examples:
  - OpenAI: 'gpt-4o-realtime-preview-2024-10-01'
  - Google: 'gemini-2.0-flash-exp'
- Stored as string (not foreign key) for historical record even if model is deleted
- Used for cost calculation and quality analysis

#### Integration Reference

**integration_account_id** (uuid, nullable, foreign key):
- Links call to integration account used
- Foreign key to integration_accounts(id) with SET NULL on delete
- NULL for web widget calls (no external integration)
- Used for:
  - Tracking integration usage
  - Troubleshooting integration issues
  - Analytics per integration account

#### Analysis

**summary** (text, nullable):
- AI-generated call summary (post-call processing)
- Example: "Customer inquired about product pricing for Enterprise plan. Provided pricing information and scheduled follow-up with sales team."
- Generated by separate summarization job (not real-time)
- Displayed in call history and conversation view

**notes** (text, nullable):
- Manual notes added by company admin or support agent
- Freeform text for internal use
- Use case: "Customer was frustrated, offer discount on next call"

**call_quality** (integer, nullable, check constraint):
- User rating of call quality (1-5 stars)
- 1 = Very poor, 5 = Excellent
- Collected via post-call survey (optional)
- Used for quality monitoring and chatbot optimization

**sentiment_score** (integer, nullable, check constraint):
- AI-analyzed sentiment score (-100 to +100)
- Negative = frustrated/angry, Positive = satisfied/happy
- Generated from transcript analysis (post-call)
- Used for flagging problematic calls and customer satisfaction metrics

#### Error Tracking

**error_message** (text, nullable):
- Human-readable error description if status='failed'
- Examples:
  - "OpenAI Realtime API connection timeout"
  - "Invalid Twilio webhook signature"
  - "User microphone permission denied"
- Displayed to admin for troubleshooting

**error_code** (varchar(50), nullable):
- Machine-readable error category code
- Examples:
  - 'provider_connection_failed'
  - 'audio_stream_error'
  - 'authentication_failed'
  - 'user_permission_denied'
  - 'rate_limit_exceeded'
- Used for error analytics and automated alerting

#### Timestamps

**started_at** (timestamp with time zone, nullable):
- When call was initiated (user clicked call button, phone started ringing)
- NULL if call never progressed beyond 'pending'
- Used for call timing analytics

**answered_at** (timestamp with time zone, nullable):
- When call was answered and conversation began
- NULL if call was never answered (no_answer, canceled, failed)
- Difference from started_at = ring duration
- Start time for duration calculation

**ended_at** (timestamp with time zone, nullable):
- When call was terminated
- NULL if call is still in_progress
- Difference from answered_at = call duration

**created_at** (timestamp with time zone, NOT NULL, default: NOW()):
- Database record creation timestamp

**updated_at** (timestamp with time zone, NOT NULL, default: NOW()):
- Record last modification timestamp
- Auto-updated via trigger

**deleted_at** (timestamp with time zone, nullable):
- Soft delete timestamp

### Indexes Rationale

1. **idx_calls_company_id**: Fast company dashboard queries (recent calls)
2. **idx_calls_chatbot_id**: Per-chatbot analytics
3. **idx_calls_end_user_id**: Customer call history
4. **idx_calls_conversation_id**: Conversation threading
5. **idx_calls_call_sid**: Fast webhook lookups by provider ID
6. **idx_calls_status**: Filter active/failed calls for monitoring
7. **idx_calls_date_range**: Date range queries for analytics
8. **idx_calls_integration_account**: Integration health monitoring

### Multi-Tenancy Enforcement

**All queries MUST include company_id filter**:

```sql
-- Correct: Company-scoped query
SELECT * FROM chatapp.calls
WHERE company_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Incorrect: Missing company_id (security violation)
SELECT * FROM chatapp.calls
WHERE deleted_at IS NULL
ORDER BY created_at DESC;
```

**Master admins** can query across companies:
```sql
-- Master admin: All calls across platform
SELECT
  c.id,
  c.company_id,
  comp.name as company_name,
  c.status,
  c.duration
FROM chatapp.calls c
JOIN chatapp.companies comp ON c.company_id = comp.id
WHERE c.deleted_at IS NULL
ORDER BY c.created_at DESC;
```

### Migration Steps

**Step 1: Create Table**
```sql
CREATE TABLE chatapp.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id) ON DELETE CASCADE,
  end_user_id UUID REFERENCES chatapp.end_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES chatapp.conversations(id) ON DELETE SET NULL,
  call_sid VARCHAR(255) UNIQUE,
  source VARCHAR(50) NOT NULL CHECK (source IN ('web', 'whatsapp', 'twilio', 'custom')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'canceled')),
  from_number VARCHAR(50),
  to_number VARCHAR(50),
  duration INTEGER,
  recording_url VARCHAR(500),
  transcript_url VARCHAR(500),
  ai_provider VARCHAR(50) CHECK (ai_provider IN ('openai', 'google', 'anthropic')),
  model_id VARCHAR(100),
  integration_account_id UUID REFERENCES chatapp.integration_accounts(id) ON DELETE SET NULL,
  summary TEXT,
  notes TEXT,
  call_quality INTEGER CHECK (call_quality >= 1 AND call_quality <= 5),
  sentiment_score INTEGER CHECK (sentiment_score >= -100 AND sentiment_score <= 100),
  error_message TEXT,
  error_code VARCHAR(50),
  started_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

**Step 2: Create Indexes**
```sql
CREATE INDEX idx_calls_company_id
  ON chatapp.calls(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_chatbot_id
  ON chatapp.calls(chatbot_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_end_user_id
  ON chatapp.calls(end_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_conversation_id
  ON chatapp.calls(conversation_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_calls_call_sid
  ON chatapp.calls(call_sid)
  WHERE deleted_at IS NULL AND call_sid IS NOT NULL;

CREATE INDEX idx_calls_status
  ON chatapp.calls(status, company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_calls_date_range
  ON chatapp.calls(company_id, started_at)
  WHERE deleted_at IS NULL AND started_at IS NOT NULL;

CREATE INDEX idx_calls_integration_account
  ON chatapp.calls(integration_account_id, created_at DESC)
  WHERE deleted_at IS NULL;
```

**Step 3: Create Trigger**
```sql
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON chatapp.calls
  FOR EACH ROW
  EXECUTE FUNCTION chatapp.update_updated_at_column();
```

**Step 4: Verify Table Creation**
```sql
SELECT * FROM information_schema.tables
WHERE table_schema = 'chatapp' AND table_name = 'calls';

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'chatapp' AND table_name = 'calls';
```

### Rollback Strategy

```sql
DROP TRIGGER IF EXISTS update_calls_updated_at ON chatapp.calls;
DROP INDEX IF EXISTS chatapp.idx_calls_company_id;
DROP INDEX IF EXISTS chatapp.idx_calls_chatbot_id;
DROP INDEX IF EXISTS chatapp.idx_calls_end_user_id;
DROP INDEX IF EXISTS chatapp.idx_calls_conversation_id;
DROP INDEX IF EXISTS chatapp.idx_calls_call_sid;
DROP INDEX IF EXISTS chatapp.idx_calls_status;
DROP INDEX IF EXISTS chatapp.idx_calls_date_range;
DROP INDEX IF EXISTS chatapp.idx_calls_integration_account;
DROP TABLE IF EXISTS chatapp.calls CASCADE;
```

---

## 7. New call_transcripts Table

### Purpose

Store turn-by-turn call transcription with precise timing information for:
- Real-time transcript display during calls
- Post-call transcript review
- Searchable call content (keyword search across transcripts)
- Quality assurance and compliance auditing
- Training data for model improvement
- Sentiment analysis on specific utterances
- Billing verification (match transcript to call duration)

### Complete Table Schema

```sql
CREATE TABLE chatapp.call_transcripts (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,

  -- Transcript Content
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL, -- Transcript text

  -- Timing (milliseconds from call start)
  start_time INTEGER NOT NULL, -- Milliseconds from call answered_at
  end_time INTEGER NOT NULL, -- Milliseconds from call answered_at
  duration INTEGER NOT NULL, -- Milliseconds (end_time - start_time)

  -- Audio Reference
  audio_url VARCHAR(500), -- URL to audio segment (optional)

  -- Quality Metrics
  confidence DECIMAL(5,4) CHECK (confidence >= 0.0 AND confidence <= 1.0), -- Transcription confidence 0.0-1.0

  -- Provider Metadata
  metadata JSONB, -- Provider-specific data (language, alternatives, etc.)

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_transcripts_call_id
  ON chatapp.call_transcripts(call_id, start_time ASC);

CREATE INDEX idx_call_transcripts_role
  ON chatapp.call_transcripts(call_id, role);

-- Full-text search index (for content search)
CREATE INDEX idx_call_transcripts_content_search
  ON chatapp.call_transcripts USING GIN(to_tsvector('english', content));
```

### Column Specifications

#### Identity Columns

**id** (uuid, primary key):
- Unique identifier for transcript entry
- Generated automatically

**call_id** (uuid, NOT NULL, foreign key):
- Links transcript to parent call
- Foreign key to calls(id) with CASCADE DELETE
- When call is deleted, all transcripts are deleted
- Indexed with start_time for chronological retrieval

#### Transcript Content

**role** (varchar(20), NOT NULL, check constraint):
- Speaker role identifier
- Valid values:
  - `'user'`: End user speaking
  - `'assistant'`: AI agent speaking
  - `'system'`: System message (e.g., "Call connected", "User interrupted")
- Used for:
  - UI rendering (different colors/alignment for user vs assistant)
  - Analytics (user vs assistant talk time ratio)
  - Conversation flow analysis

**content** (text, NOT NULL):
- Transcribed text of the utterance
- Examples:
  - User: "What are your business hours?"
  - Assistant: "We're open Monday through Friday, 9 AM to 5 PM Eastern Time."
  - System: "User has left the call."
- Empty content not allowed (min length 1 character)
- Full-text search indexed for keyword search

#### Timing Information

All timing values are in **milliseconds** relative to call answered_at timestamp.

**start_time** (integer, NOT NULL):
- Milliseconds from call start (answered_at) to when this utterance began
- Example: If user speaks 5.2 seconds into call, start_time = 5200
- Used for:
  - Synchronized transcript playback with recording
  - Timeline visualization
  - Chronological ordering

**end_time** (integer, NOT NULL):
- Milliseconds from call start to when this utterance ended
- Must be greater than start_time
- Used for timestamp display and duration calculation

**duration** (integer, NOT NULL):
- Length of utterance in milliseconds (end_time - start_time)
- Calculated value, but stored for query optimization
- Used for:
  - Analytics (average utterance length)
  - Talk time distribution
  - Detecting abnormally long/short utterances

**Timing Example**:
```
Call answered at: 2024-01-15 10:30:00.000Z

Transcript 1:
- content: "Hello, how can I help you?"
- start_time: 0 (0ms = immediately after answer)
- end_time: 2500 (2.5 seconds)
- duration: 2500 (2.5 seconds)

Transcript 2:
- content: "I need help with my account."
- start_time: 3000 (3 seconds into call)
- end_time: 5200 (5.2 seconds into call)
- duration: 2200 (2.2 seconds)
```

#### Audio Reference

**audio_url** (varchar(500), nullable):
- URL to audio segment file for this specific utterance
- Optional: Only stored if individual segment recording is enabled
- Use cases:
  - Isolated utterance playback
  - Pronunciation analysis
  - Voice quality monitoring
- Storage: Same as call recordings (Supabase/S3 with signed URLs)

#### Quality Metrics

**confidence** (decimal(5,4), nullable, check constraint):
- Transcription confidence score from speech-to-text provider
- Range: 0.0000 to 1.0000
- Examples:
  - 0.95 = High confidence (clear speech, good audio quality)
  - 0.60 = Medium confidence (accent, background noise)
  - 0.30 = Low confidence (unclear, should be manually reviewed)
- Provided by:
  - OpenAI Whisper (via Realtime API)
  - Google Speech-to-Text
- Used for:
  - Flagging low-confidence transcripts for review
  - Quality monitoring dashboards
  - Filtering unreliable data from training sets

#### Provider Metadata

**metadata** (jsonb, nullable):
- Provider-specific additional data
- Structure varies by provider:

**OpenAI Whisper Metadata**:
```json
{
  "language": "en",
  "language_probability": 0.99,
  "model": "whisper-1",
  "alternatives": [
    {
      "text": "I need help with my account",
      "confidence": 0.95
    },
    {
      "text": "I need help with my acount",
      "confidence": 0.05
    }
  ]
}
```

**Google Speech-to-Text Metadata**:
```json
{
  "language_code": "en-US",
  "alternatives": [],
  "is_final": true,
  "stability": 0.95,
  "word_timestamps": [
    {"word": "I", "start_time": "0ms", "end_time": "100ms"},
    {"word": "need", "start_time": "100ms", "end_time": "300ms"},
    {"word": "help", "start_time": "300ms", "end_time": "600ms"}
  ]
}
```

Use cases:
- Language detection for multi-lingual support
- Word-level timestamps for precise transcript alignment
- Alternative hypotheses for ambiguous audio

#### Audit Columns

**created_at** (timestamp with time zone, NOT NULL, default: NOW()):
- When transcript entry was saved to database
- Not the same as when speech occurred (use start_time for that)
- Used for database auditing and replication monitoring

### Indexes Rationale

1. **idx_call_transcripts_call_id**: Fast retrieval of all transcripts for a call in chronological order
2. **idx_call_transcripts_role**: Filter transcripts by speaker (e.g., show only user utterances)
3. **idx_call_transcripts_content_search**: Full-text search across transcript content (GIN index)

### Full-Text Search Example

```sql
-- Search for calls where user mentioned "refund"
SELECT
  ct.call_id,
  ct.content,
  ct.start_time,
  c.company_id,
  c.chatbot_id
FROM chatapp.call_transcripts ct
JOIN chatapp.calls c ON ct.call_id = c.id
WHERE to_tsvector('english', ct.content) @@ to_tsquery('english', 'refund')
  AND ct.role = 'user'
  AND c.company_id = $1
  AND c.deleted_at IS NULL
ORDER BY ct.created_at DESC
LIMIT 100;
```

### Query Patterns

**Retrieve Full Call Transcript** (chronological order):
```sql
SELECT
  id,
  role,
  content,
  start_time,
  end_time,
  duration,
  confidence
FROM chatapp.call_transcripts
WHERE call_id = $1
ORDER BY start_time ASC;
```

**Calculate Talk Time Distribution**:
```sql
SELECT
  call_id,
  SUM(CASE WHEN role = 'user' THEN duration ELSE 0 END) as user_talk_time_ms,
  SUM(CASE WHEN role = 'assistant' THEN duration ELSE 0 END) as assistant_talk_time_ms,
  COUNT(CASE WHEN role = 'user' THEN 1 END) as user_utterances,
  COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_utterances
FROM chatapp.call_transcripts
WHERE call_id = $1
GROUP BY call_id;
```

**Find Low-Confidence Transcripts**:
```sql
SELECT
  ct.call_id,
  ct.content,
  ct.confidence,
  c.company_id
FROM chatapp.call_transcripts ct
JOIN chatapp.calls c ON ct.call_id = c.id
WHERE ct.confidence < 0.70
  AND c.company_id = $1
  AND c.deleted_at IS NULL
ORDER BY ct.confidence ASC, ct.created_at DESC
LIMIT 50;
```

### Real-Time Transcript Streaming

During active call:
```typescript
// Server-side: Receive transcript delta from OpenAI
function handleTranscriptDelta(callId: string, delta: TranscriptDelta) {
  // Save to database
  await db.insert(callTranscripts).values({
    callId,
    role: delta.role,
    content: delta.content,
    startTime: delta.startTime,
    endTime: delta.endTime,
    duration: delta.endTime - delta.startTime,
    confidence: delta.confidence,
  });

  // Broadcast to connected clients via SSE/WebSocket
  await sseManager.publish(getCallChannel(callId), {
    type: 'transcript_delta',
    data: {
      id: transcriptId,
      role: delta.role,
      content: delta.content,
      startTime: delta.startTime,
    },
  });
}
```

### Migration Steps

**Step 1: Create Table**
```sql
CREATE TABLE chatapp.call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  audio_url VARCHAR(500),
  confidence DECIMAL(5,4) CHECK (confidence >= 0.0 AND confidence <= 1.0),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Step 2: Create Indexes**
```sql
CREATE INDEX idx_call_transcripts_call_id
  ON chatapp.call_transcripts(call_id, start_time ASC);

CREATE INDEX idx_call_transcripts_role
  ON chatapp.call_transcripts(call_id, role);

CREATE INDEX idx_call_transcripts_content_search
  ON chatapp.call_transcripts USING GIN(to_tsvector('english', content));
```

**Step 3: Verify Table Creation**
```sql
SELECT * FROM information_schema.tables
WHERE table_schema = 'chatapp' AND table_name = 'call_transcripts';
```

### Rollback Strategy

```sql
DROP INDEX IF EXISTS chatapp.idx_call_transcripts_call_id;
DROP INDEX IF EXISTS chatapp.idx_call_transcripts_role;
DROP INDEX IF EXISTS chatapp.idx_call_transcripts_content_search;
DROP TABLE IF EXISTS chatapp.call_transcripts CASCADE;
```

---

## 8. Update companies Table (settings JSONB)

### Purpose

Add callEnabled flag to company settings for master admin control over call feature availability. This flag acts as the master switch that determines whether a company has access to call features at all.

### Current settings JSONB Structure

```json
{
  "branding": {
    "primaryColor": "#3B82F6",
    "logo": "https://..."
  },
  "features": {
    "chatEnabled": true,
    "knowledgeBaseEnabled": true,
    "escalationEnabled": true
  },
  "billing": {
    "plan": "enterprise",
    "monthlyCredits": 10000
  }
}
```

### New settings JSONB Structure

```json
{
  "branding": {
    "primaryColor": "#3B82F6",
    "logo": "https://..."
  },
  "features": {
    "chatEnabled": true,
    "knowledgeBaseEnabled": true,
    "escalationEnabled": true,
    "callEnabled": false  // ← NEW: Master admin control for call feature
  },
  "billing": {
    "plan": "enterprise",
    "monthlyCredits": 10000
  }
}
```

### Schema Change

No schema migration needed (JSONB is flexible). Update is done via data migration:

```sql
-- Add callEnabled flag to all existing companies (default: false)
UPDATE chatapp.companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features,callEnabled}',
  'false'::jsonb,
  true
)
WHERE deleted_at IS NULL;
```

### Field Specification

**settings.features.callEnabled** (boolean):
- **Purpose**: Master admin toggle to enable/disable call feature for entire company
- **Default**: false (call feature disabled by default, opt-in)
- **Controlled By**: Master admin only (company admins cannot change this)
- **Effect**:
  - If false:
    - Company admins cannot see call-enabled chatbot packages
    - Company admins cannot enable call settings on chatbots
    - Call API endpoints return 403 Forbidden
    - Widget does not show call button even if chatbot has enabled_call=true
  - If true:
    - Company admins can create chatbots from call-enabled packages
    - Company admins can configure call settings
    - Call functionality fully available

### Migration Steps

**Step 1: Analyze Current settings Structure**
```sql
-- Check if any companies have features object
SELECT
  id,
  name,
  settings->'features' as current_features
FROM chatapp.companies
WHERE deleted_at IS NULL
LIMIT 10;
```

**Step 2: Add callEnabled Flag to All Companies**
```sql
-- Add callEnabled=false to companies that already have features object
UPDATE chatapp.companies
SET settings = jsonb_set(
  settings,
  '{features,callEnabled}',
  'false'::jsonb,
  true
)
WHERE settings->'features' IS NOT NULL
  AND deleted_at IS NULL;

-- For companies without features object, create it
UPDATE chatapp.companies
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features}',
  jsonb_build_object('callEnabled', false),
  true
)
WHERE settings->'features' IS NULL
  AND deleted_at IS NULL;
```

**Step 3: Verify Update**
```sql
-- Check that all companies now have callEnabled flag
SELECT
  COUNT(*) as total_companies,
  SUM(CASE WHEN (settings->'features'->>'callEnabled')::boolean = false THEN 1 ELSE 0 END) as call_disabled,
  SUM(CASE WHEN (settings->'features'->>'callEnabled')::boolean = true THEN 1 ELSE 0 END) as call_enabled,
  SUM(CASE WHEN settings->'features'->'callEnabled' IS NULL THEN 1 ELSE 0 END) as missing_flag
FROM chatapp.companies
WHERE deleted_at IS NULL;

-- Expected: total_companies = call_disabled, call_enabled = 0, missing_flag = 0
```

**Step 4: Manual Master Admin Enablement** (optional)
```sql
-- Master admin enables call feature for specific pilot companies
UPDATE chatapp.companies
SET settings = jsonb_set(
  settings,
  '{features,callEnabled}',
  'true'::jsonb,
  true
)
WHERE id IN (
  'company-uuid-1',
  'company-uuid-2'
) AND deleted_at IS NULL;
```

### Usage in Application Logic

**Authorization Middleware** (check before call operations):
```typescript
async function requireCallFeatureEnabled(companyId: string) {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  const callEnabled = company?.settings?.features?.callEnabled ?? false;

  if (!callEnabled) {
    throw new Error('Call feature is not enabled for this company. Contact support to enable.');
  }
}
```

**Widget Config API**:
```typescript
// GET /api/widget/config?chatbotId=xxx
export async function GET(request: Request) {
  const chatbot = await db.query.chatbots.findFirst({
    where: eq(chatbots.id, chatbotId),
    with: { company: true },
  });

  const callEnabled =
    chatbot.company.settings?.features?.callEnabled === true &&
    chatbot.enabled_call === true;

  return Response.json({
    chatEnabled: chatbot.enabled_chat,
    callEnabled, // Only true if BOTH company and chatbot enable it
  });
}
```

**Master Admin UI**:
```typescript
// Company Settings Page - Master Admin Only
<FeatureToggle
  label="Enable Call Feature"
  description="Allow this company to use voice call capabilities"
  checked={company.settings.features.callEnabled}
  onChange={handleToggleCallFeature}
  disabled={!isMasterAdmin}
/>
```

### Default Value Rationale

**callEnabled = false (default)**:
- Call feature is premium/advanced functionality
- Requires additional setup (integration accounts, AI models)
- Has cost implications (OpenAI Realtime, Gemini Live are expensive)
- Requires testing and support preparation
- Opt-in prevents surprise costs for existing customers
- Master admin can enable selectively for pilot programs

### Rollback Strategy

```sql
-- Remove callEnabled flag from all companies
UPDATE chatapp.companies
SET settings = settings #- '{features,callEnabled}'
WHERE deleted_at IS NULL;

-- Verify removal
SELECT
  COUNT(*) as companies_with_flag
FROM chatapp.companies
WHERE settings->'features'->'callEnabled' IS NOT NULL
  AND deleted_at IS NULL;

-- Expected: 0
```

---

## 9. Update chatbots Table (settings JSONB)

### Purpose

Extend chatbot settings JSONB with comprehensive call configuration object. This stores all call-specific settings that company admins configure per chatbot.

### Current settings JSONB Structure

```json
{
  "welcomeMessage": "Hello! How can I help you today?",
  "agent": {
    "name": "Support Assistant",
    "avatar": "https://...",
    "systemPrompt": "You are a helpful customer support agent..."
  },
  "chat": {
    "maxMessages": 100,
    "enableFileUploads": true,
    "allowedFileTypes": ["pdf", "txt", "docx"]
  },
  "escalation": {
    "enabled": true,
    "triggerKeywords": ["human", "agent", "speak to someone"]
  }
}
```

### New settings JSONB Structure

```json
{
  "welcomeMessage": "Hello! How can I help you today?",
  "agent": {
    "name": "Support Assistant",
    "avatar": "https://...",
    "systemPrompt": "You are a helpful customer support agent..."
  },
  "chat": {
    "maxMessages": 100,
    "enableFileUploads": true,
    "allowedFileTypes": ["pdf", "txt", "docx"]
  },
  "escalation": {
    "enabled": true,
    "triggerKeywords": ["human", "agent", "speak to someone"]
  },
  "call": {  // ← NEW: Call-specific configuration
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
    "callButtonText": "Call Us",
    "callButtonColor": "#22C55E",
    "callButtonPosition": "bottom-right",
    "vadThreshold": 0.5,
    "echoCancellation": true,
    "noiseSuppression": true
  }
}
```

### Schema Change

No schema migration needed (JSONB is flexible). Settings are updated via application logic when chatbot is created or call settings are saved.

### Field Specifications

All fields under `settings.call` object:

#### Voice Configuration

**voiceId** (string, required if enabled_call=true):
- Selected voice identifier
- Provider-specific values:
  - OpenAI: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  - Google: 'en-US-Wavenet-A', 'en-US-Wavenet-B', etc.
  - ElevenLabs: Custom voice IDs from ElevenLabs account
- Used in AI provider session configuration

**voiceProvider** (string, required if enabled_call=true):
- Voice synthesis provider
- Valid values: 'openai', 'google', 'elevenlabs'
- Determines which voice API to use
- Must match AI provider in most cases

**voiceSettings** (object, optional):
- Provider-specific voice modulation settings
- **pitch** (number, range: -1.0 to 1.0, default: 0):
  - Voice pitch adjustment
  - -1.0 = lower pitch, 0 = default, 1.0 = higher pitch
- **speed** (number, range: 0.5 to 2.0, default: 1.0):
  - Speech rate multiplier
  - 0.5 = half speed, 1.0 = default, 2.0 = double speed
- **stability** (number, range: 0.0 to 1.0, default: 0.5):
  - Voice consistency (ElevenLabs only)
  - 0.0 = more expressive, 1.0 = more stable

#### Call Behavior

**callGreeting** (string, default: "Hi, I'm your AI assistant. How can I help you today?"):
- First message spoken when call connects
- Max length: 500 characters
- Plain text (no SSML support currently)
- Example: "Thank you for calling Acme Support. I'm here to assist you with any questions."

**endCallPhrase** (string, default: "goodbye"):
- Trigger phrase that ends the call when user says it
- Case-insensitive matching
- Examples: "goodbye", "bye", "end call", "hang up"
- Can be comma-separated list: "goodbye,bye,end call"

**silenceTimeout** (integer, seconds, default: 180):
- Maximum seconds of silence before auto-disconnect
- Range: 30 to 300 seconds (0.5 to 5 minutes)
- Prevents abandoned calls from consuming resources
- After timeout: Agent prompts "Are you still there?" then ends call if no response

**maxCallDuration** (integer, seconds, default: 600):
- Hard limit for call length
- Range: 60 to 3600 seconds (1 to 60 minutes)
- Prevents excessively long calls
- Warning message at 90% of limit: "Call will end in 1 minute"

#### Features

**recordingEnabled** (boolean, default: false):
- Whether to save call audio recordings
- If true: Upload to Supabase Storage after call ends
- If false: No recording saved (transcripts still available if transcriptionEnabled=true)
- Legal: Must comply with call recording laws (two-party consent in some jurisdictions)

**transcriptionEnabled** (boolean, default: true):
- Whether to generate real-time transcripts
- If true: Save to call_transcripts table during call
- If false: No transcript available (reduces cost but limits analytics)

**interruptionEnabled** (boolean, default: true):
- Allow user to interrupt agent mid-speech
- If true: VAD detects user speech, cancels agent response
- If false: Agent completes full response before listening for user

#### Widget UI

**callButtonText** (string, default: "Call Us"):
- Text displayed on widget call button
- Max length: 50 characters
- Examples: "Speak to an Agent", "Call Now", "Get Help"

**callButtonColor** (string, hex color, default: "#22C55E"):
- Call button background color
- Format: Hex color code (#RRGGBB)
- Default: Green (#22C55E = Tailwind green-500)

**callButtonPosition** (string, default: "bottom-right"):
- Widget position on screen
- Valid values: 'bottom-right', 'bottom-left', 'top-right', 'top-left'
- Shared with chat button (both use same position)

#### Advanced Settings

**vadThreshold** (number, range: 0.0 to 1.0, default: 0.5):
- Voice Activity Detection sensitivity
- Lower = more sensitive (detects quieter speech, but more false positives)
- Higher = less sensitive (requires louder speech, fewer false positives)
- 0.5 = balanced default

**echoCancellation** (boolean, default: true):
- Enable acoustic echo cancellation
- Prevents agent's voice from being picked up by user's microphone
- Recommended: Always true (disable only for debugging)

**noiseSuppression** (boolean, default: true):
- Enable background noise suppression
- Reduces background noise in user's audio
- Improves transcription accuracy
- Recommended: Always true

### Default Values on Chatbot Creation

When a chatbot is created with `enabled_call=true`, initialize with:

```typescript
const defaultCallSettings = {
  voiceId: 'alloy', // OpenAI default voice
  voiceProvider: 'openai',
  voiceSettings: {
    pitch: 0,
    speed: 1.0,
    stability: 0.5,
  },
  callGreeting: "Hi, I'm your AI assistant. How can I help you today?",
  endCallPhrase: 'goodbye',
  silenceTimeout: 180, // 3 minutes
  maxCallDuration: 600, // 10 minutes
  recordingEnabled: false,
  transcriptionEnabled: true,
  interruptionEnabled: true,
  callButtonText: 'Call Us',
  callButtonColor: '#22C55E',
  callButtonPosition: 'bottom-right',
  vadThreshold: 0.5,
  echoCancellation: true,
  noiseSuppression: true,
};
```

### Migration Steps

**Step 1: No Schema Migration Needed**
(JSONB fields are dynamic, no ALTER TABLE required)

**Step 2: Initialize Call Settings for Existing Call-Enabled Chatbots** (if any)
```sql
-- Find chatbots with enabled_call=true but no call settings
SELECT id, name, settings
FROM chatapp.chatbots
WHERE enabled_call = true
  AND (settings->'call' IS NULL OR settings->'call' = '{}'::jsonb)
  AND deleted_at IS NULL;

-- Add default call settings to these chatbots
UPDATE chatapp.chatbots
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{call}',
  '{
    "voiceId": "alloy",
    "voiceProvider": "openai",
    "voiceSettings": {
      "pitch": 0,
      "speed": 1.0,
      "stability": 0.5
    },
    "callGreeting": "Hi, I''m your AI assistant. How can I help you today?",
    "endCallPhrase": "goodbye",
    "silenceTimeout": 180,
    "maxCallDuration": 600,
    "recordingEnabled": false,
    "transcriptionEnabled": true,
    "interruptionEnabled": true,
    "callButtonText": "Call Us",
    "callButtonColor": "#22C55E",
    "callButtonPosition": "bottom-right",
    "vadThreshold": 0.5,
    "echoCancellation": true,
    "noiseSuppression": true
  }'::jsonb,
  true
)
WHERE enabled_call = true
  AND (settings->'call' IS NULL OR settings->'call' = '{}'::jsonb)
  AND deleted_at IS NULL;
```

**Step 3: Verify Update**
```sql
-- Check that all call-enabled chatbots have call settings
SELECT
  COUNT(*) as call_enabled_chatbots,
  SUM(CASE WHEN settings->'call' IS NOT NULL THEN 1 ELSE 0 END) as with_call_settings,
  SUM(CASE WHEN settings->'call' IS NULL THEN 1 ELSE 0 END) as missing_call_settings
FROM chatapp.chatbots
WHERE enabled_call = true
  AND deleted_at IS NULL;

-- Expected: call_enabled_chatbots = with_call_settings, missing_call_settings = 0
```

### Usage in Application Logic

**Call Settings API** (GET/PATCH):
```typescript
// GET /api/company/chatbots/[chatbotId]/call-settings
export async function GET(req: Request, { params }: { params: { chatbotId: string } }) {
  const chatbot = await db.query.chatbots.findFirst({
    where: eq(chatbots.id, params.chatbotId),
  });

  if (!chatbot.enabled_call) {
    return Response.json({ error: 'Call feature not enabled for this chatbot' }, { status: 400 });
  }

  return Response.json({
    callSettings: chatbot.settings.call || defaultCallSettings,
  });
}

// PATCH /api/company/chatbots/[chatbotId]/call-settings
export async function PATCH(req: Request, { params }: { params: { chatbotId: string } }) {
  const body = await req.json();

  // Validate with Zod
  const schema = z.object({
    voiceId: z.string(),
    callGreeting: z.string().max(500),
    silenceTimeout: z.number().min(30).max(300),
    maxCallDuration: z.number().min(60).max(3600),
    // ... other fields
  });

  const validated = schema.parse(body);

  await db
    .update(chatbots)
    .set({
      settings: sql`jsonb_set(settings, '{call}', ${JSON.stringify(validated)}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(eq(chatbots.id, params.chatbotId));

  return Response.json({ success: true });
}
```

**Call Executor Initialization**:
```typescript
// When starting a call, load call settings from chatbot
async function startCall(chatbotId: string) {
  const chatbot = await db.query.chatbots.findFirst({
    where: eq(chatbots.id, chatbotId),
  });

  const callSettings = chatbot.settings.call;

  const executor = new OpenAIRealtimeExecutor({
    voiceId: callSettings.voiceId,
    greeting: callSettings.callGreeting,
    vadThreshold: callSettings.vadThreshold,
    maxDuration: callSettings.maxCallDuration,
    // ... other settings
  });

  return executor;
}
```

### Validation Rules

- **voiceId**: Must be valid for selected voiceProvider
- **callGreeting**: Max 500 characters, plain text only
- **silenceTimeout**: 30-300 seconds
- **maxCallDuration**: 60-3600 seconds
- **callButtonText**: Max 50 characters
- **callButtonColor**: Valid hex color (#RRGGBB format)
- **vadThreshold**: 0.0-1.0
- **voiceSettings.pitch**: -1.0 to 1.0
- **voiceSettings.speed**: 0.5 to 2.0
- **voiceSettings.stability**: 0.0 to 1.0

### Rollback Strategy

```sql
-- Remove call settings from all chatbots
UPDATE chatapp.chatbots
SET settings = settings #- '{call}'
WHERE deleted_at IS NULL;

-- Verify removal
SELECT COUNT(*)
FROM chatapp.chatbots
WHERE settings->'call' IS NOT NULL
  AND deleted_at IS NULL;

-- Expected: 0
```

---

## 10. Complete Migration Strategy

### Migration File Structure

Create a single migration file: `YYYYMMDDHHMMSS_add_call_features.ts`

**File Location**: `/src/lib/db/migrations/YYYYMMDDHHMMSS_add_call_features.ts`

### Migration Execution Order

**CRITICAL**: Execute in this exact order to maintain referential integrity.

```typescript
// Migration file structure
export async function up(db: PostgresDatabase) {
  console.log('Starting call feature migration...');

  // 1. Update users.avatar_url type (independent change)
  await step1_updateUsersAvatarUrl(db);

  // 2. Add capability flags to chatbot_packages
  await step2_addPackageCapabilityFlags(db);

  // 3. Add capability flags to chatbots
  await step3_addChatbotCapabilityFlags(db);

  // 4. Backfill existing chatbots with enabled_chat=true
  await step4_backfillChatbotCapabilities(db);

  // 5. Remove chatbotType from chatbot_packages
  await step5_removePackageChatbotType(db);

  // 6. Remove chatbotType from chatbots
  await step6_removeChatbotChatbotType(db);

  // 7. Add model_type to ai_models
  await step7_addModelType(db);

  // 8. Backfill existing ai_models with model_type='chat'
  await step8_backfillModelType(db);

  // 9. Create integration_accounts table
  await step9_createIntegrationAccounts(db);

  // 10. Create calls table
  await step10_createCalls(db);

  // 11. Create call_transcripts table (depends on calls)
  await step11_createCallTranscripts(db);

  // 12. Update companies.settings with callEnabled flag
  await step12_updateCompanySettings(db);

  // 13. Seed call-capable AI models
  await step13_seedCallModels(db);

  console.log('Call feature migration completed successfully!');
}

export async function down(db: PostgresDatabase) {
  console.log('Rolling back call feature migration...');

  // Rollback in reverse order
  await rollback13_removeCallModels(db);
  await rollback12_updateCompanySettings(db);
  await rollback11_dropCallTranscripts(db);
  await rollback10_dropCalls(db);
  await rollback9_dropIntegrationAccounts(db);
  await rollback8_revertModelType(db);
  await rollback7_removeModelType(db);
  await rollback6_restoreChatbotChatbotType(db);
  await rollback5_restorePackageChatbotType(db);
  await rollback4_revertChatbotCapabilities(db);
  await rollback3_removeChatbotCapabilityFlags(db);
  await rollback2_removePackageCapabilityFlags(db);
  await rollback1_revertUsersAvatarUrl(db);

  console.log('Call feature migration rolled back successfully.');
}
```

### Detailed Migration Steps

#### Step 1: Update users.avatar_url

```typescript
async function step1_updateUsersAvatarUrl(db: PostgresDatabase) {
  console.log('[Step 1/13] Updating users.avatar_url to TEXT...');

  await db.execute(sql`
    ALTER TABLE chatapp.users
    ALTER COLUMN avatar_url TYPE TEXT;
  `);

  console.log('✓ users.avatar_url updated to TEXT');
}

async function rollback1_revertUsersAvatarUrl(db: PostgresDatabase) {
  console.log('[Rollback 1/13] Reverting users.avatar_url to VARCHAR(500)...');

  // Check for long URLs
  const longUrls = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM chatapp.users
    WHERE LENGTH(avatar_url) > 500;
  `);

  if (longUrls.rows[0].count > 0) {
    console.warn(`⚠️  ${longUrls.rows[0].count} users have avatar URLs >500 characters. Truncating...`);

    await db.execute(sql`
      UPDATE chatapp.users
      SET avatar_url = LEFT(avatar_url, 500)
      WHERE LENGTH(avatar_url) > 500;
    `);
  }

  await db.execute(sql`
    ALTER TABLE chatapp.users
    ALTER COLUMN avatar_url TYPE VARCHAR(500);
  `);

  console.log('✓ users.avatar_url reverted to VARCHAR(500)');
}
```

#### Step 2-6: Capability Flags Migration

(See Section 2 for detailed SQL commands)

#### Step 7-8: AI Models model_type

(See Section 4 for detailed SQL commands)

#### Step 9-11: Create New Tables

(See Sections 5, 6, 7 for detailed CREATE TABLE commands)

#### Step 12: Update Company Settings

```typescript
async function step12_updateCompanySettings(db: PostgresDatabase) {
  console.log('[Step 12/13] Adding callEnabled flag to company settings...');

  await db.execute(sql`
    UPDATE chatapp.companies
    SET settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{features,callEnabled}',
      'false'::jsonb,
      true
    )
    WHERE deleted_at IS NULL;
  `);

  // Verify
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM chatapp.companies
    WHERE settings->'features'->'callEnabled' IS NOT NULL
      AND deleted_at IS NULL;
  `);

  console.log(`✓ Updated ${result.rows[0].count} companies with callEnabled flag`);
}
```

#### Step 13: Seed Call Models

```typescript
async function step13_seedCallModels(db: PostgresDatabase) {
  console.log('[Step 13/13] Seeding call-capable AI models...');

  const callModels = [
    {
      provider: 'openai',
      modelType: 'call',
      modelName: 'gpt-4o-realtime-preview-2024-10-01',
      displayName: 'GPT-4 Realtime (Oct 2024)',
      description: 'Real-time voice conversation model with low latency',
      supportsAudio: true,
      inputCostPerToken: 0.000005,
      outputCostPerToken: 0.000020,
      audioCostPerSecondInput: 0.10,
      audioCostPerSecondOutput: 0.20,
    },
    {
      provider: 'google',
      modelType: 'call',
      modelName: 'gemini-2.0-flash-exp',
      displayName: 'Gemini 2.0 Flash Live',
      description: 'Experimental multimodal model with real-time voice',
      supportsAudio: true,
      inputCostPerToken: 0.00000075,
      outputCostPerToken: 0.0000030,
      audioCostPerSecondInput: 0.05,
      audioCostPerSecondOutput: 0.10,
    },
  ];

  for (const model of callModels) {
    await db.insert(aiModels).values(model);
  }

  console.log(`✓ Seeded ${callModels.length} call-capable AI models`);
}
```

### Pre-Migration Checklist

- [ ] **Backup database**: `pg_dump chatapp > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] **Test migration in development environment first**
- [ ] **Verify no active calls or critical operations**
- [ ] **Notify team of maintenance window**
- [ ] **Prepare rollback script**
- [ ] **Check database disk space** (new tables will consume space)
- [ ] **Verify PostgreSQL version compatibility** (requires PostgreSQL 12+)

### Post-Migration Verification

```sql
-- 1. Verify all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'chatapp'
  AND table_name IN ('integration_accounts', 'calls', 'call_transcripts');

-- 2. Verify columns added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'chatapp'
  AND table_name = 'chatbot_packages'
  AND column_name IN ('enable_chat', 'enable_call');

-- 3. Verify indexes created
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'chatapp'
  AND indexname LIKE '%call%';

-- 4. Verify data integrity
SELECT
  (SELECT COUNT(*) FROM chatapp.chatbot_packages WHERE enable_chat IS NULL) as packages_missing_flags,
  (SELECT COUNT(*) FROM chatapp.chatbots WHERE enabled_chat IS NULL) as chatbots_missing_flags,
  (SELECT COUNT(*) FROM chatapp.ai_models WHERE model_type IS NULL) as models_missing_type,
  (SELECT COUNT(*) FROM chatapp.companies WHERE settings->'features'->'callEnabled' IS NULL) as companies_missing_flag;

-- All counts should be 0
```

### Rollback Procedure

If migration fails or issues are discovered:

```bash
# 1. Stop application servers to prevent data corruption
pm2 stop all

# 2. Restore from backup
psql chatapp < backup_YYYYMMDD_HHMMSS.sql

# 3. OR execute rollback migration
pnpm db:migrate:down

# 4. Verify rollback success
psql chatapp -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name IN ('calls', 'call_transcripts', 'integration_accounts');"
# Should return 0 rows

# 5. Restart application
pm2 start all
```

### Performance Considerations

**Expected Migration Duration** (depends on database size):
- Users table (10K records): ~5 seconds
- Chatbot packages (100 records): <1 second
- Chatbots (1K records): ~3 seconds
- AI models (50 records): <1 second
- New tables creation: ~5 seconds
- Companies settings update (100 records): ~2 seconds
- **Total estimated time**: ~20-30 seconds for small-medium database

**Locks**:
- `ALTER TABLE` operations acquire ACCESS EXCLUSIVE locks
- Brief downtime expected (20-30 seconds)
- Schedule during low-traffic window

**Indexes**:
- Created AFTER data migration to improve performance
- Index creation is fast on empty tables

---

## 11. Data Seeding Requirements

### Purpose

Populate database with initial data required for call feature functionality.

### Seed Data Categories

1. **Call-Capable AI Models**
2. **Sample Integration Accounts** (development only)
3. **Updated Existing Models with model_type**

### 1. Seed Call-Capable AI Models

```sql
-- Insert OpenAI Realtime Models
INSERT INTO chatapp.ai_models (
  id,
  provider,
  model_type,
  model_name,
  display_name,
  description,
  supports_audio,
  input_cost_per_token,
  output_cost_per_token,
  audio_cost_per_second_input,
  audio_cost_per_second_output,
  context_window,
  max_output_tokens,
  created_at,
  updated_at
) VALUES
(
  gen_random_uuid(),
  'openai',
  'call',
  'gpt-4o-realtime-preview-2024-10-01',
  'GPT-4 Realtime (Oct 2024)',
  'OpenAI Realtime API for low-latency voice conversations with natural interruption handling and function calling support',
  true,
  0.000005,  -- $5 per 1M input tokens
  0.000020,  -- $20 per 1M output tokens
  0.10,      -- $0.10 per second audio input
  0.20,      -- $0.20 per second audio output
  128000,    -- 128K context window
  4096,      -- 4K max output
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'openai',
  'call',
  'gpt-4o-realtime-preview',
  'GPT-4 Realtime (Latest)',
  'Latest version of OpenAI Realtime API (auto-updates to newest model)',
  true,
  0.000005,
  0.000020,
  0.10,
  0.20,
  128000,
  4096,
  NOW(),
  NOW()
);

-- Insert Google Gemini Live Models
INSERT INTO chatapp.ai_models (
  id,
  provider,
  model_type,
  model_name,
  display_name,
  description,
  supports_audio,
  input_cost_per_token,
  output_cost_per_token,
  audio_cost_per_second_input,
  audio_cost_per_second_output,
  context_window,
  max_output_tokens,
  created_at,
  updated_at
) VALUES
(
  gen_random_uuid(),
  'google',
  'call',
  'gemini-2.0-flash-exp',
  'Gemini 2.0 Flash Live (Experimental)',
  'Google experimental multimodal model with real-time voice capabilities and low latency',
  true,
  0.00000075,  -- $0.075 per 1M input tokens
  0.0000030,   -- $0.30 per 1M output tokens
  0.05,        -- Estimated audio input cost
  0.10,        -- Estimated audio output cost
  1000000,     -- 1M context window
  8192,        -- 8K max output
  NOW(),
  NOW()
);
```

### 2. Update Existing Models with model_type

```sql
-- Mark all existing chat models as model_type='chat'
UPDATE chatapp.ai_models
SET model_type = 'chat'
WHERE model_type IS NULL
  AND deleted_at IS NULL;

-- Verify update
SELECT
  provider,
  model_type,
  COUNT(*) as count
FROM chatapp.ai_models
WHERE deleted_at IS NULL
GROUP BY provider, model_type
ORDER BY provider, model_type;
```

### 3. Sample Integration Accounts (Development Only)

**⚠️ DEVELOPMENT/TESTING ONLY - DO NOT RUN IN PRODUCTION**

```sql
-- Insert test Twilio account
INSERT INTO chatapp.integration_accounts (
  id,
  company_id,
  account_type,
  account_name,
  description,
  credentials,
  webhook_url,
  webhook_secret,
  status,
  is_active,
  created_at,
  updated_at
) VALUES
(
  gen_random_uuid(),
  (SELECT id FROM chatapp.companies WHERE deleted_at IS NULL LIMIT 1),
  'twilio',
  'Test Twilio Account',
  'Development testing account - DO NOT USE IN PRODUCTION',
  '{
    "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "authToken": "test_auth_token_encrypted",
    "phoneNumber": "+15550100"
  }'::jsonb,
  'https://your-domain.com/api/webhooks/twilio/voice/test-account-id',
  'test_webhook_secret_' || gen_random_uuid()::text,
  'pending',
  false,
  NOW(),
  NOW()
);

-- Insert test WhatsApp account
INSERT INTO chatapp.integration_accounts (
  id,
  company_id,
  account_type,
  account_name,
  description,
  credentials,
  webhook_url,
  webhook_secret,
  status,
  is_active,
  created_at,
  updated_at
) VALUES
(
  gen_random_uuid(),
  (SELECT id FROM chatapp.companies WHERE deleted_at IS NULL LIMIT 1),
  'whatsapp',
  'Test WhatsApp Business Account',
  'Development testing account - DO NOT USE IN PRODUCTION',
  '{
    "businessAccountId": "123456789012345",
    "phoneNumberId": "987654321098765",
    "phoneNumber": "+15550200",
    "accessToken": "test_access_token_encrypted"
  }'::jsonb,
  'https://your-domain.com/api/webhooks/whatsapp/call/test-account-id',
  'test_webhook_secret_' || gen_random_uuid()::text,
  'pending',
  false,
  NOW(),
  NOW()
);
```

### Seed Script Execution

Create seed script: `/src/lib/db/seeds/call-features.ts`

```typescript
import { db } from '@/lib/db';
import { aiModels } from '@/lib/db/schema';

export async function seedCallFeatures() {
  console.log('Seeding call feature data...');

  // 1. Seed OpenAI Realtime models
  await db.insert(aiModels).values([
    {
      provider: 'openai',
      modelType: 'call',
      modelName: 'gpt-4o-realtime-preview-2024-10-01',
      displayName: 'GPT-4 Realtime (Oct 2024)',
      description: 'OpenAI Realtime API for low-latency voice conversations',
      supportsAudio: true,
      inputCostPerToken: 0.000005,
      outputCostPerToken: 0.000020,
      audioCostPerSecondInput: 0.10,
      audioCostPerSecondOutput: 0.20,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    },
    // ... other models
  ]);

  // 2. Update existing models
  await db
    .update(aiModels)
    .set({ modelType: 'chat' })
    .where(sql`model_type IS NULL AND deleted_at IS NULL`);

  console.log('✓ Call feature data seeded successfully');
}
```

Run seed script:
```bash
pnpm db:seed
```

---

## 12. Enum Updates

### No New Enums Required

The call feature integration **removes** the chatbotType enum and **reuses** existing enums.

### Removed Enum

**chatbotType Enum** (if defined):
- Previously: `'chat' | 'call'`
- Status: **REMOVED**
- Replaced by: Boolean flags (enable_chat, enable_call, enabled_chat, enabled_call)

### Reused Existing Enums

**channelTypeEnum** (existing):
- Current values: `'web' | 'whatsapp' | 'facebook' | 'custom'`
- Usage: Reused for `calls.source` column
- No changes needed

### New Check Constraints (Not Enums)

Instead of creating PostgreSQL enums, use CHECK constraints for flexibility:

**calls.source**:
```sql
CHECK (source IN ('web', 'whatsapp', 'twilio', 'custom'))
```

**calls.status**:
```sql
CHECK (status IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'canceled'))
```

**integration_accounts.account_type**:
```sql
CHECK (account_type IN ('twilio', 'whatsapp', 'custom'))
```

**ai_models.model_type**:
```sql
CHECK (model_type IN ('chat', 'call', 'both'))
```

**Rationale for CHECK constraints over ENUMs**:
- Easier to add new values (no ALTER TYPE required)
- Better TypeScript integration (type inference from schema)
- Consistent with Drizzle ORM best practices
- No migration complexity when adding new values

---

## 13. Testing Strategy

### Database Migration Testing

**Development Environment**:
1. Create fresh database: `createdb chatapp_test`
2. Run existing migrations: `pnpm db:migrate`
3. Run call feature migration: `pnpm db:migrate`
4. Verify all tables created: Check schema with `\dt chatapp.*`
5. Seed test data: `pnpm db:seed`
6. Run unit tests: `pnpm test src/lib/db/**/*.test.ts`

**Staging Environment**:
1. Backup production database: `pg_dump production > staging_backup.sql`
2. Restore to staging: `psql staging < staging_backup.sql`
3. Run migration on staging: `pnpm db:migrate`
4. Verify data integrity: Run verification queries
5. Test application with staging database
6. Test rollback: `pnpm db:migrate:down`

**Production Migration**:
1. Schedule maintenance window (low traffic period)
2. Backup database: `pg_dump production > production_backup_$(date).sql`
3. Run migration: `pnpm db:migrate`
4. Verify success: Run verification queries
5. Monitor application logs for errors
6. Rollback if issues: Restore from backup

### Integration Testing

**API Endpoint Tests**:
```typescript
describe('Integration Accounts API', () => {
  it('should create Twilio integration account', async () => {
    const response = await fetch('/api/company/integration-accounts', {
      method: 'POST',
      body: JSON.stringify({
        accountType: 'twilio',
        accountName: 'Test Twilio',
        credentials: {
          accountSid: 'ACtest',
          authToken: 'test_token',
          phoneNumber: '+15550100',
        },
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.webhookUrl).toMatch(/\/api\/webhooks\/twilio\/voice\//);
  });
});
```

### Data Integrity Tests

```sql
-- Test 1: All chatbots have at least one capability enabled
SELECT id, name, enabled_chat, enabled_call
FROM chatapp.chatbots
WHERE NOT (enabled_chat = true OR enabled_call = true)
  AND deleted_at IS NULL;
-- Expected: 0 rows

-- Test 2: All call-enabled chatbots have call settings
SELECT id, name, settings->'call' as call_settings
FROM chatapp.chatbots
WHERE enabled_call = true
  AND (settings->'call' IS NULL OR settings->'call' = '{}'::jsonb)
  AND deleted_at IS NULL;
-- Expected: 0 rows

-- Test 3: All calls reference valid chatbots
SELECT c.id
FROM chatapp.calls c
LEFT JOIN chatapp.chatbots cb ON c.chatbot_id = cb.id
WHERE cb.id IS NULL
  AND c.deleted_at IS NULL;
-- Expected: 0 rows

-- Test 4: All call transcripts reference valid calls
SELECT ct.id
FROM chatapp.call_transcripts ct
LEFT JOIN chatapp.calls c ON ct.call_id = c.id
WHERE c.id IS NULL;
-- Expected: 0 rows
```

### Performance Testing

**Query Performance**:
```sql
-- Test index usage for common queries
EXPLAIN ANALYZE
SELECT * FROM chatapp.calls
WHERE company_id = 'test-company-uuid'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;
-- Should use idx_calls_company_id index

EXPLAIN ANALYZE
SELECT * FROM chatapp.call_transcripts
WHERE call_id = 'test-call-uuid'
ORDER BY start_time ASC;
-- Should use idx_call_transcripts_call_id index
```

**Load Testing**:
- Simulate 100 concurrent call sessions
- Monitor database CPU and memory usage
- Verify query response times <100ms

---

## Summary

This document provides complete database schema changes for call feature integration:

✅ **Removed**: chatbotType column from chatbot_packages and chatbots
✅ **Added**: Capability flags (enable_chat, enable_call, enabled_chat, enabled_call)
✅ **Updated**: users.avatar_url to TEXT, ai_models.model_type
✅ **Created**: integration_accounts, calls, call_transcripts tables
✅ **Extended**: companies.settings and chatbots.settings JSONB
✅ **Defined**: 13-step migration strategy with rollback procedures
✅ **Specified**: Data seeding requirements and testing strategy

Next steps:
1. Review this document for accuracy
2. Create migration file in `/src/lib/db/migrations/`
3. Test migration in development environment
4. Execute migration in staging environment
5. Verify data integrity and application functionality
6. Schedule production migration with rollback plan ready
