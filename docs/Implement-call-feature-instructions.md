# Call Feature Implementation Instructions - DELTA CHANGES ONLY

## Overview

This document provides step-by-step instructions for adding voice call functionality to chat.buzzi.ai. It focuses **ONLY** on what needs to be changed or added, without redefining existing features that already work.

**CRITICAL**: The existing chat feature works perfectly. All instructions below are designed to ADD call capabilities WITHOUT breaking or modifying existing chat functionality.

## Legend

- ✅ **EXISTING**: Features/code that already exist and work correctly
- ➕ **ADD**: New features/code that need to be created
- 🔄 **EXTEND**: Existing features that need to be enhanced
- ⚠️ **DO NOT MODIFY**: Existing code that must remain unchanged

---

## Part 1: What Already Exists (DO NOT MODIFY)

### ✅ Database Structure
- `chatbotType` enum in `chatbot_packages` table (supports "chat" | "call")
- `chatbotType` enum in `chatbots` table (supports "chat" | "call")
- `users.avatarUrl` is already `varchar(500)` (correct type, no change needed)
- Complete `conversations` and `messages` tables for chat
- `integrations` table for per-chatbot integrations
- `webhooks` table for webhook configurations
- Multi-tenancy structure with `company_id` filtering

### ✅ Chat Execution Infrastructure
- `AgentRunnerService` (src/lib/ai/execution/runner.ts) - Central chat orchestration
- `AdkExecutor` (src/lib/ai/execution/adk-executor.ts) - Google ADK integration
- `LLMClient` (src/lib/ai/llm/client.ts) - Multi-provider LLM client
- `RAGService` (src/lib/ai/rag/service.ts) - Vector search via Qdrant
- Escalation framework for Human-in-the-Loop (HITL)
- Multi-agent support via `agentsList` JSONB arrays
- SSE (Server-Sent Events) streaming for real-time chat messages

### ✅ Widget System
- Comprehensive widget customization system (20+ options)
- Existing chat widget components
- Widget settings stored in `chatbots.settings` JSONB
- Embed code generation
- Public widget API (no auth required)

### ✅ Authentication & Authorization
- NextAuth.js v5 with JWT sessions
- Three-tier authorization (master_admin, company_admin, support_agent)
- Auth guards: `requireAuth()`, `requireMasterAdmin()`, `requireCompanyAdmin()`
- Active company tracking via cookie

### ✅ AI Models
- 5 chat models already seeded in `ai_models` table:
  - GPT-5.2 (gpt-5.2)
  - GPT-5 Mini (gpt-5-mini)
  - GPT-5 Nano (gpt-5-nano)
  - Gemini 3 Pro (gemini-3-pro-preview)
  - Gemini 3 Flash (gemini-3-flash-preview)

### ⚠️ What You Must NOT Modify

**DO NOT CHANGE THESE:**
- `chatbotType` enum (already exists, works correctly)
- `users.avatarUrl` column type (already correct)
- Existing chat execution code (AgentRunnerService, AdkExecutor)
- Existing SSE streaming for chat messages
- Existing widget chat components
- Existing conversation/message tables
- Existing API routes for chat
- Existing admin UI for chat settings

---

## Part 2: What to Add (New Features)

### ➕ 1. Master Admin: Enable Call Feature Per Company

**Location**: Master Admin → Companies → [Company] → Settings → Features Tab

**What to Add**:
- New toggle in company settings UI for "Call Feature"
- Saves to `companies.settings.features.callEnabled` (boolean, default false)

**UI Changes**:
```
Add to company settings features tab:

┌─────────────────────────────────────────┐
│ Features                                │
├─────────────────────────────────────────┤
│                                         │
│ ✅ EXISTING: Chat Feature (always on)  │
│                                         │
│ ➕ ADD THIS:                            │
│ [ ] Call Feature                        │
│     Enable voice call capabilities      │
│     for this company                    │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior**:
- When enabled: Company admins can see call-related settings
- When disabled: Call features hidden from company dashboard
- Only master admins can toggle this setting

---

### ➕ 2. Master Admin: AI Models Management

**Location**: Master Admin → AI Models → Add/Edit Model

**What to Add**:
- New field: `model_type` (dropdown: "Chat Only", "Call Only", "Both")
- Filter models by type when creating chatbot packages

**UI Changes**:
```
Add to AI model form:

┌─────────────────────────────────────────┐
│ Model Details                           │
├─────────────────────────────────────────┤
│ Provider: [OpenAI ▼]                    │
│ Model ID: [gpt-5.2        ]             │
│ Display Name: [GPT-5.2    ]             │
│                                         │
│ ➕ ADD THIS:                            │
│ Model Type: [Chat Only ▼]               │
│   Options:                              │
│   - Chat Only                           │
│   - Call Only                           │
│   - Both Chat and Call                  │
│                                         │
└─────────────────────────────────────────┘
```

**New Models to Add**:
```
➕ OpenAI Realtime API
   - Provider: openai
   - Model ID: gpt-4o-realtime-preview-2024-10-01
   - Model Type: Call Only

➕ Gemini Live API
   - Provider: google
   - Model ID: gemini-2.0-flash-exp
   - Model Type: Call Only
```

**Update Existing Models**:
```
🔄 Set model_type = 'chat' for all 5 existing models:
   - GPT-5.2
   - GPT-5 Mini
   - GPT-5 Nano
   - Gemini 3 Pro
   - Gemini 3 Flash
```

---

### ➕ 3. Company Admin: Integration Accounts Management

**Location**: Company Dashboard → Integrations → Integration Accounts (NEW PAGE)

**Purpose**: Store Twilio and WhatsApp Business credentials for making/receiving calls.

**What to Add**:
- New navigation item: "Integration Accounts"
- List page showing all integration accounts
- Form to add new integration account
- Webhook URL display with copy button
- Connection test functionality

**List Page UI**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Integration Accounts                         [+ Add Account]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ 📞 Main Twilio Account                     ✅ Active     │   │
│ │ Type: Twilio                                             │   │
│ │ Phone: +1 (555) 123-4567                                 │   │
│ │ Webhook: https://app.buzzi.ai/api/webhooks/twilio/call  │   │
│ │ Last verified: 2 hours ago                               │   │
│ │                                   [Test] [Edit] [Delete] │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ 💬 Support WhatsApp                        ⚠️  Inactive  │   │
│ │ Type: WhatsApp Business                                  │   │
│ │ Phone: +1 (555) 987-6543                                 │   │
│ │ Webhook: https://app.buzzi.ai/api/webhooks/whatsapp/... │   │
│ │ Last error: Invalid access token                         │   │
│ │                                   [Test] [Edit] [Delete] │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Add Account Form - Twilio**:
```
┌─────────────────────────────────────────┐
│ Add Integration Account                 │
├─────────────────────────────────────────┤
│                                         │
│ Account Type: [Twilio ▼]                │
│                                         │
│ Account Name:                           │
│ [Main Twilio Account           ]        │
│                                         │
│ Twilio Account SID:                     │
│ [AC...                         ]        │
│                                         │
│ Twilio Auth Token:                      │
│ [•••••••••••••                 ]        │
│                                         │
│ Twilio Phone Number:                    │
│ [+1 (555) 123-4567             ]        │
│                                         │
│ Description (optional):                 │
│ [Main account for customer support]     │
│                                         │
│                  [Test Connection] [Save] │
└─────────────────────────────────────────┘
```

**Add Account Form - WhatsApp**:
```
┌─────────────────────────────────────────┐
│ Add Integration Account                 │
├─────────────────────────────────────────┤
│                                         │
│ Account Type: [WhatsApp Business ▼]     │
│                                         │
│ Account Name:                           │
│ [Support WhatsApp              ]        │
│                                         │
│ Business Account ID:                    │
│ [123456789...                  ]        │
│                                         │
│ Phone Number ID:                        │
│ [987654321...                  ]        │
│                                         │
│ Phone Number:                           │
│ [+1 (555) 987-6543             ]        │
│                                         │
│ Access Token:                           │
│ [•••••••••••••                 ]        │
│                                         │
│ Description (optional):                 │
│ [24/7 support line             ]        │
│                                         │
│                      [Verify] [Save]     │
└─────────────────────────────────────────┘
```

**After Saving - Webhook Configuration**:
```
┌─────────────────────────────────────────┐
│ ✅ Integration Account Created          │
├─────────────────────────────────────────┤
│                                         │
│ Your webhook URL:                       │
│ ┌─────────────────────────────────────┐│
│ │ https://app.buzzi.ai/api/webhooks/  ││
│ │ twilio/voice                  [Copy]││
│ └─────────────────────────────────────┘│
│                                         │
│ Next Steps:                             │
│ 1. Copy the webhook URL above           │
│ 2. Go to your Twilio console            │
│ 3. Navigate to Phone Numbers            │
│ 4. Select your phone number             │
│ 5. Under "Voice & Fax", paste the       │
│    webhook URL in "A CALL COMES IN"     │
│ 6. Set HTTP method to POST              │
│ 7. Save the configuration               │
│                                         │
│                            [Done]        │
└─────────────────────────────────────────┘
```

**Connection Test Result**:
```
┌─────────────────────────────────────────┐
│ Connection Test                         │
├─────────────────────────────────────────┤
│                                         │
│ ✅ Successfully connected to Twilio     │
│ ✅ Account SID verified                 │
│ ✅ Auth token validated                 │
│ ✅ Phone number active                  │
│                                         │
│ Your account is ready to receive calls. │
│                                         │
│                            [OK]          │
└─────────────────────────────────────────┘
```

---

### ➕ 4. Company Admin: Call Settings Configuration

**Location**: Chatbots → [Chatbot] → Call Options Tab (NEW TAB)

**When Visible**: Only shown when `chatbot.chatbotType === 'call'`

**What to Add**: New "Call Options" tab with these sections:
1. AI Model Selection
2. Voice Selection
3. Call Behavior
4. Call Features
5. Advanced Settings

**Tab Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Chatbot: Customer Support Bot                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ EXISTING TABS:                                               │
│ [General] [Behavior] [Widget] [Integrations] [Knowledge Base]  │
│                                                                 │
│ ➕ ADD THIS TAB (only if chatbotType='call'):                   │
│ [Call Options]                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Section 1: AI Model Selection**:
```
┌─────────────────────────────────────────┐
│ AI Model & Voice                        │
├─────────────────────────────────────────┤
│                                         │
│ Call AI Model:                          │
│ [OpenAI Realtime API ▼]                 │
│   ℹ️  Only models with Call capability  │
│                                         │
│ Voice:                                  │
│ ┌─────────────────────────────────────┐│
│ │ ○ Alloy          [▶ Preview] (3s)   ││
│ │ ○ Echo           [▶ Preview] (3s)   ││
│ │ ● Shimmer        [▶ Preview] (3s)   ││
│ │ ○ Nova           [▶ Preview] (3s)   ││
│ │ ○ Fable          [▶ Preview] (3s)   ││
│ │ ○ Onyx           [▶ Preview] (3s)   ││
│ └─────────────────────────────────────┘│
│                                         │
│ Voice Speed:                            │
│ [────●────] 1.0x                        │
│ 0.5x                 2.0x               │
│                                         │
└─────────────────────────────────────────┘
```

**Section 2: Call Behavior**:
```
┌─────────────────────────────────────────┐
│ Call Behavior                           │
├─────────────────────────────────────────┤
│                                         │
│ Greeting Message:                       │
│ ┌─────────────────────────────────────┐│
│ │ Hi! I'm your AI assistant. How can  ││
│ │ I help you today?                   ││
│ └─────────────────────────────────────┘│
│                                         │
│ End Call Phrase:                        │
│ [goodbye                       ]        │
│ ℹ️  User saying this will end the call  │
│                                         │
│ Silence Timeout:                        │
│ [────────●──] 180 seconds              │
│ 30s                          300s       │
│ ℹ️  Auto-disconnect after silence       │
│                                         │
│ Max Call Duration:                      │
│ [──●────────] 10 minutes               │
│ 1 min                        60 min     │
│                                         │
└─────────────────────────────────────────┘
```

**Section 3: Call Features**:
```
┌─────────────────────────────────────────┐
│ Call Features                           │
├─────────────────────────────────────────┤
│                                         │
│ [✓] Real-time Transcription             │
│     Show what user and agent are saying │
│                                         │
│ [ ] Call Recording                      │
│     Save audio recordings of calls      │
│     ⚠️  Check local regulations          │
│                                         │
│ [✓] Allow Interruption                  │
│     User can interrupt agent mid-speech │
│                                         │
│ [✓] Knowledge Base Access               │
│     Agent can search company knowledge  │
│     (Uses chatbot's linked KB categories)│
│                                         │
└─────────────────────────────────────────┘
```

**Section 4: Advanced Settings**:
```
┌─────────────────────────────────────────┐
│ Advanced Settings                       │
├─────────────────────────────────────────┤
│                                         │
│ Voice Activity Detection (VAD):         │
│ [────●────] 0.5                         │
│ 0.0 (sensitive)      1.0 (less sensitive)│
│ ℹ️  Controls when agent detects speech  │
│                                         │
│ [✓] Echo Cancellation                   │
│     Reduce echo and feedback            │
│                                         │
│ [✓] Noise Suppression                   │
│     Filter background noise             │
│                                         │
└─────────────────────────────────────────┘
```

---

### 🔄 5. Widget Settings: Conditional Call Options

**Location**: Chatbots → [Chatbot] → Widget Tab

**What to Extend**: Add call-specific options when `chatbotType === 'call'`

**⚠️ DO NOT MODIFY**: Existing chat widget options

**Conditional Rendering**:
```
✅ EXISTING (always shown):
- Widget position
- Primary color
- Chat button icon
- Welcome message
- Input placeholder
- Send button text
- ...all other existing chat options

➕ ADD THESE (only shown when chatbotType='call'):

┌─────────────────────────────────────────┐
│ Call Button Settings                    │
├─────────────────────────────────────────┤
│                                         │
│ Call Button Icon:                       │
│ ┌────────┐                              │
│ │  📞   │ [Change Icon]                 │
│ └────────┘                              │
│                                         │
│ Call Button Text:                       │
│ [Call Us                       ]        │
│                                         │
│ Call Button Color:                      │
│ [#10b981] ████                          │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Call Interface Settings                 │
├─────────────────────────────────────────┤
│                                         │
│ Audio Visualizer Style:                 │
│ ○ Wave   ● Orb                          │
│                                         │
│ [✓] Show Call Duration                  │
│ [✓] Show Live Transcript                │
│                                         │
│ Call Welcome Message:                   │
│ ┌─────────────────────────────────────┐│
│ │ Press the call button to talk with  ││
│ │ our AI assistant.                   ││
│ └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

**Widget Preview** (when chatbotType='call'):
```
Right panel shows preview with both buttons:

┌─────────────────┐
│                 │
│                 │
│                 │
│       ┌───┐     │  ← Call button (above)
│       │📞 │     │
│       └───┘     │
│                 │
│       ┌───┐     │  ← Chat button (below, if chatbotType supports chat)
│       │💬 │     │
│       └───┘     │
└─────────────────┘
```

---

### ➕ 6. Widget: Call Interface (End User View)

**What to Add**: New call interface components for widget

**Initial State** (before call):
```
┌─────────────────────────────────────────┐
│  ← Back to Chat                         │
├─────────────────────────────────────────┤
│                                         │
│          ┌─────────────┐                │
│          │             │                │
│          │      📞     │                │
│          │             │                │
│          └─────────────┘                │
│                                         │
│     Start Voice Call                    │
│                                         │
│  Press the button below to talk         │
│  with our AI assistant                  │
│                                         │
│     ┌─────────────────────┐             │
│     │   🎤 Start Call    │             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

**During Call** (active):
```
┌─────────────────────────────────────────┐
│  Call in Progress          🔴 00:42     │
├─────────────────────────────────────────┤
│                                         │
│          ┌─────────────┐                │
│          │             │                │
│          │   ◉ ◉ ◉    │  ← Animated orb│
│          │   ◉ ◉ ◉    │    visualizer  │
│          │   ◉ ◉ ◉    │                │
│          └─────────────┘                │
│                                         │
│          🔊 Agent speaking...           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Transcript                        │  │
│  ├───────────────────────────────────┤  │
│  │ You: Hi, I need help with...     │  │
│  │                                   │  │
│  │ Agent: Of course! I'd be happy   │  │
│  │ to help you with that. Can you   │  │
│  │ provide more details?             │  │
│  │                                   │  │
│  │ You: Yes, I'm having trouble...  │  │
│  └───────────────────────────────────┘  │
│                                         │
│     ┌──────┐        ┌──────┐           │
│     │  🔇  │        │  ⏹  │           │
│     │ Mute │        │ End  │           │
│     └──────┘        └──────┘           │
│                                         │
└─────────────────────────────────────────┘
```

**Call Ended**:
```
┌─────────────────────────────────────────┐
│  Call Ended                             │
├─────────────────────────────────────────┤
│                                         │
│          ┌─────────────┐                │
│          │             │                │
│          │      ✓      │                │
│          │             │                │
│          └─────────────┘                │
│                                         │
│     Thank you for calling!              │
│                                         │
│     Duration: 2 minutes 34 seconds      │
│                                         │
│     ┌─────────────────────┐             │
│     │ ⬇ Download Transcript│            │
│     └─────────────────────┘             │
│                                         │
│     ┌─────────────────────┐             │
│     │  💬 Start Chat      │             │
│     └─────────────────────┘             │
│                                         │
│     ┌─────────────────────┐             │
│     │  📞 Call Again      │             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

---

### ➕ 7. Chatbot Test Page: Call Testing

**Location**: Chatbots → [Chatbot] → Test Tab

**What to Extend**: Add "Test Call" button when `chatbotType === 'call'`

**UI Changes**:
```
✅ EXISTING (always shown):
┌─────────────────────────────────────────┐
│ Test Your Chatbot                       │
├─────────────────────────────────────────┤
│                                         │
│ [💬 Test Chat]    ← Always available    │
│                                         │
└─────────────────────────────────────────┘

➕ ADD THIS (when chatbotType='call'):
┌─────────────────────────────────────────┐
│ Test Your Chatbot                       │
├─────────────────────────────────────────┤
│                                         │
│ [💬 Test Chat]                          │
│                                         │
│ [📞 Test Call]    ← Add this            │
│                                         │
└─────────────────────────────────────────┘
```

**Test Call Flow**:
1. Click "Test Call" button
2. Browser requests microphone permission
3. Call interface opens in preview mode
4. Admin can test voice interaction
5. View live transcript
6. End call and review summary

---

## Part 3: Technical Implementation Details

### ➕ Database Changes

**See `docs/call-feature-database-updates-needed.md` for complete database migration details.**

Summary of changes:
- ➕ Add `model_type` column to `ai_models` table
- ➕ Create `call_integration_accounts` table
- ➕ Create `calls` table
- ➕ Create `call_transcripts` table
- ➕ Create new enums: `accountTypeEnum`, `callStatusEnum`
- 🔄 Add 'voice_call' to existing `channelTypeEnum`
- 🔄 Update `companies.settings` JSONB structure (add `features.callEnabled`)
- 🔄 Update `chatbots.settings` JSONB structure (add `call` object)
- ⚠️ DO NOT remove or modify `chatbotType` enum (already exists)
- ⚠️ DO NOT modify `users.avatarUrl` column (already correct type)

### ➕ Backend Services

**See `docs/call-feature-architecture.md` for complete architecture details.**

Key services to create:
- ➕ `CallRunnerService` - Central orchestration (parallel to AgentRunnerService)
- ➕ `OpenAIRealtimeProvider` - OpenAI Realtime API integration
- ➕ `GeminiLiveProvider` - Gemini Live API integration
- ➕ `WebSocketCallHandler` - Handle browser WebSocket connections
- ➕ `WhatsAppCallHandler` - Handle WhatsApp WebRTC calls
- ➕ `TwilioCallHandler` - Handle Twilio phone calls
- ➕ `CallSessionManager` - Track active call sessions
- ➕ Audio processing utilities (codec conversion, resampling)

### ➕ API Routes

New API routes to create:
- ➕ `POST /api/widget/call/session` - Create call session
- ➕ `WebSocket /api/widget/call/[sessionId]/ws` - Audio streaming
- ➕ `POST /api/widget/call/[sessionId]/end` - End call
- ➕ `GET /api/company/integration-accounts` - List integration accounts
- ➕ `POST /api/company/integration-accounts` - Create integration account
- ➕ `GET/PATCH/DELETE /api/company/integration-accounts/[id]` - Manage account
- ➕ `GET/PATCH /api/company/chatbots/[id]/call-settings` - Call settings CRUD
- ➕ `POST /api/webhooks/whatsapp/call` - WhatsApp webhook
- ➕ `POST /api/webhooks/twilio/voice` - Twilio voice webhook

### ➕ Frontend Components

New React components to create:
- ➕ `IntegrationAccountsList.tsx` - List integration accounts
- ➕ `IntegrationAccountForm.tsx` - Add/edit integration account
- ➕ `CallSettingsForm.tsx` - Configure call settings
- ➕ `VoiceSelector.tsx` - Select and preview voices
- ➕ `CallButton.tsx` - Widget call button
- ➕ `CallInterface.tsx` - Call UI container
- ➕ `AudioVisualizer.tsx` - Animated audio visualizer (Wave/Orb)
- ➕ `TranscriptDisplay.tsx` - Real-time transcript display
- ➕ `CallControls.tsx` - Mute/end call buttons

---

## Part 4: User Flows

**See `docs/call-feature-activity-flow.md` for detailed step-by-step user flows.**

### Master Admin Flow

1. Navigate to Companies → [Company] → Settings
2. Go to Features tab
3. Toggle "Call Feature" to enabled
4. Save settings
5. System updates `companies.settings.features.callEnabled = true`
6. Company admin can now see call-related options

### Company Admin Flow

1. **Set Up Integration Account**:
   - Navigate to Integrations → Integration Accounts
   - Click "Add Account"
   - Select type (Twilio/WhatsApp)
   - Enter credentials
   - Test connection
   - Save account
   - Copy webhook URL to provider

2. **Configure Call Settings**:
   - Navigate to Chatbots → [Chatbot] → Call Options
   - Select AI model (filtered by model_type='call')
   - Choose voice and preview it
   - Configure greeting, timeouts, features
   - Save settings

3. **Customize Widget**:
   - Navigate to Chatbots → [Chatbot] → Widget
   - Configure call button appearance (only shown if chatbotType='call')
   - Set visualizer style
   - Preview changes
   - Save configuration

4. **Test Call**:
   - Navigate to Chatbots → [Chatbot] → Test
   - Click "Test Call"
   - Grant microphone permission
   - Test voice interaction
   - Review transcript
   - End call

### End User Flow

1. Visit website with embedded widget
2. See call button (if chatbotType='call')
3. Click call button
4. Grant microphone permission
5. Call interface opens
6. Agent speaks greeting
7. User speaks, agent responds
8. View live transcript (if enabled)
9. Can interrupt agent mid-speech
10. Can mute/unmute microphone
11. End call when done
12. Download transcript (optional)
13. Rate call (optional)

---

## Part 5: Key Behaviors

### Voice Activity Detection (VAD)

**How it Works**:
- Server-side VAD via OpenAI Realtime API
- No button press needed - automatic turn-taking
- Configurable threshold (0.0-1.0, default 0.5)
- Detects when user starts/stops speaking

**Events**:
- `speech_started` - User began speaking
- `speech_stopped` - User finished speaking
- Agent automatically waits for user to finish

### User Interruption

**Behavior**:
- User can interrupt agent mid-speech
- System detects new speech while agent talking
- Immediately cancels agent response
- Agent stops speaking
- User can provide new input
- Context preserved (conversation history intact)

**Visual Feedback**:
- "Agent speaking..." indicator disappears
- "You are speaking..." appears
- Audio visualizer switches to user mode

### Silence Timeout

**Default**: 180 seconds (3 minutes)

**Behavior**:
1. Timer starts when user stops speaking
2. If no speech detected for timeout duration:
   - Agent may prompt: "Are you still there?"
   - If no response after prompt:
     - Call ends gracefully
     - "Call ended due to inactivity" message
     - Transcript saved with reason: "silence_timeout"

**Configurable**: Admin can adjust timeout (30-300 seconds)

### Knowledge Base Access

**✅ EXISTING**: Chatbots already have knowledge base categories linked

**➕ ADD**: Make knowledge base accessible during calls

**How it Works**:
1. User asks question during call
2. Agent recognizes need for information
3. Agent automatically searches linked knowledge base categories
4. Retrieves relevant information via RAG
5. Agent speaks answer using retrieved context
6. Same RAG service as chat (no duplication)

**Example**:
```
User: "What are your business hours?"
→ Agent searches knowledge base for "business hours"
→ Finds: "We're open Monday-Friday, 9 AM - 5 PM"
→ Agent speaks: "We're open Monday through Friday,
   from 9 AM to 5 PM."
```

### Escalation to Human

**✅ EXISTING**: Chat escalation framework already works

**➕ EXTEND**: Add call escalation support

**How it Works**:
1. User requests human during call: "I want to talk to a person"
2. Agent recognizes escalation intent
3. Agent says: "Let me connect you with a team member. Please hold."
4. System finds available support agent
5. If agent available:
   - Call transfers to human agent
   - Agent joins call
   - Sees call transcript so far
   - Can continue conversation
6. If no agent available:
   - Agent says: "All agents are busy. Can I take a message?"
   - Collects callback information
   - Creates ticket in inbox

---

## Part 6: Error Handling

### Call Connection Failed

**Scenario**: Unable to connect to OpenAI/Gemini provider

**User Experience**:
```
┌─────────────────────────────────────────┐
│  Connection Failed                      │
├─────────────────────────────────────────┤
│                                         │
│          ┌─────────────┐                │
│          │             │                │
│          │      ✗      │                │
│          │             │                │
│          └─────────────┘                │
│                                         │
│     Unable to connect                   │
│                                         │
│  We're having trouble connecting to     │
│  our call service. Please try again     │
│  in a moment.                           │
│                                         │
│     ┌─────────────────────┐             │
│     │  🔄 Retry Call      │             │
│     └─────────────────────┘             │
│                                         │
│     ┌─────────────────────┐             │
│     │  💬 Start Chat      │             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

**System Behavior**:
- Retry 3 times with exponential backoff
- Log error with full context
- Notify company admin if persistent
- Offer chat fallback

### Microphone Permission Denied

**User Experience**:
```
┌─────────────────────────────────────────┐
│  Microphone Access Required             │
├─────────────────────────────────────────┤
│                                         │
│          ┌─────────────┐                │
│          │             │                │
│          │      🎤     │                │
│          │             │                │
│          └─────────────┘                │
│                                         │
│     Permission Needed                   │
│                                         │
│  To make voice calls, we need access    │
│  to your microphone. Please enable      │
│  microphone permissions in your         │
│  browser settings.                      │
│                                         │
│     ┌─────────────────────┐             │
│     │  ⚙️  Browser Settings│            │
│     └─────────────────────┘             │
│                                         │
│     ┌─────────────────────┐             │
│     │  💬 Use Chat Instead│             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

### Integration Account Inactive

**Scenario**: Twilio/WhatsApp credentials invalid or expired

**Admin Dashboard Alert**:
```
┌─────────────────────────────────────────┐
│ ⚠️  Integration Account Error            │
├─────────────────────────────────────────┤
│                                         │
│ Your Twilio integration "Main Account"  │
│ has failed verification.                │
│                                         │
│ Error: Invalid auth token               │
│ Last attempted: 5 minutes ago           │
│                                         │
│ Calls through this integration are      │
│ currently unavailable.                  │
│                                         │
│     ┌─────────────────────┐             │
│     │  Fix Integration   │             │
│     └─────────────────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

**User Experience**:
- Call button disabled
- Message: "Voice calls temporarily unavailable"
- Chat still works (if supported)

---

## Part 7: Testing Checklist

### Unit Tests
- [ ] Audio conversion utilities (PCM16, Opus, PCMU)
- [ ] Audio resampling (8kHz, 16kHz, 24kHz, 48kHz)
- [ ] CallRunnerService executor caching
- [ ] OpenAI provider event handling
- [ ] WebSocket handler audio routing

### Integration Tests
- [ ] Create call session via API
- [ ] WebSocket connection upgrade
- [ ] Audio streaming end-to-end
- [ ] Webhook signature validation
- [ ] Integration account CRUD

### E2E Tests
- [ ] Master admin enables call feature
- [ ] Company admin creates integration account
- [ ] Company admin configures call settings
- [ ] Widget displays call button
- [ ] End user makes call successfully
- [ ] Transcript saved correctly
- [ ] User interruption works
- [ ] Silence timeout triggers
- [ ] Knowledge base accessed during call
- [ ] Escalation to human works

### Manual Testing
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test on mobile devices
- [ ] Test audio quality
- [ ] Test with slow internet connection
- [ ] Test with background noise
- [ ] Verify microphone permission flow
- [ ] Verify call recordings (if enabled)

---

## Part 8: Security Checklist

- [ ] Encrypt integration account credentials (AES-256)
- [ ] Validate webhook signatures (HMAC-SHA256)
- [ ] Rate limit webhook endpoints
- [ ] Use secure WebSocket (wss://) in production
- [ ] Generate secure session tokens (UUID v4)
- [ ] Expire sessions after 24 hours
- [ ] Never log raw audio data
- [ ] Never log decrypted credentials
- [ ] Use signed URLs for recording access (10-min expiry)
- [ ] Validate audio data size (prevent memory exhaustion)
- [ ] Implement CORS properly for widget API
- [ ] Sanitize user input in transcripts

---

## Part 9: Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit, integration, E2E)
- [ ] Database migration tested in staging
- [ ] Performance testing completed (concurrent calls)
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Monitoring dashboards configured
- [ ] Alert rules configured

### Deployment Steps
1. [ ] Run database migration
2. [ ] Verify migration success
3. [ ] Deploy backend code
4. [ ] Deploy frontend code
5. [ ] Verify health checks
6. [ ] Enable feature flag for pilot companies
7. [ ] Monitor error rates
8. [ ] Monitor call success rates
9. [ ] Monitor audio latency
10. [ ] Gradual rollout to all companies

### Post-Deployment
- [ ] Monitor call metrics for 24 hours
- [ ] Verify no impact on existing chat functionality
- [ ] Collect user feedback
- [ ] Document any issues encountered
- [ [ ] Plan improvements based on feedback

---

## Conclusion

This document provides complete instructions for adding call functionality to chat.buzzi.ai using a **delta-based approach**. All instructions are designed to ADD new features WITHOUT breaking existing chat functionality.

**Key Reminders**:
- ✅ Preserve all existing chat features
- ➕ Add call infrastructure in parallel
- 🔄 Extend existing features minimally
- ⚠️ Never modify core chat code

Follow the implementation steps, test thoroughly at each phase, and verify that existing functionality remains unchanged throughout the process.
