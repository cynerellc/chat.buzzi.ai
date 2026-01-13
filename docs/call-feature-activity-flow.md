# Call Feature Activity Flows - Detailed User Journeys

## Document Purpose

This document provides comprehensive, step-by-step activity flows for all user roles interacting with the call feature. Each flow includes specific UI interactions, system behaviors, validation rules, and error handling scenarios.

---

## Table of Contents

1. [Master Admin Flows](#1-master-admin-flows)
2. [Company Admin Flows](#2-company-admin-flows)
3. [End User Flows](#3-end-user-flows)
4. [Error Handling Flows](#4-error-handling-flows)
5. [Edge Cases and Special Scenarios](#5-edge-cases-and-special-scenarios)

---

## 1. Master Admin Flows

### 1.1 Enable Call Feature for Company

**Purpose**: Grant a company access to call capabilities

**Prerequisites**:
- User has master_admin role
- Company exists and is active

**Flow Steps**:

1. **Navigate to Company Management**
   - User clicks "Admin" in top navigation
   - User clicks "Companies" in sidebar
   - System displays list of all companies (paginated, 20 per page)
   - User searches or scrolls to find target company
   - User clicks company name to open company details

2. **Access Company Settings**
   - System displays company overview page with tabs: Overview, Settings, Users, Billing, Analytics
   - User clicks "Settings" tab
   - System loads company settings form

3. **Navigate to Features Section**
   - Settings page shows sections: General, Features, Branding, API Keys, Webhooks
   - User scrolls to or clicks "Features" section
   - System displays current feature toggles:
     - ✅ Chat Feature (enabled)
     - ✅ Knowledge Base (enabled)
     - ✅ Escalation (enabled)
     - ⬜ Call Feature (disabled) ← Current state

4. **Enable Call Feature**
   - User clicks toggle switch next to "Call Feature"
   - System shows confirmation dialog:
     ```
     Enable Call Feature for [Company Name]?

     This will allow company admins to:
     - Create call-enabled chatbots
     - Configure integration accounts (Twilio, WhatsApp)
     - Access call analytics and recordings

     Note: Call features may incur additional costs for AI provider usage.

     [Cancel] [Enable Call Feature]
     ```
   - User clicks "Enable Call Feature"
   - System validates: User is master admin
   - System updates database:
     ```sql
     UPDATE chatapp.companies
     SET settings = jsonb_set(settings, '{features,callEnabled}', 'true'::jsonb, true),
         updated_at = NOW()
     WHERE id = $1;
     ```
   - System displays success toast: "✓ Call feature enabled for [Company Name]"
   - Toggle switch updates to checked state: ✅ Call Feature (enabled)

5. **Verify Enablement**
   - User can optionally test by:
     - Impersonating company admin
     - Verifying call-related menu items now visible
     - Checking chatbot package filters show call-enabled packages

**Success Criteria**:
- companies.settings.features.callEnabled = true
- Company admin sees integration accounts menu
- Company admin can create call-enabled chatbots

**Rollback**:
- User toggles "Call Feature" off
- System confirms: "Disable call feature? Existing call-enabled chatbots will stop accepting calls."
- System sets callEnabled = false
- Existing call configurations preserved but inactive

---

### 1.2 Create Call-Enabled Chatbot Package

**Purpose**: Define a reusable chatbot template with call capabilities

**Prerequisites**:
- User has master_admin role
- At least one call-capable AI model exists (model_type='call' or 'both')

**Flow Steps**:

1. **Navigate to Chatbot Packages**
   - User clicks "Admin" → "Chatbot Packages"
   - System displays list of existing packages (sortable by name, type, created date)
   - User clicks "+ New Package" button

2. **Enter Basic Package Information**
   - System displays package creation form
   - User fills out:
     - **Package Name**: "Premium Support - Voice Enabled" (required, 3-100 characters)
     - **Package Description**: "Enterprise support package with voice call capabilities and 24/7 availability" (optional, max 500 characters)
     - **Package Type**: Dropdown (Basic, Standard, Premium, Enterprise, Custom) → User selects "Enterprise"

3. **Select Capabilities**
   - System displays "Capabilities" section with checkboxes:
     - ✅ **Enable Chat** (checked by default)
       - Tooltip: "Allow chatbots created from this package to handle text chat"
     - ⬜ **Enable Call** (unchecked by default)
       - Tooltip: "Allow chatbots created from this package to handle voice calls"
   - User checks "Enable Call" checkbox
   - System validates: At least one capability must be enabled
   - If user unchecks both: System shows error "At least one capability (Chat or Call) must be enabled"
   - System shows success indicator: ✅ Both chat and call enabled

4. **Configure Chat Agent** (if Enable Chat checked)
   - System displays "Chat Agent Configuration" section
   - User configures:
     - **Chat AI Model**: Dropdown filtered by model_type IN ('chat', 'both')
       - Options: GPT-4 Turbo, Claude 3.5 Sonnet, Gemini 1.5 Pro
       - User selects "Claude 3.5 Sonnet"
     - **System Prompt**: Textarea (1000 character limit)
       - Default: "You are a helpful customer support agent..."
       - User enters custom prompt for chat interactions
     - **Temperature**: Slider (0.0 - 1.0, default: 0.7)
     - **Max Tokens**: Number input (100-4000, default: 1000)

5. **Configure Call Agent** (if Enable Call checked)
   - System displays "Call Agent Configuration" section
   - User configures:
     - **Call AI Model**: Dropdown filtered by model_type IN ('call', 'both')
       - Options: GPT-4 Realtime (Oct 2024), Gemini 2.0 Flash Live
       - User selects "GPT-4 Realtime (Oct 2024)"
     - **Voice**: Dropdown (provider-specific voices)
       - Options: Alloy, Echo, Fable, Onyx, Nova, Shimmer
       - User selects "Nova"
       - Preview button available: User clicks 🔊 to hear voice sample
         - System plays 5-second audio clip: "Hello, I'm your AI assistant"
     - **Call Greeting**: Textarea (500 character limit)
       - Default: "Hi, I'm your AI assistant. How can I help you today?"
       - User enters: "Thank you for calling Premium Support. I'm here to help with any questions you have."
     - **System Prompt**: Textarea (1000 character limit)
       - Default: "You are a voice assistant providing support over the phone..."
       - User enters custom prompt optimized for voice interaction
     - **Voice Settings**:
       - Speed: Slider (0.5x - 2.0x, default: 1.0x)
       - Pitch: Slider (-1.0 to +1.0, default: 0.0)

6. **Configure Knowledge Base Access**
   - System displays "Knowledge Base" section
   - User selects:
     - **Knowledge Categories**: Multi-select dropdown
       - Shows all master admin created categories
       - User selects: "Product Documentation", "Troubleshooting", "FAQs"
     - **RAG Settings**:
       - Top K results: Number input (1-20, default: 5)
       - Similarity threshold: Slider (0.5-1.0, default: 0.75)
   - Knowledge base access is shared between chat and call agents

7. **Configure Tools/Functions** (optional)
   - System displays "Available Tools" section
   - User can enable:
     - ✅ Knowledge Base Search (always available if KB configured)
     - ⬜ Order Lookup API
     - ⬜ Calendar Integration
     - ⬜ CRM Integration
   - Each tool has configuration fields (API keys, endpoints)

8. **Set Package Pricing** (optional)
   - System displays "Pricing & Limits" section
   - User configures:
     - **Monthly Price**: $499.00
     - **Included Chat Messages**: 10,000 per month
     - **Included Call Minutes**: 500 minutes per month
     - **Overage Rate (Chat)**: $0.05 per message
     - **Overage Rate (Call)**: $0.20 per minute

9. **Review and Save**
   - User scrolls to bottom and clicks "Create Package" button
   - System validates:
     - ✓ Package name unique and valid
     - ✓ At least one capability enabled
     - ✓ If enable_call=true, call AI model selected
     - ✓ If enable_chat=true, chat AI model selected
     - ✓ All required fields completed
   - System saves to database:
     ```sql
     INSERT INTO chatapp.chatbot_packages (
       name, description, package_type,
       enable_chat, enable_call,
       chat_model_id, call_model_id,
       system_prompt_chat, system_prompt_call,
       voice_id, voice_provider,
       knowledge_categories, tools_config, pricing,
       created_at, updated_at
     ) VALUES (...);
     ```
   - System displays success message: "✓ Package 'Premium Support - Voice Enabled' created successfully"
   - System redirects to package list page
   - New package appears in list with badge: "CHAT + CALL"

**Success Criteria**:
- Package saved with enable_chat=true, enable_call=true
- Company admins can now select this package when creating chatbots
- Package appears in filtered views for call-enabled packages

**Validation Rules**:
- Package name: 3-100 characters, unique within master admin packages
- At least one capability (chat or call) must be enabled
- If enable_call=true: Must select call-capable AI model
- If enable_chat=true: Must select chat-capable AI model
- Voice ID must be valid for selected voice provider

---

### 1.3 Manage AI Models

**Purpose**: Add and configure AI models for chat and call capabilities

**Prerequisites**:
- User has master_admin role
- API keys for AI providers configured in system settings

**Flow Steps**:

1. **Navigate to AI Models Management**
   - User clicks "Admin" → "AI Models"
   - System displays table of existing models:
     ```
     | Provider  | Model Name                    | Type | Status | Actions |
     |-----------|-------------------------------|------|--------|---------|
     | OpenAI    | GPT-4 Turbo                  | Chat | Active | Edit    |
     | OpenAI    | GPT-4 Realtime (Oct 2024)    | Call | Active | Edit    |
     | Anthropic | Claude 3.5 Sonnet            | Chat | Active | Edit    |
     | Google    | Gemini 2.0 Flash Live        | Call | Active | Edit    |
     ```
   - User clicks "+ Add AI Model" button

2. **Select Provider**
   - System displays "Add AI Model" modal
   - User selects:
     - **Provider**: Dropdown (OpenAI, Google, Anthropic, Custom)
     - User selects "Google"
   - System shows provider-specific fields

3. **Enter Model Details**
   - User fills out:
     - **Model Name**: "gemini-2.0-flash-exp" (required, must match provider's model ID)
     - **Display Name**: "Gemini 2.0 Flash Live" (required, shown in UI dropdowns)
     - **Description**: "Experimental multimodal model with real-time voice capabilities and function calling"
     - **Model Type**: Radio buttons
       - ⚪ Chat Only - For text-based conversations
       - 🔘 Call Only - For voice conversations ← User selects
       - ⚪ Both - Supports both chat and call
     - **Supports Audio**: Checkbox ✅ (auto-checked for Call/Both types)

4. **Configure Model Parameters**
   - **Context Window**: 1,000,000 tokens
   - **Max Output Tokens**: 8,192 tokens
   - **Supports Functions**: Checkbox ✅
   - **Supports Streaming**: Checkbox ✅
   - **Supports Vision**: Checkbox ⬜

5. **Set Cost Parameters**
   - User enters pricing (for cost tracking and billing):
     - **Input Cost per Token**: $0.00000075 ($0.075 per 1M tokens)
     - **Output Cost per Token**: $0.0000030 ($0.30 per 1M tokens)
     - **Audio Input Cost per Second**: $0.05
     - **Audio Output Cost per Second**: $0.10
   - System calculates and displays:
     - Estimated cost per 10-minute call: ~$48
     - Estimated cost per 100-message chat: ~$0.50

6. **Configure API Settings**
   - **API Endpoint**: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp"
   - **Authentication**: Dropdown (API Key, OAuth, Service Account)
   - **Rate Limits**:
     - Requests per minute: 60
     - Tokens per minute: 500,000

7. **Test Model Connection** (optional)
   - User clicks "Test Connection" button
   - System attempts API call to provider:
     ```javascript
     // Test call with minimal prompt
     const testPrompt = "Say 'Connection successful' if you can hear this.";
     const response = await googleAI.generateContent(testPrompt);
     ```
   - System displays result:
     - ✅ Success: "Connection successful! Model responded in 234ms"
     - OR ❌ Error: "Connection failed: Invalid API key"

8. **Save Model**
   - User clicks "Add Model" button
   - System validates:
     - ✓ Model name unique within provider
     - ✓ Display name not empty
     - ✓ Model type selected
     - ✓ Cost parameters are positive numbers
   - System saves to database:
     ```sql
     INSERT INTO chatapp.ai_models (
       provider, model_type, model_name, display_name,
       description, supports_audio, context_window, max_output_tokens,
       input_cost_per_token, output_cost_per_token,
       audio_cost_per_second_input, audio_cost_per_second_output,
       created_at, updated_at
     ) VALUES (...);
     ```
   - System displays success: "✓ AI Model 'Gemini 2.0 Flash Live' added successfully"
   - Model appears in table and is available in call settings dropdowns

**Success Criteria**:
- Model saved with model_type='call'
- Model appears in call settings AI model dropdown for company admins
- Model does NOT appear in chat settings dropdown (filtered by model_type)

**Edit Existing Model**:
- User clicks "Edit" on existing model
- System loads current values
- User modifies fields (e.g., update cost per token)
- User clicks "Save Changes"
- System updates database and displays success

**Deactivate Model**:
- User clicks "..." menu → "Deactivate"
- System confirms: "Deactivate model? Chatbots using this model will continue to work, but new chatbots cannot select it."
- User confirms
- System sets status='inactive' (soft disable, not deleted)
- Model no longer appears in dropdowns for new chatbot configuration

---

### 1.4 Monitor Call Usage (Analytics Dashboard)

**Purpose**: Track call metrics across all companies for billing and performance monitoring

**Prerequisites**:
- User has master_admin role
- At least one call has been made in the system

**Flow Steps**:

1. **Navigate to Call Analytics**
   - User clicks "Admin" → "Analytics" → "Calls"
   - System displays call analytics dashboard

2. **View High-Level Metrics**
   - System displays KPI cards at top:
     ```
     ┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
     │   Total Calls       │  Total Duration     │   Success Rate      │   Avg Call Length   │
     │   12,847           │   4,230 hours      │      94.2%         │     19.8 minutes    │
     │   ↑ 23% this month │   ↑ 31% this month │   ↓ 0.8% this month│    ↑ 2.1 min        │
     └─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
     ```

3. **Filter Data**
   - User applies filters:
     - **Date Range**: Dropdown or date picker
       - Today, Yesterday, Last 7 Days, Last 30 Days, Custom Range
       - User selects "Last 30 Days"
     - **Company**: Multi-select dropdown (all companies)
       - User selects specific company or "All Companies"
     - **Status**: Multi-select (completed, failed, in_progress)
       - User selects "All"
     - **Provider**: Multi-select (OpenAI, Google)
       - User selects "OpenAI"
   - System updates all charts and tables based on filters

4. **View Calls Over Time Chart**
   - System displays line chart:
     - X-axis: Date
     - Y-axis: Number of calls
     - Lines: Total Calls, Successful Calls, Failed Calls
   - User can hover over data points to see exact values
   - User can click legend to show/hide specific lines

5. **View Calls by Company Table**
   - System displays sortable table:
     ```
     | Company Name       | Total Calls | Total Minutes | Success Rate | Avg Duration | Cost Estimate |
     |--------------------|-------------|---------------|--------------|--------------|---------------|
     | Acme Corp          | 3,452       | 1,204 hrs     | 96.1%        | 20.9 min     | $8,432.50     |
     | TechStart Inc      | 2,189       | 843 hrs       | 92.3%        | 23.1 min     | $6,901.20     |
     | Global Solutions   | 1,876       | 692 hrs       | 95.8%        | 22.2 min     | $5,743.80     |
     ```
   - User can:
     - Sort by any column (click column header)
     - Click company name to view company-specific call details
     - Export table to CSV

6. **View Provider Distribution**
   - System displays pie chart:
     - OpenAI Realtime: 78.3% (10,052 calls)
     - Gemini Live: 21.7% (2,795 calls)
   - User can click slice to filter other charts by provider

7. **View Call Sources Distribution**
   - System displays bar chart:
     - Web Widget: 8,234 calls (64.1%)
     - WhatsApp: 3,012 calls (23.4%)
     - Twilio Phone: 1,601 calls (12.5%)

8. **View Failed Calls Analysis**
   - System displays table of failed calls:
     ```
     | Error Type                    | Count | Percentage |
     |-------------------------------|-------|------------|
     | Provider Connection Timeout   | 342   | 45.8%      |
     | User Microphone Permission    | 198   | 26.5%      |
     | Audio Stream Error            | 127   | 17.0%      |
     | Invalid Webhook Signature     | 81    | 10.8%      |
     ```
   - User can click error type to see specific call records with that error

9. **Drill Down to Specific Call**
   - User clicks "View All Calls" button
   - System displays paginated call list:
     ```
     | Call ID  | Company       | Chatbot        | Date/Time         | Duration | Status    | Actions |
     |----------|---------------|----------------|-------------------|----------|-----------|---------|
     | 3f4a8... | Acme Corp     | Support Bot    | 2024-01-15 10:23 | 18:42    | Completed | View    |
     | 7b2c9... | TechStart Inc | Sales Assistant| 2024-01-15 10:21 | 5:12     | Failed    | View    |
     ```
   - User clicks "View" on specific call
   - System displays call detail page:
     - Call metadata (start/end time, duration, source)
     - Full transcript with timestamps
     - Audio recording player (if available)
     - Quality metrics (confidence scores, sentiment)
     - AI model and settings used
     - Error details (if failed)

10. **Export Data**
    - User clicks "Export" button
    - System shows export options:
      - Format: CSV, JSON, Excel
      - Include: All fields, Summary only, Transcripts only
      - Date range: Current filter or custom
    - User selects options and clicks "Download"
    - System generates export file and initiates download

**Success Criteria**:
- Master admin can view call metrics across all companies
- Filters update charts and tables in real-time
- Export functionality works correctly
- Drill-down to individual calls provides detailed information

**Use Cases**:
- Billing: Calculate total AI usage costs per company
- Performance monitoring: Identify companies with high failure rates
- Capacity planning: Predict infrastructure needs based on call volume trends
- Provider comparison: Evaluate OpenAI vs Gemini quality and cost

---

## 2. Company Admin Flows

### 2.1 Set Up Integration Account (Twilio)

**Purpose**: Configure Twilio account for phone call integration

**Prerequisites**:
- User has company_admin permission for active company
- Company has callEnabled=true in settings
- Company has active Twilio account with phone number

**Flow Steps**:

1. **Navigate to Integrations**
   - User logs into company dashboard
   - User clicks "Integrations" in sidebar
   - System displays integrations overview page with tabs:
     - All Integrations
     - Integration Accounts ← User clicks this tab
     - Connected Services
   - System displays existing integration accounts table (empty if none)

2. **Initiate Account Creation**
   - User clicks "+ Add Integration Account" button
   - System displays "Add Integration Account" modal

3. **Select Integration Type**
   - System shows integration type cards:
     ```
     ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
     │  📞 Twilio      │  │  💬 WhatsApp     │  │  🔧 Custom SIP  │
     │  Voice calls    │  │  Business calls  │  │  WebRTC/SIP     │
     │  via Twilio     │  │  via Meta        │  │  provider       │
     └──────────────────┘  └──────────────────┘  └──────────────────┘
     ```
   - User clicks "Twilio" card
   - System displays Twilio configuration form

4. **Enter Account Details**
   - User fills out form:
     - **Account Name**: "Main Support Line" (required, 3-100 characters)
       - Purpose: Internal reference name
       - Example: "Main Support Line", "After Hours", "Sales Team"
     - **Description**: "Primary phone number for customer support calls" (optional, max 500 characters)

5. **Enter Twilio Credentials**
   - User needs to obtain credentials from Twilio Console first
   - Instructions displayed in form:
     ```
     To find your Twilio credentials:
     1. Log in to https://console.twilio.com
     2. Navigate to Account > API Keys & Tokens
     3. Copy your Account SID and Auth Token
     ```
   - User enters:
     - **Account SID**: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (required, 34 characters, starts with "AC")
       - System validates format as user types
       - Shows ✅ if format valid
     - **Auth Token**: "••••••••••••••••••••••••••••••••" (required, masked input)
       - System shows 🔓 icon to toggle visibility
     - **Phone Number**: "+1 (555) 010-0100" (required, E.164 format)
       - System auto-formats as user types: +15550100 → +1 (555) 010-0100
       - Validates: Must start with +, contain 10-15 digits

6. **Test Connection**
   - User clicks "Test Connection" button
   - System disables form fields and shows loading spinner
   - System performs validation:
     ```javascript
     // Backend validation
     const twilio = require('twilio');
     const client = twilio(accountSid, authToken);

     try {
       // Test API access
       const account = await client.api.accounts(accountSid).fetch();

       // Verify phone number ownership
       const phoneNumber = await client.incomingPhoneNumbers.list({
         phoneNumber: formattedPhoneNumber,
         limit: 1
       });

       if (phoneNumber.length === 0) {
         throw new Error('Phone number not found in your Twilio account');
       }

       return { success: true, message: 'Connection successful!' };
     } catch (error) {
       return { success: false, error: error.message };
     }
     ```
   - **If successful**:
     - System displays ✅ "Connection successful! Your Twilio account is working."
     - "Save" button becomes enabled
   - **If failed**:
     - System displays ❌ "Connection failed: Invalid Auth Token"
     - Shows specific error message from Twilio API
     - "Save" button remains disabled
     - User corrects credentials and retries

7. **Review Webhook URL**
   - After successful test, system generates unique webhook URL
   - System displays webhook configuration section:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     📌 IMPORTANT: Configure this webhook URL in Twilio Console
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     Webhook URL:
     ┌────────────────────────────────────────────────────────────┐
     │ https://chat.buzzi.ai/api/webhooks/twilio/voice/a1b2c3d4   │  [Copy]
     └────────────────────────────────────────────────────────────┘

     Configuration Steps:
     1. Log in to Twilio Console: https://console.twilio.com
     2. Go to Phone Numbers → Active Numbers
     3. Click on your number: +1 (555) 010-0100
     4. Scroll to "Voice & Fax" section
     5. Under "A CALL COMES IN", select "Webhook"
     6. Paste the webhook URL above
     7. Select "HTTP POST"
     8. Click "Save"

     ⚠️  Until you configure this webhook, calls to your number will not
         reach your AI agent.
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```
   - User clicks [Copy] button
   - System copies webhook URL to clipboard
   - System shows toast: "✓ Webhook URL copied to clipboard"

8. **Save Integration Account**
   - User clicks "Save Integration Account" button
   - System validates all fields
   - System encrypts sensitive data:
     ```javascript
     const encryptedCredentials = encryptCredentials(JSON.stringify({
       accountSid,
       authToken,
       phoneNumber,
     }));
     ```
   - System saves to database:
     ```sql
     INSERT INTO chatapp.integration_accounts (
       company_id, account_type, account_name, description,
       credentials, webhook_url, webhook_secret,
       status, is_active,
       last_verified_at, created_at, updated_at
     ) VALUES (
       $1, 'twilio', $2, $3,
       $4, $5, $6,
       'active', true,
       NOW(), NOW(), NOW()
     );
     ```
   - System displays success message: "✓ Twilio integration account 'Main Support Line' created successfully"
   - Modal closes, integration accounts table refreshes

9. **View Created Integration Account**
   - System displays updated table:
     ```
     | Name              | Type    | Phone Number      | Status | Last Verified | Actions    |
     |-------------------|---------|-------------------|--------|---------------|------------|
     | Main Support Line | Twilio  | +1 (555) 010-0100 | Active | Just now      | Edit, Test |
     ```
   - Status indicator shows green dot: 🟢 Active

10. **Configure Webhook in Twilio Console** (User action outside system)
    - User opens Twilio Console in new tab
    - User navigates to Phone Numbers → Active Numbers
    - User clicks on the phone number (+1 555-010-0100)
    - User scrolls to "Voice & Fax" section
    - Under "A CALL COMES IN":
      - User pastes webhook URL: https://chat.buzzi.ai/api/webhooks/twilio/voice/a1b2c3d4
      - User selects "HTTP POST" method
    - Under "CALL STATUS CHANGES":
      - User pastes status webhook URL: https://chat.buzzi.ai/api/webhooks/twilio/call-status/a1b2c3d4
      - User selects "HTTP POST" method
    - User clicks "Save" button
    - Twilio sends verification request to webhook
    - System logs webhook verification success

11. **Verify Webhook Configuration** (Back in system)
    - User returns to integrations page
    - User clicks "Test" button on integration account row
    - System initiates test call:
      ```javascript
      // System makes test outbound call via Twilio
      const call = await twilioClient.calls.create({
        to: testPhoneNumber, // System's test number
        from: integrationAccount.phoneNumber,
        twiml: '<Response><Say>Test call successful</Say></Response>'
      });
      ```
    - System displays test result:
      - ✅ "Test call successful! Webhook configuration verified."
      - OR ❌ "Test failed: Webhook URL not configured in Twilio"
    - System updates last_verified_at timestamp

**Success Criteria**:
- Integration account saved with encrypted credentials
- Webhook URL generated and displayed to user
- User successfully configures webhook in Twilio Console
- Test call verifies end-to-end connection
- Integration account status shows "Active"

**Troubleshooting Common Issues**:
- **Error: "Invalid Account SID"**
  - Solution: Verify Account SID copied correctly from Twilio Console
  - Check: Must be exactly 34 characters starting with "AC"
- **Error: "Invalid Auth Token"**
  - Solution: Regenerate Auth Token in Twilio Console if compromised
  - Check: Token has no extra spaces or characters
- **Error: "Phone number not found"**
  - Solution: Verify phone number is active in your Twilio account
  - Check: Phone number must be in E.164 format (+15550100)
- **Error: "Webhook verification failed"**
  - Solution: Check webhook URL configured exactly as displayed
  - Check: Webhook method must be "HTTP POST", not GET

---

### 2.2 Set Up Integration Account (WhatsApp Business)

**Purpose**: Configure WhatsApp Business API for voice calls

**Prerequisites**:
- User has company_admin permission
- Company has callEnabled=true
- Company has Meta Business Account with WhatsApp Business API access
- WhatsApp phone number provisioned and verified

**Flow Steps**:

1. **Navigate to Integration Accounts**
   - User clicks "Integrations" → "Integration Accounts"
   - User clicks "+ Add Integration Account"
   - User selects "WhatsApp Business" card

2. **Obtain WhatsApp Credentials** (User action outside system)
   - Instructions displayed:
     ```
     Before proceeding, obtain the following from Meta Business Suite:

     1. Go to https://business.facebook.com
     2. Navigate to your Business Settings
     3. Click "WhatsApp Accounts" → Select your account
     4. Click "API Setup"
     5. Copy the following:
        - Business Account ID (15 digits)
        - Phone Number ID (15 digits)
        - Access Token (long string starting with "EAAG...")
        - Phone Number (with country code)
     ```

3. **Enter WhatsApp Account Details**
   - User fills form:
     - **Account Name**: "Support WhatsApp Line" (required)
     - **Description**: "WhatsApp Business number for customer support" (optional)
     - **Business Account ID**: "123456789012345" (required, 15 digits)
       - System validates: Must be numeric, 15 digits
     - **Phone Number ID**: "987654321098765" (required, 15 digits)
       - System validates: Must be numeric, 15 digits
     - **Phone Number**: "+1 (555) 020-0200" (required, E.164)
       - System auto-formats as user types
     - **Access Token**: "EAAG••••••••••••••••••••••••" (required, masked)
       - System validates: Must start with "EAAG"
       - Token should be long-lived (60+ days validity)

4. **Test WhatsApp Connection**
   - User clicks "Test Connection" button
   - System verifies credentials:
     ```javascript
     // Backend verification
     const response = await fetch(
       `https://graph.facebook.com/v18.0/${phoneNumberId}`,
       {
         headers: {
           'Authorization': `Bearer ${accessToken}`
         }
       }
     );

     if (response.ok) {
       const data = await response.json();
       return {
         success: true,
         phoneNumber: data.display_phone_number,
         verifiedName: data.verified_name
       };
     } else {
       const error = await response.json();
       return { success: false, error: error.error.message };
     }
     ```
   - **If successful**:
     - System displays: ✅ "Connected successfully!"
     - Shows verified phone: "Verified: +1 (555) 020-0200"
     - Shows verified name: "Business Name: Acme Support"
   - **If failed**:
     - System displays error message
     - Common errors:
       - "Invalid access token" → Regenerate token in Meta Business Suite
       - "Phone number not found" → Verify Phone Number ID is correct
       - "Insufficient permissions" → Token needs whatsapp_business_management permission

5. **Generate and Configure Webhook**
   - After successful test, system generates webhook URL
   - System displays webhook configuration:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     📌 Configure Webhook in Meta Business Suite
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     Callback URL:
     ┌────────────────────────────────────────────────────────────┐
     │ https://chat.buzzi.ai/api/webhooks/whatsapp/call/x9y8z7w6  │  [Copy]
     └────────────────────────────────────────────────────────────┘

     Verify Token:
     ┌────────────────────────────────────────────────────────────┐
     │ buzzi_webhook_verify_a1b2c3d4e5f6                          │  [Copy]
     └────────────────────────────────────────────────────────────┘

     Configuration Steps:
     1. Go to https://business.facebook.com
     2. Settings → WhatsApp Accounts → [Your Account]
     3. Click "Configuration" tab
     4. Click "Edit" next to "Webhook"
     5. Paste Callback URL above
     6. Paste Verify Token above
     7. Click "Verify and Save"
     8. Subscribe to webhook events:
        ✓ messages
        ✓ message_status
        ✓ calls (IMPORTANT for voice functionality)
     9. Click "Save"
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```

6. **Save Integration Account**
   - User clicks "Save Integration Account"
   - System encrypts and saves credentials
   - System displays success message
   - Integration account appears in table with status "Pending Webhook Verification"

7. **Configure Webhook in Meta Business Suite** (User action)
   - User opens Meta Business Suite
   - User navigates to WhatsApp Accounts → Configuration → Webhook
   - User clicks "Edit"
   - User pastes Callback URL and Verify Token
   - User clicks "Verify and Save"
   - Meta sends verification request: GET https://chat.buzzi.ai/api/webhooks/whatsapp/call/x9y8z7w6?hub.mode=subscribe&hub.challenge=123&hub.verify_token=buzzi_webhook_verify_a1b2c3d4e5f6
   - System validates verify token and responds with challenge
   - Meta confirms: ✅ "Webhook verified"
   - User subscribes to "calls" event
   - User clicks "Save"

8. **Verify Webhook in System**
   - User returns to system integrations page
   - System automatically detects webhook verification (via webhook event)
   - Integration account status updates to: 🟢 "Active"
   - Last Verified timestamp updates

9. **Test WhatsApp Call** (optional)
   - User clicks "Test" button on integration account
   - System displays: "To test WhatsApp calling, use your WhatsApp app to call +1 (555) 020-0200. The test call will be logged here."
   - User places test call from their WhatsApp
   - System receives webhook and displays:
     - ✅ "Test call received! Duration: 0:45, Status: completed"
   - Call appears in call history with source="whatsapp"

**Success Criteria**:
- WhatsApp integration account saved with encrypted credentials
- Webhook URL configured in Meta Business Suite
- Webhook verification successful
- Test call successfully routed through system
- Integration account status: Active

**WhatsApp-Specific Notes**:
- Access tokens expire after 60 days (or per Meta's policy)
- System should monitor token expiry and alert admin 7 days before expiration
- WhatsApp calls use WebRTC (different from Twilio's PSTN)
- Audio format: Opus codec at 48kHz (requires resampling for OpenAI/Gemini)

---

### 2.3 Create Call-Enabled Chatbot

**Purpose**: Instantiate a chatbot from a call-enabled package

**Prerequisites**:
- User has company_admin permission
- Company has callEnabled=true
- At least one call-enabled chatbot package exists (enable_call=true)

**Flow Steps**:

1. **Navigate to Chatbots**
   - User clicks "Chatbots" in sidebar
   - System displays list of existing chatbots (if any)
   - User clicks "+ Create Chatbot" button

2. **Select Chatbot Package**
   - System displays "Create New Chatbot" wizard
   - Step 1: "Choose Package"
   - System displays available packages as cards:
     ```
     ┌─────────────────────────────────────────────────────────┐
     │  Premium Support - Voice Enabled                         │
     │  🎯 Enterprise Package                                   │
     │  💬 Chat Enabled  📞 Call Enabled                       │
     │                                                          │
     │  Includes: GPT-4 Realtime voice, Claude 3.5 Sonnet chat│
     │  Knowledge base access, Function calling                │
     │                                                          │
     │  [Select This Package]                                   │
     └─────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────────────────────┐
     │  Basic Chat Only Support                                 │
     │  🎯 Standard Package                                     │
     │  💬 Chat Enabled                                        │
     │                                                          │
     │  Includes: GPT-4 Turbo chat, Basic knowledge base      │
     │                                                          │
     │  [Select This Package]                                   │
     └─────────────────────────────────────────────────────────┘
     ```
   - User selects "Premium Support - Voice Enabled"
   - System highlights selected package
   - User clicks "Next" button

3. **Configure Basic Information**
   - Step 2: "Basic Configuration"
   - User fills out:
     - **Chatbot Name**: "Customer Support Agent" (required, 3-100 chars)
       - Purpose: Internal reference name
       - Shown in: Admin dashboard, analytics, agent selection
     - **Display Name**: "Support Assistant" (required, 3-50 chars)
       - Purpose: Name shown to end users in widget
     - **Description**: "Main customer support chatbot handling product questions and troubleshooting" (optional)

4. **Review Inherited Capabilities**
   - System displays inherited settings from package:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Capabilities (Inherited from Package)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     ✅ Chat Enabled
        - AI Model: Claude 3.5 Sonnet
        - Temperature: 0.7
        - Max Tokens: 1000

     ✅ Call Enabled
        - AI Model: GPT-4 Realtime (Oct 2024)
        - Voice: Nova
        - Greeting: "Thank you for calling..."

     ℹ️  These settings can be customized after chatbot creation.
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```
   - System automatically sets:
     - enabled_chat = package.enable_chat (true)
     - enabled_call = package.enable_call (true)
   - User cannot disable capabilities that package doesn't support
   - User CAN disable capabilities that package supports:
     - Toggle: "Enable Chat for this chatbot" (on by default)
     - Toggle: "Enable Call for this chatbot" (on by default)
     - If user wants call-only: Uncheck "Enable Chat"

5. **Configure Knowledge Base** (if package includes KB)
   - Step 3: "Knowledge Base"
   - System displays inherited knowledge categories from package:
     ```
     Selected Categories (from package):
     ✓ Product Documentation
     ✓ Troubleshooting Guides
     ✓ FAQs

     Additional Categories (optional):
     ⬜ Company Policies
     ⬜ Pricing Information
     ⬜ API Documentation
     ```
   - User can:
     - Keep inherited categories
     - Add additional categories specific to this chatbot
     - Remove inherited categories (if needed)
   - User selects additional: "Pricing Information"

6. **Assign Integrations** (if call enabled)
   - Step 4: "Integrations"
   - System displays available integration accounts:
     ```
     Web Widget (Always Enabled)
     ✅ Enabled automatically for all chatbots

     Phone Integrations (Optional)
     ⬜ Main Support Line (Twilio: +1 555-010-0100)
     ⬜ Support WhatsApp Line (WhatsApp: +1 555-020-0200)
     ```
   - User checks: "Main Support Line"
   - System shows info: "Phone calls to +1 (555) 010-0100 will be routed to this chatbot"
   - User leaves WhatsApp unchecked (will configure separately)

7. **Review and Create**
   - Step 5: "Review & Create"
   - System displays summary:
     ```
     Chatbot Name: Customer Support Agent
     Package: Premium Support - Voice Enabled
     Capabilities: ✅ Chat  ✅ Call
     Knowledge Categories: 4 selected
     Integrations:
       - Web Widget (enabled)
       - Main Support Line (enabled)

     [← Back]  [Create Chatbot]
     ```
   - User clicks "Create Chatbot"

8. **System Creates Chatbot**
   - System saves to database:
     ```sql
     INSERT INTO chatapp.chatbots (
       company_id, chatbot_package_id,
       name, display_name, description,
       enabled_chat, enabled_call,
       settings, -- Copied from package with defaults
       created_at, updated_at
     ) VALUES (...);
     ```
   - System copies settings from package to chatbot.settings
   - System links integration account to chatbot
   - System displays success: "✓ Chatbot 'Customer Support Agent' created successfully"

9. **Post-Creation Actions**
   - System redirects to chatbot details page
   - System displays quick action cards:
     ```
     ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
     │  ⚙️ Configure         │  │  🎨 Customize Widget │  │  🧪 Test Chatbot    │
     │  Call Settings       │  │  Appearance          │  │  Before Launch       │
     │  [Go]                │  │  [Go]                │  │  [Go]                │
     └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
     ```
   - User typically proceeds to configure call settings

**Success Criteria**:
- Chatbot created with enabled_chat and enabled_call flags set correctly
- Chatbot inherits settings from package
- Integration account(s) linked to chatbot
- Chatbot appears in chatbot list with badges: 💬 CHAT 📞 CALL

**Common Next Steps**:
1. Configure detailed call settings (voice, greeting, timeouts)
2. Customize widget appearance (call button color, position)
3. Test call functionality
4. Deploy widget to website

---

### 2.4 Configure Call Settings

**Purpose**: Customize call behavior, voice, and features for a specific chatbot

**Prerequisites**:
- User has company_admin permission
- Chatbot exists with enabled_call=true
- Company has at least one call-capable AI model available

**Flow Steps**:

1. **Navigate to Chatbot Call Settings**
   - User clicks "Chatbots" → selects chatbot "Customer Support Agent"
   - System displays chatbot details page with tabs:
     - Overview
     - General Settings
     - Chat Options (visible if enabled_chat=true)
     - Call Options (visible if enabled_call=true) ← User clicks
     - Widget
     - Integrations
     - Analytics
   - System loads "Call Options" tab

2. **View Current Call Configuration**
   - System displays current settings (inherited from package or defaults):
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Call Configuration for: Customer Support Agent
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     AI Model & Voice
     Provider: OpenAI Realtime
     Model: GPT-4 Realtime (Oct 2024)
     Voice: Nova
     Cost: ~$14.40 per 10-minute call

     Call Behavior
     Greeting: "Thank you for calling Premium Support..."
     Max Duration: 10 minutes
     Silence Timeout: 3 minutes

     Features
     Recording: Disabled
     Transcription: Enabled
     User Interruption: Enabled
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```
   - User sees "Edit Settings" button

3. **Select AI Model**
   - User clicks "Edit Settings"
   - System displays form with sections
   - **AI Model Section**:
     - **Provider & Model**: Dropdown
       - System filters models by model_type IN ('call', 'both')
       - Options displayed:
         ```
         OpenAI
         ├─ GPT-4 Realtime (Oct 2024) [Selected] ✓
         └─ GPT-4 Realtime (Latest)

         Google
         └─ Gemini 2.0 Flash Live (Experimental)
         ```
     - Each model shows cost estimate:
       - "~$14.40 per 10-minute call (based on average usage)"
     - User keeps "GPT-4 Realtime (Oct 2024)" selected

4. **Select and Preview Voice**
   - **Voice Selection Section**:
     - **Voice Provider**: Auto-set based on AI model (OpenAI)
     - **Voice**: Dropdown with preview buttons
       ```
       ┌─────────────────────────────────────────────────────────┐
       │  Alloy        [🔊 Preview]                              │
       │  Echo         [🔊 Preview]                              │
       │  Fable        [🔊 Preview]                              │
       │  Nova         [🔊 Preview]  ← Currently selected       │
       │  Onyx         [🔊 Preview]                              │
       │  Shimmer      [🔊 Preview]                              │
       └─────────────────────────────────────────────────────────┘
       ```
     - User clicks [🔊 Preview] next to "Shimmer"
     - System plays audio sample:
       - Shows audio player: ▶️ ━━━━━━━━━●──── 0:05
       - Audio: "Hello, I'm your AI assistant. How can I help you today?"
     - User likes "Shimmer" voice, selects it from dropdown
   - **Voice Settings** (Advanced, collapsible):
     - User expands "Advanced Voice Settings"
     - **Speed**: Slider (0.5x to 2.0x, currently 1.0x)
       - User adjusts to 1.1x (slightly faster)
     - **Pitch**: Slider (-1.0 to +1.0, currently 0.0)
       - User keeps at 0.0 (default)
     - User clicks [🔊 Preview with Custom Settings]
     - System plays sample with speed=1.1x applied

5. **Configure Call Greeting**
   - **Call Greeting Section**:
     - **Greeting Message**: Textarea (max 500 characters)
       - Current: "Thank you for calling Premium Support. I'm here to help with any questions you have."
       - User edits to: "Hello! Thanks for calling Acme Support. I'm an AI assistant ready to help you. How can I assist you today?"
       - Character count: 122 / 500
     - [🔊 Preview Greeting] button
       - User clicks to hear greeting with selected voice
     - **Pro Tip** displayed: "Keep greetings under 15 seconds for best user experience. Avoid long introductions."

6. **Set Call Duration Limits**
   - **Call Duration & Timeouts Section**:
     - **Maximum Call Duration**: Slider (1 to 60 minutes)
       - Current: 10 minutes
       - User adjusts to 15 minutes
       - System shows: "Estimated cost per max-duration call: ~$21.60"
     - **Silence Timeout**: Slider (30 seconds to 5 minutes)
       - Current: 180 seconds (3 minutes)
       - Help text: "Auto-disconnect after this many seconds of silence"
       - User adjusts to 120 seconds (2 minutes) for faster turnover
     - **End Call Phrase**: Text input (max 100 chars)
       - Current: "goodbye"
       - User adds: "goodbye,bye,end call,hang up" (comma-separated)
       - Help text: "User saying any of these phrases will end the call"

7. **Enable/Disable Features**
   - **Features Section**:
     - **Call Recording**: Toggle switch
       - Currently: ⬜ Off
       - User clicks toggle
       - System shows confirmation:
         ```
         Enable Call Recording?

         ⚠️  Legal Notice: Call recording laws vary by jurisdiction.
         You may be required to notify callers that the call is being recorded.

         Recorded calls will be stored for 90 days and consume storage space.

         [Cancel]  [Enable Recording]
         ```
       - User clicks "Enable Recording"
       - Toggle updates: ✅ On
     - **Real-time Transcription**: Toggle switch
       - Currently: ✅ On (recommended)
       - Help text: "Live transcription enables better analytics and search"
       - User keeps enabled
     - **User Interruption**: Toggle switch
       - Currently: ✅ On
       - Help text: "Allow users to interrupt agent mid-response for more natural conversation"
       - User keeps enabled

8. **Configure Advanced Audio Settings** (Optional)
   - User expands "Advanced Audio Settings" accordion
   - **Voice Activity Detection (VAD) Threshold**: Slider (0.0 to 1.0)
     - Current: 0.5
     - Help text: "Lower = more sensitive (detects quieter speech), Higher = less sensitive (fewer false positives)"
     - User keeps at 0.5 (balanced)
   - **Echo Cancellation**: Toggle ✅ On (recommended)
     - Help text: "Prevents agent's voice from being detected as user input"
     - User keeps enabled
   - **Noise Suppression**: Toggle ✅ On (recommended)
     - Help text: "Reduces background noise in user's audio"
     - User keeps enabled

9. **Save Call Settings**
   - User scrolls to bottom
   - User clicks "Save Call Settings" button
   - System validates all fields:
     - ✓ Greeting under 500 characters
     - ✓ Max duration between 1-60 minutes
     - ✓ Silence timeout between 30-300 seconds
     - ✓ Voice ID valid for selected provider
   - System updates database:
     ```sql
     UPDATE chatapp.chatbots
     SET settings = jsonb_set(settings, '{call}', $1::jsonb, true),
         updated_at = NOW()
     WHERE id = $2;
     ```
   - System displays success: "✓ Call settings saved successfully"
   - System shows toast: "Changes will apply to new calls immediately. Active calls are not affected."

10. **Test Call Settings** (Optional)
    - After saving, system displays "Test Call" button
    - User clicks "Test Call"
    - System opens test call interface (see Section 2.7 for details)
    - User places test call to verify new settings
    - User hears new greeting with Shimmer voice
    - User confirms settings work as expected

**Success Criteria**:
- Call settings saved to chatbots.settings.call JSONB
- Voice and greeting updated correctly
- Duration and timeout limits applied
- Features (recording, transcription, interruption) configured
- Test call reflects new settings

**Validation Rules**:
- Greeting: 1-500 characters, plain text only (no HTML/SSML)
- Max duration: 60-3600 seconds (1-60 minutes)
- Silence timeout: 30-300 seconds (0.5-5 minutes)
- End call phrases: Max 10 phrases, each max 50 characters
- VAD threshold: 0.0-1.0, must be decimal
- Voice must be valid for selected AI provider

**Common Use Cases**:
- **Short, transactional calls**: Max duration 5 min, silence timeout 1 min, fast voice
- **Detailed support calls**: Max duration 30 min, silence timeout 3 min, clear voice
- **Automated surveys**: Recording enabled, short greeting, specific end phrase
- **International calls**: Slower voice speed (0.9x), higher VAD threshold

---

### 2.5 Customize Call Widget

**Purpose**: Configure visual appearance and behavior of call button and interface

**Prerequisites**:
- User has company_admin permission
- Chatbot exists with enabled_call=true
- Call settings configured

**Flow Steps**:

1. **Navigate to Widget Customization**
   - User clicks "Chatbots" → selects chatbot
   - User clicks "Widget" tab
   - System loads widget customization page with live preview

2. **View Widget Preview**
   - Right side of screen shows live preview:
     ```
     ┌───────────────────────────────────────────────────────┐
     │                                                        │
     │               [Live Preview]                           │
     │                                                        │
     │                                                        │
     │                                                        │
     │                                                        │
     │                                      [📞 Call Us]     │
     │                                      [💬 Chat]        │
     └───────────────────────────────────────────────────────┘
     ```
   - Preview updates in real-time as user makes changes

3. **Configure Appearance Section**
   - Left side shows customization form
   - **Appearance Section** (affects both chat and call buttons):
     - **Widget Position**: Radio buttons
       - ⚪ Bottom Right ← Currently selected
       - ⚪ Bottom Left
       - ⚪ Top Right
       - ⚪ Top Left
       - User keeps "Bottom Right"
     - **Button Spacing**: Slider (0-20px)
       - Current: 10px (vertical gap between call and chat buttons)
       - User adjusts to 8px for tighter spacing

4. **Customize Call Button**
   - **Call Button Section** (only visible if enabled_call=true):
     - **Button Text**: Text input (max 20 chars)
       - Current: "Call Us"
       - User changes to: "📞 Talk to AI"
       - Help text: "Emojis supported. Keep text short for mobile."
     - **Button Color**: Color picker
       - Current: #22C55E (green)
       - User clicks color picker
       - System shows color palette and hex input
       - User selects: #3B82F6 (blue) to match brand
       - Preview updates to show blue call button
     - **Button Icon**: Icon picker (optional)
       - Options: Default phone icon, Custom upload, No icon
       - User keeps default phone icon
     - **Button Size**: Dropdown
       - Options: Small (48px), Medium (56px), Large (64px)
       - Current: Medium
       - User selects: Large (more prominent for calls)

5. **Customize Chat Button** (if enabled_chat=true)
   - **Chat Button Section**:
     - **Button Text**: "💬 Chat"
     - **Button Color**: #10B981 (green, different from call)
     - **Button Size**: Large (match call button size)
   - Buttons stack vertically: Call button above, Chat button below

6. **Configure Call Interface**
   - **Call Interface Section**:
     - **Visualizer Style**: Radio buttons with previews
       ```
       ⚪ Wave     ⚪ Orb       ⚪ Bars
       [preview]  [preview]   [preview]
       ```
       - User selects "Orb" (circular animated visualizer)
       - Preview shows animated orb during call
     - **Show Call Duration**: Toggle ✅ On
       - When enabled: Display timer "2:34" during call
       - User keeps enabled for transparency
     - **Show Live Transcript**: Toggle ✅ On
       - When enabled: Show real-time transcript below visualizer
       - User keeps enabled for accessibility
     - **Interface Theme**: Dropdown
       - Options: Light, Dark, Auto (match system)
       - User selects "Auto"

7. **Configure Branding**
   - **Branding Section**:
     - **Company Logo**: Image upload (max 500KB, PNG/JPG/SVG)
       - User clicks "Upload Logo"
       - User selects company logo file
       - System uploads to storage
       - System validates: Image under 500KB, valid format
       - Preview shows logo in call interface header
     - **Company Name**: Text input (max 50 chars)
       - Current: "Customer Support Agent"
       - User changes to: "Acme Support"
       - Displayed at top of call interface
     - **Accent Color**: Color picker
       - User selects: #3B82F6 (blue, match call button)
       - Used for progress bars, active states

8. **Configure Initial Messages**
   - **Welcome Messages Section**:
     - **Call Welcome Message**: Textarea (max 500 chars)
       - Current: "Click the call button to start a voice conversation with our AI assistant."
       - User changes to: "Need help? Click '📞 Talk to AI' to start a voice call. I'm here 24/7!"
       - Displayed in widget before user clicks call button
     - **Chat Welcome Message**: Textarea (separate from call)
       - Configured separately, not affected

9. **Preview Widget in Different States**
   - User clicks tabs above preview pane:
     - **Closed State**: Shows call and chat buttons only
     - **Call Ringing**: Shows "Connecting..." with animated orb
     - **Call Active**: Shows live visualizer, transcript, duration, controls
     - **Call Ended**: Shows "Call ended. Thanks for calling!" with rating
   - User verifies appearance in each state

10. **Test on Different Devices** (Optional)
    - User clicks "Preview on Devices" dropdown
    - Options: Desktop, Tablet, Mobile (iPhone), Mobile (Android)
    - User selects "Mobile (iPhone)"
    - Preview resizes to mobile dimensions
    - User verifies buttons are large enough to tap
    - User confirms text is readable on small screen

11. **Save Widget Configuration**
    - User clicks "Save Widget Settings" button
    - System validates all fields
    - System updates chatbot.settings.widget JSONB:
      ```json
      {
        "call": {
          "buttonText": "📞 Talk to AI",
          "buttonColor": "#3B82F6",
          "buttonSize": "large",
          "visualizerStyle": "orb",
          "showDuration": true,
          "showTranscript": true,
          "interfaceTheme": "auto",
          "welcomeMessage": "Need help? Click '📞 Talk to AI'..."
        },
        "position": "bottom-right",
        "branding": {
          "logo": "https://storage.../logo.png",
          "companyName": "Acme Support",
          "accentColor": "#3B82F6"
        }
      }
      ```
    - System displays success: "✓ Widget settings saved"

12. **Get Embed Code**
    - After saving, system displays "Embed Code" section
    - User clicks "Show Embed Code" button
    - System generates and displays:
      ```html
      <!-- Acme Support Widget -->
      <script>
        (function() {
          window.buzziChatbot = {
            chatbotId: 'abc123def456',
            companyId: 'xyz789uvw012'
          };
          var s = document.createElement('script');
          s.src = 'https://chat.buzzi.ai/embed/widget.js';
          s.async = true;
          document.head.appendChild(s);
        })();
      </script>
      <!-- End Acme Support Widget -->
      ```
    - User clicks [Copy Code] button
    - System copies to clipboard
    - User pastes into their website's HTML (before `</body>` tag)

**Success Criteria**:
- Widget settings saved to chatbot.settings.widget
- Live preview matches saved configuration
- Embed code generated with correct chatbot ID
- Widget displays correctly on company website
- Call button styled according to customization
- Call interface shows selected visualizer style

**Best Practices**:
- **Call button prominence**: Use contrasting color to make call button stand out
- **Mobile optimization**: Use Large button size for easier tapping on mobile
- **Accessibility**: Enable live transcript for hearing-impaired users
- **Branding consistency**: Match button colors to company brand colors
- **Button text**: Keep under 15 characters for mobile screens

---

### 2.6 Enable Integration for Chatbot

**Purpose**: Link specific integration accounts to chatbot for multi-channel support

**Prerequisites**:
- User has company_admin permission
- Chatbot exists with enabled_call=true
- Integration accounts created (Twilio, WhatsApp, etc.)

**Flow Steps**:

1. **Navigate to Chatbot Integrations**
   - User clicks "Chatbots" → selects chatbot
   - User clicks "Integrations" tab
   - System displays integration configuration page

2. **View Available Integrations**
   - System displays integration categories:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Web Widget (Always Enabled)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ✅ Web Widget
     Status: Active
     Automatically enabled for all chatbots with call capability.
     Embed code available in Widget tab.

     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Phone Integrations (Optional)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Configure which phone numbers route calls to this chatbot.
     ```

3. **Configure Twilio Integration**
   - **Twilio Phone Calls** card:
     ```
     ┌───────────────────────────────────────────────────────┐
     │ 📞 Twilio Phone Calls                    [Enable]     │
     │ Currently: Disabled                                   │
     │                                                       │
     │ Route phone calls from Twilio to this chatbot.       │
     └───────────────────────────────────────────────────────┘
     ```
   - User clicks [Enable] button
   - System displays configuration modal:
     ```
     Enable Twilio Integration

     Select Integration Account:
     ┌─────────────────────────────────────────────────────┐
     │ ⚪ Main Support Line                                │
     │    Phone: +1 (555) 010-0100                        │
     │    Status: 🟢 Active                               │
     │                                                     │
     │ ⚪ After Hours Line                                 │
     │    Phone: +1 (555) 010-0200                        │
     │    Status: 🟢 Active                               │
     └─────────────────────────────────────────────────────┘

     ⚠️  Note: Selecting an integration account that is already
         assigned to another chatbot will reassign it to this one.

     [Cancel]  [Enable Integration]
     ```
   - User selects "Main Support Line"
   - User clicks "Enable Integration"
   - System validates:
     - ✓ Integration account exists and is active
     - ✓ User has permission to configure chatbot
   - System updates database:
     ```sql
     UPDATE chatapp.chatbots
     SET settings = jsonb_set(
       settings,
       '{integrations,twilio}',
       jsonb_build_object(
         'enabled', true,
         'integrationAccountId', 'integration-account-uuid',
         'enabledAt', NOW()
       ),
       true
     )
     WHERE id = 'chatbot-uuid';
     ```
   - System displays success: "✓ Twilio integration enabled"
   - Card updates:
     ```
     ┌───────────────────────────────────────────────────────┐
     │ 📞 Twilio Phone Calls                  [Disable]      │
     │ Currently: Enabled                                    │
     │                                                       │
     │ Integration Account: Main Support Line               │
     │ Phone Number: +1 (555) 010-0100                      │
     │ Status: 🟢 Active                                    │
     │                                                       │
     │ Incoming calls to this number will reach this        │
     │ chatbot.                                             │
     │                                                       │
     │ [View Call Logs]  [Test Connection]                 │
     └───────────────────────────────────────────────────────┘
     ```

4. **Configure WhatsApp Integration**
   - **WhatsApp Business Calls** card:
     ```
     ┌───────────────────────────────────────────────────────┐
     │ 💬 WhatsApp Business Calls               [Enable]     │
     │ Currently: Disabled                                   │
     │                                                       │
     │ Route WhatsApp voice calls to this chatbot.          │
     └───────────────────────────────────────────────────────┘
     ```
   - User clicks [Enable] button
   - System displays configuration modal:
     ```
     Enable WhatsApp Integration

     Select Integration Account:
     ┌─────────────────────────────────────────────────────┐
     │ ⚪ Support WhatsApp Line                            │
     │    Phone: +1 (555) 020-0200                        │
     │    Status: 🟢 Active                               │
     │    Business: Acme Support                          │
     └─────────────────────────────────────────────────────┘

     Call Routing Options:
     ┌─────────────────────────────────────────────────────┐
     │ ✅ Route voice calls to this chatbot                │
     │ ⬜ Also route WhatsApp text messages (optional)     │
     └─────────────────────────────────────────────────────┘

     [Cancel]  [Enable Integration]
     ```
   - User selects integration account
   - User checks both options:
     - ✅ Route voice calls
     - ✅ Also route text messages (unified experience)
   - User clicks "Enable Integration"
   - System updates database similarly
   - System displays success: "✓ WhatsApp integration enabled"

5. **Test Integration Connection**
   - User clicks [Test Connection] on Twilio card
   - System performs test:
     ```javascript
     // Backend test
     const testResult = await testTwilioIntegration({
       integrationAccountId,
       chatbotId
     });

     // System makes test call to a system test number
     // Verifies webhook routing works correctly
     ```
   - System displays test result:
     - ✅ "Test successful! Webhook routing verified."
     - Shows test call details:
       - Duration: 0:15
       - Status: Completed
       - Transcript: "Test call successful. Your integration is working."
   - OR ❌ "Test failed: Webhook not configured correctly"
     - Shows troubleshooting steps

6. **View Call Routing Summary**
   - System displays "Active Call Routing" summary at bottom:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Active Call Routing for: Customer Support Agent
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     This chatbot will receive calls from:

     ✅ Web Widget
        - Visitors to your website (via embed code)

     ✅ Twilio Phone
        - +1 (555) 010-0100 (Main Support Line)

     ✅ WhatsApp Business
        - +1 (555) 020-0200 (Support WhatsApp Line)

     Total potential call sources: 3

     [View Call Analytics]
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ```

7. **Configure Routing Rules** (Advanced, Optional)
   - User expands "Advanced Routing Rules" section
   - **Business Hours Routing**:
     - User can configure different chatbots for business hours vs after hours
     - Example:
       - 9 AM - 5 PM (Mon-Fri): Route to "Customer Support Agent"
       - Other times: Route to "After Hours Bot"
   - **Language-Based Routing**:
     - User can configure language detection
     - Example:
       - Detected language: Spanish → Route to "Spanish Support Bot"
       - Default: Route to "Customer Support Agent"
   - **Queue Management**:
     - Max concurrent calls: 10
     - When exceeded: Play message "All agents busy, please try again"

**Success Criteria**:
- Integration account linked to chatbot
- Calls from selected phone number route to this chatbot
- Test call successful
- Routing summary accurate

**Troubleshooting**:
- **Test fails**: Check webhook configuration in Twilio/WhatsApp console
- **No calls received**: Verify phone number matches exactly
- **Calls route to wrong chatbot**: Check for multiple chatbots using same integration account

---

### 2.7 Test Call Feature

**Purpose**: Verify call configuration before deploying to production

**Prerequisites**:
- User has company_admin permission
- Chatbot exists with enabled_call=true
- Call settings and widget configured

**Flow Steps**:

1. **Navigate to Test Interface**
   - User clicks "Chatbots" → selects chatbot
   - User clicks "Test" tab
   - System displays test interface with options:
     ```
     ┌────────────────────────────────────────────────────────┐
     │                                                         │
     │              Test Your Chatbot                          │
     │                                                         │
     │  Before deploying, test all functionality to ensure    │
     │  everything works as expected.                          │
     │                                                         │
     │  ┌──────────────┐  ┌──────────────┐                  │
     │  │ 💬 Test Chat │  │ 📞 Test Call │                  │
     │  └──────────────┘  └──────────────┘                  │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - User clicks [📞 Test Call] button

2. **Request Microphone Permission** (if first time)
   - System requests browser microphone permission
   - Browser displays permission prompt:
     ```
     Allow "chat.buzzi.ai" to use your microphone?

     [Block]  [Allow]
     ```
   - User clicks [Allow]
   - System confirms permission granted
   - If user clicks [Block]:
     - System displays error: "Microphone access required for test call"
     - Shows instructions to enable in browser settings

3. **Initiate Test Call**
   - System opens test call interface:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  🎙️ Test Call                                [×]       │
     ├────────────────────────────────────────────────────────┤
     │                                                         │
     │                    [Large Orb]                          │
     │                   (animated)                            │
     │                                                         │
     │           🔊 Connecting to AI assistant...              │
     │                                                         │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - System establishes WebSocket connection:
     ```javascript
     // Frontend
     const ws = new WebSocket(`wss://chat.buzzi.ai/api/widget/call/${sessionId}/ws`);

     ws.onopen = () => {
       // Connection established
       startAudioCapture();
     };
     ```
   - System shows connection status: "Connected ✅"

4. **Hear Greeting Message**
   - System receives audio stream from AI
   - User hears greeting: "Hello! Thanks for calling Acme Support. I'm an AI assistant ready to help you. How can I assist you today?"
   - Visual feedback:
     - Orb animates (pulsing) to indicate agent speaking
     - Status: "🔊 AI is speaking..."
   - Transcript appears below orb:
     ```
     Transcript
     ──────────────────────────────────────────────
     [00:00] Assistant: Hello! Thanks for calling
     Acme Support. I'm an AI assistant ready to
     help you. How can I assist you today?
     ```

5. **Speak Test Queries**
   - User speaks: "What are your business hours?"
   - Visual feedback:
     - Orb color changes (e.g., blue → green) to indicate user speaking
     - Status: "🎤 You are speaking..."
   - System streams audio to backend via WebSocket
   - User's speech appears in transcript:
     ```
     [00:08] You: What are your business hours?
     ```
   - AI processes and responds
   - Agent audio plays through speakers
   - Agent response appears in transcript:
     ```
     [00:12] Assistant: We're open Monday through
     Friday, 9 AM to 5 PM Eastern Time. Our AI
     assistant is available 24/7.
     ```

6. **Test User Interruption**
   - User interrupts agent mid-sentence:
     - Agent is saying: "You can also reach us via..."
     - User speaks: "What about Saturday?"
   - System detects interruption (VAD)
   - Agent stops speaking immediately
   - Transcript shows:
     ```
     [00:18] Assistant: You can also reach us via...
     [00:19] You: What about Saturday?
     [00:22] Assistant: We're closed on weekends,
     but you can leave a message and we'll respond
     on Monday morning.
     ```
   - User confirms interruption works smoothly

7. **Test Knowledge Base Access**
   - User asks: "How do I reset my password?"
   - AI accesses knowledge base (function calling)
   - Transcript shows:
     ```
     [00:28] You: How do I reset my password?
     [00:29] System: 🔍 Searching knowledge base...
     [00:30] Assistant: To reset your password,
     follow these steps: 1. Go to the login page
     and click "Forgot Password". 2. Enter your
     email address...
     ```
   - User confirms knowledge base integration works

8. **Monitor Call Quality Indicators**
   - System displays call quality metrics in test interface:
     ```
     ┌────────────────────────────────────────────────────────┐
     │ Call Quality                                            │
     ├────────────────────────────────────────────────────────┤
     │ 🎙️ Audio Input:  ████████████████░░░░  Good          │
     │ 🔊 Audio Output: █████████████████░░░  Good           │
     │ 🌐 Connection:   █████████████████░░░  Stable         │
     │ ⏱️ Latency:      234ms                                │
     │ 📊 Transcription Confidence: 94.5%                    │
     └────────────────────────────────────────────────────────┘
     ```
   - User monitors during call
   - If quality degrades:
     - System shows warning: "⚠️ Poor connection detected"
     - Suggests: "Check your internet connection"

9. **Test Call Duration Display**
   - System displays timer at top of interface:
     ```
     ⏱️ 01:23
     ```
   - Timer increments in real-time
   - When approaching max duration (e.g., at 90%):
     - System shows warning: "⏰ Call will end in 1 minute"
     - Agent says: "Just to let you know, we have about one minute remaining on this call."

10. **End Test Call**
    - User has three options to end call:
      - **Option 1**: User clicks red [End Call] button
        - System sends end call signal
        - Call terminates immediately
      - **Option 2**: User says "goodbye" (end call phrase)
        - System detects phrase
        - Agent responds: "Thank you for calling. Have a great day!"
        - Call ends after 2 seconds
      - **Option 3**: User is silent for 2 minutes (silence timeout)
        - Agent prompts: "Are you still there?"
        - User remains silent for 30 more seconds
        - Agent says: "I'll end the call now. Feel free to call back anytime."
        - Call ends automatically
    - User chooses Option 2 (says "goodbye")
    - System displays call end screen:
      ```
      ┌────────────────────────────────────────────────────────┐
      │                                                         │
      │                    ✓ Call Ended                        │
      │                                                         │
      │           Thanks for testing!                           │
      │                                                         │
      │  Duration: 01:42                                       │
      │  Status: Completed                                     │
      │                                                         │
      │  [View Full Transcript]  [Download Recording]         │
      │                                                         │
      │  [Rate Call Quality] ★★★★★                           │
      │                                                         │
      │  [Start New Test Call]  [Close]                       │
      │                                                         │
      └────────────────────────────────────────────────────────┘
      ```

11. **Review Test Call Transcript**
    - User clicks [View Full Transcript]
    - System displays full conversation with timestamps:
      ```
      Call Transcript - Test Call
      Date: 2024-01-15 14:32:18
      Duration: 01:42
      ════════════════════════════════════════════════════════

      [00:00] Assistant: Hello! Thanks for calling Acme
      Support. I'm an AI assistant ready to help you. How
      can I assist you today?

      [00:08] You: What are your business hours?

      [00:12] Assistant: We're open Monday through Friday,
      9 AM to 5 PM Eastern Time. Our AI assistant is
      available 24/7.

      [00:18] Assistant: You can also reach us via...

      [00:19] You: What about Saturday?

      [00:22] Assistant: We're closed on weekends, but you
      can leave a message and we'll respond on Monday
      morning.

      [00:28] You: How do I reset my password?

      [00:29] System: 🔍 Searching knowledge base...

      [00:30] Assistant: To reset your password, follow
      these steps: 1. Go to the login page and click
      "Forgot Password". 2. Enter your email address...

      [01:35] You: goodbye

      [01:38] Assistant: Thank you for calling. Have a
      great day!

      ════════════════════════════════════════════════════════
      [Download PDF]  [Copy to Clipboard]  [Close]
      ```
   - User reviews for accuracy
   - User confirms transcription quality high (94.5% confidence)

12. **Review Call Metadata**
    - User closes transcript
    - User clicks "View Call Details" in test dashboard
    - System displays call record:
      ```
      Test Call Details
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      Call ID: test-call-abc123
      Chatbot: Customer Support Agent
      Source: Web Widget (Test)
      Status: Completed
      Started: 2024-01-15 14:32:18
      Ended: 2024-01-15 14:34:00
      Duration: 01:42 (102 seconds)

      AI Configuration:
      - Provider: OpenAI Realtime
      - Model: GPT-4 Realtime (Oct 2024)
      - Voice: Shimmer
      - Speed: 1.1x

      Quality Metrics:
      - Average Latency: 234ms
      - Transcription Confidence: 94.5%
      - Audio Quality: Good
      - Connection Stability: Stable

      Features Used:
      ✓ Voice Activity Detection
      ✓ User Interruption (1 time)
      ✓ Knowledge Base Search (1 query)
      ✓ Real-time Transcription

      Estimated Cost: $0.27
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ```
   - User reviews all details
   - User confirms everything working as expected

13. **Rate Test Experience** (Optional)
    - User clicks [Rate Call Quality] ★★★★★
    - User selects 5 stars
    - System prompts for optional feedback:
      ```
      How was the test call quality?

      ★★★★★ (5/5)

      Additional Comments (optional):
      ┌────────────────────────────────────────────┐
      │ Voice quality excellent, interruption      │
      │ worked perfectly. KB integration fast.     │
      └────────────────────────────────────────────┘

      [Skip]  [Submit Feedback]
      ```
    - User submits feedback
    - System saves to call record

14. **Make Adjustments** (if issues found)
    - If user finds issues during test:
      - Voice too fast → Go to Call Settings, adjust speed to 1.0x
      - Greeting too long → Edit greeting to be more concise
      - KB search not working → Check KB categories assigned
      - Audio quality poor → Check internet connection, try different browser
    - User makes adjustments
    - User runs another test call to verify fixes

**Success Criteria**:
- Test call completes successfully
- Audio quality good (latency <500ms)
- Transcription accurate (>90% confidence)
- User interruption works smoothly
- Knowledge base queries answered correctly
- Call ends gracefully on command
- Full transcript and metadata available

**Common Test Scenarios**:
- **Happy path**: User asks questions, gets accurate answers, says goodbye
- **Interruption test**: User interrupts agent multiple times
- **Silence test**: User stays silent to trigger timeout
- **Knowledge base test**: Ask questions that require KB lookup
- **Edge case test**: Background noise, poor connection, accented speech
- **Long conversation**: Test approaching max duration warning

---

## 3. End User Flows

### 3.1 Web Widget Call Flow

**Purpose**: End user initiates voice call from company website

**Prerequisites**:
- Company website has widget embed code installed
- Chatbot has enabled_call=true
- User has modern browser with microphone support

**Flow Steps**:

1. **User Visits Website**
   - User navigates to company website (e.g., https://acme.com)
   - Widget script loads automatically:
     ```html
     <script src="https://chat.buzzi.ai/embed/widget.js"></script>
     ```
   - System checks chatbot configuration
   - System determines which buttons to show:
     - enabled_chat=true → Show chat button
     - enabled_call=true → Show call button

2. **Widget Appears on Page**
   - Widget loads in bottom-right corner (or configured position)
   - User sees two buttons stacked vertically:
     ```
                                    [📞 Talk to AI]  ← Call button (top)
                                    [💬 Chat]        ← Chat button (bottom)
     ```
   - Call button styled per configuration:
     - Color: Blue (#3B82F6)
     - Size: Large (64px)
     - Text: "📞 Talk to AI"
   - Buttons have subtle animation (gentle pulse every 5 seconds)

3. **User Clicks Call Button**
   - User clicks [📞 Talk to AI] button
   - System expands widget to show call interface:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  Acme Support                                    [×]    │
     ├────────────────────────────────────────────────────────┤
     │                                                         │
     │  Need help? Click the microphone button below to       │
     │  start a voice call. I'm here 24/7!                    │
     │                                                         │
     │                  [🎤 Start Call]                       │
     │                                                         │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - User sees welcome message (configured in widget settings)

4. **Request Microphone Permission**
   - User clicks [🎤 Start Call] button
   - System requests microphone permission:
     ```javascript
     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
     ```
   - **If first time**: Browser shows permission prompt:
     ```
     "acme.com" wants to use your microphone

     [Block]  [Allow]
     ```
   - **If user clicks [Allow]**:
     - Permission granted
     - System proceeds to step 5
   - **If user clicks [Block]**:
     - System displays error message:
       ```
       ┌──────────────────────────────────────────────────┐
       │  ⚠️ Microphone Access Required                   │
       │                                                   │
       │  To make a voice call, please allow microphone   │
       │  access in your browser settings.                │
       │                                                   │
       │  [Show Instructions]  [Try Again]  [Cancel]     │
       └──────────────────────────────────────────────────┘
       ```
     - User clicks [Show Instructions]
     - System displays browser-specific steps to enable microphone
     - User enables permission and clicks [Try Again]

5. **Establish Connection**
   - System shows "Connecting..." status:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  Acme Support                                    [×]    │
     ├────────────────────────────────────────────────────────┤
     │                                                         │
     │                    [Animated Orb]                       │
     │                    (pulsing blue)                       │
     │                                                         │
     │              🔄 Connecting to assistant...              │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - System creates call session:
     ```javascript
     // Frontend
     const response = await fetch('/api/widget/call/session', {
       method: 'POST',
       body: JSON.stringify({
         chatbotId,
         companyId,
         customer: {
           sessionId: localSessionId,
           userAgent: navigator.userAgent
         }
       })
     });

     const { sessionId, websocketUrl } = await response.json();
     ```
   - System establishes WebSocket connection:
     ```javascript
     const ws = new WebSocket(websocketUrl);
     ws.onopen = () => {
       console.log('WebSocket connected');
       startAudioStreaming();
     };
     ```
   - Connection typically takes 2-3 seconds

6. **Call Connected - Hear Greeting**
   - System displays "Connected" status
   - Audio begins streaming
   - User hears greeting message:
     - "Hello! Thanks for calling Acme Support. I'm an AI assistant ready to help you. How can I assist you today?"
   - Visual feedback:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  Acme Support                              ⏱️ 00:03 [×]│
     ├────────────────────────────────────────────────────────┤
     │                                                         │
     │                    [Animated Orb]                       │
     │                   (pulsing green)                       │
     │                                                         │
     │              🔊 AI assistant is speaking...             │
     │                                                         │
     │  ┌────────────────────────────────────────────────┐   │
     │  │ Transcript                                      │   │
     │  ├────────────────────────────────────────────────┤   │
     │  │ [00:00] Assistant: Hello! Thanks for calling   │   │
     │  │ Acme Support. I'm an AI assistant ready to     │   │
     │  │ help you. How can I assist you today?          │   │
     │  └────────────────────────────────────────────────┘   │
     │                                                         │
     │  [🔇 Mute]                            [📞 End Call]   │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - Call duration timer starts: ⏱️ 00:03
   - Transcript appears in real-time as agent speaks
   - Orb animates to match agent's speech (pulsing with amplitude)

7. **User Speaks First Question**
   - User speaks: "I need help resetting my password"
   - System captures audio from microphone:
     ```javascript
     // Audio capture using Web Audio API
     const audioContext = new AudioContext();
     const source = audioContext.createMediaStreamSource(stream);
     const processor = audioContext.createScriptProcessor(4096, 1, 1);

     processor.onaudioprocess = (event) => {
       const audioData = event.inputBuffer.getChannelData(0);
       const base64Audio = btoa(new Uint8Array(audioData.buffer));

       // Send to server via WebSocket
       ws.send(JSON.stringify({
         type: 'audio',
         data: base64Audio
       }));
     };
     ```
   - Visual feedback changes:
     - Orb color changes from green to blue (user speaking indicator)
     - Status: "🎤 You are speaking..."
   - Transcript updates in real-time:
     ```
     [00:08] You: I need help resetting my password
     ```
   - User sees their own words appear as they speak (Whisper transcription)

8. **AI Responds to Question**
   - AI processes user's question
   - System receives audio response from backend
   - Audio plays through user's speakers
   - Visual feedback:
     - Orb returns to green (agent speaking)
     - Status: "🔊 AI assistant is speaking..."
   - Transcript updates:
     ```
     [00:12] Assistant: I can help you with that.
     To reset your password, I'll need to look up
     the instructions. One moment please.

     [00:16] System: 🔍 Searching knowledge base...

     [00:17] Assistant: Here's how to reset your
     password: First, go to our login page and
     click the "Forgot Password" link. Then enter
     your email address...
     ```
   - User hears clear voice explanation with natural pacing

9. **User Interrupts Agent**
   - Agent is mid-sentence: "...and then click the link in the email we send you..."
   - User interrupts: "Wait, what if I don't receive the email?"
   - System detects interruption via VAD (Voice Activity Detection)
   - Agent stops speaking immediately
   - Visual: Orb quickly changes blue → green (seamless transition)
   - Transcript shows:
     ```
     [00:28] Assistant: ...and then click the link
     in the email we send you...

     [00:30] You: Wait, what if I don't receive the
     email?

     [00:33] Assistant: Good question! If you don't
     receive the email within a few minutes, please
     check your spam folder. If it's still not there...
     ```
   - User appreciates natural, interruptible conversation flow

10. **User Asks Follow-Up Questions**
    - Conversation continues naturally:
      ```
      [00:45] You: Can you help with billing questions too?

      [00:48] Assistant: Absolutely! I can assist with
      billing questions, account information, technical
      support, and general inquiries. What billing
      question do you have?

      [00:55] You: Actually, that was all I needed. Thanks!

      [00:58] Assistant: You're welcome! Is there anything
      else I can help you with today?

      [01:02] You: No, that's all.

      [01:04] Assistant: Great! Thank you for calling Acme
      Support. If you need anything else, feel free to
      call back anytime. Have a wonderful day!

      [01:10] You: Goodbye

      [01:12] System: Call ending...
      ```
    - Call duration now at ⏱️ 01:12

11. **Call Ends Gracefully**
    - System detects "goodbye" keyword
    - Agent provides closing message
    - System waits 2 seconds for any final words
    - WebSocket connection closes gracefully
    - Interface transitions to end call screen:
      ```
      ┌────────────────────────────────────────────────────────┐
      │  Acme Support                                    [×]    │
      ├────────────────────────────────────────────────────────┤
      │                                                         │
      │                    ✓ Call Ended                        │
      │                                                         │
      │           Thanks for calling!                           │
      │                                                         │
      │  Call Duration: 01:12                                  │
      │                                                         │
      │  ┌────────────────────────────────────────────────┐   │
      │  │ How was your experience?                        │   │
      │  │ ★★★★★                                          │   │
      │  └────────────────────────────────────────────────┘   │
      │                                                         │
      │  [View Transcript]  [Download Recording]              │
      │                                                         │
      │  [Start New Call]  [Send Chat Message]                │
      │                                                         │
      └────────────────────────────────────────────────────────┘
      ```
    - User can optionally rate experience (1-5 stars)
    - User can download transcript or recording (if enabled)

12. **User Rates Experience** (Optional)
    - User clicks ★★★★★ (5 stars)
    - System displays feedback form:
      ```
      Thanks for your rating!

      Any additional comments? (optional)
      ┌────────────────────────────────────────────┐
      │ Quick and helpful! Password reset          │
      │ instructions were clear.                   │
      └────────────────────────────────────────────┘

      [Skip]  [Submit]
      ```
    - User submits feedback
    - System saves rating to database:
      ```sql
      UPDATE chatapp.calls
      SET call_quality = 5,
          notes = 'Quick and helpful! Password reset instructions were clear.'
      WHERE id = 'call-uuid';
      ```
    - System displays: "✓ Thank you for your feedback!"

13. **Widget Returns to Default State**
    - After 10 seconds (or user closes), widget minimizes back to buttons:
      ```
                                    [📞 Talk to AI]
                                    [💬 Chat]
      ```
    - User can initiate another call or chat anytime
    - Call history saved to backend for company admin review

**Success Criteria**:
- User successfully places call from website
- Audio quality clear and low-latency (<500ms)
- Transcription appears in real-time with high accuracy
- User can interrupt agent naturally
- Call ends gracefully with proper cleanup
- User experience smooth and intuitive

**Common User Actions**:
- **Minimize during call**: User clicks minimize, call continues in background with floating mini-player
- **Mute microphone**: User clicks [🔇 Mute], microphone disabled, orb shows muted state
- **Close widget**: User clicks [×], system asks "End call?" confirmation
- **Switch to chat**: User can transition from call to chat (start new chat session)

**Error Scenarios**:
- **Connection lost**: System shows "Connection lost. Reconnecting..." and attempts to restore
- **Microphone fails**: System shows "Microphone error. Please check your device."
- **Call timeout**: At max duration, agent warns user, then gracefully ends call
- **Browser compatibility**: If WebAudio not supported, show message to upgrade browser

---

### 3.2 WhatsApp Call Flow

**Purpose**: End user initiates voice call through WhatsApp Business

**Prerequisites**:
- Company has WhatsApp Business API integration configured
- User has WhatsApp installed on their phone
- Chatbot enabled for WhatsApp integration

**Flow Steps**:

1. **User Opens WhatsApp**
   - User launches WhatsApp app on mobile device (iOS/Android)
   - User navigates to Contacts or Chats

2. **User Finds Business Contact**
   - **Option A**: User saved business number to contacts
     - User searches for "Acme Support" in contacts
     - User taps on contact
   - **Option B**: User has existing chat thread
     - User opens chat with Acme Support (from previous text conversation)
   - **Option C**: User manually enters number
     - User taps "New Chat"
     - User enters "+1 (555) 020-0200"
     - User taps on verified business profile

3. **View Business Profile**
   - WhatsApp displays verified business profile:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  ← Acme Support                          🔍  ⋮          │
     │     Active now                                          │
     ├────────────────────────────────────────────────────────┤
     │                                                         │
     │  🏢 [Company Logo]                                     │
     │                                                         │
     │  Acme Support                                          │
     │  ✓ Business Account                                    │
     │                                                         │
     │  📞 +1 (555) 020-0200                                  │
     │  🌐 https://acme.com                                   │
     │  📧 support@acme.com                                   │
     │                                                         │
     │  ℹ️  Business hours: Mon-Fri 9AM-5PM                   │
     │  🤖 AI assistant available 24/7                        │
     │                                                         │
     │  [Send Message]  [Voice Call]  [Video Call]           │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - User sees "Voice Call" option is available

4. **Initiate Voice Call**
   - User taps [Voice Call] button
   - WhatsApp displays "Calling Acme Support..."
   - System shows connecting animation:
     ```
     ┌────────────────────────────────────────────────────────┐
     │                                                         │
     │           [Business Profile Picture]                    │
     │                                                         │
     │                 Acme Support                            │
     │             Calling... ⏱️ 00:00                        │
     │                                                         │
     │                  [🔴 End Call]                         │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```

5. **WhatsApp Sends Webhook to System**
   - WhatsApp sends call initiation event:
     ```json
     POST /api/webhooks/whatsapp/call/x9y8z7w6

     {
       "entry": [{
         "changes": [{
           "value": {
             "messaging_product": "whatsapp",
             "metadata": {
               "phone_number_id": "987654321098765"
             },
             "calls": [{
               "from": "15550199",
               "id": "whatsapp-call-abc123",
               "timestamp": "1705329123",
               "type": "voice"
             }]
           }
         }]
       }]
     }
     ```
   - System backend processes webhook:
     ```javascript
     // Webhook handler
     export async function POST(request: Request) {
       const body = await request.json();

       // Verify webhook signature
       if (!verifyWhatsAppSignature(request, body)) {
         return new Response('Unauthorized', { status: 401 });
       }

       // Extract call info
       const call = body.entry[0].changes[0].value.calls[0];
       const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;

       // Find chatbot for this phone number
       const integrationAccount = await db.query.integrationAccounts.findFirst({
         where: eq(integrationAccounts.credentials->>'phoneNumberId', phoneNumberId)
       });

       // Create call session
       const callSession = await createCallSession({
         chatbotId: integrationAccount.chatbotId,
         source: 'whatsapp',
         fromNumber: call.from,
         callSid: call.id
       });

       // Respond with WebRTC SDP answer
       return Response.json({
         type: 'answer',
         sdp: callSession.sdpAnswer
       });
     }
     ```

6. **Call Connects - User Hears Greeting**
   - System accepts call via WebRTC
   - WhatsApp shows "Connected":
     ```
     ┌────────────────────────────────────────────────────────┐
     │                                                         │
     │           [Business Profile Picture]                    │
     │                                                         │
     │                 Acme Support                            │
     │              Connected ⏱️ 00:05                        │
     │                                                         │
     │  [🔇 Mute]  [🔊 Speaker]  [🔴 End Call]              │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```
   - User hears AI greeting through phone speaker/earpiece:
     - "Hello! Thanks for calling Acme Support. I'm an AI assistant ready to help you. How can I assist you today?"
   - Call timer starts incrementing: ⏱️ 00:05

7. **User Speaks Question**
   - User speaks into phone microphone:
     - "I received a damaged product and need a replacement"
   - Audio flows:
     ```
     User's Phone Mic
       ↓
     WhatsApp App (Opus encoding)
       ↓
     WhatsApp Servers (RTP over WebRTC)
       ↓
     System Backend (WhatsAppCallHandler)
       ↓
     Audio Converter (Opus → PCM16 48kHz → 24kHz resample)
       ↓
     CallExecutor (OpenAIRealtimeProvider)
       ↓
     OpenAI Realtime API
     ```
   - User sees no transcript (WhatsApp native call UI doesn't show transcript)
   - But system is recording transcript in backend for later review

8. **AI Responds**
   - AI processes user's question
   - System accesses knowledge base (product return policy)
   - AI generates response:
     - "I'm sorry to hear about the damaged product. I can definitely help you with a replacement. Can you please provide your order number so I can look up your order details?"
   - Audio flows back to user:
     ```
     OpenAI Realtime API
       ↓
     CallExecutor receives audio delta
       ↓
     Audio Converter (PCM16 24kHz → 48kHz resample → Opus encode)
       ↓
     WhatsAppCallHandler sends via WebRTC
       ↓
     WhatsApp Servers
       ↓
     User's Phone Speaker/Earpiece
     ```
   - User hears clear AI voice response

9. **Conversation Continues**
   - User provides order number: "My order number is 12345"
   - AI confirms: "Thank you. Let me look that up for you."
   - AI uses function calling to query order system (hypothetical):
     ```javascript
     // System calls function
     const orderDetails = await tools.lookupOrder({ orderNumber: '12345' });
     ```
   - AI responds: "I found your order from January 10th for the Blue Widget Pro. I see it was delivered on January 13th. I've created a replacement order for you, and we'll email you a prepaid return label for the damaged item. The replacement will ship within 24 hours. Is there anything else I can help you with?"
   - User: "No, that's perfect. Thank you!"
   - AI: "You're very welcome! We apologize for the inconvenience. Have a great day!"
   - User: "Thanks, bye!"
   - AI: "Goodbye!"

10. **Call Ends**
    - System detects "bye" keyword (end call phrase)
    - System gracefully terminates WebRTC connection
    - WhatsApp shows call ended screen:
      ```
      ┌────────────────────────────────────────────────────────┐
      │                                                         │
      │           [Business Profile Picture]                    │
      │                                                         │
      │                 Acme Support                            │
      │              Call ended ⏱️ 02:34                       │
      │                                                         │
      │  Duration: 2 minutes 34 seconds                        │
      │  Quality: Good                                         │
      │                                                         │
      │  [Call Again]  [Send Message]                         │
      │                                                         │
      └────────────────────────────────────────────────────────┘
      ```
    - Call record saved to database with duration, transcript, metadata

11. **Follow-Up Message** (Optional System Feature)
    - System automatically sends follow-up WhatsApp text message:
      ```
      ┌────────────────────────────────────────────────────────┐
      │  Acme Support                                    14:45  │
      ├────────────────────────────────────────────────────────┤
      │                                                         │
      │  Thanks for calling! Here's a summary of our           │
      │  conversation:                                          │
      │                                                         │
      │  ✓ Created replacement order for damaged Blue Widget   │
      │    Pro (Order #12345)                                  │
      │  ✓ Return label will be emailed within 1 hour         │
      │  ✓ Replacement ships in 24 hours                       │
      │                                                         │
      │  Your replacement order number: #67890                 │
      │                                                         │
      │  Questions? Reply to this message or call us back.     │
      │                                                         │
      │  [View Full Transcript]                                │
      │                                                         │
      └────────────────────────────────────────────────────────┘
      ```
    - User can click [View Full Transcript] to see written record of call
    - Transcript opens in browser or as PDF download

12. **User Reviews Transcript** (Optional)
    - User clicks [View Full Transcript]
    - System generates unique link: https://chat.buzzi.ai/transcripts/abc123
    - Browser opens with full transcript:
      ```
      Call Transcript
      Acme Support
      January 15, 2024 at 2:42 PM
      Duration: 2 minutes 34 seconds
      ════════════════════════════════════════════════════════

      [00:00] Assistant: Hello! Thanks for calling Acme
      Support. I'm an AI assistant ready to help you. How
      can I assist you today?

      [00:08] Customer: I received a damaged product and
      need a replacement.

      [00:12] Assistant: I'm sorry to hear about the
      damaged product. I can definitely help you with a
      replacement. Can you please provide your order number
      so I can look up your order details?

      ... [rest of transcript] ...

      ════════════════════════════════════════════════════════
      Need help? Contact us at support@acme.com
      ```
    - User can save or print transcript for records

**Success Criteria**:
- Call connects successfully via WhatsApp
- Audio quality is clear with minimal lag
- AI successfully handles order lookup and creates replacement
- Call ends gracefully
- User receives helpful follow-up message with transcript
- Call record saved to system for company admin review

**WhatsApp-Specific Considerations**:
- **Audio codec**: Opus at 48kHz (requires resampling to 24kHz for OpenAI)
- **WebRTC**: Uses ICE candidates for NAT traversal
- **Latency**: Typically 300-500ms (slightly higher than direct WebSocket)
- **No visual interface**: User only has WhatsApp's standard call UI (no custom transcript display during call)
- **Follow-up messaging**: Unique advantage of WhatsApp (can send text after call)
- **International calls**: WhatsApp uses internet, no international phone charges

**Troubleshooting**:
- **Call doesn't connect**: Check WhatsApp webhook configuration in Meta Business Suite
- **Poor audio quality**: Check user's internet connection (WhatsApp uses VoIP)
- **Delayed responses**: May indicate server processing issues or high latency

---

### 3.3 Twilio Phone Call Flow

**Purpose**: End user calls company phone number via traditional phone network (PSTN)

**Prerequisites**:
- Company has Twilio integration configured
- Twilio phone number provisioned and active
- Chatbot configured for Twilio integration

**Flow Steps**:

1. **User Dials Phone Number**
   - User picks up their phone (mobile, landline, or VoIP)
   - User dials company number: +1 (555) 010-0100
   - Phone network routes call to Twilio

2. **Twilio Receives Incoming Call**
   - Twilio phone number receives call
   - Twilio checks webhook configuration for this number
   - Twilio sends HTTP request to system webhook:
     ```http
     POST /api/webhooks/twilio/voice/a1b2c3d4
     Content-Type: application/x-www-form-urlencoded

     Called=%2B15550100&
     Caller=%2B15550199&
     CallSid=CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&
     AccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&
     Direction=inbound&
     From=%2B15550199&
     To=%2B15550100
     ```

3. **System Responds with TwiML**
   - System webhook handler processes request:
     ```javascript
     export async function POST(request: Request) {
       const formData = await request.formData();

       // Verify Twilio signature
       if (!verifyTwilioSignature(request, formData)) {
         return new Response('Forbidden', { status: 403 });
       }

       // Extract call details
       const callSid = formData.get('CallSid');
       const from = formData.get('From');
       const to = formData.get('To');

       // Find chatbot for this phone number
       const integrationAccount = await findIntegrationAccountByPhone(to);

       // Create call session
       const session = await createCallSession({
         chatbotId: integrationAccount.chatbotId,
         source: 'twilio',
         direction: 'inbound',
         fromNumber: from,
         toNumber: to,
         callSid
       });

       // Generate TwiML response with <Stream> verb
       const twiml = `<?xml version="1.0" encoding="UTF-8"?>
       <Response>
         <Connect>
           <Stream url="wss://chat.buzzi.ai/api/webhooks/twilio/stream/${session.id}">
             <Parameter name="chatbotId" value="${integrationAccount.chatbotId}" />
             <Parameter name="sessionId" value="${session.id}" />
           </Stream>
         </Connect>
       </Response>`;

       return new Response(twiml, {
         headers: { 'Content-Type': 'application/xml' }
       });
     }
     ```
   - System returns TwiML XML telling Twilio to open WebSocket stream

4. **Twilio Establishes WebSocket Stream**
   - Twilio opens WebSocket connection to system:
     ```
     wss://chat.buzzi.ai/api/webhooks/twilio/stream/session-uuid
     ```
   - Twilio sends "connected" event:
     ```json
     {
       "event": "connected",
       "protocol": "Call",
       "version": "1.0.0"
     }
     ```
   - System responds with acknowledgment
   - Twilio begins streaming audio bidirectionally

5. **User Hears Greeting** (Call Answered)
   - System sends greeting audio to Twilio via WebSocket
   - Audio format: μ-law (PCMU) at 8kHz (telephone quality)
   - System converts OpenAI audio (PCM16 24kHz) → PCMU 8kHz:
     ```javascript
     // Audio conversion
     const pcm16Audio = await getAudioFromOpenAI(); // 24kHz PCM16
     const resampled = resample(pcm16Audio, 24000, 8000); // Downsample to 8kHz
     const pcmuAudio = encodePCMU(resampled); // Encode to μ-law

     // Send to Twilio
     ws.send(JSON.stringify({
       event: 'media',
       streamSid,
       media: {
         payload: Buffer.from(pcmuAudio).toString('base64')
       }
     }));
     ```
   - User hears through their phone:
     - "Hello! Thanks for calling Acme Support. I'm an AI assistant ready to help you. How can I assist you today?"
   - Audio quality: Telephone quality (8kHz sampling rate)

6. **User Speaks Question**
   - User speaks into phone: "I'm calling about my bill"
   - Twilio captures audio from phone network
   - Twilio sends audio to system via WebSocket:
     ```json
     {
       "event": "media",
       "sequenceNumber": "12",
       "media": {
         "track": "inbound",
         "chunk": "2",
         "timestamp": "5000",
         "payload": "base64_encoded_pcmu_audio"
       },
       "streamSid": "MZxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
     }
     ```
   - System receives and decodes audio:
     ```javascript
     // Receive from Twilio
     ws.on('message', (data) => {
       const event = JSON.parse(data);

       if (event.event === 'media') {
         const pcmuAudio = Buffer.from(event.media.payload, 'base64');

         // Convert PCMU 8kHz → PCM16 8kHz → PCM16 24kHz (for OpenAI)
         const pcm8k = decodePCMU(pcmuAudio);
         const pcm24k = resample(pcm8k, 8000, 24000);
         const base64Audio = pcm24k.toString('base64');

         // Send to OpenAI Realtime API
         openAIConnection.send(JSON.stringify({
           type: 'input_audio_buffer.append',
           audio: base64Audio
         }));
       }
     });
     ```
   - User's speech transcribed and processed by AI

7. **AI Responds**
   - AI generates response:
     - "I'd be happy to help you with your bill. Can you please provide your account number or the phone number associated with your account?"
   - System sends audio back to Twilio (converted to PCMU 8kHz)
   - User hears response through phone
   - Conversation continues naturally

8. **User Provides Account Information**
   - User: "My account number is 98765"
   - AI: "Thank you. Let me look up your account."
   - AI uses function calling to fetch billing information:
     ```javascript
     const billingInfo = await tools.getBillingInfo({ accountNumber: '98765' });
     ```
   - AI: "I have your account pulled up. Your current balance is $87.50, and your next bill is due on January 25th. How can I help you with your bill?"
   - User: "Why is it higher than last month?"
   - AI: "Let me check the details. Your bill increased by $15 this month because you upgraded to the Premium plan on January 5th. The new plan includes unlimited calls and 5GB of additional data."
   - User: "Oh, that's right. I forgot about the upgrade. That makes sense. Thank you."
   - AI: "You're welcome! Is there anything else I can help you with regarding your bill or account?"
   - User: "No, that's all. Thanks."
   - AI: "Great! Thank you for calling Acme Support. If you have any other questions in the future, feel free to call us back. Have a wonderful day. Goodbye!"
   - User: "Goodbye."

9. **Call Ends**
   - System detects "goodbye" keyword
   - System sends end stream message to Twilio:
     ```json
     {
       "event": "stop",
       "streamSid": "MZxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
     }
     ```
   - Twilio closes WebSocket connection
   - Twilio hangs up phone call
   - User hears disconnect tone
   - Call ends on user's phone

10. **Twilio Sends Status Callback**
    - Twilio sends final call status to webhook:
      ```http
      POST /api/webhooks/twilio/call-status/a1b2c3d4
      Content-Type: application/x-www-form-urlencoded

      CallSid=CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx&
      CallStatus=completed&
      CallDuration=142&
      From=%2B15550199&
      To=%2B15550100&
      Direction=inbound
      ```
    - System updates call record in database:
      ```sql
      UPDATE chatapp.calls
      SET status = 'completed',
          duration = 142,
          ended_at = NOW()
      WHERE call_sid = 'CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      ```

11. **Company Admin Views Call Record**
    - Company admin logs into dashboard
    - Admin clicks "Analytics" → "Calls"
    - Admin sees call in list:
      ```
      | Date/Time         | From          | To            | Duration | Status    | Actions |
      |-------------------|---------------|---------------|----------|-----------|---------|
      | Jan 15, 2:45 PM   | +1-555-0199   | +1-555-0100   | 2:22     | Completed | View    |
      ```
    - Admin clicks "View"
    - System displays full call details:
      ```
      Call Details
      ════════════════════════════════════════════════════════

      Call ID: twilio-call-xyz789
      Chatbot: Customer Support Agent
      Source: Twilio Phone (Main Support Line)
      Direction: Inbound

      From: +1 (555) 019-9000
      To: +1 (555) 010-0100
      Call SID: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

      Status: Completed
      Started: Jan 15, 2024 at 2:45:18 PM
      Answered: Jan 15, 2024 at 2:45:20 PM
      Ended: Jan 15, 2024 at 2:47:40 PM
      Duration: 2 minutes 22 seconds (142 seconds)

      AI Configuration:
      - Provider: OpenAI Realtime
      - Model: GPT-4 Realtime (Oct 2024)
      - Voice: Nova
      - Audio Quality: Telephone (8kHz PCMU)

      Call Summary (AI Generated):
      Customer inquired about increased bill amount.
      Explained Premium plan upgrade on January 5th added
      $15/month. Customer satisfied with explanation. No
      further action needed.

      Transcript:
      [View Full Transcript]

      Recording:
      [🔊 Play Recording] [⬇️ Download MP3]

      Estimated Cost: $0.47
      (142 seconds × $0.20/min = $0.47)
      ════════════════════════════════════════════════════════
      ```
    - Admin can listen to recording and review transcript

**Success Criteria**:
- Phone call connects successfully via Twilio
- Audio quality is acceptable (8kHz telephone quality)
- AI provides accurate billing information via function calling
- Call ends gracefully
- Call record saved with complete metadata
- Recording available for quality assurance

**Twilio-Specific Considerations**:
- **Audio codec**: PCMU (μ-law) at 8kHz (telephone quality, lower than Web/WhatsApp)
- **Latency**: Typically 200-400ms (lower than WhatsApp, similar to Web)
- **Network**: PSTN (traditional phone network) + VoIP hybrid
- **Call recording**: Twilio can record natively (alternative to system recording)
- **Costs**: Twilio charges per minute + OpenAI API costs
- **Caller ID**: System can see caller's phone number (useful for customer lookup)
- **DTMF tones**: Can capture button presses (e.g., "Press 1 for sales") - not typically used with AI

**Advantages of Twilio Phone Calls**:
- Accessibility: Users don't need internet or apps, just any phone
- Familiarity: Traditional calling experience
- Reliability: PSTN network very reliable
- Caller ID: System can identify repeat callers

**Limitations**:
- Audio quality: 8kHz (lower than Web 24kHz or WhatsApp 48kHz)
- Cost: Higher than Web-only solution (Twilio fees + AI costs)
- No visual interface: User can't see transcript during call
- International: May have international calling charges (unless caller uses VoIP)

---

## 4. Error Handling Flows

### 4.1 Call Connection Failed

**Scenario**: System unable to establish call connection

**Possible Causes**:
- Provider API down (OpenAI Realtime API unavailable)
- Network connectivity issues
- Invalid configuration (missing API keys)
- Rate limit exceeded

**User Experience**:

**Web Widget**:
```
┌────────────────────────────────────────────────────────┐
│  ⚠️ Unable to Connect                                  │
├────────────────────────────────────────────────────────┤
│                                                         │
│  We're having trouble connecting to our voice system.  │
│  Please try again in a moment.                         │
│                                                         │
│  [Try Again]  [Start Chat Instead]  [Close]           │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**WhatsApp/Twilio**:
- User hears: "We're experiencing technical difficulties. Please try your call again later or send us a message."
- Call automatically disconnects after message

**System Actions**:
1. Log error with full context:
   ```javascript
   logger.error('Call connection failed', {
     chatbotId,
     sessionId,
     error: error.message,
     provider: 'openai',
     timestamp: new Date()
   });
   ```
2. Update call record status to 'failed':
   ```sql
   UPDATE chatapp.calls
   SET status = 'failed',
       error_message = 'Provider connection timeout',
       error_code = 'provider_connection_failed'
   WHERE id = 'call-uuid';
   ```
3. Send alert to company admin (if failure rate > 5%)
4. Increment error counter for monitoring
5. Attempt automatic retry (max 3 attempts with exponential backoff)

**Recovery**:
- User can retry call immediately
- System tries alternative provider if configured (OpenAI → Gemini fallback)
- User offered chat alternative if calls continue to fail

---

### 4.2 Integration Account Inactive

**Scenario**: User attempts to call via integration that's disabled or errored

**Trigger**: integration_accounts.is_active = false OR status = 'error'

**User Experience**:

**Twilio Phone Call**:
- User dials company phone number
- User hears pre-recorded message:
  - "This phone number is currently unavailable. Please visit our website at acme.com for support, or send us an email at support@acme.com. Thank you."
- Call ends

**WhatsApp Call**:
- User initiates call
- Call never connects (WhatsApp shows "Call Failed")
- System sends WhatsApp message:
  ```
  Sorry, voice calls are temporarily unavailable. Please
  send us a text message and we'll respond shortly.
  ```

**Web Widget**:
- Call button is disabled (grayed out)
- Hover tooltip: "Voice calls temporarily unavailable"
- User sees banner: "Voice calls are currently offline. Please use chat for immediate assistance."

**System Actions**:
1. Check integration account status before allowing call:
   ```javascript
   const integrationAccount = await db.query.integrationAccounts.findFirst({
     where: eq(integrationAccounts.id, integrationAccountId)
   });

   if (!integrationAccount.isActive || integrationAccount.status === 'error') {
     throw new Error('Integration account inactive');
   }
   ```
2. Log attempted call to inactive integration
3. Send notification to company admin:
   ```
   Subject: Integration Account Requires Attention

   Your Twilio integration "Main Support Line" is currently
   inactive. Incoming calls are being rejected.

   Error: Invalid Auth Token

   Action required: Update credentials in Integration Accounts
   settings.

   [Fix Integration] button
   ```
4. Display error dashboard in admin panel:
   ```
   ⚠️ Critical: Integration Down
   Main Support Line (Twilio +1-555-0100) is offline.
   Calls are being rejected since 2:30 PM (15 minutes ago).
   Last error: Invalid Auth Token

   [Troubleshoot] [Disable Temporarily]
   ```

**Resolution**:
- Company admin updates integration credentials
- Admin clicks "Test Connection" to verify fix
- System sets is_active=true, status='active'
- Calls resume normally

---

### 4.3 Call Quality Issues

**Scenario**: Poor audio quality, high latency, or packet loss detected

**Detection**:
- Latency > 500ms
- Packet loss > 5%
- Transcription confidence < 70%
- User reports issue

**User Experience During Call**:
```
┌────────────────────────────────────────────────────────┐
│  Acme Support                            ⏱️ 01:23  [×]│
├────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️ Connection Quality: Poor                           │
│                                                         │
│        [Animated Orb - stuttering]                      │
│                                                         │
│  We're experiencing connection issues. Audio may be    │
│  unclear.                                              │
│                                                         │
│  [Try Reconnecting]  [Switch to Chat]  [Continue]     │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**System Actions**:
1. Monitor connection quality metrics:
   ```javascript
   setInterval(() => {
     const latency = calculateAverageLatency();
     const packetLoss = calculatePacketLoss();
     const transcriptionConfidence = getAverageConfidence();

     if (latency > 500 || packetLoss > 0.05 || transcriptionConfidence < 0.70) {
       notifyPoorQuality();
     }
   }, 10000); // Check every 10 seconds
   ```
2. Log quality metrics:
   ```sql
   INSERT INTO chatapp.call_quality_logs (
     call_id, timestamp, latency, packet_loss, confidence
   ) VALUES ($1, NOW(), $2, $3, $4);
   ```
3. Offer remediation options to user
4. If quality doesn't improve after 30 seconds:
   - Suggest reconnection
   - Offer chat alternative
   - Gracefully end call if unusable

**User Actions**:
- **[Try Reconnecting]**: System closes WebSocket and re-establishes connection
- **[Switch to Chat]**: System transfers context to chat session, preserves conversation history
- **[Continue]**: User acknowledges poor quality and continues (system logs acceptance)

**Post-Call**:
- System flags call with quality issues
- Company admin sees in call list:
  ```
  | Date/Time         | From          | Duration | Status    | Quality |
  |-------------------|---------------|----------|-----------|---------|
  | Jan 15, 2:45 PM   | +1-555-0199   | 2:22     | Completed | ⚠️ Poor  |
  ```
- Admin can review call to identify patterns (e.g., specific geographic region, time of day, integration type)

---

### 4.4 Silence Timeout

**Scenario**: User silent for configured timeout duration (default: 3 minutes)

**Detection**:
- No speech detected from user for silenceTimeout seconds
- VAD (Voice Activity Detection) reports no activity

**User Experience**:

**Warning Phase** (at 80% of timeout, e.g., 2:24 into silence):
- AI speaks: "Are you still there? I haven't heard from you in a while. Let me know if you need anything else, or I'll end the call to free up the line."
- Visual (Web Widget):
  ```
  ┌────────────────────────────────────────────────────────┐
  │  ⏱️ 02:48                                         [×]  │
  ├────────────────────────────────────────────────────────┤
  │                                                         │
  │  ⏰ Still there?                                       │
  │                                                         │
  │        [Pulsing Orb - waiting]                         │
  │                                                         │
  │  No response detected for 2 minutes. Call will end    │
  │  in 36 seconds if no activity.                        │
  │                                                         │
  │  [I'm Here - Continue Call]                           │
  │                                                         │
  └────────────────────────────────────────────────────────┘
  ```

**End Phase** (full timeout reached, 3:00 of silence):
- AI speaks: "I haven't heard from you, so I'll go ahead and end the call now. Thank you for calling. Feel free to reach out anytime. Goodbye!"
- System waits 3 seconds
- Call ends automatically
- Web Widget shows:
  ```
  ┌────────────────────────────────────────────────────────┐
  │                                                         │
  │           ⏱️ Call Ended Due to Inactivity              │
  │                                                         │
  │  The call was ended after 3 minutes of silence.       │
  │  Duration: 5:32                                        │
  │                                                         │
  │  [Start New Call]  [View Transcript]                  │
  │                                                         │
  └────────────────────────────────────────────────────────┘
  ```

**System Actions**:
1. Track last user speech timestamp:
   ```javascript
   let lastUserSpeechTime = Date.now();

   // On VAD speech_started event
   onSpeechStarted(() => {
     lastUserSpeechTime = Date.now();
   });

   // Check every 10 seconds
   setInterval(() => {
     const silenceDuration = Date.now() - lastUserSpeechTime;
     const timeoutMs = chatbotSettings.call.silenceTimeout * 1000;

     if (silenceDuration > timeoutMs * 0.8) {
       // Warning phase
       promptUser('Are you still there?');
     }

     if (silenceDuration > timeoutMs) {
       // End call
       endCallDueToSilence();
     }
   }, 10000);
   ```
2. Update call record:
   ```sql
   UPDATE chatapp.calls
   SET status = 'completed',
       ended_at = NOW(),
       notes = 'Call ended due to silence timeout (3 minutes)'
   WHERE id = 'call-uuid';
   ```
3. Log reason for call end:
   ```javascript
   logger.info('Call ended due to silence timeout', {
     callId,
     silenceDuration: 180,
     lastUserSpeechTime
   });
   ```

**User Recovery**:
- User can click [I'm Here] button during warning phase to continue call
- User can speak to reset silence timer
- After call ends, user can start new call immediately

**Configuration**:
- Company admin can adjust silenceTimeout (30-300 seconds) in Call Settings
- Shorter timeout (60s) for high-volume support lines
- Longer timeout (300s) for complex troubleshooting calls

---

### 4.5 Maximum Duration Reached

**Scenario**: Call reaches configured maximum duration limit (default: 10 minutes)

**Detection**:
- Call duration >= maxCallDuration seconds
- Timer reaches limit

**User Experience**:

**Warning Phase** (at 90% of max duration, e.g., 9:00 of 10:00):
- AI speaks: "Just to let you know, we have about one minute remaining on this call. Is there anything urgent I can help you with before we wrap up?"
- Visual (Web Widget):
  ```
  ┌────────────────────────────────────────────────────────┐
  │  ⏱️ 09:15 / 10:00                               [×]  │
  ├────────────────────────────────────────────────────────┤
  │                                                         │
  │  ⏰ Call ending soon                                   │
  │                                                         │
  │        [Orb with orange highlight]                     │
  │                                                         │
  │  Maximum call duration approaching. Call will end     │
  │  in 45 seconds.                                       │
  │                                                         │
  │  Transcript and recording will be saved.              │
  │                                                         │
  └────────────────────────────────────────────────────────┘
  ```

**End Phase** (max duration reached, 10:00):
- AI speaks: "We've reached the maximum call duration. Thank you so much for calling. If you need additional assistance, please feel free to call back or use our chat feature. Goodbye!"
- System waits 3 seconds for user response
- Call ends automatically
- Web Widget shows:
  ```
  ┌────────────────────────────────────────────────────────┐
  │                                                         │
  │        ✓ Call Ended - Maximum Duration Reached        │
  │                                                         │
  │  Duration: 10:00 (maximum)                            │
  │                                                         │
  │  Your conversation has been saved. If you need more   │
  │  help, please start a new call or send us a message.  │
  │                                                         │
  │  [Start New Call]  [Start Chat]  [View Transcript]   │
  │                                                         │
  └────────────────────────────────────────────────────────┘
  ```

**System Actions**:
1. Track call duration:
   ```javascript
   const callStartTime = callSession.answeredAt;

   setInterval(() => {
     const elapsedSeconds = (Date.now() - callStartTime) / 1000;
     const maxDuration = chatbotSettings.call.maxCallDuration;

     if (elapsedSeconds > maxDuration * 0.9) {
       // Warning phase
       warnUserAboutDurationLimit();
     }

     if (elapsedSeconds > maxDuration) {
       // End call
       endCallDueToMaxDuration();
     }
   }, 10000);
   ```
2. Update call record:
   ```sql
   UPDATE chatapp.calls
   SET status = 'completed',
       ended_at = NOW(),
       duration = $1, -- maxCallDuration in seconds
       notes = 'Call ended due to maximum duration limit (10 minutes)'
   WHERE id = 'call-uuid';
   ```
3. Calculate total cost:
   ```javascript
   const cost = calculateCallCost({
     duration: maxCallDuration,
     provider: 'openai',
     model: 'gpt-4o-realtime'
   });
   // Example: 10 minutes = $2.40 at $0.24/min
   ```

**Conversation Preservation**:
- Full transcript saved to database
- Recording available (if enabled)
- User can download transcript or continue via chat
- If user starts new call, system can reference "In our previous call, you mentioned..."

**Configuration**:
- Company admin sets maxCallDuration (1-60 minutes) in Call Settings
- Typical values:
  - Quick support: 5 minutes
  - Standard support: 15 minutes
  - Technical troubleshooting: 30 minutes
  - Sales consultations: 45 minutes
- Master admin can set hard platform limit (e.g., 60 minutes max)

**Cost Management**:
- Prevents runaway costs from forgotten calls
- Clear user expectations (duration limit displayed)
- Analytics show if limit frequently reached (may need increase)

---

## 5. Edge Cases and Special Scenarios

### 5.1 User Switches from Chat to Call Mid-Conversation

**Scenario**: User starts with text chat, then wants to switch to voice call

**User Flow**:

1. **User Starts Chat**
   - User clicks [💬 Chat] button on widget
   - User types: "I need help with setting up my account"
   - AI responds via text: "I'd be happy to help you set up your account. What step are you currently on?"
   - User types: "I'm stuck on the payment integration part"

2. **User Requests Call**
   - User sees call button in chat interface
   - User clicks [📞 Switch to Call] button
   - OR user types: "Can I call instead? This is easier to explain verbally"

3. **System Offers Transition**
   - System displays confirmation:
     ```
     ┌────────────────────────────────────────────────────────┐
     │  Switch to Voice Call?                                  │
     ├────────────────────────────────────────────────────────┤
     │                                                         │
     │  Would you like to continue this conversation via      │
     │  voice call?                                           │
     │                                                         │
     │  Your chat history will be preserved and shared with   │
     │  the voice assistant.                                  │
     │                                                         │
     │  [Start Voice Call]  [Stay in Chat]                   │
     │                                                         │
     └────────────────────────────────────────────────────────┘
     ```

4. **User Confirms Transition**
   - User clicks [Start Voice Call]
   - System requests microphone permission (if needed)
   - System initiates call with conversation context

5. **Call Begins with Context**
   - AI greets with context awareness:
     - "Hello! I see we were just chatting about setting up your account, specifically the payment integration. I'm ready to help you through that over the phone. Can you tell me more about where you're stuck?"
   - Transcript shows conversation history:
     ```
     ━━━━━━ Chat History ━━━━━━
     [02:30] You: I need help with setting up my account
     [02:31] Assistant: I'd be happy to help you set up your account...
     [02:32] You: I'm stuck on the payment integration part

     ━━━━━━ Voice Call Started ━━━━━━
     [02:35] Assistant (voice): Hello! I see we were just chatting...
     ```

6. **Unified Conversation Record**
   - System links chat conversation_id to call record
   - Both chat messages and call transcript stored in same conversation thread
   - Company admin sees unified view in conversation history

**System Implementation**:
```javascript
async function switchFromChatToCall(conversationId: string) {
  // Fetch chat history
  const chatMessages = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: messages.createdAt
  });

  // Create call session with context
  const callSession = await createCallSession({
    chatbotId,
    conversationId, // Link to existing conversation
    context: {
      previousMessages: chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    }
  });

  // Send context to AI provider
  await sendContextToProvider(callSession, chatMessages);

  return callSession;
}
```

**Benefits**:
- Seamless user experience (no need to repeat information)
- Maintains conversation continuity
- Efficient for complex explanations
- User feels understood and not frustrated

---

### 5.2 Call Interrupted by Network Disconnection

**Scenario**: User's internet connection drops during call (Web or WhatsApp)

**Detection**:
- WebSocket connection closed unexpectedly
- Heartbeat timeout (no pings received for 30 seconds)

**Immediate Response**:

**User Side (Web Widget)**:
```
┌────────────────────────────────────────────────────────┐
│  ⚠️ Connection Lost                                    │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Your internet connection was interrupted.            │
│                                                         │
│  [Reconnecting... 🔄]                                  │
│                                                         │
│  Attempt 1 of 3                                       │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Server Side**:
- System keeps call session active for 60 seconds (grace period)
- System logs disconnection event
- System pauses audio streaming

**Automatic Reconnection** (if user's internet returns within 60 seconds):
1. User's browser automatically attempts to reconnect WebSocket
2. System validates session token
3. System resumes audio streaming
4. User hears: "Welcome back! It looks like we got disconnected for a moment. Where were we?"
5. Call continues from where it left off

**Failed Reconnection** (if user's internet doesn't return within 60 seconds):
1. System ends call session gracefully
2. System saves call record with status: "disconnected"
3. User sees (when internet returns):
   ```
   ┌────────────────────────────────────────────────────────┐
   │  Call Ended - Connection Lost                          │
   ├────────────────────────────────────────────────────────┤
   │                                                         │
   │  Your call was disconnected due to network issues.    │
   │  Duration: 3:42 (before disconnection)                │
   │                                                         │
   │  [View Call Transcript]  [Call Back]  [Start Chat]   │
   │                                                         │
   └────────────────────────────────────────────────────────┘
   ```

**User Calls Back**:
- User clicks [Call Back]
- System creates new call session
- AI greets with awareness:
  - "Welcome back! I see we got disconnected earlier while discussing your account setup. Would you like to pick up where we left off, or is there something else I can help you with?"
- System can optionally resume conversation from last transcript entry

**System Implementation**:
```javascript
ws.on('close', async (code, reason) => {
  logger.info('WebSocket closed', { code, reason, sessionId });

  // Start grace period timer
  const gracePeriodMs = 60000;

  setTimeout(async () => {
    const session = await getCallSession(sessionId);

    // If session still open (not reconnected), end it
    if (session.status === 'in_progress') {
      await endCallSession(sessionId, {
        reason: 'disconnected',
        status: 'failed',
        error: 'Client connection lost'
      });

      // Notify user via other channels if possible (email, SMS)
      await sendDisconnectionNotification(session.endUserId);
    }
  }, gracePeriodMs);
});
```

**Prevention**:
- System monitors connection quality proactively
- System warns user if connection degrading: "Your connection quality is poor. Consider switching to a stronger network."
- System offers chat fallback before disconnection imminent

---

### 5.3 Multiple Calls to Same Chatbot Simultaneously

**Scenario**: Multiple users call same chatbot at the same time

**System Behavior**:

**Concurrent Call Handling**:
- System supports multiple simultaneous calls per chatbot (no hard limit)
- Each call gets its own isolated session
- AI provider handles concurrent requests independently

**Resource Management**:
```javascript
// Track active calls per chatbot
const activeCalls = await db.query.calls.findMany({
  where: and(
    eq(calls.chatbotId, chatbotId),
    eq(calls.status, 'in_progress')
  )
});

// Check against limit (configurable by company admin)
const maxConcurrentCalls = chatbotSettings.call.maxConcurrentCalls || 10;

if (activeCalls.length >= maxConcurrentCalls) {
  // Reject new call or queue it
  throw new Error('Maximum concurrent calls reached');
}
```

**Queueing** (if max concurrent calls exceeded):

**User Experience**:
```
┌────────────────────────────────────────────────────────┐
│  All Agents Busy                                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│  We're currently experiencing high call volume.        │
│  You are #3 in queue.                                  │
│                                                         │
│  Estimated wait time: 2 minutes                        │
│                                                         │
│  [Continue Waiting]  [Start Chat Instead]  [Cancel]   │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Queue Management**:
- First-in-first-out (FIFO) queue
- System updates queue position in real-time
- User can switch to chat while waiting
- When slot available: "Thank you for waiting. Connecting you now..."

**Cost Optimization**:
- Each call consumes API resources (OpenAI/Gemini)
- System monitors concurrent usage to prevent runaway costs
- Company admin receives alert if usage spike occurs:
  ```
  ⚠️ High Call Volume Alert

  Your chatbot "Customer Support Agent" has 47 active
  calls (avg: 12). This may result in higher costs.

  Current estimated cost rate: $28/hour

  [View Active Calls] [Adjust Limits]
  ```

**Scalability**:
- System horizontally scalable (add more servers)
- WebSocket connections distributed across multiple instances
- Database connection pooling prevents bottlenecks
- Load balancer routes calls to least-busy server

---

### 5.4 User Requests Human Escalation During Call

**Scenario**: User wants to speak with human agent instead of AI

**Trigger**:
- User says: "Can I speak to a real person?" or "Transfer me to a human" or "I want a live agent"
- AI detects escalation keywords

**AI Response**:
- "I understand you'd like to speak with a human agent. Let me see if I can connect you to someone."
- System checks if human escalation enabled and agents available

**Option 1: Human Agent Available**:

**Web Widget**:
```
┌────────────────────────────────────────────────────────┐
│  Transferring to Human Agent...                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Please hold while I connect you to one of our         │
│  support specialists.                                  │
│                                                         │
│  [Animated Transfer Icon]                              │
│                                                         │
│  Estimated wait time: 30 seconds                       │
│                                                         │
│  [Cancel Transfer - Stay with AI]                     │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**System Actions**:
1. Find available human agent:
   ```javascript
   const availableAgent = await findAvailableHumanAgent({
     companyId,
     chatbotId,
     skills: ['voice_support']
   });
   ```
2. Create escalation record:
   ```sql
   INSERT INTO chatapp.escalations (
     call_id, conversation_id,
     from_ai_chatbot_id, to_agent_id,
     reason, created_at
   ) VALUES ($1, $2, $3, $4, 'user_requested', NOW());
   ```
3. Notify human agent:
   ```javascript
   await notifyAgent(availableAgent.id, {
     type: 'incoming_call_escalation',
     callId,
     context: callTranscript,
     customer: {
       name: endUser.name,
       previousInteractions: previousCalls.length
     }
   });
   ```
4. Transfer audio stream from AI to human agent:
   - System switches WebSocket route from CallExecutor to AgentConnection
   - Human agent hears call context summary (AI whispers in agent's ear)
   - Human agent can review transcript in real-time
5. Human agent speaks: "Hi, this is Sarah from Acme Support. I understand you were speaking with our AI assistant. How can I help you?"

**Call Record Updated**:
```sql
UPDATE chatapp.calls
SET escalated_to_human = true,
    human_agent_id = $1,
    escalation_time = NOW()
WHERE id = 'call-uuid';
```

**Option 2: No Human Agents Available**:

**AI Response**:
- "I'm sorry, but all of our human agents are currently assisting other customers. I can take a message and have someone call you back, or I can try my best to help you right now. What would you prefer?"

**User Options**:
```
┌────────────────────────────────────────────────────────┐
│  No Agents Available Right Now                          │
├────────────────────────────────────────────────────────┤
│                                                         │
│  All human agents are currently busy. Would you like: │
│                                                         │
│  1. Leave a callback request                           │
│     (We'll call you back within 15 minutes)            │
│                                                         │
│  2. Continue with AI assistant                         │
│     (I'll do my best to help)                          │
│                                                         │
│  3. Send a message                                     │
│     (We'll respond via chat/email)                     │
│                                                         │
│  [1]  [2]  [3]  [End Call]                            │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**If User Chooses Callback**:
- AI: "I'll have someone call you back shortly. Can you confirm the best number to reach you?"
- User provides phone number
- AI: "Great! Expect a call at [number] within 15 minutes. Is there anything else I can note for the agent?"
- User provides context
- System creates callback task for human agents
- Call ends

**Option 3: Return to AI After Human Agent**:

**Scenario**: Human agent resolves specific issue, user has follow-up questions

**Human Agent**: "Is there anything else I can help you with today?"
**User**: "No, that's all. Thank you!"
**Human Agent**: "You're welcome! I'm going to transfer you back to our AI assistant in case you think of anything else. Have a great day!"
- Human agent clicks [Transfer Back to AI] button
- System re-routes audio stream back to AI
- AI: "Hi again! It looks like Sarah was able to help you with that issue. Is there anything else I can assist you with?"
- Conversation continues with AI

**Call Transcript Shows Escalation**:
```
[00:00] AI: Hello! How can I help you today?
[00:05] User: I need help with a billing issue.
[00:10] AI: I can help with that...
[01:20] User: Actually, can I speak to a real person?
[01:23] AI: I understand. Let me connect you...

━━━━━━ Transferred to Human Agent: Sarah ━━━━━━
[01:35] Sarah: Hi, this is Sarah from Acme Support...
[03:45] Sarah: Is there anything else I can help with?
[03:50] User: No, that's all. Thank you!

━━━━━━ Transferred Back to AI ━━━━━━
[04:00] AI: Hi again! Is there anything else I can assist you with?
[04:05] User: No, I'm all set. Goodbye!
```

**Analytics**:
- System tracks escalation rate:
  - Total calls: 1,000
  - Escalations: 120 (12%)
  - Successful escalations: 95 (79% connected to human)
- Company admin can analyze:
  - Why users escalate (keywords, topics)
  - Average time to escalation
  - Escalation resolution rate
- Insights used to improve AI responses

---

## Summary

This document provides comprehensive, step-by-step activity flows for all user roles and scenarios in the call feature integration. Each flow includes detailed UI interactions, system behaviors, validation rules, success criteria, and error handling.

**Key Takeaways**:

1. **Master Admin Flows**: Enable call feature per company, create call-enabled packages, manage AI models, monitor usage analytics
2. **Company Admin Flows**: Set up integration accounts (Twilio, WhatsApp), create chatbots, configure call settings, customize widget, test calls
3. **End User Flows**: Web widget calls, WhatsApp calls, Twilio phone calls - all with natural conversation flow and clear status indicators
4. **Error Handling**: Robust error scenarios with user-friendly messages, automatic recovery attempts, and fallback options
5. **Edge Cases**: Seamless transitions between chat and call, network disconnection handling, concurrent call management, human escalation workflows

All flows designed for:
- **Intuitive UX**: Clear status indicators, helpful error messages, smooth transitions
- **Reliability**: Automatic retries, graceful degradation, comprehensive error handling
- **Transparency**: Real-time transcripts, call duration display, quality indicators
- **Flexibility**: Multiple integration channels, customizable settings, fallback options
- **Scalability**: Concurrent call support, queueing, resource management

Next documentation: `docs/call-feature-architecture.md` (technical architecture, system design, and integration patterns)
