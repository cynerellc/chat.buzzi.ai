@ -0,0 +1,4261 @@
# Call Feature Implementation Instructions

## Document Overview

This document provides comprehensive, detailed instructions on how the call feature should work within the chat.buzzi.ai multi-tenant platform. It covers every aspect of the feature from master admin configuration to end-user interactions, including all UI components, settings pages, workflows, and behaviors.

**Important**: This document contains NO code. All content is detailed instructions and text descriptions to guide implementation.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Master Admin Configuration](#master-admin-configuration)
3. [Company Admin Configuration](#company-admin-configuration)
4. [Widget Customization](#widget-customization)
5. [Integration Setup](#integration-setup)
6. [Call Execution Flow](#call-execution-flow)
7. [Knowledge Base Access](#knowledge-base-access)
8. [Escalation During Calls](#escalation-during-calls)
9. [Recording and Transcription](#recording-and-transcription)
10. [Testing and Preview](#testing-and-preview)
11. [Key Features Per Page/Component](#key-features-per-pagecomponent)

---

## 1. Feature Overview

### 1.1 Purpose

The call feature enables AI chatbots to handle voice conversations in addition to text-based chat. Companies can deploy chatbots that accept voice calls through multiple channels:
- **Web Widget**: Browser-based voice calls using WebSocket and Web Audio API
- **WhatsApp Business**: Voice calls through WhatsApp using WebRTC technology
- **Twilio**: Traditional phone calls through Twilio's telephony infrastructure

### 1.2 Core Capabilities

The call feature provides these core capabilities:
- **Real-time voice conversations** with AI agents using OpenAI Realtime API or Google Gemini Live API
- **Multiple integration channels** (Web, WhatsApp, Twilio) with a single chatbot configuration
- **Voice Activity Detection (VAD)** for natural turn-taking without button presses
- **User interruption support** allowing users to interrupt the agent mid-speech
- **Real-time transcription** displaying what both user and agent are saying
- **Call recordings** stored securely for compliance and quality review
- **Knowledge base access** allowing call agents to retrieve information from company knowledge bases
- **Human escalation** enabling transfer from AI to human agents during calls
- **Customizable voices** with preview functionality for different AI voice options
- **Audio visualizers** showing waveform or orb animations during active calls
- **Multi-tenancy** with complete company isolation and permission controls

### 1.3 Architecture Principles

The call feature follows these architectural principles:
- **Separation from chat**: Call logic is completely isolated in a separate namespace
- **Pattern reuse**: Follows existing chat patterns (AgentRunnerService → CallRunnerService)
- **Provider abstraction**: Supports multiple AI providers through a common interface
- **Integration flexibility**: Pluggable adapters for different communication channels
- **Hybrid approach**: Port proven voice logic from voice.buzzi.ai, rewrite infrastructure for multi-tenancy

### 1.4 User Roles and Permissions

**Master Admin**:
- Enable/disable call feature per company
- Create call-enabled chatbot packages
- Manage AI models and categorize them (chat/call/both)
- Monitor call usage and costs across all companies

**Company Admin**:
- Configure integration accounts (Twilio, WhatsApp credentials)
- Configure call settings for chatbots (voice, behavior, features)
- Customize call widget appearance
- View call history and transcripts
- Manage team permissions

**Support Agent**:
- View call transcripts (read-only)
- Receive escalated calls
- No configuration access

**End User**:
- Initiate voice calls through widget, WhatsApp, or phone
- Interact with AI voice agent
- Interrupt agent when needed
- Download transcripts after calls
- No authentication required for public-facing calls

---

## 2. Master Admin Configuration

### 2.1 Enabling Call Feature Per Company

**Navigation Path**: Master Admin → Companies → [Select Company] → Settings → Features Tab

**Purpose**: Control which companies have access to the call feature. This is a company-level feature flag that must be enabled before company admins can configure call settings.

**Process**:

1. **Access Company Settings**:
   - Log in as master admin
   - Navigate to Companies list page
   - Click on the company name to view details
   - Click "Settings" tab

2. **Navigate to Features Section**:
   - Within Settings, find "Features" tab
   - This tab lists all available platform features

3. **Enable Call Feature**:
   - Locate "Call Feature" toggle switch
   - Default state: Disabled (OFF)
   - Toggle switch to ON
   - A confirmation message should appear: "Call feature will be enabled for [Company Name]. Users will be able to create call-enabled chatbots."

4. **Save Changes**:
   - Click "Save Settings" button at bottom of page
   - System updates companies table: settings.features.callEnabled = true
   - Success message: "Call feature enabled successfully"

5. **Post-Enablement Effects**:
   - Company admins can now see call-related options in chatbot settings
   - Company admins can access Integration Accounts page
   - Chatbot creation wizard shows call capability options
   - Call-enabled chatbot packages become visible to this company

**Visual Indicators**:
- When enabled: Green checkmark badge next to "Call Feature" label
- When disabled: Gray "X" badge
- Tooltip on hover: "Allows company to use voice call capabilities"

**Permission Verification**:
- Only users with role "chatapp.master_admin" can toggle this setting
- Company admins see a read-only indicator showing feature status
- Attempting to access call settings without this flag shows: "Call feature not available. Contact support."

### 2.2 Creating Call-Enabled Chatbot Packages

**Navigation Path**: Master Admin → Chatbot Packages → New Package

**Purpose**: Create template packages that companies can deploy. Packages define whether a chatbot supports chat, calls, or both.

**Process**:

1. **Access Package Creation**:
   - Navigate to Master Admin → Chatbot Packages
   - Click "Create New Package" button
   - Package creation wizard opens

2. **Basic Information Section**:
   - **Package Name**: Enter descriptive name (e.g., "Customer Support Call Agent")
   - **Package Description**: Detailed description of use case
   - **Category**: Select category (Customer Support, Sales, Technical Support, HR, etc.)
   - **Package Type**: Select "Single Agent" or "Multi-Agent"

3. **Capability Selection Section** (NEW):
   - **Enable Chat Checkbox**:
     - Default: CHECKED
     - Label: "Enable Chat"
     - Description: "This chatbot can handle text-based conversations"
     - When unchecked: Chat-specific settings are hidden

   - **Enable Call Checkbox**:
     - Default: UNCHECKED
     - Label: "Enable Call"
     - Description: "This chatbot can handle voice conversations"
     - When checked: Call-specific configuration options appear
     - Requirement indicator: "Requires OpenAI Realtime or Gemini Live model"

   - **Capability Validation**:
     - At least one capability must be selected
     - Error message if both unchecked: "At least one capability (Chat or Call) must be enabled"
     - Warning if only Call enabled: "Chatbot will only accept voice calls, not text chat"

4. **Agent Configuration Section**:
   - **For Chat and Call Packages**:
     - Can configure different agents for chat vs call
     - Each agent has toggle: "Use for Chat" and "Use for Call"
     - Agent configuration includes:
       - Agent name and identifier
       - System prompt (different prompts for chat vs call recommended)
       - Model selection (filtered by capability)
       - Temperature, max tokens, and other model settings
       - Knowledge base category assignment
       - Routing rules (for multi-agent)

5. **Model Selection for Call-Enabled Packages**:
   - **AI Model Dropdown**:
     - When "Enable Call" is checked, dropdown filters to show only:
       - Models where model_type = 'call'
       - Models where model_type = 'both'
     - Model list displays:
       - Model name
       - Provider (OpenAI, Google)
       - Capability badge (Call, Both)
       - Cost per minute indicator
     - Example call models:
       - OpenAI GPT-4 Realtime (Call only)
       - Google Gemini Live (Call only)

   - **Default Model Selection**:
     - If no call model selected: Warning appears
     - "A call-compatible model must be selected for call-enabled packages"
     - Cannot save package without selecting appropriate model

6. **Voice Configuration for Call Packages**:
   - **Default Voice Selection**:
     - Dropdown lists available voices for selected model
     - OpenAI voices: Alloy, Echo, Fable, Onyx, Nova, Shimmer
     - Google voices: Provider-specific voice options
     - Each voice has:
       - Name and description
       - Gender indicator
       - Language/accent
       - Preview button (plays 5-second sample)

   - **Voice Preview Functionality**:
     - Click speaker icon next to voice name
     - Sample phrase plays: "Hello, I'm your AI assistant. I'm here to help you today."
     - Preview uses actual voice API (not pre-recorded)
     - Loading indicator while generating preview

7. **Knowledge Base Configuration**:
   - **Knowledge Base Access**:
     - Same for both chat and call
     - Toggle: "Enable Knowledge Base Access"
     - When enabled: Select categories
     - Categories appear as checkboxes
     - Select "All Categories" option available

   - **Call-Specific Knowledge Base Behavior**:
     - During calls, knowledge retrieval happens real-time
     - Agent summarizes retrieved information verbally
     - No visual display of sources (audio only)
     - Longer retrieval may introduce pauses in conversation

8. **Call-Specific Package Settings**:
   - **Default Call Greeting**:
     - Text input for initial greeting
     - Default: "Hello! Thank you for calling. How can I assist you today?"
     - Character limit: 500 characters
     - Should be conversational and natural

   - **Default Maximum Call Duration**:
     - Slider: 1 to 60 minutes
     - Default: 10 minutes
     - Description: "Calls automatically end after this duration"

   - **Default Silence Timeout**:
     - Slider: 30 to 300 seconds
     - Default: 180 seconds (3 minutes)
     - Description: "Call ends if user is silent for this duration"

   - **Call Recording Default**:
     - Toggle: Enable/Disable
     - Default: Disabled
     - Warning: "Ensure compliance with local recording laws"

   - **Transcription Default**:
     - Toggle: Enable/Disable
     - Default: Enabled
     - Description: "Generate real-time transcripts of calls"

9. **Variable Configuration**:
   - Can define variables that companies must provide when deploying package
   - Example variables for call packages:
     - businessHours: Office hours for live agent transfer
     - escalationPhoneNumber: Human agent phone number
     - departmentName: For greeting customization

10. **Execution Configuration**:
    - Sandbox settings
    - Maximum execution time
    - Memory limits
    - Tool/function access permissions

11. **Save and Publish Package**:
    - Click "Save as Draft" to save without publishing
    - Click "Publish Package" to make available to companies
    - Validation runs:
      - Check model compatibility
      - Verify at least one capability enabled
      - Validate all required fields filled
    - Success: Package appears in company chatbot creation wizards
    - Package details show capability badges: [Chat] [Call]

**Post-Creation**:
- Package appears in master admin package list with capability indicators
- Companies can filter packages by capability (Chat only, Call only, Both)
- Package preview shows sample configuration with call-specific settings

### 2.3 Managing AI Models

**Navigation Path**: Master Admin → AI Models → List/Add/Edit

**Purpose**: Configure which AI models are available and categorize them by capability (chat, call, or both).

**AI Model Configuration**:

1. **Model List View**:
   - Table columns:
     - Model Name
     - Provider (OpenAI, Anthropic, Google)
     - Model Type (Chat, Call, Both) - NEW FIELD
     - Status (Active, Deprecated)
     - Cost per 1K tokens
     - Actions (Edit, Disable)

   - Filter Options:
     - Filter by Provider
     - Filter by Model Type (show only chat models, only call models, or both)
     - Search by model name

2. **Adding New Model**:
   - Click "Add Model" button
   - Form fields:
     - **Model Name**: Display name (e.g., "GPT-4 Realtime")
     - **Model ID**: Technical identifier (e.g., "gpt-4-realtime-preview")
     - **Provider**: Dropdown (OpenAI, Anthropic, Google, Custom)
     - **Model Type**: Dropdown (Chat, Call, Both) - REQUIRED
     - **Description**: Detailed description of model capabilities
     - **Max Context Window**: Number of tokens
     - **Supports Streaming**: Checkbox
     - **Supports Function Calling**: Checkbox
     - **Supports Vision**: Checkbox (for chat models)
     - **Supports Audio**: Checkbox (automatically checked if Model Type includes Call)
     - **Cost per Input Token**: Decimal value
     - **Cost per Output Token**: Decimal value
     - **Cost per Audio Minute**: Decimal value (for call models)

3. **Model Type Selection Guidance**:
   - **Chat**: Traditional text-based models
     - Examples: GPT-4, GPT-3.5, Claude 3, Gemini Pro
     - Used for: Text conversations, widget chat, messaging integrations

   - **Call**: Voice-only models
     - Examples: GPT-4 Realtime, Gemini Live
     - Used for: Voice calls, real-time audio streaming
     - Requirements: Must support WebSocket audio streaming

   - **Both**: Multimodal models (future use)
     - Can handle both text and voice
     - Allows single model for chat and call
     - Currently not available but system supports this classification

4. **Model Type Impact**:
   - **In Chatbot Package Creation**:
     - If package has "Enable Call" checked, model dropdown filters to Call or Both
     - If package has "Enable Chat" checked, model dropdown filters to Chat or Both
     - If both enabled, only "Both" models shown (or separate model selection)

   - **In Chatbot Configuration**:
     - Call Options tab only shows Call or Both models
     - Chat settings only reference Chat or Both models

5. **Voice Configuration Per Model** (for Call models):
   - **Available Voices Section**:
     - List of voices available for this model
     - Add/remove voices from model configuration
     - For OpenAI Realtime:
       - Alloy (neutral, balanced)
       - Echo (warm, friendly)
       - Fable (British accent, storytelling)
       - Onyx (deep, authoritative)
       - Nova (feminine, professional)
       - Shimmer (soft, calming)
     - For Google Gemini Live:
       - Gemini voices list
       - Language-specific voices

   - **Voice Metadata**:
     - Voice ID (technical identifier)
     - Voice Name (display name)
     - Description (personality, tone)
     - Gender (Male, Female, Neutral)
     - Language/Accent
     - Sample Audio URL (for preview)

6. **Saving Model Configuration**:
   - Validation checks:
     - Model ID must be unique
     - Model Type must be selected
     - If Model Type is Call or Both, ensure provider supports audio
     - Cost fields must be positive numbers
   - Success message: "AI Model added successfully"
   - Model becomes available in package and chatbot configuration

### 2.4 Monitoring Call Usage

**Navigation Path**: Master Admin → Analytics → Calls

**Purpose**: Monitor call usage, costs, and performance across all companies for billing and capacity planning.

**Analytics Dashboard Components**:

1. **Overview Metrics** (Top Cards):
   - **Total Calls Today**:
     - Count of all calls across companies
     - Comparison with yesterday (percentage change)

   - **Active Calls Now**:
     - Real-time count of in-progress calls
     - Indicator if approaching capacity limits

   - **Average Call Duration**:
     - Average across all calls today
     - Breakdown by integration type (Web, WhatsApp, Twilio)

   - **Total Call Minutes This Month**:
     - Aggregated call duration
     - Cost estimate based on model pricing
     - Comparison with last month

2. **Company Breakdown Table**:
   - Table showing per-company metrics:
     - Company Name
     - Total Calls (this month)
     - Total Minutes
     - Average Duration
     - Success Rate (%)
     - Failed Calls
     - Estimated Cost
     - Primary Integration (Web/WhatsApp/Twilio)

   - Sortable columns
   - Export to CSV button

3. **Provider Distribution Chart**:
   - Pie chart showing distribution:
     - OpenAI Realtime (percentage and count)
     - Gemini Live (percentage and count)
   - Click to drill down to company level

4. **Call Timeline Graph**:
   - Line chart showing calls over time
   - X-axis: Time (hourly, daily, weekly views)
   - Y-axis: Number of calls
   - Multiple lines:
     - Total calls
     - Successful calls
     - Failed calls
   - Identify peak usage times

5. **Integration Channel Breakdown**:
   - Bar chart comparing:
     - Web Widget calls
     - WhatsApp calls
     - Twilio calls
   - Average duration per channel
   - Success rate per channel

6. **Error Analysis**:
   - Table showing recent failed calls:
     - Timestamp
     - Company
     - Chatbot
     - Error Type
     - Error Message
     - Duration before failure
   - Filter by error type
   - Export for troubleshooting

7. **Cost Analysis**:
   - Monthly cost breakdown by:
     - Company
     - Provider (OpenAI, Google)
     - Model
   - Cost trends over time
   - Projection for end of month
   - Cost per successful call average

8. **Export Functionality**:
   - **Export Call Data**:
     - Date range selector
     - Company filter (all or specific)
     - Export format: CSV, Excel, JSON
     - Includes: Call ID, Company, Chatbot, Duration, Status, Cost, Timestamps

   - **Export for Billing**:
     - Monthly statement per company
     - Itemized call list
     - Cost calculation details
     - PDF format option

9. **Filtering and Search**:
   - Filter by date range
   - Filter by company
   - Filter by status (successful, failed, abandoned)
   - Filter by integration type
   - Search by call ID or chatbot name

**Access Control**:
- Only master admins see this analytics section
- Company admins see company-specific analytics in their dashboard
- No PII (Personally Identifiable Information) displayed in aggregate views

---

## 3. Company Admin Configuration

Company admins configure call settings for their chatbots after master admin enables the call feature for their company.

### 3.1 Integration Accounts Management

**Navigation Path**: Company Dashboard → Integrations → Integration Accounts

**Purpose**: Set up company-wide integration credentials (Twilio, WhatsApp Business) that can be reused across multiple chatbots.

**Page Layout**:

1. **Integration Accounts List Page**:
   - Page title: "Integration Accounts"
   - Subtitle: "Manage company-wide integrations for voice calls"
   - Description: "Integration accounts store credentials for Twilio and WhatsApp Business. Configure them once and use across multiple chatbots."

   - **Account Cards Grid**:
     - Three card types:
       - Twilio Account Card
       - WhatsApp Business Account Card
       - Custom Integration Card

     - Each card shows:
       - Integration logo/icon
       - Account name
       - Status badge (Active, Inactive, Error, Not Configured)
       - Last verified timestamp
       - Quick actions: Edit, Test Connection, Delete
       - "Add New" button if not configured

2. **Adding Twilio Integration Account**:

   **Step 1: Click "Add Twilio Account"**:
   - Modal or full-page form opens
   - Title: "Configure Twilio Integration"
   - Warning message: "You'll need your Twilio Account SID and Auth Token. Find these in your Twilio Console."

   **Step 2: Account Information**:
   - **Account Name**:
     - Text input
     - Purpose: "Give this account a friendly name (e.g., 'Main Twilio Account')"
     - Required field
     - Used for identification when selecting account for chatbot

   - **Description** (Optional):
     - Text area
     - Purpose: "Add notes about this account (e.g., 'Production account for customer support')"

   **Step 3: Twilio Credentials**:
   - **Account SID**:
     - Text input
     - Format validation: Must start with "AC"
     - Masked after initial entry
     - Help text: "Found in Twilio Console → Account Dashboard"

   - **Auth Token**:
     - Password input (masked)
     - Help text: "Found in Twilio Console → Account Dashboard"
     - "Show" toggle button

   - **Phone Number**:
     - Text input with country code selector
     - Format: +[country code] [number]
     - Example: +1 (555) 123-4567
     - Validation: Must be E.164 format
     - Help text: "The Twilio phone number that will receive calls"

   **Step 4: Test Connection**:
   - "Test Connection" button
   - When clicked:
     - Shows loading spinner
     - System makes API call to Twilio to validate credentials
     - Tests that phone number exists and is voice-capable
     - Success: Green checkmark "Connection successful!"
     - Failure: Red X "Connection failed: [error message]"

   **Step 5: Webhook Configuration**:
   - After successful test, system generates webhook URL
   - **Generated Webhook URL Display**:
     - Read-only text field with generated URL
     - Format: https://yourdomain.com/api/webhooks/twilio/voice?accountId=[UUID]
     - Copy button next to URL
     - Instruction text: "Copy this URL and configure it in your Twilio Phone Number settings"

   - **Configuration Instructions**:
     - Step-by-step guide displayed:
       1. "Go to Twilio Console → Phone Numbers → Active Numbers"
       2. "Click on your phone number ([entered number])"
       3. "Scroll to 'Voice Configuration'"
       4. "Under 'A Call Comes In', select 'Webhook'"
       5. "Paste the generated webhook URL"
       6. "Select 'HTTP POST'"
       7. "Click 'Save'"

   - Link to Twilio Console button

   **Step 6: Save Account**:
   - "Save Integration Account" button
   - Validation:
     - Account name must be unique
     - All credentials must be filled
     - Connection test must have passed
   - On save:
     - Success message: "Twilio account configured successfully"
     - Account appears in list with Active status
     - Credentials encrypted and stored in database
     - Webhook secret generated automatically

3. **Adding WhatsApp Business Integration Account**:

   **Step 1: Click "Add WhatsApp Account"**:
   - Modal or full-page form opens
   - Title: "Configure WhatsApp Business Integration"
   - Warning: "Requires Meta Business Account and WhatsApp Business API access"

   **Step 2: Account Information**:
   - **Account Name**:
     - Text input
     - Example: "Support WhatsApp"
     - Required

   - **Description** (Optional):
     - Text area
     - Example: "WhatsApp number for customer support calls"

   **Step 3: WhatsApp Credentials**:
   - **Business Account ID**:
     - Text input
     - Format: Numeric string
     - Help text: "Found in Meta Business Suite → Business Settings"
     - Link to Meta Business Suite

   - **Phone Number ID**:
     - Text input
     - Format: Numeric string
     - Help text: "Found in Meta Business Suite → WhatsApp → API Setup"

   - **Phone Number**:
     - Text input with country code
     - Format: +[country code] [number]
     - Must match number registered with WhatsApp Business
     - Example: +1 555 123 4567

   - **Access Token**:
     - Text area (long token)
     - Masked after entry
     - Help text: "System User Access Token from Meta Business Suite"
     - "Show" toggle button
     - Expiry warning: "Tokens expire. Set up a system user for permanent access."

   **Step 4: Verify Configuration**:
   - "Verify Connection" button
   - When clicked:
     - System calls WhatsApp Business API
     - Verifies phone number status
     - Checks token permissions
     - Validates account access
   - Success: "WhatsApp account verified!"
   - Failure: Detailed error message with troubleshooting steps

   **Step 5: Webhook Setup**:
   - **Generated Webhook URL**:
     - Format: https://yourdomain.com/api/webhooks/whatsapp?accountId=[UUID]
     - Copy button

   - **Verify Token Display**:
     - System-generated random string
     - Used for webhook verification
     - Copy button

   - **Configuration Instructions**:
     - Detailed steps:
       1. "Go to Meta Business Suite → WhatsApp → Configuration → Webhook"
       2. "Click 'Edit' next to Callback URL"
       3. "Paste the Webhook URL"
       4. "Paste the Verify Token"
       5. "Click 'Verify and Save'"
       6. "Subscribe to webhook fields: messages, message_status"

   - Link to Meta Business Suite

   **Step 6: Save Account**:
   - "Save Integration Account" button
   - Validation checks
   - Success message
   - Account appears in list with Active status
   - Note: Webhook must be configured in Meta for calls to work

4. **Integration Account List Display**:

   **For Each Configured Account**:
   - **Card Header**:
     - Integration type icon and name
     - Account name (user-defined)
     - Status badge:
       - Active (green): Working correctly
       - Error (red): Last verification failed
       - Inactive (gray): Manually disabled

   - **Card Body**:
     - Last verified: Timestamp
     - Phone number: Displayed (partially masked)
     - Description: First 100 characters
     - Webhook status: Configured / Not Configured

   - **Card Actions**:
     - Edit: Opens edit form (same as add, pre-filled)
     - Test Connection: Re-runs verification
     - View Webhook URL: Shows URL and copy button
     - Disable/Enable: Toggle account status
     - Delete: Confirmation dialog, removes account
       - Warning: "This account is used by [N] chatbots. They will stop receiving calls."
       - Requires confirmation checkbox

5. **Account Status Indicators**:

   **Active Status**:
   - Green checkmark icon
   - "Last verified 2 hours ago"
   - All systems operational

   **Error Status**:
   - Red X icon
   - "Verification failed: [error message]"
   - "Last successful verification: 3 days ago"
   - "Action required" button → Opens troubleshooting guide
   - Common errors:
     - "Invalid credentials"
     - "Token expired"
     - "Phone number not found"
     - "Insufficient permissions"

   **Inactive Status**:
   - Gray icon
   - "Manually disabled"
   - "Enable" button available

   **Not Configured Status**:
   - Dotted border card
   - "Add [Integration Type]" button
   - Description of benefits

6. **Testing and Verification**:

   **Test Call Feature** (for Twilio):
   - "Make Test Call" button on account card
   - When clicked:
     - Shows phone number input: "Enter your phone number to receive a test call"
     - "Initiate Test Call" button
     - System makes outbound call through Twilio to entered number
     - AI agent speaks greeting
     - User can test conversation
     - After call, feedback form: "Test call successful? [Yes] [No - Report Issue]"

   **Test Message Feature** (for WhatsApp):
   - "Send Test Message" button
   - When clicked:
     - "We'll send a test message to [configured number]"
     - Sends: "This is a test message from [Company Name]. Reply 'call me' to test voice call functionality."
     - User can reply "call me"
     - System initiates test call
     - Confirms bidirectional communication works

7. **Webhook Health Monitoring**:

   **Webhook Stats Display**:
   - On each account card:
     - "Webhook Events"
       - Last 24 hours: [count] events received
       - Success rate: [percentage]
       - Last event: [timestamp]

   **View Webhook Logs**:
   - "View Logs" link
   - Opens modal with recent webhook events:
     - Timestamp
     - Event type (call_initiated, call_ended, etc.)
     - Status (success, failed)
     - Response time
     - Error details if failed
   - Filter by date range
   - Export logs option

8. **Account Usage Dashboard** (per account):

   **Click "View Usage" on account card**:
   - Shows:
     - Total calls through this account (this month)
     - Active calls now
     - Chatbots using this account (list with links)
     - Call volume trend (graph)
     - Average call duration
     - Error rate

   **Billing Information**:
   - Note: "Integration costs (Twilio, WhatsApp) are billed directly by the provider. This dashboard shows usage, not costs."
   - Link to provider billing dashboard

**Permission Requirements**:
- Only company admins can add/edit/delete integration accounts
- Support agents can view accounts (read-only)
- Master admins can view all companies' integration accounts

### 3.2 Creating Call-Enabled Chatbot

**Navigation Path**: Company Dashboard → Chatbots → New Chatbot

**Purpose**: Deploy a chatbot instance from a package template. The chatbot inherits call capabilities from the selected package.

**Process**:

1. **Chatbot Creation Wizard - Step 1: Select Package**:
   - Page title: "Create New Chatbot"
   - Package selection grid:
     - Each package shown as a card
     - **Capability Badges** displayed on each card:
       - [Chat] badge (blue) if enable_chat = true
       - [Call] badge (green) if enable_call = true
       - Both badges if both enabled
     - Package name and description
     - Category tag
     - "Select Package" button

   - **Filter Options**:
     - Filter by category
     - **Filter by capability** (NEW):
       - "Show All" (default)
       - "Chat Only" (packages with enable_chat=true, enable_call=false)
       - "Call Only" (packages with enable_chat=false, enable_call=true)
       - "Chat and Call" (both enabled)
     - Search by package name

   - Selecting a package proceeds to Step 2

2. **Chatbot Creation Wizard - Step 2: Basic Information**:
   - **Chatbot Name**:
     - Text input
     - Required
     - Example: "Customer Support Bot"

   - **Chatbot Description**:
     - Text area
     - Purpose and intended use

   - **Chatbot Slug** (URL-friendly name):
     - Auto-generated from name
     - Editable
     - Used in widget URL

   - **Capability Display** (Read-only):
     - Shows inherited capabilities from package:
       - "This chatbot supports: [Chat] [Call]"
       - Note: "Capabilities are inherited from the package and set to enabled_chat=[value], enabled_call=[value]"
       - Company admins cannot change these flags (set at package level)

3. **Chatbot Creation Wizard - Step 3: Variable Configuration**:
   - If package defines variables, company must provide values
   - Example variables:
     - businessHours: "Monday-Friday 9am-5pm EST"
     - escalationPhoneNumber: "+1 555 123 4567"
     - departmentName: "Customer Support"
   - Each variable shows:
     - Variable name
     - Description from package
     - Input field (appropriate type: text, number, select, etc.)
     - Required indicator

4. **Chatbot Creation Wizard - Step 4: Initial Agent Configuration**:
   - List of agents from package
   - Can customize:
     - Agent name
     - System prompt (pre-filled with package default)
     - Model settings (temperature, etc.)
     - Knowledge base categories
   - For call-enabled chatbots:
     - Note: "Call settings will be configured after creation in Call Options tab"

5. **Chatbot Creation Wizard - Step 5: Review and Create**:
   - Summary of configuration:
     - Chatbot name
     - Package name
     - Capabilities: [Chat] [Call]
     - Agent count
     - Variables configured
   - "Create Chatbot" button
   - On creation:
     - System copies enabled_chat and enabled_call from package to chatbot
     - System creates chatbot record
     - System initializes settings with package defaults
     - Success message: "Chatbot created successfully!"
     - Redirect to chatbot settings page

**Post-Creation**:
- Chatbot appears in chatbots list with capability badges
- If call-enabled, "Call Options" tab visible in settings
- If call-enabled, can configure integration accounts
- Must configure call settings before call feature is active

### 3.3 Configuring Call Settings

**Navigation Path**: Chatbots → [Select Chatbot] → Call Options Tab

**Purpose**: Configure voice, behavior, and features for call-enabled chatbots.

**Access Control**:
- Tab only visible if chatbot.enabled_call = true
- If enabled_call = false, tab not shown in navigation
- Company admin role required

**Call Options Page Layout**:

The Call Options page is divided into several sections:

#### Section 1: AI Model and Voice Selection

**1.1 AI Model Configuration**:

- **Label**: "Call AI Model"
- **Purpose**: Select which AI model to use for voice calls
- **Dropdown Field**:
  - Label: "AI Model"
  - Populated with models where model_type = 'call' OR model_type = 'both'
  - Each option shows:
    - Model name (e.g., "GPT-4 Realtime")
    - Provider (e.g., "OpenAI")
    - Cost indicator (e.g., "$0.06/min")
  - Default: Model from chatbot package (if set)
  - Required field

- **Model Information Card** (below dropdown):
  - Displays details of selected model:
    - Full model name
    - Provider
    - Model capabilities:
      - Supports streaming: Yes
      - Supports function calling: Yes
      - Supports interruption: Yes
    - Audio format: PCM16 24kHz
    - Max conversation tokens
    - Estimated cost per minute

- **Warning Messages**:
  - If no call model selected: "A call model must be selected before chatbot can accept calls"
  - If selected model is deprecated: "This model is deprecated and may be removed in the future. Consider switching to [alternative model]."

**1.2 Voice Selection**:

- **Label**: "Voice"
- **Purpose**: Choose the AI agent's voice for calls
- **Voice Selector Component**:
  - Displays as a grid of voice cards (2-3 columns depending on screen size)
  - Each voice card shows:
    - Voice name (large text)
    - Voice description (e.g., "Warm and friendly", "Professional and clear")
    - Voice attributes:
      - Gender icon and label (Male/Female/Neutral)
      - Language/accent (e.g., "English - US", "English - UK")
      - Tone tags (e.g., "Conversational", "Authoritative", "Calm")
    - **Preview Button**:
      - Speaker icon button
      - Label: "Preview Voice"
      - Click to play sample
    - **Selection Radio Button**:
      - Only one voice can be selected at a time
      - Selected voice has highlighted border (blue or green)

- **Voice Preview Functionality**:
  - When "Preview Voice" clicked:
    - Button shows loading spinner
    - System makes API call to generate sample audio
    - Sample phrase: "Hello! This is how I'll sound during our conversations. I'm here to help you with whatever you need today."
    - Audio plays through browser speakers
    - While playing:
      - Button text changes to "Playing..." with waveform animation
      - Stop button appears to cancel playback
    - After playback:
      - Button returns to "Preview Voice"
      - Success message: "Preview played successfully"
    - Error handling:
      - If preview fails: Error message "Unable to generate preview. Please try again."
      - If audio play fails: "Unable to play audio. Check your speakers."

- **Voice Selection Indicator**:
  - Below voice grid: "Selected Voice: [Voice Name]"
  - Description of selected voice shown
  - Change notification: "Voice changes apply to new calls immediately"

**1.3 Voice Settings (Advanced)**:

- **Expandable Section**: "Advanced Voice Settings"
- Available only for certain providers (OpenAI, some third-party TTS)
- Settings:

  - **Pitch** (if supported):
    - Slider: -20% to +20%
    - Default: 0% (normal)
    - Description: "Adjust voice pitch higher or lower"
    - Real-time preview button next to slider

  - **Speed** (if supported):
    - Slider: 0.5x to 1.5x
    - Default: 1.0x (normal)
    - Description: "Adjust speaking speed"
    - Warning if set too fast: "Very fast speech may reduce comprehension"

  - **Stability** (if supported by provider):
    - Slider: 0.0 to 1.0
    - Default: 0.5
    - Description: "Higher values make voice more consistent, lower values add variation"

#### Section 2: Call Behavior Configuration

**2.1 Call Greeting**:

- **Label**: "Call Greeting Message"
- **Purpose**: The first thing the AI agent says when call connects
- **Text Area Input**:
  - Rows: 3
  - Character limit: 500 characters
  - Character counter displayed: "245 / 500 characters"
  - Placeholder: "Hello! Thank you for calling [Company Name]. How can I assist you today?"
  - Default value: Inherited from package or generic greeting
  - Help text: "This greeting is spoken when the call connects. Keep it natural and conversational."

- **Greeting Tips** (collapsible):
  - "Keep it under 10 seconds (about 25-30 words)"
  - "State who the caller has reached"
  - "Be friendly and welcoming"
  - "Avoid complex or technical language"
  - Example templates provided:
    - Customer Support: "Hi there! Thanks for calling [Company]. I'm [Agent Name], your AI assistant. How can I help you today?"
    - Sales: "Hello! Thank you for your interest in [Company]. I'm here to answer your questions and help you find the perfect solution. What brings you to us today?"
    - Technical Support: "Hi! You've reached [Company] technical support. I'm [Agent Name], and I'm here to help resolve any issues you're experiencing. What can I help you with?"

- **Preview Greeting Button**:
  - Plays greeting using selected voice
  - Allows admin to hear exactly how greeting will sound
  - Uses selected voice with voice settings applied

**2.2 Maximum Call Duration**:

- **Label**: "Maximum Call Duration"
- **Purpose**: Hard limit to prevent extremely long calls
- **Slider Input**:
  - Range: 1 minute to 60 minutes
  - Step: 1 minute
  - Default: 10 minutes
  - Display: Shows selected value (e.g., "15 minutes")
  - Help text: "Calls automatically end after this duration to prevent overages. Choose a duration appropriate for your use case."

- **Duration Guidance**:
  - Suggested durations by use case:
    - Quick inquiries: 5-10 minutes
    - Customer support: 15-20 minutes
    - Sales calls: 20-30 minutes
    - Technical support: 30-45 minutes
  - Warning if set very high (>45 min): "Long call durations may result in high costs. Ensure your budget supports this."

- **Behavior Details**:
  - At max duration - 1 minute: Agent says "I want to let you know we have about a minute left on this call. Is there anything else I can help you with?"
  - At max duration: "Thank you for calling. Our time is up for this call. Please call back if you need further assistance. Goodbye!"
  - Call ends gracefully, saves transcript and recording

**2.3 Silence Timeout**:

- **Label**: "Silence Timeout"
- **Purpose**: End call if user is silent for extended period
- **Slider Input**:
  - Range: 30 seconds to 300 seconds (5 minutes)
  - Step: 15 seconds
  - Default: 180 seconds (3 minutes)
  - Display: Shows in seconds and minutes (e.g., "180 seconds (3 minutes)")
  - Help text: "If the caller is silent for this duration, the call will end automatically."

- **Silence Behavior Details**:
  - After 50% of timeout: Agent says "Are you still there? Please let me know if you need anything else."
  - After 75% of timeout: Agent says "I haven't heard from you for a while. If you're still there, please say something or I'll need to end the call."
  - At timeout: "I haven't heard from you, so I'll end the call now. Thank you for calling. Goodbye!"
  - Call ends, saves transcript with end reason: "Silence timeout"

- **Timeout Guidance**:
  - Shorter timeouts (30-60s): For high-volume, quick interactions
  - Medium timeouts (2-3 min): Standard customer service
  - Longer timeouts (4-5 min): For calls where users may need time to look up information

**2.4 End Call Phrase**:

- **Label**: "End Call Phrase"
- **Purpose**: User can speak specific phrase to immediately end call
- **Text Input**:
  - Default: "goodbye"
  - Placeholder: "goodbye"
  - Help text: "User can say this word to end the call immediately"
  - Case-insensitive matching
  - Alternatives: "bye", "end call", "hang up"

- **Phrase Detection Behavior**:
  - When phrase detected:
    - Agent responds: "Thank you for calling. Goodbye!"
    - Call ends immediately
    - Transcript saved with end reason: "User ended call"
  - Phrase can appear anywhere in user's sentence
  - Example: "Okay, goodbye!" → Call ends

#### Section 3: Call Features

**3.1 Call Recording**:

- **Toggle Switch**: "Enable Call Recording"
- **Default**: OFF (disabled)
- **Description**: "Record all calls for quality assurance and compliance"

- **When Enabled**:
  - Additional setting appears: **Recording Announcement**
    - Checkbox: "Announce recording to caller"
    - If checked, agent says at beginning: "This call may be recorded for quality and training purposes."
    - Legal compliance note: "Ensure compliance with local laws. Some jurisdictions require explicit consent."

  - **Recording Storage**:
    - Radio buttons:
      - "Store in platform" (default) - Uses Supabase or configured storage
      - "External storage" - Shows S3/Azure blob configuration fields

  - **Retention Period**:
    - Dropdown: 30 days, 90 days, 1 year, Indefinite
    - Default: 90 days
    - Description: "Recordings automatically deleted after retention period"

- **Legal Disclaimer**:
  - Warning icon with text: "Recording phone calls may be subject to local laws. Ensure you have proper consent and comply with regulations in your jurisdiction."
  - Link to compliance documentation

**3.2 Real-time Transcription**:

- **Toggle Switch**: "Enable Real-time Transcription"
- **Default**: ON (enabled)
- **Description**: "Generate live transcripts of calls with timestamps"

- **When Enabled**:
  - Transcripts saved to database
  - Visible in call history
  - Can be downloaded by admins
  - Real-time display in call widget (if enabled in widget settings)

- **Transcription Options**:
  - Checkbox: "Include confidence scores"
    - Saves confidence level for each transcript segment
  - Checkbox: "Post-call AI summary"
    - After call ends, AI generates summary of conversation
    - Summary includes:
      - Call purpose
      - Key points discussed
      - Action items
      - Sentiment analysis

**3.3 User Interruption**:

- **Toggle Switch**: "Allow User to Interrupt Agent"
- **Default**: ON (enabled)
- **Description**: "Allows caller to speak while agent is talking"

- **When Enabled**:
  - Uses Voice Activity Detection (VAD) to detect when user starts speaking
  - Agent immediately stops talking
  - Agent's partial response discarded
  - System listens to user's new input
  - More natural conversation flow

- **When Disabled**:
  - Agent completes full response before listening
  - User must wait for agent to finish
  - May feel less natural but more structured
  - Useful for scenarios where complete information delivery is critical

- **Interruption Behavior Details**:
  - Interruption detected via OpenAI input_audio_buffer.speech_started event
  - Response cancellation sent to provider: response.cancel
  - Client receives STOP_AUDIO event
  - Audio playback stops immediately
  - System waits for user to finish speaking
  - Agent responds to user's new input

#### Section 4: Advanced Settings

**Expandable Section**: "Advanced Call Settings"

**4.1 Voice Activity Detection (VAD) Configuration**:

- **Label**: "VAD Sensitivity"
- **Purpose**: Control how sensitive the system is to detecting speech
- **Slider Input**:
  - Range: 0.0 to 1.0
  - Step: 0.1
  - Default: 0.5
  - Display: Value and description
    - 0.0-0.3: "Low sensitivity (less sensitive, requires clearer speech)"
    - 0.4-0.6: "Medium sensitivity (balanced, recommended)"
    - 0.7-1.0: "High sensitivity (more sensitive, may pick up background noise)"
  - Help text: "Adjust how easily the system detects when the user starts speaking"

- **Advanced VAD Settings** (sub-expandable):
  - **Prefix Padding**:
    - Input: milliseconds
    - Default: 300ms
    - Description: "Audio buffered before detected speech start. Prevents cutting off beginning of words."

  - **Silence Duration**:
    - Input: milliseconds
    - Default: 700ms
    - Description: "How long a pause before considering speech ended. Shorter = faster response, but may cut off multi-clause sentences."

**4.2 Audio Processing**:

- **Echo Cancellation**:
  - Toggle: Enable/Disable
  - Default: ON
  - Description: "Removes echo from audio, improving quality"
  - Technical note: "Applied at audio capture level"

- **Noise Suppression**:
  - Toggle: Enable/Disable
  - Default: ON
  - Description: "Reduces background noise from caller's environment"
  - Levels (if enabled):
    - Radio buttons: Low, Medium, High
    - Default: Medium

**4.3 Function Calling / Tools**:

- **Label**: "Enable Tools During Calls"
- **Purpose**: Allow agent to call functions during voice conversation
- **Toggle**: Enable/Disable
- **Default**: ON (if tools configured in agent)

- **Available Tools List**:
  - Shows tools configured for this chatbot's agents
  - Example tools:
    - save_customer_info: Save caller name and email
    - check_order_status: Look up order by number
    - schedule_callback: Schedule human agent callback
  - Each tool shows:
    - Tool name
    - Description
    - Parameters
    - Checkbox to enable/disable for calls

- **Tool Execution Behavior During Calls**:
  - When tool needs to run:
    - Agent pauses speech
    - Tool executes (may take 1-5 seconds)
    - Agent acknowledges: "Let me check that for you..."
    - After tool returns result:
    - Agent continues speaking, incorporating result

**4.4 Fallback Behavior**:

- **Label**: "Behavior When Provider Unavailable"
- **Purpose**: What happens if AI provider (OpenAI, Google) is down
- **Dropdown**:
  - Options:
    - "Reject call with message" (default)
      - Plays message: "We're experiencing technical difficulties. Please try again later."
      - Hangs up immediately

    - "Queue for human agent"
      - If escalation enabled: Transfers to human
      - If no agents: Plays message and takes callback number

    - "Play maintenance message and offer callback"
      - Plays: "Our system is temporarily unavailable. Press 1 to leave your number for a callback."
      - Collects phone number via DTMF or speech
      - Creates callback task

**Save Settings**:

- **Save Button**: "Save Call Settings"
- Located at bottom of page
- Validation before save:
  - Model must be selected
  - Voice must be selected
  - All required fields filled
- On save:
  - Success message: "Call settings saved successfully"
  - Settings persist to chatbots.settings.call JSONB
  - Changes apply to new calls immediately
  - Active calls use settings from when they started
- **Cancel Button**: Discards unsaved changes

**Settings Preview**:

- **Preview Button**: "Preview Call Settings"
- Opens modal showing summary of all call settings
- "Test Call" button in modal:
  - Makes test call with current settings
  - Admin can verify all settings work as expected

### 3.4 Customizing Call Widget

**Navigation Path**: Chatbots → [Select Chatbot] → Widget Tab

**Purpose**: Customize appearance and behavior of call widget for end users.

**Important Note**: The Widget tab contains settings for BOTH chat and call widgets. Sections appear conditionally based on chatbot capabilities (enabled_chat and enabled_call flags).

**Widget Tab Structure**:

The Widget tab is divided into sub-tabs:
1. Appearance
2. Branding
3. Behavior (only if enabled_chat = true)
4. Call Options (only if enabled_call = true)
5. Features
6. Advanced
7. Human Escalation (only if enabled_chat = true)

#### Sub-Tab 1: Appearance (Shared for Chat and Call)

**Purpose**: Control visual appearance of widget launcher and interface.

**Shared Appearance Settings**:

**1.1 Theme**:
- Radio buttons: Light, Dark, Auto (follows device)
- Default: Auto
- Applies to both chat and call interfaces

**1.2 Position**:
- Dropdown: Bottom Right, Bottom Left, Top Right, Top Left
- Default: Bottom Right
- Controls position of widget launcher(s)

**1.3 Placement**:
- Pixels from edge:
  - Horizontal offset: slider 0-100px, default 20px
  - Vertical offset: slider 0-100px, default 20px

**1.4 Color Configuration**:
- **Primary Color**:
  - Color picker
  - Default: Brand color or #4F46E5
  - Used for: Buttons, active states, call visualizer
  - Preview updates in real-time

- **Accent Color**:
  - Color picker
  - Default: Lighter shade of primary
  - Used for: Hover states, secondary UI elements

**1.5 Border Radius**:
- Slider: 0px to 50px
- Default: 16px
- Controls roundness of all UI elements
- Preview: Shows sample button with current radius

**1.6 Button Size**:
- Dropdown: Small (48px), Medium (56px), Large (64px)
- Default: Medium
- Applies to launcher buttons (chat and call)

**1.7 Launcher Icon Border Radius**:
- Slider: 0% to 50%
- Default: 50% (circle)
- 0% = square, 50% = circle
- Separate from general border radius for launcher buttons only

**Chat-Specific Appearance Settings** (only if enabled_chat = true):

**1.8 Chat Launcher Icon**:
- Icon selector or image upload
- Default: Message bubble icon
- Formats: SVG, PNG (transparent background recommended)
- Size recommendation: 32x32px
- Preview shown in real-time

**1.9 User Bubble Color**:
- Color picker
- Default: Gray
- Used for user messages in chat

**1.10 Override Agent Colors**:
- Toggle: Yes/No
- If Yes: Color picker for agent messages
- If No: Uses agent's configured color from agents list

**1.11 Show Launcher Text** (Chat):
- Toggle: Yes/No
- If Yes: Text input appears

**1.12 Launcher Text** (Chat):
- Text input
- Default: "Chat with us!"
- Max length: 50 characters

**1.13 Text Background** (Chat launcher text):
- Color picker
- Default: White

**1.14 Text Color** (Chat launcher text):
- Color picker
- Default: Dark gray

**Call-Specific Appearance Settings** (only if enabled_call = true):

**1.15 Call Launcher Icon**:
- Icon selector or image upload
- Default: Phone icon
- Formats: SVG, PNG
- Size recommendation: 32x32px
- Preview shown in real-time

**1.16 Show Call Launcher Text**:
- Toggle: Yes/No
- Default: Yes
- If Yes: Text input appears

**1.17 Call Launcher Text**:
- Text input
- Default: "Call us!"
- Max length: 50 characters
- Shown next to call button

**1.18 Call Button Color**:
- Color picker
- Default: Green (#10B981)
- Used for call button background
- Separate from primary color to distinguish call from chat

**Widget Launcher Preview**:
- Right panel shows live preview of widget
- If both enabled_chat and enabled_call:
  - Shows call button above chat button (vertically stacked)
  - Call button on top, chat button below
  - Spacing: 12px between buttons
- If only one enabled:
  - Shows single button
- Preview updates in real-time as settings change

#### Sub-Tab 2: Branding (Shared and Specific)

**Purpose**: Configure branding elements and messages.

**Shared Branding Settings**:

**2.1 Company Logo**:
- Image upload
- Formats: PNG, SVG, JPG
- Recommended size: 200x60px
- Transparent background recommended
- Shows in header of both chat and call interfaces

**Chat-Specific Branding Settings** (only if enabled_chat = true):

**2.2 Widget Title** (Chat):
- Text input
- Default: Company name or "Customer Support"
- Max length: 60 characters
- Shows in chat interface header

**2.3 Subtitle** (Chat):
- Text input
- Default: "We're here to help!"
- Max length: 100 characters
- Shows below title in chat interface

**2.4 Welcome Message** (Chat):
- Text area
- Default: "Hi there! 👋 How can we help you today?"
- Max length: 500 characters
- First message shown when chat opens

**2.5 Input Placeholder** (Chat):
- Text input
- Default: "Type your message..."
- Max length: 50 characters
- Placeholder text in message input field

**Call-Specific Branding Settings** (only if enabled_call = true):

**2.6 Call Welcome Message**:
- Text area
- Default: Inherited from Call Options → Call Greeting, but can be overridden
- Max length: 500 characters
- Note: "This is the message spoken when a call connects. Also configured in Call Options tab."
- Help text: "If different from Call Options greeting, this takes precedence for web widget calls."

**2.7 End Call Message**:
- Text input
- Default: "Thank you for calling!"
- Max length: 100 characters
- Shown on screen after call ends (not spoken)

#### Sub-Tab 3: Behavior (ONLY if enabled_chat = true)

**Purpose**: Control chat-specific behavior.

**Note**: This entire sub-tab is hidden if enabled_chat = false.

**Behavior Settings**:

**3.1 Auto-Open Chat**:
- Toggle: Yes/No
- Default: No
- If Yes: Delay slider (seconds)

**3.2 Enable Sound Effects**:
- Toggle: Yes/No
- Default: Yes
- Plays sound for new messages

**3.3 Persistence**:
- Toggle: Yes/No
- Default: Yes
- Saves conversation in browser storage

**3.4 Show Typing Indicator**:
- Toggle: Yes/No
- Default: Yes

**3.5 Message Timestamps**:
- Dropdown: Never, On Hover, Always
- Default: On Hover

(All existing chat behavior settings remain here)

#### Sub-Tab 4: Call Options (ONLY if enabled_call = true)

**Purpose**: Configure call widget UI options.

**Note**: This entire sub-tab is hidden if enabled_call = false.

**Call UI Configuration**:

**4.1 Visualizer Style**:
- Radio buttons with preview images:
  - **Wave**:
    - Shows waveform visualization
    - Animated bars representing audio frequency
    - Classic audio visualizer look
    - Preview: Animated demo of wave style

  - **Orb**:
    - Shows circular orb visualization
    - Pulsates with speaking
    - Modern, minimalist look
    - Preview: Animated demo of orb style

- Default: Wave
- Help text: "Choose how audio is visualized during active call"

**4.2 Show Call Duration**:
- Toggle: Yes/No
- Default: Yes
- If Yes:
  - Duration displayed during call (e.g., "3:24")
  - Updates in real-time
  - Position: Top of call interface

**4.3 Show Live Transcript**:
- Toggle: Yes/No
- Default: Yes
- If Yes:
  - Real-time transcript panel shown during call
  - Scrollable area with user and agent messages
  - Auto-scrolls to latest
  - Position: Below visualizer

**4.4 Transcript Display Style** (if Show Live Transcript enabled):
- Radio buttons:
  - **Inline**: Transcript appears in call interface
  - **Side Panel**: Transcript in collapsible side panel
  - **Bottom Panel**: Transcript below visualizer
- Default: Bottom Panel

**4.5 Show Mute Button**:
- Toggle: Yes/No
- Default: Yes
- If Yes: Mute button appears in call controls

**4.6 Show End Call Button Style**:
- Radio buttons:
  - **Red Button**: Traditional red "hang up" button
  - **Icon Only**: Just phone hang-up icon
  - **Text Button**: "End Call" text button
- Default: Red Button

**4.7 Call Interface Size**:
- Radio buttons:
  - **Modal**: Overlay modal on current page
  - **Full Screen**: Takes over entire screen
  - **Embedded**: Stays within widget area
- Default: Modal
- Preview shows difference

**4.8 Show Agent Avatar**:
- Toggle: Yes/No
- Default: Yes
- If Yes: Shows agent's avatar during call

**4.9 Call Button Position Relative to Chat**:
- This setting only appears if both enabled_chat and enabled_call are true
- Radio buttons:
  - **Above Chat Button** (default): Call button on top
  - **Below Chat Button**: Chat button on top
  - **Separate Position**: Each button has independent position
- Preview updates to show button arrangement

#### Sub-Tab 5: Features (Shared with Conditional Sections)

**Purpose**: Toggle various features on/off.

**Shared Features**:

**5.1 Enable Feedback**:
- Toggle: Yes/No
- Default: Yes
- Applies to both chat and call (post-conversation feedback)

**5.2 Require Email**:
- Toggle: Yes/No
- Default: No
- If Yes: User must provide email before chat/call

**5.3 Require Name**:
- Toggle: Yes/No
- Default: No
- If Yes: User must provide name before chat/call

**Chat-Specific Features** (only if enabled_chat = true):

**5.4 Enable File Uploads**:
- Toggle: Yes/No
- Default: No

**5.5 Voice Support (Push to Talk)**:
- Toggle: Yes/No
- Default: No
- Different from call feature (this is for voice messages in chat)

**5.6 Show Agent List at Top**:
- Toggle: Yes/No
- Default: Yes

**5.7 Agents Listing Type**:
- Dropdown: Minimal, Compact, Standard, Detailed
- Default: Standard

**Call-Specific Features** (only if enabled_call = true):

**5.8 Show Call Quality Indicator**:
- Toggle: Yes/No
- Default: Yes
- Shows connection quality (bars or percentage)

**5.9 Allow Call Recording Download**:
- Toggle: Yes/No
- Default: No
- If Yes: User can download their call recording after call
- Note: "Only available if call recording is enabled in Call Options"

**5.10 Allow Transcript Download**:
- Toggle: Yes/No
- Default: Yes
- If Yes: User can download transcript after call

**5.11 Show "Switch to Chat" Button**:
- Only appears if both enabled_chat and enabled_call are true
- Toggle: Yes/No
- Default: Yes
- If Yes: Button appears during call to switch to chat interface

#### Sub-Tab 6: Advanced (Shared)

**Purpose**: Technical and advanced configuration.

**Advanced Settings**:

**6.1 Custom CSS**:
- Code editor (textarea with syntax highlighting if available)
- Allows custom CSS to override default styles
- Applies to both chat and call interfaces

**6.2 Custom JavaScript**:
- Code editor
- Allows custom JavaScript
- Warning: "Only use trusted code. Malicious code can compromise security."

**6.3 Allowed Domains**:
- Text area, one domain per line
- CORS configuration
- Widget only loads on these domains
- Wildcard support: *.example.com

**6.4 Rate Limiting**:
- Input: Messages/calls per user per hour
- Default: 100 for chat, 10 for calls

**6.5 Session Timeout**:
- Input: Minutes
- Default: 30 minutes
- Applies to both chat and call sessions

**6.6 Analytics Tracking**:
- Toggle: Enable/Disable
- If enabled: Google Analytics, Mixpanel, etc. tracking codes

**6.7 Language**:
- Dropdown: English, Spanish, French, German, etc.
- Default: English
- UI language (not AI response language)

#### Sub-Tab 7: Human Escalation (ONLY if enabled_chat = true)

**Purpose**: Configure escalation to human agents.

**Note**: This entire sub-tab is hidden if enabled_chat = false. Call escalation is configured separately.

(All existing escalation settings remain here for chat)

### Widget Preview Panel

**Location**: Right side of screen (or bottom on mobile)

**Purpose**: Live preview of widget as settings change.

**Preview Features**:

**1. Interactive Preview**:
- Shows widget launcher in selected position
- If both call and chat enabled: Shows both buttons in correct arrangement
- If only one enabled: Shows single button
- Can click to open widget
- Preview updates in real-time as settings change

**2. Preview Modes**:
- Toggle buttons above preview:
  - Desktop (default)
  - Tablet
  - Mobile
- Preview adjusts to show responsive behavior

**3. Preview Backgrounds**:
- Toggle through sample website backgrounds:
  - Light website
  - Dark website
  - Image background
- See how widget appears on different sites

**4. Test Interactions**:
- Can click call button in preview to open call interface
- Can click chat button to open chat interface
- Shows actual transitions and animations
- Does NOT make real calls (simulated)

**5. Copy Embed Code**:
- Button: "Copy Embed Code"
- Generates and copies widget embed script to clipboard
- Format: script tag with chatbot ID and company ID

**Save Widget Settings**:

- **Save Button**: "Save Widget Configuration"
- Located at bottom of page
- Saves all settings across all sub-tabs
- On save:
  - Success message: "Widget configuration saved"
  - Settings persist to widgetConfigs table
  - Widget updates immediately on all embedded sites (may take 1-2 minutes for CDN propagation)

### 3.5 Enabling Integrations for Chatbot

**Navigation Path**: Chatbots → [Select Chatbot] → Integrations Tab

**Purpose**: Connect chatbot to integration accounts and enable call channels.

**Integrations Tab Layout**:

The Integrations tab shows available integration channels. For call-enabled chatbots, it includes Web Widget, WhatsApp, and Twilio.

**Integration Types Displayed**:

1. **Web Widget** (always shown if enabled_call = true)
2. **WhatsApp** (shown if company has WhatsApp integration accounts)
3. **Twilio** (shown if company has Twilio integration accounts)
4. Other integrations (Slack, Zapier, etc.) - not call-related

#### Integration 1: Web Widget (Call)

**Status**: Automatically enabled if enabled_call = true

**Card Display**:
- **Icon**: Globe or widget icon
- **Title**: "Web Widget"
- **Status**: Active (green checkmark)
- **Description**: "Embed this chatbot on your website with call capability"

**Configuration**:
- No additional setup required
- Widget automatically includes call button
- Shows embed code:
  - **Embed Code Display**:
    - Read-only code block
    - Copy button
    - Code format: HTML script tag with chatbot ID
    - Example: `<script src="https://yourdomain.com/widget.js" data-chatbot-id="[UUID]"></script>`

- **Preview Widget Button**:
  - Opens widget in new tab for testing
  - URL: https://yourdomain.com/preview/widget?chatbotId=[UUID]&companyId=[UUID]

- **Customization Link**:
  - "Customize Widget" button
  - Links to Widget tab

**Call-Specific Web Widget Info**:
- Shows note: "This widget includes call functionality. Users can click the call button to initiate voice calls."
- Lists features enabled:
  - WebSocket audio streaming
  - Real-time transcription (if enabled)
  - Audio visualizer ([style])

#### Integration 2: WhatsApp (Call)

**Status**: Not configured by default

**Card Display** (when not configured):
- **Icon**: WhatsApp logo
- **Title**: "WhatsApp Business"
- **Status**: Not Configured (gray)
- **Description**: "Enable voice calls through WhatsApp Business"
- **Button**: "Enable WhatsApp Calls"

**Configuration Process**:

1. **Click "Enable WhatsApp Calls"**:
   - Modal opens: "Enable WhatsApp Integration for [Chatbot Name]"

2. **Select Integration Account**:
   - **Dropdown**: "WhatsApp Integration Account"
   - Populated with company's WhatsApp integration accounts (from Integration Accounts page)
   - Each option shows:
     - Account name
     - Phone number (partially masked)
     - Status (Active, Error)
   - If no accounts: Message "No WhatsApp accounts configured. [Add WhatsApp Account]" link

3. **Select Account and Save**:
   - Select account from dropdown
   - Click "Enable Integration"
   - System creates link between chatbot and integration account
   - Validation:
     - Checks account is active
     - Verifies webhook is configured
   - Success message: "WhatsApp integration enabled"

**Card Display** (when configured):
- **Status**: Active (green checkmark)
- **Details**:
  - Account name: [Account Name]
  - Phone number: +1 555 XXX-4567
  - Last verified: 2 hours ago
- **How It Works** (collapsible):
  - "Users can call this WhatsApp number to speak with the AI agent"
  - "Calls use WhatsApp's voice calling feature"
  - "Requires WhatsApp Business API access"

**Actions**:
- **Test WhatsApp Call**:
  - Button: "Test Call"
  - Prompts: "We'll call your WhatsApp number to test the integration"
  - Initiates test call to admin's WhatsApp
- **Change Account**:
  - Button: "Change Account"
  - Opens account selector
- **Disable**:
  - Button: "Disable WhatsApp"
  - Confirmation dialog
  - Unlinks integration account from chatbot

**Technical Details** (collapsible section):
- Shows webhook URL being used
- Shows WebRTC configuration status
- Connection quality indicator

#### Integration 3: Twilio (Phone Calls)

**Status**: Not configured by default

**Card Display** (when not configured):
- **Icon**: Phone icon
- **Title**: "Twilio (Phone Calls)"
- **Status**: Not Configured (gray)
- **Description**: "Enable traditional phone calls through Twilio"
- **Button**: "Enable Phone Calls"

**Configuration Process**:

1. **Click "Enable Phone Calls"**:
   - Modal opens: "Enable Twilio Integration for [Chatbot Name]"

2. **Select Integration Account**:
   - **Dropdown**: "Twilio Integration Account"
   - Populated with company's Twilio integration accounts
   - Each option shows:
     - Account name
     - Phone number
     - Status
   - If no accounts: "No Twilio accounts configured. [Add Twilio Account]" link

3. **Select Account and Save**:
   - Select account from dropdown
   - Click "Enable Integration"
   - System links chatbot to Twilio account
   - Success message: "Twilio integration enabled"

**Card Display** (when configured):
- **Status**: Active (green checkmark)
- **Details**:
  - Account name: [Account Name]
  - Phone number: +1 (555) 123-4567
  - Incoming calls: Enabled
  - Outgoing calls: Disabled (or Enabled if configured)
- **How It Works** (collapsible):
  - "Users can call [phone number] to speak with the AI agent"
  - "Calls are routed through Twilio's voice network"
  - "Standard phone carrier rates apply to callers"

**Webhook Configuration** (collapsible section):
- **Status**: Configured / Not Configured
- **Voice Webhook URL**:
  - Display with copy button
  - Format: https://yourdomain.com/api/webhooks/twilio/voice?chatbotId=[UUID]&accountId=[UUID]
  - Instructions:
    1. "Go to Twilio Console → Phone Numbers → [your number]"
    2. "Under 'Voice Configuration', set 'A Call Comes In' to Webhook"
    3. "Paste this URL and select POST"
    4. "Save"
- **Status Callback URL**:
  - Display with copy button
  - For call status updates

**Actions**:
- **Test Call**:
  - Button: "Test Phone Call"
  - Input: "Enter your phone number"
  - System initiates outbound test call through Twilio
  - User receives call from chatbot
- **Change Account**:
  - Opens account selector
- **Configure Outbound Calls** (advanced):
  - Toggle: Enable outbound calls
  - If enabled: Chatbot can initiate calls (requires additional setup)
- **Disable**:
  - Unlinks Twilio account from chatbot

**Technical Details** (collapsible):
- Webhook status
- TwiML configuration
- Audio codec: PCMU 8kHz
- Last successful call: timestamp

### Integration Save and Activation

**Activation Flow**:
- Each integration can be independently enabled/disabled
- Changes apply immediately
- When integration enabled:
  - Chatbot starts accepting calls from that channel
  - Webhook endpoint becomes active
  - Integration account starts routing to this chatbot

**Multiple Chatbots, Same Account**:
- Multiple chatbots can share same integration account (Twilio or WhatsApp)
- Routing based on phone number or webhook parameters
- Each chatbot maintains independent settings

**Monitoring**:
- Each integration card shows:
  - Last call received: timestamp
  - Calls today: count
  - Active call: Yes/No
  - Status: Active, Error, Inactive

---

## 4. Widget Customization

Widget customization is primarily handled in the Widget tab (covered in section 3.4), but this section provides additional context on the end-user experience.

### 4.1 End-User Widget Experience (Web)

**When Both Chat and Call Enabled**:

1. **Widget Launcher**:
   - Two buttons vertically stacked:
     - **Call Button** (top):
       - Color: Green or configured call button color
       - Icon: Phone icon or custom call launcher icon
       - Text: "Call us!" or configured call launcher text (if enabled)
     - **Chat Button** (bottom):
       - Color: Primary color
       - Icon: Message bubble or custom chat launcher icon
       - Text: "Chat with us!" or configured launcher text (if enabled)
   - Spacing: 12px between buttons
   - Position: Bottom-right or configured position
   - Both buttons have subtle animations (pulse or bounce)

2. **Call Button Click**:
   - Browser requests microphone permission
   - Permission dialog: "Allow [site] to use your microphone?"
   - If granted: Call interface opens
   - If denied: Error message "Microphone access required for calls"

3. **Call Interface Opens**:
   - Modal or full-screen overlay (based on configuration)
   - **Header**:
     - Company logo
     - Agent name and avatar
     - Status: "Connecting..." → "Connected"
   - **Main Area**:
     - Audio visualizer (Wave or Orb style)
     - Animates with agent's voice
     - Changes color based on who's speaking (user vs agent)
   - **Transcript Area** (if enabled):
     - Below or side of visualizer
     - Scrollable area
     - Messages appear in real-time:
       - User: "Hello"
       - Agent: "Hello! How can I assist you today?"
     - Timestamps (optional)
   - **Footer/Controls**:
     - Call duration: "1:24" (if enabled)
     - Mute button (microphone icon, toggles on/off)
     - End Call button (red button, phone hang-up icon)
   - **Connection Quality Indicator** (if enabled):
     - Small bars or icon in corner
     - Green: Good, Yellow: Fair, Red: Poor

4. **During Call**:
   - Agent speaks greeting (configured in Call Options)
   - User can speak, visualizer shows their audio activity
   - Transcript updates in real-time (if enabled)
   - User can interrupt agent (if enabled)
   - Mute/unmute functionality works instantly

5. **Ending Call**:
   - User clicks "End Call" button
   - Or user says end phrase (e.g., "goodbye")
   - Or silence timeout reached
   - Or max duration reached
   - Call interface shows:
     - "Call Ended"
     - Call duration: "Total time: 3:45"
     - Feedback prompt (if enabled): "How was your call? [star rating]"
     - Download transcript button (if enabled)
     - "Start Chat" button (if enabled_chat = true)
     - Close button to return to website

**When Only Call Enabled (Chat Disabled)**:
- Single call button shown
- Larger size possible
- No chat option
- Cleaner, simpler interface

**When Only Chat Enabled (Call Disabled)**:
- No changes to existing chat widget
- No call button shown

### 4.2 Mobile Responsive Behavior

**Mobile Adaptations**:

1. **Launcher Buttons**:
   - Slightly larger touch targets (minimum 48x48px)
   - Stack vertically (same as desktop)
   - Position: Bottom-right or bottom-center

2. **Call Interface**:
   - **Full Screen Mode** (recommended for mobile):
     - Takes over entire screen
     - No modal, no overlay
     - Immersive experience
   - **Header** stays fixed at top
   - **Visualizer** takes most of screen space
   - **Transcript** (if enabled):
     - Collapsible panel
     - Swipe up to expand, swipe down to collapse
     - Overlay on bottom half of screen when expanded
   - **Controls** fixed at bottom
   - **Large touch targets** for all buttons

3. **Orientation Handling**:
   - Portrait (default): Standard vertical layout
   - Landscape: Visualizer and transcript side-by-side

4. **Performance Optimizations**:
   - Lower quality visualizer on low-end devices
   - Adaptive audio bitrate
   - Reduced animations if device performance is low

### 4.3 Accessibility Considerations

**WCAG Compliance**:

1. **Keyboard Navigation**:
   - Tab to call button
   - Enter to open call interface
   - Tab through controls (mute, end call)
   - Escape to close interface

2. **Screen Reader Support**:
   - ARIA labels on all buttons
   - Status announcements: "Call connected", "Agent is speaking"
   - Transcript available to screen readers in real-time
   - Alternative to audio: Transcript provides full context

3. **Visual Indicators**:
   - High contrast mode support
   - Status shown visually and via text
   - Color not sole indicator (use icons and text)

4. **Audio Controls**:
   - Clear mute/unmute indication
   - Volume control (uses device volume)
   - Visual indicators when user or agent speaking

### 4.4 Internationalization (i18n)

**Language Support**:

- UI elements translated based on Advanced → Language setting
- Agent responses in language configured in agent's system prompt
- Transcript shows in language spoken (auto-detected)
- Common translations:
  - "Call us!" → "Llámanos!" (Spanish)
  - "Connected" → "Connecté" (French)
  - "End Call" → "Anruf beenden" (German)

---

## 5. Integration Setup

This section provides detailed setup instructions for each integration channel.

### 5.1 Web Widget Integration

**Prerequisites**:
- Chatbot created with enabled_call = true
- Call settings configured (voice, model, behavior)
- Widget customization completed

**Setup Steps**:

1. **Get Embed Code**:
   - Navigate to Chatbots → [Chatbot] → Integrations tab
   - Web Widget card shows embed code
   - Click "Copy Embed Code"
   - Code copied to clipboard

2. **Embed on Website**:
   - Paste code in HTML of website
   - Recommended location: Just before closing `</body>` tag
   - Code example format (shown to user):
     ```
     <script src="https://yourdomain.com/widget.js"
             data-chatbot-id="[UUID]"
             data-company-id="[UUID]">
     </script>
     ```

3. **Domain Whitelist** (if configured):
   - Ensure website domain is in Allowed Domains list (Widget → Advanced)
   - Without this, widget won't load (security measure)

4. **Test Embed**:
   - Load website with embed code
   - Widget launcher buttons should appear
   - Click call button
   - Grant microphone permission
   - Test call should connect

**WebSocket Requirements**:

- **Browser Compatibility**:
  - Chrome 50+
  - Firefox 44+
  - Safari 11+
  - Edge 79+
  - No IE support

- **Audio Requirements**:
  - HTTPS required (microphone access not allowed on HTTP)
  - Valid SSL certificate
  - Microphone permission granted

- **WebSocket Connection**:
  - Connection URL: wss://yourdomain.com/api/widget/call/[sessionId]/ws
  - Protocol: WebSocket Secure (WSS)
  - Audio format: PCM16 24kHz, base64 encoded
  - Message protocol:
    - Client→Server: {type: "audio", data: base64} | {type: "end"}
    - Server→Client: {type: "connected"} | {type: "audio", data: base64} | {type: "transcript", data: {...}} | {type: "agent_speaking"} | {type: "call_ended"} | {type: "error"}

**Troubleshooting**:

- **Widget Not Appearing**:
  - Check browser console for errors
  - Verify domain is whitelisted
  - Ensure script URL is correct and accessible
  - Check CORS configuration

- **Call Button Not Working**:
  - Verify enabled_call = true for chatbot
  - Check call settings are configured
  - Ensure model is selected and valid
  - Check browser microphone permissions

- **Microphone Permission Denied**:
  - User must manually re-enable in browser settings
  - Show instructions: "Click lock icon in address bar → Site settings → Microphone → Allow"

- **WebSocket Connection Fails**:
  - Check server logs for errors
  - Verify WebSocket endpoint is accessible
  - Check firewall/proxy settings
  - Ensure HTTPS and valid SSL certificate

### 5.2 WhatsApp Integration Setup

**Prerequisites**:
- WhatsApp Business Account
- Meta Business Suite access
- WhatsApp Business API enabled
- Phone number verified with WhatsApp

**Setup Steps**:

**Step 1: Configure Integration Account** (Company-wide):

1. Navigate to Company Dashboard → Integrations → Integration Accounts
2. Click "Add WhatsApp Account"
3. Enter credentials:
   - Business Account ID (from Meta Business Suite)
   - Phone Number ID
   - Phone Number
   - Access Token (System User token recommended)
4. Click "Verify Connection"
5. If successful, save account

**Step 2: Configure Webhook in Meta Business Suite**:

1. Copy webhook URL from Integration Account card
2. Copy Verify Token
3. Go to Meta Business Suite → WhatsApp → Configuration
4. Click "Webhook" section
5. Click "Edit" next to Callback URL
6. Paste Webhook URL
7. Paste Verify Token
8. Click "Verify and Save"
9. If verification succeeds: Webhook is active
10. Subscribe to webhook fields:
    - messages
    - message_status

**Step 3: Enable Integration for Chatbot**:

1. Navigate to Chatbots → [Chatbot] → Integrations tab
2. Find WhatsApp card
3. Click "Enable WhatsApp Calls"
4. Select WhatsApp integration account from dropdown
5. Click "Enable Integration"
6. Success: WhatsApp integration is now active

**Step 4: Test WhatsApp Call**:

1. On WhatsApp integration card, click "Test Call"
2. Enter your WhatsApp phone number
3. System initiates test call through WhatsApp
4. Your phone rings via WhatsApp
5. Answer call
6. Agent speaks greeting
7. Speak to test conversation
8. End call
9. Verify call appears in call history

**WhatsApp Call Flow (Technical)**:

1. **User Initiates Call**:
   - User calls WhatsApp Business number
   - WhatsApp sends webhook to configured endpoint
   - Webhook payload includes:
     - Call ID
     - Caller phone number
     - SDP offer (for WebRTC)

2. **System Receives Webhook**:
   - System validates webhook signature
   - Creates call session in database
   - Loads chatbot configuration
   - Prepares AI provider connection (OpenAI/Gemini)

3. **WebRTC Negotiation**:
   - System parses SDP offer from WhatsApp
   - Validates SDP structure
   - Generates SDP answer
   - Returns SDP answer to WhatsApp in webhook response
   - ICE candidates exchanged
   - WebRTC connection established

4. **Audio Streaming**:
   - WhatsApp sends Opus audio (48kHz) via WebRTC RTP packets
   - System decodes Opus to PCM16 48kHz
   - System resamples PCM16 48kHz to 24kHz (OpenAI requirement)
   - System encodes to base64
   - System sends to OpenAI Realtime API via WebSocket

5. **Agent Responses**:
   - OpenAI sends audio delta (base64 PCM16 24kHz)
   - System decodes from base64
   - System resamples 24kHz to 48kHz
   - System encodes PCM16 to Opus 48kHz
   - System sends Opus via WebRTC RTP to WhatsApp
   - User hears agent's voice in WhatsApp call

6. **Transcription**:
   - Transcription generated by OpenAI (Whisper)
   - Saved to call_transcripts table
   - Not shown to user during call (audio only)
   - Available for review after call

7. **Call End**:
   - User hangs up OR silence timeout OR max duration
   - System saves call record
   - System saves complete transcript
   - System closes all connections
   - Optional: Send transcript via WhatsApp text message

**WhatsApp-Specific Considerations**:

- **Audio Codecs**:
  - WhatsApp uses Opus (preferred) or G.711 (PCMU/PCMA)
  - System must handle codec negotiation
  - Resampling required (48kHz ↔ 24kHz)

- **Connection Quality**:
  - WhatsApp calls depend on user's internet connection
  - System monitors connection quality
  - Can adapt audio bitrate if needed

- **Rate Limits**:
  - WhatsApp API has rate limits on webhooks
  - System implements queuing if limits approached

- **Business Verification**:
  - WhatsApp Business Account must be verified for best results
  - Unverified accounts have limitations

**Troubleshooting**:

- **Webhook Not Receiving Events**:
  - Verify webhook URL is correct
  - Check webhook is subscribed to correct fields
  - Verify access token has required permissions
  - Check server logs for incoming requests

- **Call Not Connecting**:
  - Check WebRTC negotiation logs
  - Verify SDP parsing is successful
  - Check ICE candidates are being exchanged
  - Ensure firewall allows WebRTC traffic

- **Audio Quality Issues**:
  - Check resampling is working correctly
  - Verify codec conversion (Opus ↔ PCM16)
  - Monitor connection quality indicators
  - Check for packet loss in logs

- **Calls Drop Unexpectedly**:
  - Check silence timeout settings
  - Verify max call duration not too short
  - Monitor WebRTC connection stability
  - Check WhatsApp API status

### 5.3 Twilio Integration Setup

**Prerequisites**:
- Twilio account
- Twilio phone number (voice-enabled)
- Twilio Account SID and Auth Token

**Setup Steps**:

**Step 1: Configure Integration Account** (Company-wide):

1. Navigate to Company Dashboard → Integrations → Integration Accounts
2. Click "Add Twilio Account"
3. Enter credentials:
   - Account Name (friendly name)
   - Account SID (starts with "AC")
   - Auth Token (masked)
   - Phone Number (+1 format)
4. Click "Test Connection"
5. If successful, save account
6. Copy generated webhook URL

**Step 2: Configure Twilio Phone Number**:

1. Log in to Twilio Console
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click on your phone number
4. Scroll to "Voice Configuration" section
5. Under "A Call Comes In":
   - Select "Webhook"
   - Paste webhook URL from integration account
   - Select "HTTP POST"
6. Under "Call Status Changes" (optional but recommended):
   - Paste status callback URL (shown in integration account)
   - Select "HTTP POST"
7. Click "Save"

**Step 3: Enable Integration for Chatbot**:

1. Navigate to Chatbots → [Chatbot] → Integrations tab
2. Find Twilio card
3. Click "Enable Phone Calls"
4. Select Twilio integration account from dropdown
5. Click "Enable Integration"
6. Success: Twilio integration is now active

**Step 4: Test Phone Call**:

1. On Twilio integration card, click "Test Phone Call"
2. Enter your phone number
3. System initiates outbound test call
4. Your phone rings
5. Answer call
6. Agent speaks greeting
7. Speak to test conversation
8. End call
9. Verify call appears in call history

**Twilio Call Flow (Technical)**:

1. **Incoming Call Received**:
   - User dials Twilio phone number
   - Twilio receives call on their network
   - Twilio makes HTTP POST to configured webhook URL
   - Webhook payload includes:
     - Call SID
     - From (caller number)
     - To (Twilio number)
     - Call status

2. **System Responds with TwiML**:
   - System receives webhook
   - Validates request signature (security)
   - Creates call session in database
   - Loads chatbot configuration
   - Generates TwiML XML response:
     - Contains `<Connect>` verb
     - Contains `<Stream>` verb with WebSocket URL
     - Includes chatbot ID and account ID as parameters
   - Returns TwiML to Twilio

3. **Twilio Opens WebSocket Stream**:
   - Twilio parses TwiML
   - Twilio establishes WebSocket connection to streaming URL
   - WebSocket URL format: wss://yourdomain.com/api/webhooks/twilio/stream
   - Connection established message sent

4. **Audio Streaming Starts**:
   - Twilio streams audio over WebSocket in chunks
   - Audio format: PCMU (G.711 μ-law), 8kHz, base64 encoded
   - System receives audio chunks
   - System decodes PCMU to PCM16 8kHz
   - System resamples PCM16 8kHz to 24kHz (OpenAI requirement)
   - System encodes to base64
   - System sends to OpenAI Realtime API

5. **Agent Responses**:
   - OpenAI sends audio delta (base64 PCM16 24kHz)
   - System decodes from base64
   - System resamples 24kHz to 8kHz
   - System encodes PCM16 to PCMU
   - System sends via WebSocket to Twilio
   - Twilio plays audio to caller

6. **Call End**:
   - User hangs up OR timeout reached
   - Twilio sends "stop" event over WebSocket
   - System closes connections
   - System saves call record and transcript
   - Status callback webhook sent by Twilio (if configured)

**TwiML Response Example** (shown to admin for understanding):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://yourdomain.com/api/webhooks/twilio/stream">
      <Parameter name="chatbotId" value="[UUID]" />
      <Parameter name="accountId" value="[UUID]" />
    </Stream>
  </Connect>
</Response>
```

**Twilio-Specific Considerations**:

- **Audio Format**:
  - Twilio uses PCMU (G.711 μ-law) at 8kHz
  - Requires codec conversion to PCM16
  - Requires resampling (8kHz ↔ 24kHz)

- **Webhook Security**:
  - Twilio signs webhooks with X-Twilio-Signature header
  - System validates signature using Auth Token
  - Rejects requests with invalid signatures

- **Streaming Protocol**:
  - Twilio uses custom WebSocket protocol
  - Messages are JSON with base64 audio
  - Events: connected, start, media, stop, mark

- **Cost Considerations**:
  - Twilio charges per minute for phone calls
  - Separate from OpenAI API costs
  - Company is billed directly by Twilio

- **Phone Number Requirements**:
  - Must be voice-enabled
  - Can be local, toll-free, or short code
  - SMS-only numbers will NOT work

**Troubleshooting**:

- **Calls Not Reaching System**:
  - Verify webhook URL configured correctly in Twilio
  - Check webhook URL is accessible (test with curl)
  - Verify HTTPS and valid SSL certificate
  - Check Twilio debugger for webhook errors

- **TwiML Errors**:
  - Check system logs for TwiML generation errors
  - Verify XML format is correct
  - Test TwiML in Twilio's TwiML bin tester

- **WebSocket Not Connecting**:
  - Verify streaming URL is correct
  - Check WebSocket endpoint is accessible
  - Verify firewall allows WebSocket connections
  - Check for authentication issues

- **Audio Quality Issues**:
  - Verify codec conversion (PCMU ↔ PCM16)
  - Check resampling (8kHz ↔ 24kHz)
  - Monitor for packet loss
  - Check Twilio call quality metrics

- **Call Drops**:
  - Check silence timeout settings
  - Verify max call duration
  - Monitor WebSocket connection stability
  - Check Twilio debugger for issues

---

## 6. Call Execution Flow

This section describes the complete lifecycle of a call from initiation to completion.

### 6.1 Session Creation Process

**Web Widget Call Initiation**:

1. **User Clicks Call Button**:
   - User clicks call button on embedded widget
   - Widget JavaScript requests microphone permission from browser
   - Browser shows permission dialog

2. **Microphone Permission**:
   - **If Granted**:
     - Widget proceeds to create session
   - **If Denied**:
     - Widget shows error message: "Microphone access is required for calls. Please allow microphone access and try again."
     - Provides instructions to enable in browser settings
     - Call does not proceed

3. **Create Session API Call**:
   - Widget makes POST request to: /api/widget/call/session
   - Request body includes:
     - chatbotId: UUID of chatbot
     - companyId: UUID of company
     - customer: {name, email} (if collected via pre-call form)
   - Request is unauthenticated (public endpoint)

4. **Server-Side Session Creation**:
   - System validates chatbot exists and belongs to company
   - System checks enabled_call = true for chatbot
   - System checks company has callEnabled = true
   - System creates session record in database:
     - Generates sessionId (UUID)
     - Creates call record in calls table
     - Sets status: "pending"
     - Generates session token (24-hour expiry)
     - Creates in-memory session in CallSessionManager
   - System returns response:
     - sessionId
     - callId
     - websocketUrl: wss://yourdomain.com/api/widget/call/[sessionId]/ws
     - expiresAt: timestamp

5. **Widget Establishes WebSocket Connection**:
   - Widget connects to websocketUrl
   - WebSocket upgrade request includes session token
   - Server validates session token
   - Server instantiates WebSocketCallHandler for this connection
   - Connection established
   - Server sends: {type: "connected", sessionId}

**WhatsApp Call Initiation**:

1. **User Calls WhatsApp Number**:
   - User taps call button in WhatsApp
   - WhatsApp establishes call attempt

2. **WhatsApp Webhook Received**:
   - WhatsApp sends POST to webhook URL
   - Payload includes:
     - Call ID
     - Caller number
     - SDP offer (WebRTC)
   - System validates webhook signature

3. **System Creates Session**:
   - Creates call record with source: "whatsapp"
   - Loads chatbot configuration
   - Generates sessionId
   - Creates WhatsAppCallHandler
   - Prepares WebRTC negotiation

4. **WebRTC Connection Established**:
   - System parses SDP offer
   - System generates SDP answer
   - Returns SDP answer to WhatsApp
   - ICE candidates exchanged
   - WebRTC connection established
   - Audio streaming begins

**Twilio Call Initiation**:

1. **User Dials Phone Number**:
   - User dials Twilio phone number
   - Call routes through PSTN to Twilio

2. **Twilio Webhook Received**:
   - Twilio sends POST to webhook URL
   - Payload includes:
     - Call SID
     - From (caller number)
     - To (Twilio number)
     - Call status: "ringing"

3. **System Responds with TwiML**:
   - Creates call record with source: "custom" (Twilio)
   - Generates sessionId
   - Creates TwiML response with Stream verb
   - Returns TwiML to Twilio

4. **Twilio Opens WebSocket**:
   - Twilio connects to streaming URL
   - System creates TwilioCallHandler
   - WebSocket connection established
   - Audio streaming begins

### 6.2 WebSocket/WebRTC Connection Establishment

**Web Widget WebSocket Connection**:

1. **WebSocket Upgrade**:
   - HTTP request upgraded to WebSocket protocol
   - Headers validated
   - Session token verified

2. **Handler Initialization**:
   - WebSocketCallHandler instantiated
   - Handler registers with CallSessionManager
   - Handler sets up message listeners

3. **Connected Event**:
   - Handler sends: {type: "connected", sessionId}
   - Widget receives confirmation
   - Widget UI shows "Connected" status

4. **Ready for Audio**:
   - Widget starts capturing microphone audio
   - Audio converted to PCM16 24kHz
   - Audio sent as {type: "audio", data: base64}

**WhatsApp WebRTC Connection**:

1. **SDP Negotiation**:
   - WhatsApp sends SDP offer via webhook
   - System parses offer (validates format, codecs, ICE)
   - System generates SDP answer
   - Answer returned to WhatsApp

2. **ICE Candidate Exchange**:
   - WhatsApp sends ICE candidates via subsequent webhooks
   - System adds candidates to WebRTC peer connection
   - System generates its own candidates
   - Candidates sent back to WhatsApp

3. **Connection Established**:
   - Best candidate pair selected
   - DTLS handshake completed
   - SRTP keys exchanged
   - RTP audio stream starts
   - Connection state: "connected"

4. **Audio Flowing**:
   - Opus audio packets received from WhatsApp
   - PCM16 audio packets sent to WhatsApp
   - Bidirectional audio stream active

**Twilio WebSocket Connection**:

1. **Stream URL Connection**:
   - Twilio connects to stream URL from TwiML
   - WebSocket handshake completed
   - Parameters (chatbotId, accountId) extracted

2. **Handler Initialization**:
   - TwilioCallHandler instantiated
   - Handler registers with CallSessionManager

3. **Connected Event**:
   - Twilio sends: {event: "connected", ...}
   - Handler acknowledges

4. **Start Event**:
   - Twilio sends: {event: "start", ...}
   - Includes stream SID, call SID
   - Handler sets up audio processing

5. **Media Events Begin**:
   - Twilio sends: {event: "media", payload: base64}
   - Continuous audio chunks
   - Handler processes and forwards to AI provider

### 6.3 Audio Streaming Flow

**Client to Server to OpenAI**:

1. **Audio Capture** (Web Widget):
   - Browser captures microphone audio via getUserMedia()
   - Audio format: PCM16 24kHz (native Web Audio API format)
   - Audio buffered in chunks (100ms = 2400 samples)
   - Each chunk base64 encoded
   - Sent via WebSocket: {type: "audio", data: base64}

2. **Server Receives Audio**:
   - WebSocketCallHandler.handleAudio() called
   - Base64 decoded to Buffer
   - Validation: Check audio format, size
   - Pass to CallRunnerService.sendAudio(sessionId, audioBuffer)

3. **CallRunnerService Routing**:
   - Looks up session
   - Gets CallExecutor for session
   - Calls executor.sendAudio(audioBuffer)

4. **CallExecutor to Provider**:
   - OpenAIRealtimeExecutor.sendAudio()
   - Audio re-encoded to base64 (if needed)
   - Sent to OpenAI via WebSocket:
     - {type: "input_audio_buffer.append", audio: base64}
   - OpenAI buffers audio

5. **Voice Activity Detection** (OpenAI):
   - OpenAI monitors incoming audio with server-side VAD
   - When speech detected:
     - Event: {type: "input_audio_buffer.speech_started"}
   - When speech ends:
     - Event: {type: "input_audio_buffer.speech_stopped"}
     - OpenAI processes speech, generates response

**OpenAI to Server to Client**:

1. **OpenAI Generates Response**:
   - OpenAI processes user input
   - Generates text response internally
   - Converts text to audio using selected voice
   - Audio generated in real-time (streaming)

2. **Audio Deltas from OpenAI**:
   - OpenAI sends frequent events:
     - {type: "response.audio.delta", delta: base64}
   - Each delta is small audio chunk (100-200ms)
   - Deltas sent rapidly for low latency

3. **Server Receives Audio Deltas**:
   - OpenAIRealtimeExecutor handles event
   - Calls handler.onAudioDelta(delta)
   - Emits audioDelta event

4. **Handler Forwards to Client**:
   - WebSocketCallHandler.sendAudio(delta)
   - Sends via WebSocket: {type: "audio", data: base64}
   - No additional processing needed (already in correct format)

5. **Client Plays Audio**:
   - Widget receives {type: "audio", data: base64}
   - Base64 decoded to ArrayBuffer
   - Converted to AudioBuffer via Web Audio API
   - Queued to audio output
   - Played through speakers
   - Visualizer animates based on audio

**WhatsApp Audio Flow** (additional conversions):

- **Inbound** (WhatsApp → OpenAI):
  1. WhatsApp sends Opus 48kHz via RTP
  2. System decodes Opus → PCM16 48kHz
  3. System resamples 48kHz → 24kHz
  4. System encodes to base64
  5. System sends to OpenAI

- **Outbound** (OpenAI → WhatsApp):
  1. OpenAI sends PCM16 24kHz base64
  2. System decodes base64 → PCM16 24kHz
  3. System resamples 24kHz → 48kHz
  4. System encodes PCM16 48kHz → Opus
  5. System sends via RTP to WhatsApp

**Twilio Audio Flow** (additional conversions):

- **Inbound** (Twilio → OpenAI):
  1. Twilio sends PCMU 8kHz base64
  2. System decodes PCMU → PCM16 8kHz
  3. System resamples 8kHz → 24kHz
  4. System encodes to base64
  5. System sends to OpenAI

- **Outbound** (OpenAI → Twilio):
  1. OpenAI sends PCM16 24kHz base64
  2. System decodes base64 → PCM16 24kHz
  3. System resamples 24kHz → 8kHz
  4. System encodes PCM16 8kHz → PCMU
  5. System sends to Twilio WebSocket

### 6.4 Voice Activity Detection Behavior

**Server-Side VAD (OpenAI)**:

1. **Configuration**:
   - Set in OpenAI session.update:
     - turn_detection.type: "server_vad"
     - turn_detection.threshold: 0.5 (from chatbot settings)
     - turn_detection.prefix_padding_ms: 300
     - turn_detection.silence_duration_ms: 700

2. **Speech Detection**:
   - OpenAI continuously monitors incoming audio
   - When amplitude exceeds threshold:
     - Event: {type: "input_audio_buffer.speech_started"}
     - OpenAI buffers audio
   - When silence exceeds silence_duration:
     - Event: {type: "input_audio_buffer.speech_stopped"}
     - OpenAI processes buffered audio
     - Triggers response generation

3. **Behavior from User Perspective**:
   - User doesn't need to press any button
   - Simply starts speaking
   - System automatically detects speech
   - Agent responds after user finishes (natural pause)
   - Feels like natural conversation

4. **VAD Events**:
   - System receives speech_started and speech_stopped events
   - System can use these for:
     - Updating UI (show "User speaking")
     - Tracking silence for timeout
     - Detecting interruptions

### 6.5 User Interruption Handling

**Interruption Detection**:

1. **Agent is Speaking**:
   - OpenAI sending audio deltas
   - Client playing agent audio
   - Agent UI shows "Agent speaking" or animated visualizer

2. **User Starts Speaking**:
   - User begins speaking while agent is still talking
   - OpenAI detects via VAD: input_audio_buffer.speech_started

3. **System Detects Interruption**:
   - OpenAIRealtimeExecutor receives speech_started event
   - Checks isSpeaking flag (true = agent currently speaking)
   - Determines this is an interruption

4. **Debounce Check**:
   - System tracks lastInterruptionTime
   - Checks if at least 100ms since last interruption
   - Prevents spurious interruption events

5. **Cancel Agent Response**:
   - System sends to OpenAI:
     - {type: "response.cancel"}
   - OpenAI stops generating audio
   - OpenAI discards partial response

6. **Notify Client**:
   - System sends to client: {type: "stop_audio"}
   - Client immediately stops playing agent audio
   - Client shows "User speaking" in UI

7. **Listen to User**:
   - System waits for speech_stopped event
   - User finishes speaking
   - OpenAI processes user's new input
   - Agent generates new response (incorporates context)

**Interruption Tracking**:
- System increments interruptionCount
- Saved in call metadata for analytics
- High interruption count may indicate:
  - Agent responses too long
  - Agent not addressing user needs
  - User frustrated or urgent

**User Experience**:
- Feels natural (like interrupting a human)
- No delay when interrupting
- Agent doesn't finish irrelevant information
- Conversation stays on track

### 6.6 Silence Detection and Timeout

**Silence Tracking**:

1. **Update Last Speech Time**:
   - Every time speech_stopped event received
   - System updates lastUserSpeechTime to current timestamp

2. **Periodic Silence Check**:
   - Every 10 seconds, system checks:
     - currentTime - lastUserSpeechTime
     - If greater than silenceTimeout setting:
       - Trigger silence timeout action

3. **Silence Warning** (at 50% of timeout):
   - Example: silenceTimeout = 180 seconds (3 minutes)
   - At 90 seconds of silence:
     - Agent speaks: "Are you still there? Please let me know if you need anything else."
     - Resets lastUserSpeechTime if user responds
     - Prevents premature timeout

4. **Final Warning** (at 75% of timeout):
   - At 135 seconds of silence:
     - Agent speaks: "I haven't heard from you for a while. If you're still there, please say something or I'll need to end the call."
     - Last chance for user to respond

5. **Timeout Reached** (at 100%):
   - At 180 seconds of silence:
     - Agent speaks: "I haven't heard from you, so I'll end the call now. Thank you for calling. Goodbye!"
     - System initiates call end
     - Reason: "silence_timeout"

**Silence Timeout Configuration**:
- Set in Call Options: Silence Timeout slider
- Default: 180 seconds (3 minutes)
- Range: 30 to 300 seconds
- Per-chatbot setting

**Special Cases**:
- If agent is waiting for specific input (e.g., phone number):
  - Shorter patience timeout may apply
  - Agent may prompt more frequently
- If user asks agent to "wait a moment":
  - System should not timeout immediately
  - Agent may acknowledge and wait longer

### 6.7 Graceful Call Termination

**Call End Triggers**:

1. **User Ends Call**:
   - User clicks "End Call" button in widget
   - OR user says end call phrase (e.g., "goodbye")
   - OR user hangs up (WhatsApp, Twilio)

2. **Silence Timeout**:
   - User silent for configured duration
   - Agent speaks goodbye message
   - Call ends automatically

3. **Maximum Duration Reached**:
   - Call duration reaches maxCallDuration setting
   - Agent gives 1-minute warning
   - At max duration, agent speaks goodbye and ends call

4. **Error or Provider Failure**:
   - If AI provider connection drops
   - If WebSocket/WebRTC disconnects unexpectedly
   - System attempts graceful error message

**Termination Process**:

1. **End Call Initiated**:
   - System sets call status to "ending"
   - Stops accepting new audio from user
   - If agent mid-speech, allows completion (up to 5 seconds)

2. **Agent Goodbye** (if not already spoken):
   - Agent speaks configured end message
   - Example: "Thank you for calling. Goodbye!"
   - Audio sent to client
   - Client plays audio

3. **Close Connections**:
   - After goodbye audio played:
     - Close WebSocket to client
     - Close WebSocket to AI provider
     - Close WebRTC connection (if WhatsApp)
     - Close Twilio stream

4. **Save Call Record**:
   - Update call status to "completed" (or "failed" if error)
   - Set endedAt timestamp
   - Calculate total duration: endedAt - startedAt
   - Save end reason (user_ended, silence_timeout, max_duration, error)
   - Save call quality rating (if available)

5. **Save Transcript**:
   - Finalize any pending transcript entries
   - Generate call summary (AI-powered, if enabled)
   - Save summary to call record

6. **Save Recording** (if enabled):
   - Finalize audio recording file
   - Upload to storage (Supabase, S3, etc.)
   - Generate signed URL (10-minute expiry)
   - Save recordingUrl to call record

7. **Cleanup Session**:
   - Remove session from CallSessionManager
   - Clear in-memory session data
   - Release executor back to cache (if reusable)

8. **Notify Client**:
   - Send to client: {type: "call_ended", data: {duration, reason}}
   - Client UI shows "Call Ended"
   - Client displays call duration
   - Client shows feedback prompt (if enabled)
   - Client offers transcript download (if enabled)

**Post-Call User Experience**:

- **Widget Display**:
  - "Call Ended"
  - Duration: "3:45"
  - Feedback: "How was your call?" [1-5 stars]
  - Download Transcript button (if enabled)
  - Start Chat button (if enabled_chat = true)
  - Close button

- **WhatsApp**:
  - Call ends normally
  - Optional: System sends transcript via WhatsApp message
  - Optional: System sends feedback survey via WhatsApp

- **Twilio**:
  - Call ends, user hears disconnect tone
  - Optional: SMS with transcript link and feedback survey

**Error Termination**:

- **If Provider Fails**:
  - Agent plays pre-recorded message: "We're experiencing technical difficulties. Please try again later."
  - Call ends with error reason
  - User notified of issue

- **If Network Drops**:
  - Client detects WebSocket disconnect
  - Client shows "Connection lost" message
  - Client offers "Retry" button or "Start Chat"

---

## 7. Knowledge Base Access

Call agents can access company knowledge bases just like chat agents, with some differences in how information is presented.

### 7.1 Knowledge Base Configuration

**Same as Chat**:
- Knowledge base configuration is shared between chat and call
- Set in Chatbot Settings → General tab → Knowledge Base section
- Enable/disable knowledge base access
- Select categories to include
- Configure retrieval settings (top-k, similarity threshold)

**Knowledge Base Categories**:
- Categories defined at company level
- Each category contains:
  - Documents (PDFs, text files, web pages)
  - Q&A pairs
  - Product information
  - Policy documents
- Chunks stored in vector database (Qdrant)
- Embeddings generated for semantic search

### 7.2 Retrieval During Calls

**How It Works**:

1. **User Asks Question**:
   - User: "What are your business hours?"
   - Speech transcribed by OpenAI Whisper
   - Transcript available to system

2. **Agent Determines Need for Retrieval**:
   - AI agent analyzes question
   - Determines if knowledge base query needed
   - If yes, calls retrieval function

3. **Function Calling**:
   - OpenAI Realtime supports function calling
   - Agent calls search_knowledge_base function
   - Parameters: query="business hours"

4. **System Performs Retrieval**:
   - System receives function call request
   - Query sent to RAG service
   - Vector search in Qdrant
   - Top-k relevant chunks retrieved (e.g., top 3)
   - Chunks include source information

5. **Results Returned to Agent**:
   - System returns function result to OpenAI
   - Result includes:
     - Retrieved text chunks
     - Source documents
     - Relevance scores

6. **Agent Formulates Response**:
   - Agent incorporates retrieved information
   - Generates natural verbal response
   - Cites sources if appropriate
   - Speaks response to user

**Example Exchange**:

User: "What are your business hours?"

System: [Retrieves from knowledge base]

Agent: "Our business hours are Monday through Friday, 9 AM to 5 PM Eastern Time. We're closed on weekends and major holidays. Is there anything else you'd like to know?"

### 7.3 Differences from Chat

**Verbal Presentation**:
- In chat, sources can be shown as clickable links
- In calls, sources must be described verbally
- Agent may say: "According to our policy document..."

**No Visual Display**:
- Cannot show formatted documents
- Cannot display images or tables
- Agent must describe information verbally

**Simplified Citations**:
- In chat: "Source: Customer Service Policy (page 5)"
- In call: "As stated in our customer service policy..."

**Response Length**:
- Call responses should be concise
- Avoid reading long passages
- Summarize key points only

### 7.4 Function Calling During Calls

**Available Functions**:

Configured in Call Options or inherited from chatbot package. Example functions:

**1. search_knowledge_base**:
- Parameters: query (string)
- Returns: Relevant information from knowledge base
- Use: Answer factual questions

**2. save_customer_info**:
- Parameters: name (string), email (string), phone (string)
- Returns: Confirmation
- Use: Collect and store customer details

**3. check_order_status**:
- Parameters: order_number (string)
- Returns: Order status details
- Use: Look up order information

**4. schedule_callback**:
- Parameters: phone_number (string), preferred_time (string)
- Returns: Confirmation
- Use: Schedule human agent callback

**5. transfer_to_human**:
- Parameters: reason (string), department (string)
- Returns: Transfer status
- Use: Escalate to human agent

**Function Execution**:

1. **Agent Decides to Call Function**:
   - Based on conversation context
   - OpenAI sends function_call event

2. **System Receives Function Call**:
   - System extracts function name and parameters
   - System validates parameters
   - System executes function
   - Execution may take 1-5 seconds

3. **During Execution**:
   - Agent may say: "Let me check that for you..."
   - Or: "One moment while I look that up..."
   - Fills silence while function executes

4. **Return Result to Agent**:
   - System sends function result back to OpenAI
   - Agent incorporates result into response
   - Agent continues conversation naturally

**Error Handling**:
- If function fails:
  - Agent says: "I'm having trouble accessing that information right now. Let me try to help you another way."
  - Agent continues without function result

---

## 8. Escalation During Calls

The call feature integrates with the existing escalation system to allow transfer to human agents during active calls.

### 8.1 Escalation Triggers During Calls

**Trigger Types**:

1. **Manual Escalation** (User Request):
   - User says: "I want to speak to a human" or similar
   - Agent detects intent
   - Initiates escalation process

2. **Sentiment-Based Escalation**:
   - System monitors call sentiment
   - If sentiment drops below threshold (e.g., very negative)
   - Automatic escalation triggered

3. **Turn-Based Escalation**:
   - After N back-and-forth exchanges (e.g., 10 turns)
   - If issue not resolved
   - Agent offers escalation

4. **Agent Determination**:
   - AI agent realizes it cannot help
   - Agent proactively offers human agent
   - Example: "This sounds like something our team should handle. Let me connect you to a specialist."

**Escalation Configuration**:
- Set in Chatbot Settings → Human Escalation tab (for chat)
- Call escalations use same settings
- Escalation triggers apply to both chat and call

### 8.2 Escalation Process for Calls

**Step 1: Escalation Triggered**:
- Agent detects escalation needed
- Agent says: "I understand you'd like to speak with one of our team members. Let me check who's available."

**Step 2: Check Agent Availability**:
- System queries support agents assigned to this chatbot
- Checks agent status: online, away, busy
- Checks agent availability for call escalations
- Checks business hours (if configured)

**Step 3: Agent Available**:

**Option A: Immediate Transfer**:
- If agent available now:
  - Agent says: "I'm connecting you to [Agent Name] now. Please hold."
  - System creates escalation record
  - System notifies human agent (browser notification, sound)
  - Human agent accepts call
  - System switches audio routing:
    - User audio → Human agent (not AI)
    - Human agent audio → User
  - AI agent disconnects
  - Human agent takes over call

**Option B: Callback**:
- If no agent available now:
  - Agent says: "All our team members are currently busy. Can I have someone call you back?"
  - User provides phone number (via speech recognition)
  - Agent confirms: "Got it, we'll call you back at [number] within [timeframe]."
  - System creates escalation record with status: "pending"
  - System schedules callback task
  - Current call ends

**Step 4: Human Agent Interface**:
- Human agent receives notification
- Notification includes:
  - Caller name (if collected)
  - Call duration so far
  - Transcript summary (what was discussed)
  - Call sentiment
- Human agent clicks "Accept"
- Human agent's audio connected to call
- Human agent sees:
  - Real-time transcript
  - Call controls (mute, end, notes)
  - Caller information
  - Chatbot context

**Step 5: Human Agent Conversation**:
- Human agent speaks to caller
- Caller hears human agent (no AI)
- Full transcript continues (human + caller)
- Human agent can:
  - Access knowledge base
  - Take notes
  - Transfer to another agent
  - Return to AI (if supported)
  - End call

**Step 6: Return to AI** (Optional):
- If human agent resolves issue quickly:
  - Agent: "I've addressed your concern. I'm going to transfer you back to our assistant who can help with anything else."
  - System returns call to AI agent
  - AI agent: "I'm back. Is there anything else I can help you with?"
  - Conversation continues with AI

**Step 7: End Call**:
- When human agent ends call:
  - Call record updated with escalation info
  - Full transcript saved (AI + human portions)
  - Escalation record marked "resolved"

### 8.3 Configuration for Call Escalations

**Settings Location**: Chatbot Settings → Human Escalation tab

**Call-Specific Settings**:

**8.3.1 Enable Call Escalations**:
- Toggle: "Enable Escalation for Calls"
- Default: Same as chat escalation setting
- If disabled, escalation requests handled differently:
  - Agent: "I'm unable to transfer you right now, but I'll create a support ticket and someone will contact you soon."

**8.3.2 Available Agents**:
- List of support agents who can receive escalated calls
- Each agent can toggle: "Accept Call Escalations"
- Agent must have:
  - Microphone connected
  - Browser notification permissions
  - Status: Online or Available

**8.3.3 Routing Rule for Calls**:
- Same options as chat:
  - Round Robin
  - Least Busy
  - Preferred Agent
- For calls, "Least Busy" considers:
  - Current active calls
  - Current active chats
  - Agent capacity

**8.3.4 Callback Behavior**:
- If no agents available:
  - Dropdown:
    - "Collect callback number and schedule" (default)
    - "End call with apology"
    - "Queue call (wait on hold)"
  - For "Queue" option:
    - Max wait time slider (1-10 minutes)
    - Hold music or message played
    - If wait time exceeded, collect callback

**8.3.5 Business Hours**:
- Outside business hours:
  - Option: "Allow escalations outside business hours"
  - If disabled: Offer callback during business hours only

### 8.4 Escalation Notifications

**For Human Agents**:

**Browser Notification**:
- Title: "Incoming Call Escalation"
- Body: "Caller [Name] needs assistance"
- Sound: Ring tone
- Click to open agent dashboard

**Agent Dashboard Alert**:
- Pop-up modal:
  - Caller name and phone number
  - Call duration
  - Transcript summary (last 5 messages)
  - Sentiment: [emoji and score]
  - Reason for escalation
  - Accept / Decline buttons

**Accept Call**:
- Agent clicks "Accept"
- Call immediately connected
- Agent interface shows live call controls

**Decline Call**:
- Agent clicks "Decline"
- Call routed to next available agent (per routing rule)
- If no other agents, caller offered callback

**For Caller**:

**While Waiting**:
- Agent says: "Please hold while I connect you..."
- Hold music (if configured) or silence
- Message every 30 seconds: "Your call is important. Please continue to hold."

**If Wait Exceeds Threshold**:
- After 2 minutes (configurable):
  - Agent: "I apologize for the wait. Would you like to continue holding or receive a callback?"
  - User chooses
  - If callback: Collect number and end call

---

## 9. Recording and Transcription

The call feature supports recording calls and generating transcripts for compliance, quality assurance, and user reference.

### 9.1 Call Recording

**Configuration**: Call Options → Call Features → Enable Call Recording

**Recording Process**:

1. **Recording Starts**:
   - If recording enabled, starts when call connects
   - All audio captured:
     - User speech
     - Agent speech
     - Silence periods
   - Audio format: WAV or MP3 (configurable)
   - Sample rate: 24kHz or 16kHz (configurable)

2. **Recording Announcement** (Optional):
   - If configured, agent announces at start:
     - "This call may be recorded for quality and training purposes."
   - Required by law in some jurisdictions (two-party consent states)

3. **During Call**:
   - Audio continuously recorded
   - Recorded to temporary file or buffer
   - Minimal performance impact

4. **Recording Ends**:
   - When call ends, recording finalized
   - Audio file processed (compressed if MP3)
   - File ready for storage

5. **Storage**:
   - **Platform Storage** (default):
     - Upload to Supabase Storage or configured storage
     - Bucket: "call-recordings"
     - Filename: [callId]-[timestamp].mp3
     - Generate signed URL (10-minute expiry for admin access)

   - **External Storage** (if configured):
     - Upload to AWS S3
     - Upload to Azure Blob Storage
     - Company-provided storage endpoint

6. **Save Recording URL**:
   - recordingUrl saved to calls table
   - URL is signed (requires authentication to access)
   - Recording associated with call record

**Retention**:
- Recordings automatically deleted after retention period
- Default: 90 days
- Configurable: 30 days, 90 days, 1 year, Indefinite
- Deletion job runs daily

**Privacy and Compliance**:
- Recordings encrypted at rest (AES-256)
- Access logged (who accessed, when)
- GDPR compliance: User can request deletion
- Two-party consent warning shown if enabled

**Access Control**:
- Company admins: Can access all recordings
- Support agents: Can access recordings they were involved in
- Master admins: Can access all recordings (all companies)
- End users: Can download their own recording (if enabled)

### 9.2 Real-Time Transcription

**Configuration**: Call Options → Call Features → Enable Real-time Transcription

**Transcription Process**:

1. **Transcription Source**:
   - **Automatic via OpenAI**:
     - Configured in session.update
     - input_audio_transcription.model: "whisper-1"
     - Transcription generated automatically

   - **Manual Transcription** (if not using OpenAI):
     - After call ends, audio sent to Whisper API
     - Transcription generated post-call

2. **Real-Time Transcript Events**:
   - During call, OpenAI sends:
     - **response.audio_transcript.delta**:
       - Partial transcript as agent is speaking
       - Text: "Hello, how can I..."
     - **response.audio_transcript.done**:
       - Final transcript when agent finishes
       - Text: "Hello, how can I help you today?"

   - System receives events
   - Emits to handler

3. **Transcript Storage**:
   - Each transcript segment saved to call_transcripts table
   - Fields:
     - call_id: UUID
     - role: "user" or "assistant"
     - content: Transcript text
     - start_time: Milliseconds from call start
     - end_time: Milliseconds from call start
     - confidence: 0.0 to 1.0 (OpenAI provides)
     - created_at: Timestamp

4. **Live Transcript Display** (Web Widget):
   - If "Show Live Transcript" enabled in widget settings:
     - Transcript panel shown during call
     - Scrollable area
     - Messages appear as spoken:
       - User: "What are your business hours?"
       - Agent: "Our business hours are Monday through Friday, 9 AM to 5 PM."
     - Auto-scroll to latest message
     - Timestamps (optional)

5. **Post-Call Transcript Access**:
   - After call ends, full transcript available
   - Company admins can view in call history
   - User can download transcript (if enabled)

**Transcript Formats**:

**Plain Text**:
```
[00:00:05] User: Hello
[00:00:07] Agent: Hello! How can I assist you today?
[00:00:15] User: What are your business hours?
[00:00:17] Agent: Our business hours are Monday through Friday, 9 AM to 5 PM Eastern Time.
[00:00:30] User: Thank you
[00:00:31] Agent: You're welcome! Is there anything else I can help you with?
[00:00:35] User: No, that's all
[00:00:36] Agent: Thank you for calling. Goodbye!
```

**JSON**:
```json
{
  "callId": "uuid",
  "duration": 45,
  "transcript": [
    {"time": 5, "role": "user", "text": "Hello"},
    {"time": 7, "role": "agent", "text": "Hello! How can I assist you today?"},
    ...
  ]
}
```

**SRT (Subtitle Format)**:
```
1
00:00:05,000 --> 00:00:07,000
User: Hello

2
00:00:07,000 --> 00:00:15,000
Agent: Hello! How can I assist you today?
```

### 9.3 Post-Call AI Summary

**Configuration**: Call Options → Advanced → Post-Call AI Summary

**Summary Generation**:

1. **After Call Ends**:
   - If enabled, system triggers summary generation
   - Full transcript passed to AI (GPT-4 or similar)
   - Prompt: "Summarize this call conversation. Include: call purpose, key points discussed, outcome, and any action items."

2. **AI Generates Summary**:
   - Typically 3-5 sentences
   - Captures essence of call
   - Identifies:
     - Call purpose (why user called)
     - Key topics discussed
     - Resolution status
     - Action items (if any)
     - Sentiment (positive, neutral, negative)

3. **Save Summary**:
   - Summary saved to calls.summary field
   - Displayed in call history

**Example Summary**:
> **Purpose**: Customer inquired about business hours and holiday schedule.
> **Discussion**: Agent provided standard business hours (Mon-Fri 9-5 EST) and confirmed office is closed on major holidays.
> **Outcome**: Customer's question fully answered.
> **Sentiment**: Positive - Customer satisfied with information.

**Use Cases**:
- Quick review without reading full transcript
- Admin dashboard showing call summaries
- Identify common call topics
- Quality assurance

### 9.4 Transcript Download

**For End Users**:

**If Enabled** (Widget → Features → Allow Transcript Download):
- After call ends, widget shows:
  - "Download Transcript" button
  - Clicking downloads transcript as .txt file
  - Filename: transcript-[callId]-[date].txt

**For Company Admins**:
- Navigate to Call History
- Find call record
- Click "View Transcript"
- Modal shows full transcript
- "Download" button (formats: TXT, JSON, SRT)
- "Copy to Clipboard" button

**For Support Agents**:
- Can view transcripts of calls they were involved in
- Can view transcripts of escalated calls assigned to them
- Cannot view transcripts of other calls (privacy)

### 9.5 Transcript Search

**Call History Search**:

- Navigate to Call History page
- Search box: "Search transcripts"
- Enter keywords
- System searches call_transcripts.content
- Returns calls containing keyword
- Shows relevant excerpt with keyword highlighted

**Use Cases**:
- Find calls about specific topic (e.g., "refund")
- Compliance auditing (e.g., "recorded")
- Quality assurance (e.g., "supervisor")
- Training (find examples of good/bad calls)

---

## 10. Testing and Preview

### 10.1 Test Call Interface

**Navigation**: Chatbots → [Chatbot] → Test Tab

**Test Tab Layout**:

**If enabled_chat = true**:
- Shows "Test Chat" button (existing functionality)

**If enabled_call = true**:
- Shows "Test Call" button (NEW)

**Test Call Button**:
- Click "Test Call"
- Call interface opens in modal or new tab
- Interface is identical to production widget
- Uses real call settings
- Connects to real AI provider (OpenAI/Gemini)
- Charges apply (uses company's API keys)

**Test Call Flow**:

1. **Click Test Call**:
   - Call interface opens
   - Shows call button

2. **Click Call Button**:
   - Browser requests microphone permission
   - Grant permission
   - Call connects

3. **Test Conversation**:
   - Agent speaks greeting
   - Tester speaks
   - Agent responds
   - Test features:
     - Interruption (speak while agent is talking)
     - Silence (wait for timeout)
     - End call phrase (say "goodbye")
     - Knowledge base (ask question requiring retrieval)
     - Function calling (trigger function)

4. **End Call**:
   - Click "End Call" or say end phrase
   - Call ends
   - View call summary
   - View transcript
   - Download transcript

5. **Review**:
   - Call appears in Call History
   - Tagged as "test call"
   - Can review for quality

**Test Call Settings**:
- Uses all configured settings:
  - Voice
  - Greeting
  - Max duration
  - Silence timeout
  - Recording (if enabled)
  - Transcription (if enabled)
- Exactly like production call

### 10.2 Voice Preview in Settings

**Location**: Call Options → Voice Selection

**Voice Preview Button**:
- Next to each voice in voice selector
- Speaker icon
- Label: "Preview Voice"

**Preview Process**:

1. **Click Preview**:
   - Button shows loading spinner
   - System makes API call to OpenAI:
     - Endpoint: Text-to-Speech API (separate from Realtime)
     - Text: "Hello! This is how I'll sound during our conversations. I'm here to help you with whatever you need today."
     - Voice: Selected voice ID
     - Format: MP3 or WAV

2. **Audio Generated**:
   - OpenAI returns audio file
   - System caches (to avoid repeated API calls)
   - Audio sent to client

3. **Play Audio**:
   - Browser plays audio through speakers
   - Button text changes to "Playing..."
   - Waveform animation shown
   - Stop button appears

4. **Playback Complete**:
   - Button returns to "Preview Voice"
   - Can click again to replay

**Preview Customization**:
- Preview respects voice settings (pitch, speed) if configured
- Each voice has unique preview
- Preview phrase is generic but representative

**Use Case**:
- Admin trying multiple voices
- Can quickly audition voices
- Select best voice for brand/use case

### 10.3 Call Simulation for Debugging

**For Developers**:

**Simulation Mode**:
- Environment variable: CALL_SIMULATION_MODE=true
- When enabled:
  - Calls don't actually connect to OpenAI
  - Simulated responses generated
  - No charges incurred
  - Faster testing

**Simulated Responses**:
- System generates predictable responses
- Example:
  - User: "Hello"
  - Agent (simulated): "Hello! This is a simulated response."
- Useful for testing UI, audio flow, transcript generation

**Debugging Tools**:
- Call logs with detailed events
- Audio packet inspection
- WebSocket message logging
- Latency measurement

**Test Scenarios**:
- Successful call
- Call with interruptions
- Call with silence timeout
- Call with error (simulated)
- Call with escalation
- Call with function calling

---

## 11. Key Features Per Page/Component

This section provides a detailed breakdown of features for each major page and component.

### 11.1 Master Admin - Chatbot Packages Page

**URL**: /admin/chatbot-packages

**Features**:

1. **Package List**:
   - Table showing all packages
   - Columns: Name, Category, Capabilities, Status, Actions
   - **Capabilities Column** (NEW):
     - Shows badges: [Chat] [Call] or both
     - Filter by capabilities

2. **Create Package Button**:
   - Opens package creation wizard

3. **Package Creation Wizard**:
   - Step 1: Basic Info (name, description, category)
   - Step 2: Capabilities (NEW):
     - Checkbox: "Enable Chat"
     - Checkbox: "Enable Call"
     - At least one must be checked
   - Step 3: Agents Configuration
     - Different agents for chat vs call (optional)
   - Step 4: Model Selection
     - If Call enabled: Filter to call-compatible models
   - Step 5: Voice Selection (if Call enabled)
     - Voice dropdown with preview
   - Step 6: Knowledge Base
   - Step 7: Call Settings (if Call enabled)
     - Default greeting
     - Default max duration
     - Default silence timeout
     - Default recording setting
   - Step 8: Variables
   - Step 9: Review and Publish

4. **Edit Package**:
   - Same wizard, pre-filled
   - Can change capabilities (affects new deployments only)

5. **Package Preview**:
   - Shows sample configuration
   - Capability badges prominent

### 11.2 Master Admin - AI Models Page

**URL**: /admin/ai-models

**Features**:

1. **Models List**:
   - Table showing all models
   - Columns: Name, Provider, **Model Type** (NEW), Status, Cost, Actions
   - **Model Type Column**:
     - Shows: Chat, Call, or Both
     - Icon for each type
   - Filter by:
     - Provider
     - **Model Type** (NEW filter)
     - Status

2. **Add Model**:
   - Form with fields:
     - Model Name
     - Model ID
     - Provider
     - **Model Type** (NEW):
       - Dropdown: Chat, Call, Both
       - Required field
     - Description
     - Max Tokens
     - Supports Streaming
     - Supports Function Calling
     - **Supports Audio** (NEW):
       - Auto-checked if Model Type includes Call
     - Cost fields
     - **Cost per Audio Minute** (NEW):
       - Shown only if Model Type is Call or Both

3. **Edit Model**:
   - Same form, pre-filled
   - Can change model type

4. **Voice Configuration** (for Call models):
   - Sub-section in Edit Model
   - List of available voices
   - Add voice:
     - Voice ID
     - Voice Name
     - Description
     - Gender
     - Language/Accent
     - Sample Audio URL

### 11.3 Company Admin - Integration Accounts Page

**URL**: /integrations

**Features**:

1. **Page Header**:
   - Title: "Integration Accounts"
   - Description
   - "Add Integration Account" button

2. **Account Cards Grid**:
   - Card for each integration type:
     - Twilio
     - WhatsApp Business
     - Custom
   - Each card shows:
     - Integration logo
     - Account name
     - Status badge
     - Phone number (if applicable)
     - Last verified timestamp
     - Actions: Edit, Test, Delete

3. **Add Twilio Account**:
   - Modal form:
     - Account Name
     - Twilio Account SID
     - Auth Token
     - Phone Number
     - Test Connection button
     - Webhook URL display (after save)
     - Configuration instructions

4. **Add WhatsApp Account**:
   - Modal form:
     - Account Name
     - Business Account ID
     - Phone Number ID
     - Phone Number
     - Access Token
     - Verify Connection button
     - Webhook URL display (after save)
     - Verify Token display
     - Configuration instructions

5. **Account Card Actions**:
   - Edit: Modify credentials
   - Test: Run connection test
   - View Webhook URL: Copy URL
   - View Usage: Open usage dashboard
   - Disable/Enable: Toggle status
   - Delete: Remove account (with confirmation)

6. **Webhook Health**:
   - Each card shows webhook stats
   - Recent events (last 24h)
   - Success rate
   - View Logs link

### 11.4 Company Admin - Chatbot Settings (Call Options Tab)

**URL**: /chatbots/[id]/call-settings

**Features**:

**Tab is only shown if**: chatbot.enabled_call = true

**Section 1: AI Model and Voice**:
1. AI Model dropdown (filtered to call models)
2. Model information card
3. Voice selector grid
4. Voice preview buttons
5. Advanced voice settings (expandable)

**Section 2: Call Behavior**:
1. Call greeting text area
2. Preview greeting button
3. Max call duration slider
4. Silence timeout slider
5. End call phrase input

**Section 3: Call Features**:
1. Call recording toggle
2. Recording announcement checkbox (if recording enabled)
3. Recording storage options
4. Retention period dropdown
5. Real-time transcription toggle
6. Transcription options (if enabled)
7. User interruption toggle
8. Interruption behavior explanation

**Section 4: Advanced Settings** (expandable):
1. VAD sensitivity slider
2. Advanced VAD settings (expandable)
3. Echo cancellation toggle
4. Noise suppression toggle
5. Function calling toggle
6. Available tools list (if function calling enabled)
7. Fallback behavior dropdown

**Bottom Actions**:
1. Save button
2. Cancel button
3. Preview Call Settings button

### 11.5 Company Admin - Widget Tab

**URL**: /chatbots/[id]/widget

**Features**:

**Widget Tab has Sub-Tabs**:

**Sub-Tab 1: Appearance**:
- **Shared Settings**:
  - Theme selector
  - Position selector
  - Placement (px from edge)
  - Primary color picker
  - Accent color picker
  - Border radius slider
  - Button size dropdown
  - Launcher icon border radius slider
- **Chat Settings** (if enabled_chat):
  - Chat launcher icon upload
  - User bubble color picker
  - Override agent colors toggle
  - Show launcher text toggle
  - Launcher text input
  - Text background color
  - Text color
- **Call Settings** (if enabled_call):
  - Call launcher icon upload
  - Show call launcher text toggle
  - Call launcher text input
  - Call button color picker

**Sub-Tab 2: Branding**:
- **Shared**:
  - Company logo upload
- **Chat** (if enabled_chat):
  - Widget title input
  - Subtitle input
  - Welcome message textarea
  - Input placeholder input
- **Call** (if enabled_call):
  - Call welcome message textarea
  - End call message input

**Sub-Tab 3: Behavior** (ONLY if enabled_chat):
- All existing chat behavior settings

**Sub-Tab 4: Call Options** (ONLY if enabled_call):
- Visualizer style selector (Wave, Orb)
- Show call duration toggle
- Show live transcript toggle
- Transcript display style (if enabled)
- Show mute button toggle
- End call button style selector
- Call interface size selector
- Show agent avatar toggle
- Call button position (if both chat and call enabled)

**Sub-Tab 5: Features**:
- **Shared**:
  - Enable feedback toggle
  - Require email toggle
  - Require name toggle
- **Chat** (if enabled_chat):
  - Enable file uploads toggle
  - Voice support toggle
  - Show agent list toggle
  - Agents listing type dropdown
- **Call** (if enabled_call):
  - Show call quality indicator toggle
  - Allow recording download toggle
  - Allow transcript download toggle
  - Show "Switch to Chat" button toggle (if both enabled)

**Sub-Tab 6: Advanced**:
- Custom CSS editor
- Custom JavaScript editor
- Allowed domains textarea
- Rate limiting input
- Session timeout input
- Analytics tracking toggle
- Language dropdown

**Sub-Tab 7: Human Escalation** (ONLY if enabled_chat):
- All existing escalation settings

**Widget Preview Panel** (Right Side):
- Live preview
- Desktop/Tablet/Mobile toggle
- Preview backgrounds toggle
- Interactive preview (can click buttons)
- Copy embed code button

**Bottom Actions**:
- Save Widget Configuration button
- Cancel button

### 11.6 Company Admin - Chatbot Integrations Tab

**URL**: /chatbots/[id]/integrations

**Features**:

**Integration Cards**:

**1. Web Widget Card** (always shown if enabled_call):
- Status: Active (auto)
- Description
- Embed code display
- Copy embed code button
- Preview widget button
- Customize widget link

**2. WhatsApp Card** (if WhatsApp accounts exist):
- **Not Configured State**:
  - Enable WhatsApp Calls button
- **Configured State**:
  - Status: Active/Inactive/Error
  - Account name
  - Phone number
  - Last verified timestamp
  - How It Works (expandable)
  - Actions:
    - Test Call button
    - Change Account button
    - Disable button
  - Technical Details (expandable)

**3. Twilio Card** (if Twilio accounts exist):
- **Not Configured State**:
  - Enable Phone Calls button
- **Configured State**:
  - Status: Active/Inactive/Error
  - Account name
  - Phone number
  - Incoming calls: Enabled
  - How It Works (expandable)
  - Webhook Configuration (expandable)
    - Voice webhook URL with copy button
    - Status callback URL with copy button
    - Configuration instructions
  - Actions:
    - Test Phone Call button
    - Change Account button
    - Disable button
  - Technical Details (expandable)

**4. Other Integrations** (Slack, Zapier, etc.):
- Existing integration cards

### 11.7 End User - Web Widget (Call)

**Features**:

**Widget Launcher**:
- Call button (if enabled_call)
  - Position: Top or above chat button
  - Icon: Phone or custom
  - Text: "Call us!" or custom (if enabled)
  - Color: Green or custom
  - Animation: Pulse or bounce
- Chat button (if enabled_chat)
  - Position: Bottom or below call button
  - Existing chat button features

**Call Interface** (after clicking call button):

**Header**:
- Company logo
- Agent name and avatar
- Status indicator: "Connecting..." → "Connected" → "Listening"
- Close button (X)

**Main Area**:
- **Audio Visualizer**:
  - Style: Wave or Orb (configured)
  - Animates with audio
  - User speaking: One color (e.g., blue)
  - Agent speaking: Another color (e.g., green)
  - Idle: Subtle animation
- **Transcript Panel** (if enabled):
  - Position: Below visualizer or side panel
  - Scrollable area
  - Messages:
    - User: [avatar] [message] [timestamp]
    - Agent: [avatar] [message] [timestamp]
  - Auto-scroll to latest
  - Collapse button

**Footer/Controls**:
- Call duration (if enabled): "1:24"
- Mute button:
  - Icon: Microphone
  - States: Unmuted (blue), Muted (red, line through mic)
  - Tooltip: "Mute" / "Unmute"
- End Call button:
  - Style: Red button, icon only, or text (configured)
  - Icon: Phone hang-up
  - Text: "End Call" (if configured)
- Connection quality indicator (if enabled):
  - Bars or percentage
  - Green/Yellow/Red

**Call Ended Screen**:
- Message: "Call Ended"
- Duration: "Total time: 3:45"
- Feedback (if enabled):
  - "How was your call?"
  - Star rating (1-5)
  - Optional comment box
  - Submit button
- Download transcript button (if enabled)
- Start Chat button (if enabled_chat)
- Close button

**Responsive Behavior**:
- Mobile: Full screen
- Desktop: Modal or embedded (configured)
- Touch-friendly controls
- Accessible keyboard navigation

---

## Conclusion

This document provides comprehensive instructions for implementing the call feature in the chat.buzzi.ai platform. Every aspect has been detailed from master admin configuration to end-user experience, covering all pages, components, settings, flows, and behaviors.

The implementation should follow these instructions exactly, ensuring consistency with existing patterns while cleanly integrating call capabilities alongside chat functionality.

For database schema details, refer to: **docs/call-feature-database-updates-needed.md**
For user flows, refer to: **docs/call-feature-activity-flow.md**
For technical architecture, refer to: **docs/call-feature-architecture.md**