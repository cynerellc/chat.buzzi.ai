# Call Feature API Documentation

This document describes the API endpoints for the voice call feature in chat.buzzi.ai.

## Overview

The call feature enables real-time voice conversations between end users and AI chatbots. It supports:
- Web browser calls via WebSocket
- WhatsApp voice calls via WebRTC
- Multiple AI providers (OpenAI Realtime, Google Gemini Live)

## Authentication

### Widget API (Public)
Widget endpoints use session-based authentication with chatbot ID validation.

### Company API (Authenticated)
Company endpoints require authentication via NextAuth session and company admin permissions.

---

## Widget Call API

### Create Call Session

Creates a new call session for the widget.

```
POST /api/widget/call/session
```

**Request Body:**
```json
{
  "chatbotId": "uuid",
  "sessionId": "existing-chat-session-id (optional)",
  "callerInfo": {
    "name": "string (optional)",
    "email": "string (optional)",
    "phone": "string (optional)"
  }
}
```

**Response (200 OK):**
```json
{
  "sessionId": "call-session-uuid",
  "callId": "call-record-uuid",
  "wsUrl": "wss://host:port/api/widget/call/ws",
  "aiProvider": "OPENAI | GEMINI",
  "voiceConfig": {
    "voice": "alloy",
    "vadThreshold": 0.5,
    "silenceDurationMs": 700
  }
}
```

**Error Responses:**
- `400` - Invalid request (missing chatbotId)
- `404` - Chatbot not found or calls not enabled
- `500` - Server error

### WebSocket Connection

Establishes a WebSocket connection for real-time audio streaming.

```
WS /api/widget/call/ws?sessionId={sessionId}
```

**Client → Server Messages:**

```typescript
// Start the call
{
  "type": "start_call",
  "data": {
    "sessionId": "string"
  }
}

// Send audio data (PCM16 base64)
{
  "type": "audio_data",
  "data": {
    "audio": "base64-encoded-pcm16"
  }
}

// End the call
{
  "type": "end_call",
  "data": {
    "reason": "user_ended | timeout | error"
  }
}
```

**Server → Client Messages:**

```typescript
// Connection established
{
  "type": "connected",
  "data": {
    "sessionId": "string"
  }
}

// Call started
{
  "type": "call_started",
  "data": {
    "callId": "string"
  }
}

// Audio response from AI
{
  "type": "audio_response",
  "data": {
    "audio": "base64-encoded-pcm16"
  }
}

// Transcript update
{
  "type": "transcript",
  "data": {
    "role": "user | assistant",
    "content": "string",
    "isFinal": boolean
  }
}

// Status update
{
  "type": "status",
  "data": {
    "status": "connecting | in_progress | completed | failed"
  }
}

// Agent state
{
  "type": "agent_state",
  "data": {
    "state": "speaking | listening"
  }
}

// Call ended
{
  "type": "call_ended",
  "data": {
    "reason": "string",
    "durationSeconds": number
  }
}

// Error
{
  "type": "error",
  "data": {
    "message": "string",
    "code": "string"
  }
}
```

### Audio Format

**Input (Client → Server):**
- Format: PCM16 (signed 16-bit little-endian)
- Sample Rate: 24000 Hz (OpenAI) or 16000 Hz (Gemini)
- Channels: Mono
- Encoding: Base64

**Output (Server → Client):**
- Format: PCM16 (signed 16-bit little-endian)
- Sample Rate: 24000 Hz (OpenAI) or 24000 Hz (Gemini)
- Channels: Mono
- Encoding: Base64

---

## Company API

### Get Call Analytics

Returns call analytics for the company.

```
GET /api/company/analytics/calls?days={number}
```

**Query Parameters:**
- `days` (optional): Number of days for analytics (default: 30, max: 365)

**Response (200 OK):**
```json
{
  "summary": {
    "totalCalls": 150,
    "completedCalls": 120,
    "failedCalls": 10,
    "successRate": 80.0,
    "averageDurationSeconds": 180,
    "totalDurationSeconds": 21600,
    "totalTurns": 1500,
    "averageTurns": 10
  },
  "dailyMetrics": [
    {
      "date": "2025-01-01",
      "totalCalls": 10,
      "completedCalls": 8,
      "failedCalls": 1,
      "averageDurationSeconds": 200
    }
  ],
  "sourceBreakdown": {
    "web": 100,
    "whatsapp": 40,
    "twilio": 10
  },
  "aiProviderBreakdown": {
    "OPENAI": 120,
    "GEMINI": 30
  },
  "statusBreakdown": {
    "completed": 120,
    "failed": 10,
    "no_answer": 5,
    "timeout": 15
  },
  "topChatbots": [
    {
      "chatbotId": "uuid",
      "chatbotName": "Support Bot",
      "totalCalls": 80,
      "averageDurationSeconds": 200
    }
  ],
  "recentCalls": [
    {
      "id": "uuid",
      "chatbotName": "Support Bot",
      "source": "web",
      "status": "completed",
      "durationSeconds": 180,
      "createdAt": "2025-01-14T10:30:00Z"
    }
  ],
  "dateRange": {
    "start": "2024-12-15",
    "end": "2025-01-14"
  }
}
```

### List Integration Accounts

Returns all integration accounts for the company.

```
GET /api/company/integration-accounts
```

**Response (200 OK):**
```json
{
  "accounts": [
    {
      "id": "uuid",
      "provider": "whatsapp | twilio | vonage | bandwidth",
      "displayName": "Main WhatsApp",
      "phoneNumber": "+1234567890",
      "isVerified": true,
      "isActive": true,
      "settings": {},
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-14T00:00:00Z"
    }
  ]
}
```

### Create Integration Account

Creates a new integration account.

```
POST /api/company/integration-accounts
```

**Request Body:**
```json
{
  "provider": "whatsapp | twilio | vonage | bandwidth",
  "displayName": "My WhatsApp Account",
  "phoneNumber": "+1234567890",
  "credentials": {
    "access_token": "string",
    "account_sid": "string (for Twilio)"
  },
  "settings": {
    "recordingEnabled": true,
    "defaultAiProvider": "OPENAI"
  }
}
```

**Response (200 OK):**
```json
{
  "account": {
    "id": "uuid",
    "provider": "whatsapp",
    "displayName": "My WhatsApp Account",
    "phoneNumber": "+1234567890",
    "isVerified": false,
    "isActive": true,
    "webhookSecret": "generated-secret",
    "settings": {},
    "createdAt": "2025-01-14T00:00:00Z"
  }
}
```

### Update Integration Account

Updates an existing integration account.

```
PATCH /api/company/integration-accounts/{id}
```

**Request Body:**
```json
{
  "displayName": "Updated Name",
  "isActive": false,
  "settings": {
    "recordingEnabled": false
  }
}
```

### Delete Integration Account

Soft deletes an integration account.

```
DELETE /api/company/integration-accounts/{id}
```

---

## WhatsApp Webhook

### Webhook Verification

Verifies webhook ownership with Meta.

```
GET /api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token={token}&hub.challenge={challenge}
```

**Response:**
- Returns `challenge` value if token matches
- Returns `403` if verification fails

### Webhook Events

Receives webhook events from WhatsApp.

```
POST /api/webhook/whatsapp
```

**Headers:**
- `x-hub-signature-256`: HMAC signature for verification

**Event Types:**

**Incoming Call:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "calls": [{
          "event": "connect",
          "call_id": "string",
          "from": "+1234567890",
          "phone_number_id": "string",
          "offer": "SDP offer string"
        }]
      }
    }]
  }]
}
```

**Call Terminated:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "calls": [{
          "event": "terminate",
          "call_id": "string",
          "reason": "string"
        }]
      }
    }]
  }]
}
```

---

## Chatbot Call Configuration

### Update Chatbot Call Settings

Updates call configuration for a chatbot.

```
PATCH /api/company/chatbots/{chatbotId}
```

**Request Body:**
```json
{
  "enabledCall": true,
  "callAiProvider": "OPENAI | GEMINI",
  "voiceConfig": {
    "openaiVoice": "alloy | ash | ballad | coral | echo | sage | shimmer | verse",
    "geminiVoice": "Kore | Aoede | Puck | Charon | Fenrir",
    "vadThreshold": 0.5,
    "silenceDurationMs": 700,
    "prefixPaddingMs": 300,
    "callGreeting": "Hello! How can I help you today?",
    "systemPromptCall": "You are a helpful assistant..."
  },
  "callWidgetConfig": {
    "enabled": true,
    "position": "bottom-right",
    "callButton": {
      "style": "orb",
      "size": "md",
      "animation": "pulse"
    },
    "orb": {
      "glowIntensity": "medium",
      "pulseSpeed": "normal"
    },
    "callDialog": {
      "width": 400,
      "showVisualizer": true
    }
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SESSION` | Session ID is invalid or expired |
| `CHATBOT_NOT_FOUND` | Chatbot does not exist or is not accessible |
| `CALLS_NOT_ENABLED` | Call feature is not enabled for this chatbot |
| `PROVIDER_ERROR` | Error from AI provider (OpenAI/Gemini) |
| `AUDIO_FORMAT_ERROR` | Invalid audio format received |
| `TIMEOUT` | Session timed out due to inactivity |
| `RATE_LIMITED` | Too many requests |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /api/widget/call/session` | 10 per minute per IP |
| WebSocket connections | 5 concurrent per IP |
| `GET /api/company/analytics/calls` | 60 per minute |

---

## Sample Integration

### Browser (JavaScript)

```javascript
// Create call session
const response = await fetch('/api/widget/call/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chatbotId: 'your-chatbot-id' })
});
const { sessionId, wsUrl } = await response.json();

// Connect WebSocket
const ws = new WebSocket(`${wsUrl}?sessionId=${sessionId}`);

// Get microphone access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext({ sampleRate: 24000 });
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

// Send audio
processor.onaudioprocess = (e) => {
  const pcm16 = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
  ws.send(JSON.stringify({
    type: 'audio_data',
    data: { audio: btoa(String.fromCharCode(...new Uint8Array(pcm16))) }
  }));
};

source.connect(processor);
processor.connect(audioContext.destination);

// Handle responses
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'audio_response') {
    playAudio(atob(message.data.audio));
  }
};

// Start call
ws.send(JSON.stringify({ type: 'start_call', data: { sessionId } }));
```

### React Hook (TypeScript)

```typescript
import { useCallSession } from '@/hooks/widget/useCallSession';

function CallComponent({ chatbotId }: { chatbotId: string }) {
  const {
    status,
    startCall,
    endCall,
    toggleMute,
    isMuted,
    transcript,
    duration
  } = useCallSession({ chatbotId });

  return (
    <div>
      <p>Status: {status}</p>
      <p>Duration: {duration}s</p>
      <button onClick={startCall} disabled={status !== 'idle'}>
        Start Call
      </button>
      <button onClick={endCall} disabled={status === 'idle'}>
        End Call
      </button>
      <button onClick={toggleMute}>
        {isMuted ? 'Unmute' : 'Mute'}
      </button>
      <div>
        {transcript.map((t, i) => (
          <p key={i}><strong>{t.role}:</strong> {t.content}</p>
        ))}
      </div>
    </div>
  );
}
```
