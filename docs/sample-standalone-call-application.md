# Sample Standalone Call Application Analysis

This document provides a comprehensive technical analysis of the voice.buzzi.ai reference implementation, which serves as the foundation for implementing call chatbots in the multi-tenant chat.buzzi.ai platform.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Audio Processing Pipeline](#2-audio-processing-pipeline)
3. [AI Provider Integration](#3-ai-provider-integration)
4. [WebSocket Protocol](#4-websocket-protocol)
5. [Web Call Flow](#5-web-call-flow)
6. [WhatsApp Call Integration](#6-whatsapp-call-integration)
7. [Voice Activity Detection & Interruption Handling](#7-voice-activity-detection--interruption-handling)
8. [Call Recording](#8-call-recording)
9. [Database Schema](#9-database-schema)
10. [Web Widget Call UI Configuration](#10-web-widget-call-ui-configuration)
11. [Key Configuration Constants](#11-key-configuration-constants)
12. [Dependencies](#12-dependencies)
13. [Environment Variables](#13-environment-variables)

---

## 1. Architecture Overview

### 1.1 Server Architecture

The voice.buzzi.ai application uses an Express + WebSocket server architecture running on Node.js with support for multiple AI providers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          voice.buzzi.ai Server                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────────┐ │
│  │  Express HTTP    │    │  WebSocket Server │    │  WhatsApp            │ │
│  │  Server          │    │  (path: /call)    │    │  Webhook Handler     │ │
│  │  - /health       │    │                   │    │  - /webhook/whatsapp │ │
│  │  - /api          │    │                   │    │                      │ │
│  └────────┬─────────┘    └─────────┬─────────┘    └────────┬─────────────┘ │
│           │                        │                        │               │
│           └────────────────────────┼────────────────────────┘               │
│                                    │                                         │
│                    ┌───────────────▼───────────────┐                        │
│                    │     CallSessionManager        │                        │
│                    │  - Session lifecycle          │                        │
│                    │  - AI service routing         │                        │
│                    │  - Event coordination         │                        │
│                    └───────────────┬───────────────┘                        │
│                                    │                                         │
│        ┌───────────────────────────┼───────────────────────────┐           │
│        │                           │                           │           │
│  ┌─────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼─────────┐ │
│  │ AI Provider    │    │                      │    │                    │ │
│  │ Factory        │    │  Audio Converter     │    │   WebRTC Service   │ │
│  │ ┌────────────┐ │    │  - PCM16/µ-law/Opus │    │   (WhatsApp)       │ │
│  │ │ OpenAI     │ │    │  - Sample rate conv │    │                    │ │
│  │ │ Realtime   │ │    │                      │    │                    │ │
│  │ ├────────────┤ │    │                      │    │                    │ │
│  │ │ Gemini     │ │    │                      │    │                    │ │
│  │ │ Live       │ │    │                      │    │                    │ │
│  │ └────────────┘ │    │                      │    │                    │ │
│  └────────────────┘    └──────────────────────┘    └────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Components

| Component | File | Purpose |
|-----------|------|---------|
| Server Entry | `src/server.js` | Express + WebSocket server setup |
| Session Manager | `src/managers/call-session.js` | Call lifecycle management |
| OpenAI Service | `src/services/openai.js` | OpenAI Realtime API integration |
| Gemini Service | `src/services/gemini.js` | Google Gemini Live API integration |
| WebRTC Service | `src/services/webrtc.js` | WhatsApp WebRTC handling |
| WhatsApp Service | `src/services/whatsapp.js` | WhatsApp Business API calls |
| Audio Converter | `src/utils/audio-converter.js` | Codec and sample rate conversion |
| WebSocket Handler | `src/handlers/websocket.js` | Browser-based calls |
| WhatsApp Handler | `src/handlers/whatsapp-call.js` | WhatsApp voice calls |
| Constants | `src/config/constants.js` | Event definitions |
| Environment | `src/config/env.js` | Provider configuration |

### 1.3 Call Flow Overview

```
Browser/WhatsApp Client
        │
        ▼
┌──────────────────┐
│ Connection Setup │
│ - WebSocket conn │
│ - SDP negotiation│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Session Creation │
│ - UUID generation│
│ - DB record      │
│ - AI provider    │
│   selection      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐         ┌────────────────────────────┐
│ Audio Streaming  │◄───────►│ AI Provider (selectable)   │
│ - Codec convert  │         │ ┌────────────────────────┐ │
│ - Sample rate    │         │ │ OpenAI Realtime API    │ │
│ - Real-time      │         │ │ - PCM16 @ 24kHz        │ │
│                  │         │ │ - server_vad           │ │
│                  │         │ ├────────────────────────┤ │
│                  │         │ │ Gemini Live API        │ │
│                  │         │ │ - PCM16 @ 16kHz input  │ │
│                  │         │ │ - 24kHz output         │ │
│                  │         │ │ - automatic activity   │ │
│                  │         │ │   detection            │ │
│                  │         │ └────────────────────────┘ │
└────────┬─────────┘         └────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Call Termination │
│ - Recording save │
│ - DB update      │
│ - Summary email  │
└──────────────────┘
```

---

## 2. Audio Processing Pipeline

### 2.1 Audio Format Requirements by Provider

| Platform/Provider | Codec | Input Sample Rate | Output Sample Rate | Channels | Format |
|-------------------|-------|-------------------|-------------------|----------|--------|
| **OpenAI Realtime API** | PCM16 | 24,000 Hz | 24,000 Hz | Mono | base64 encoded |
| **Gemini Live API** | PCM16 | 16,000 Hz | 24,000 Hz | Mono | base64 encoded |
| WebSocket Browser | PCM16 | 24,000 Hz | 24,000 Hz | Mono | base64 encoded |
| WhatsApp WebRTC | Opus → PCM16 | 48,000 Hz | 48,000 Hz | Stereo | RTP packets |
| Twilio Media Stream | G.711 µ-law | 8,000 Hz | 8,000 Hz | Mono | base64 encoded |

### 2.2 Conversion Functions

The audio converter (`src/utils/audio-converter.js`) handles bidirectional conversions:

#### 2.2.1 G.711 µ-law Conversion

```javascript
// µ-law to PCM16 conversion
function mulawToPCM16(mulawData) {
  const pcm16 = Buffer.alloc(mulawData.length * 2);
  const mulawTable = generateMulawTable();

  for (let i = 0; i < mulawData.length; i++) {
    const sample = mulawTable[mulawData[i]];
    pcm16.writeInt16LE(sample, i * 2);
  }

  return pcm16;
}

// PCM16 to µ-law conversion
function pcm16ToMulaw(pcm16Data) {
  const mulaw = Buffer.alloc(pcm16Data.length / 2);

  for (let i = 0; i < mulaw.length; i++) {
    const sample = pcm16Data.readInt16LE(i * 2);
    mulaw[i] = linearToMulaw(sample);
  }

  return mulaw;
}
```

#### 2.2.2 Opus Codec Handling

Uses `@discordjs/opus` library:

```javascript
const { OpusEncoder } = require('@discordjs/opus');

// Decode Opus to PCM16
function decodeOpus(opusData, sampleRate = 48000) {
  const decoder = new OpusEncoder(sampleRate, 2); // stereo
  const pcmData = decoder.decode(opusData);

  // Convert Float32Array to Int16 Buffer
  const pcm16 = Buffer.alloc(pcmData.length * 2);
  for (let i = 0; i < pcmData.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcmData[i]));
    pcm16.writeInt16LE(Math.floor(sample * 32767), i * 2);
  }

  return pcm16;
}

// Encode PCM16 to Opus
function encodeOpus(pcm16Data, sampleRate = 48000) {
  const FRAME_DURATION_MS = 20;
  const samplesPerFrame = Math.floor((sampleRate * FRAME_DURATION_MS) / 1000);
  const bytesPerFrame = samplesPerFrame * 2;

  const encoder = new OpusEncoder(sampleRate, 2);
  const chunks = [];

  for (let offset = 0; offset < pcm16Data.length; offset += bytesPerFrame) {
    const chunk = pcm16Data.slice(offset, offset + bytesPerFrame);
    if (chunk.length === bytesPerFrame) {
      // Convert to Float32Array for encoder
      const samples = new Float32Array(samplesPerFrame);
      for (let i = 0; i < samplesPerFrame; i++) {
        samples[i] = chunk.readInt16LE(i * 2) / 32768.0;
      }
      const opusFrame = encoder.encode(samples);
      chunks.push(Buffer.from(opusFrame));
    }
  }

  return Buffer.concat(chunks);
}
```

#### 2.2.3 Sample Rate Conversion

Uses `@alexanderolsen/libsamplerate-js` for high-quality resampling:

```javascript
const LibSampleRate = require('@alexanderolsen/libsamplerate-js');

async function resamplePCM16(pcm16Data, inputRate, outputRate) {
  if (inputRate === outputRate) return pcm16Data;

  const src = await LibSampleRate.create(1, inputRate, outputRate, {
    converterType: LibSampleRate.ConverterType.SRC_SINC_FASTEST
  });

  // Convert Buffer to Float32Array
  const inputFloats = new Float32Array(pcm16Data.length / 2);
  for (let i = 0; i < inputFloats.length; i++) {
    inputFloats[i] = pcm16Data.readInt16LE(i * 2) / 32768.0;
  }

  const resampledFloats = src.simple(inputFloats);

  // Convert back to Buffer
  const outputBuffer = Buffer.alloc(resampledFloats.length * 2);
  for (let i = 0; i < resampledFloats.length; i++) {
    let sample = Math.max(-1, Math.min(1, resampledFloats[i]));
    outputBuffer.writeInt16LE(Math.floor(sample * 32767), i * 2);
  }

  return outputBuffer;
}
```

### 2.3 Conversion Pipeline by Provider

#### Browser → OpenAI (Web Widget)

```
Browser MediaRecorder (PCM16 @ 48kHz)
         │
         ▼ [Resample 48kHz → 24kHz]
    PCM16 @ 24kHz
         │
         ▼ [base64 encode]
    WebSocket message
         │
         ▼
    OpenAI Realtime API (24kHz)
```

#### Browser → Gemini (Web Widget)

```
Browser MediaRecorder (PCM16 @ 48kHz)
         │
         ▼ [Resample 48kHz → 16kHz]
    PCM16 @ 16kHz
         │
         ▼ [base64 encode]
    Gemini Live API (16kHz input)
         │
         ▼ [Response: 24kHz output]
    PCM16 @ 24kHz
         │
         ▼ [Resample 24kHz → 48kHz]
    Browser playback
```

#### WhatsApp → OpenAI

```
WhatsApp Phone
         │
         ▼ [WebRTC]
    RTCAudioSink (PCM16 @ 48kHz stereo)
         │
         ▼ [Stereo → Mono]
    PCM16 @ 48kHz mono
         │
         ▼ [Resample 48kHz → 24kHz]
    PCM16 @ 24kHz mono
         │
         ▼ [base64 encode]
    OpenAI Realtime API
```

#### WhatsApp → Gemini

```
WhatsApp Phone
         │
         ▼ [WebRTC]
    RTCAudioSink (PCM16 @ 48kHz stereo)
         │
         ▼ [Stereo → Mono]
    PCM16 @ 48kHz mono
         │
         ▼ [Resample 48kHz → 16kHz]
    PCM16 @ 16kHz mono
         │
         ▼ [base64 encode]
    Gemini Live API
```

#### OpenAI → WhatsApp

```
OpenAI Realtime API
         │
         ▼ [base64 decode]
    PCM16 @ 24kHz mono
         │
         ▼ [Resample 24kHz → 48kHz]
    PCM16 @ 48kHz mono
         │
         ▼ [Mono → Stereo (duplicate)]
    PCM16 @ 48kHz stereo
         │
         ▼ [AudioQueue pacing - 10ms chunks]
    RTCAudioSource
         │
         ▼ [WebRTC RTP]
    WhatsApp Phone
```

---

## 3. AI Provider Integration

### 3.1 Provider Selection Configuration

The system supports multiple AI providers, selectable per call source:

```javascript
// src/config/env.js

const config = {
  // AI Provider Selection (per source)
  aiProvider: {
    web: process.env.WEB_CALL_AI || 'OPENAI',       // OPENAI or GEMINI
    whatsapp: process.env.WHATSAPP_CALL_AI || 'OPENAI'
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-realtime-2025-08-28',
    voice: process.env.OPENAI_VOICE || 'ash',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4096
  },

  // Gemini Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-native-audio-preview-09-2025',
    voice: process.env.GEMINI_VOICE || 'Kore'
  }
};
```

### 3.2 Voice Configuration by Provider

#### VoiceConfig Interface

```typescript
interface VoiceConfig {
  // Provider selection
  provider: 'OPENAI' | 'GEMINI';

  // Voice selection (provider-specific)
  voice: string;

  // Voice Activity Detection settings
  vad: {
    // OpenAI: 0.0 (sensitive) to 1.0 (less sensitive)
    // Gemini: LOW, MEDIUM, HIGH sensitivity
    threshold?: number | 'START_SENSITIVITY_LOW' | 'START_SENSITIVITY_MEDIUM' | 'START_SENSITIVITY_HIGH';

    // Milliseconds of silence before turn ends
    silence_duration_ms?: number;

    // Milliseconds of audio captured before speech detection
    prefix_padding_ms?: number;

    // Gemini-specific: end of speech sensitivity
    end_of_speech_sensitivity?: 'END_SENSITIVITY_LOW' | 'END_SENSITIVITY_MEDIUM' | 'END_SENSITIVITY_HIGH';
  };

  // Model settings
  temperature?: number;
  max_tokens?: number;
}
```

#### Available Voices

| Provider | Voice Options | Default |
|----------|--------------|---------|
| **OpenAI** | `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar` | `ash` |
| **Gemini** | `Kore`, `Aoede`, `Puck`, `Charon`, `Fenrir` | `Kore` |

### 3.3 OpenAI Realtime API Integration

#### Connection Setup

```javascript
// src/services/openai.js

const url = 'wss://api.openai.com/v1/realtime?model=' + config.openai.model;

this.ws = new WebSocket(url, {
  headers: {
    'Authorization': `Bearer ${config.openai.apiKey}`,
    'OpenAI-Beta': 'realtime=v1'
  }
});
```

#### Session Configuration

```javascript
const sessionConfig = {
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    instructions: this.instructions,          // System prompt
    voice: config.openai.voice,               // 'alloy', 'ash', etc.
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_transcription: {
      model: 'whisper-1'
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,                         // VAD sensitivity (0.0 - 1.0)
      prefix_padding_ms: 300,                 // Capture speech start
      silence_duration_ms: 700                // Wait before end of turn
    },
    tools: this.defineFunctions(),            // Function calling tools
    tool_choice: 'auto',
    temperature: config.openai.temperature,
    max_response_output_tokens: config.openai.maxTokens
  }
};
```

#### Key Events

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `session.update` | Client → OpenAI | Configure session settings |
| `input_audio_buffer.append` | Client → OpenAI | Send audio chunk |
| `input_audio_buffer.commit` | Client → OpenAI | Force processing |
| `response.create` | Client → OpenAI | Trigger response |
| `response.cancel` | Client → OpenAI | Cancel current response |
| `session.created` | OpenAI → Client | Session initialized |
| `response.audio.delta` | OpenAI → Client | Audio chunk from agent |
| `response.audio_transcript.delta` | OpenAI → Client | Transcript chunk |
| `input_audio_buffer.speech_started` | OpenAI → Client | User started speaking |
| `input_audio_buffer.speech_stopped` | OpenAI → Client | User stopped speaking |
| `response.function_call_arguments.done` | OpenAI → Client | Function call ready |

### 3.4 Gemini Live API Integration

#### Connection Setup

```javascript
// src/services/gemini.js

const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });

// Connect to live streaming
this.session = await genAI.live.connect({
  model: config.gemini.model,
  config: this.buildSessionConfig()
});
```

#### Session Configuration

```javascript
buildSessionConfig() {
  return {
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: config.gemini.voice  // 'Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'
        }
      }
    },
    // Voice Activity Detection
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_MEDIUM',  // LOW, MEDIUM, HIGH
        endOfSpeechSensitivity: 'END_SENSITIVITY_MEDIUM',       // LOW, MEDIUM, HIGH
        prefixPaddingMs: 300,
        silenceDurationMs: 700
      }
    },
    systemInstruction: {
      parts: [{ text: this.instructions }]
    },
    tools: this.buildTools()
  };
}
```

#### Audio Format Difference

| Aspect | OpenAI | Gemini |
|--------|--------|--------|
| Input sample rate | 24 kHz | 16 kHz |
| Output sample rate | 24 kHz | 24 kHz |
| Audio format | PCM16 little-endian | PCM16 little-endian |
| Encoding | base64 | base64 |

#### Sending Audio to Gemini

```javascript
async sendAudio(audioBuffer) {
  if (!this.session) return;

  // Audio must be 16kHz for Gemini input
  await this.session.sendRealtimeInput({
    mediaChunks: [{
      mimeType: 'audio/pcm;rate=16000',
      data: audioBuffer.toString('base64')
    }]
  });
}
```

#### Receiving Audio from Gemini

```javascript
// Listen for server events
this.session.on('serverContent', (content) => {
  if (content.modelTurn?.parts) {
    for (const part of content.modelTurn.parts) {
      if (part.inlineData?.mimeType?.startsWith('audio/')) {
        // Audio is 24kHz output
        const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
        this.handlers.onAudioResponse({ audio: audioBuffer });
      }
      if (part.text) {
        this.handlers.onTranscript({ text: part.text, role: 'assistant' });
      }
    }
  }
});
```

### 3.5 Function Calling Comparison

#### OpenAI Format

```javascript
// OpenAI tool definition
{
  type: 'function',
  name: 'save_customer_info',
  description: 'Save customer contact information',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Customer full name' },
      email: { type: 'string', description: 'Customer email' }
    },
    required: ['name', 'email']
  }
}

// OpenAI function call response
{
  type: 'conversation.item.create',
  item: {
    type: 'function_call_output',
    call_id: message.call_id,
    output: JSON.stringify(result)
  }
}
```

#### Gemini Format

```javascript
// Gemini tool definition
{
  functionDeclarations: [{
    name: 'save_customer_info',
    description: 'Save customer contact information',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name' },
        email: { type: 'string', description: 'Customer email' }
      },
      required: ['name', 'email']
    }
  }]
}

// Gemini function call response
await session.sendToolResponse({
  functionResponses: [{
    id: functionCall.id,
    name: functionCall.name,
    response: { result: JSON.stringify(result) }
  }]
});
```

---

## 4. WebSocket Protocol

### 4.1 Connection URL

```
wss://{host}/call
```

### 4.2 Client → Server Messages

```typescript
// Start call
{
  type: 'start_call',
  data: {
    name?: string,    // Optional caller name
    email?: string,   // Optional caller email
    chatbotId?: string,    // Target chatbot (multi-tenant)
    companyId?: string     // Company context (multi-tenant)
  }
}

// Audio data (PCM16, sample rate depends on provider)
{
  type: 'audio_data',
  data: {
    audio: string     // base64 encoded PCM16 audio
  }
}

// End call
{
  type: 'end_call',
  data: {
    reason?: string   // Optional end reason
  }
}
```

### 4.3 Server → Client Messages

```typescript
// Call started confirmation
{
  type: 'call_started',
  data: {
    sessionId: string,
    callId: number,
    message: string,
    aiProvider: 'OPENAI' | 'GEMINI'
  }
}

// Audio response (PCM16, sample rate depends on provider)
{
  type: 'audio_response',
  data: {
    audio: string     // base64 encoded PCM16 audio
  }
}

// Transcript
{
  type: 'transcript',
  data: {
    text: string,
    role: 'assistant' | 'user'
  }
}

// Agent speaking status
{
  type: 'agent_speaking',
  data: {
    timestamp: string
  }
}

// Agent listening status
{
  type: 'agent_listening',
  data: {
    timestamp: string
  }
}

// Stop audio (interruption)
{
  type: 'stop_audio',
  data: {
    reason: 'user_interrupted',
    interruptionCount: number,
    timestamp: string
  }
}

// Call ended
{
  type: 'call_ended',
  data: {
    reason: string,
    callId: number,
    duration: number
  }
}

// Error
{
  type: 'error',
  data: {
    code: string,
    message: string,
    timestamp: string
  }
}
```

---

## 5. Web Call Flow

### 5.1 Complete Web Call Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WEB CALL FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐                    ┌──────────────────┐                    ┌─────────────────┐
│   Browser    │                    │  Call Server     │                    │   AI Provider   │
│   Widget     │                    │  (WebSocket)     │                    │  (OpenAI/Gemini)│
└──────┬───────┘                    └────────┬─────────┘                    └────────┬────────┘
       │                                     │                                        │
       │  1. User clicks "Start Call"        │                                        │
       │─────────────────────────────────────►                                        │
       │  WebSocket connect: wss://host/call │                                        │
       │                                     │                                        │
       │  2. Send start_call                 │                                        │
       │────────────────────────────────────►│                                        │
       │  { type: 'start_call',              │                                        │
       │    data: { name, email,             │                                        │
       │            chatbotId, companyId }}  │                                        │
       │                                     │                                        │
       │                                     │  3. Create session                     │
       │                                     │  - Generate sessionId (UUID)           │
       │                                     │  - Load chatbot config                 │
       │                                     │  - Select AI provider                  │
       │                                     │                                        │
       │                                     │  4. Connect to AI Provider             │
       │                                     │─────────────────────────────────────────►
       │                                     │  OpenAI: WebSocket to realtime API     │
       │                                     │  Gemini: SDK live.connect()            │
       │                                     │                                        │
       │                                     │  5. Configure session                  │
       │                                     │────────────────────────────────────────►
       │                                     │  - System prompt                       │
       │                                     │  - Voice selection                     │
       │                                     │  - VAD settings                        │
       │                                     │  - Tools/functions                     │
       │                                     │                                        │
       │                                     │◄────────────────────────────────────────
       │                                     │  Session confirmed                     │
       │                                     │                                        │
       │  6. call_started response           │                                        │
       │◄────────────────────────────────────│                                        │
       │  { sessionId, aiProvider }          │                                        │
       │                                     │                                        │
       │                                     │  7. Trigger initial greeting           │
       │                                     │────────────────────────────────────────►
       │                                     │  Inject "Hello" to start conversation  │
       │                                     │                                        │
       │                                     │◄────────────────────────────────────────
       │  8. audio_response (greeting)       │  Audio response (greeting)             │
       │◄────────────────────────────────────│                                        │
       │                                     │                                        │
       │  9. User speaks (captured audio)    │                                        │
       │────────────────────────────────────►│                                        │
       │  { type: 'audio_data',              │  10. Forward to AI                     │
       │    data: { audio: base64 }}         │────────────────────────────────────────►
       │                                     │  Resample if needed:                   │
       │                                     │  - OpenAI: 24kHz                       │
       │                                     │  - Gemini: 16kHz                       │
       │                                     │                                        │
       │                                     │  11. VAD detects speech end            │
       │                                     │◄────────────────────────────────────────
       │                                     │  speech_started / speech_stopped       │
       │                                     │                                        │
       │                                     │◄────────────────────────────────────────
       │  12. audio_response (AI reply)      │  Audio response                        │
       │◄────────────────────────────────────│                                        │
       │                                     │                                        │
       │  13. transcript                     │                                        │
       │◄────────────────────────────────────│                                        │
       │  { text, role: 'assistant' }        │                                        │
       │                                     │                                        │
       │         ... conversation continues ...                                       │
       │                                     │                                        │
       │  14. User ends call                 │                                        │
       │────────────────────────────────────►│                                        │
       │  { type: 'end_call' }               │  15. Disconnect AI                     │
       │                                     │────────────────────────────────────────►
       │                                     │                                        │
       │                                     │  16. Save recording (if enabled)       │
       │                                     │  17. Update DB with duration           │
       │                                     │                                        │
       │  18. call_ended                     │                                        │
       │◄────────────────────────────────────│                                        │
       │  { reason, duration }               │                                        │
       │                                     │                                        │
       ▼                                     ▼                                        ▼
```

### 5.2 Browser Audio Capture

```javascript
// Initialize audio capture in browser
async function startAudioCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 48000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const audioContext = new AudioContext({ sampleRate: 48000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);

    // Convert Float32 to Int16
    const int16Data = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
    }

    // Resample 48kHz → 24kHz (or 16kHz for Gemini)
    const resampled = resample(int16Data, 48000, targetSampleRate);

    // Send via WebSocket
    ws.send(JSON.stringify({
      type: 'audio_data',
      data: { audio: btoa(String.fromCharCode(...new Uint8Array(resampled.buffer))) }
    }));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}
```

### 5.3 Browser Audio Playback

```javascript
// Audio playback queue
class AudioPlayer {
  constructor(sampleRate = 24000) {
    this.audioContext = new AudioContext({ sampleRate });
    this.queue = [];
    this.isPlaying = false;
  }

  enqueue(base64Audio) {
    const buffer = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
    const int16 = new Int16Array(buffer.buffer);

    // Convert to Float32 for Web Audio
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    this.queue.push(float32);
    if (!this.isPlaying) this.playNext();
  }

  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const samples = this.queue.shift();

    const audioBuffer = this.audioContext.createBuffer(1, samples.length, this.audioContext.sampleRate);
    audioBuffer.getChannelData(0).set(samples);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.onended = () => this.playNext();
    source.start();
  }

  clear() {
    this.queue = [];
  }
}
```

---

## 6. WhatsApp Call Integration

### 6.1 WhatsApp Webhook Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WHATSAPP CALL WEBHOOK FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌───────────────────┐          ┌──────────────────┐
│   WhatsApp   │          │   Call Server     │          │   AI Provider    │
│   Cloud API  │          │   (Webhook)       │          │  (OpenAI/Gemini) │
└──────┬───────┘          └────────┬──────────┘          └────────┬─────────┘
       │                           │                               │
       │  1. Incoming call         │                               │
       │──────────────────────────►│                               │
       │  POST /webhook/whatsapp   │                               │
       │  {                        │                               │
       │    entry: [{              │                               │
       │      changes: [{          │                               │
       │        value: {           │                               │
       │          messaging_product│                               │
       │          metadata,        │                               │
       │          calls: [{        │                               │
       │            from,          │                               │
       │            id: callId,    │                               │
       │            event,         │                               │
       │            session: {     │                               │
       │              sdp          │◄──── SDP Offer                │
       │            }              │                               │
       │          }]               │                               │
       │        }                  │                               │
       │      }]                   │                               │
       │    }]                     │                               │
       │  }                        │                               │
       │                           │                               │
       │                           │  2. Validate webhook          │
       │                           │  - Check signature            │
       │                           │  - Parse call event           │
       │                           │                               │
       │                           │  3. Check event type          │
       │                           │  - 'connect': New call        │
       │                           │  - 'terminate': Call ended    │
       │                           │                               │
       │                           │  4. Create/get session        │
       │                           │  - Generate sessionId         │
       │                           │  - Store call metadata        │
       │                           │                               │
       │                           │  5. Setup WebRTC              │
       │                           │  - Parse SDP offer            │
       │                           │  - Create RTCPeerConnection   │
       │                           │  - Set remote description     │
       │                           │  - Create answer SDP          │
       │                           │    (MUST use setup:active)    │
       │                           │                               │
       │  6. Answer call (SDP)     │                               │
       │◄──────────────────────────│                               │
       │  POST /v21.0/{phone_id}/  │                               │
       │        calls/{call_id}    │                               │
       │  {                        │                               │
       │    action: "accept",      │                               │
       │    session: {             │                               │
       │      sdp: "v=0\r\n..."    │◄──── SDP Answer               │
       │    }                      │                               │
       │  }                        │                               │
       │                           │                               │
       │  7. ICE negotiation       │                               │
       │◄─────────────────────────►│                               │
       │  ICE candidates exchange  │                               │
       │                           │                               │
       │  8. Media established     │                               │
       │══════════════════════════►│                               │
       │  RTP audio (Opus 48kHz)   │                               │
       │                           │                               │
       │                           │  9. Connect to AI Provider    │
       │                           │─────────────────────────────────►
       │                           │  Configure session, voice     │
       │                           │                               │
       │                           │  10. Audio pipeline           │
       │══════════════════════════►│  - RTCAudioSink receives     │
       │  Caller audio             │  - Opus → PCM16              │
       │                           │  - 48kHz → 24/16kHz          │
       │                           │─────────────────────────────────►
       │                           │  Forward to AI               │
       │                           │                               │
       │                           │◄─────────────────────────────────
       │                           │  AI audio response           │
       │◄══════════════════════════│  - PCM16 → 48kHz            │
       │  AI response audio        │  - mono → stereo            │
       │  (RTCAudioSource)         │  - AudioQueue pacing        │
       │                           │                               │
       │         ... conversation continues ...                    │
       │                           │                               │
       │  11. Call terminated      │                               │
       │──────────────────────────►│                               │
       │  event: 'terminate'       │  12. Cleanup                  │
       │                           │  - Close WebRTC              │
       │                           │  - Disconnect AI             │
       │                           │  - Save recording            │
       │                           │                               │
       ▼                           ▼                               ▼
```

### 6.2 Webhook Handler Implementation

```javascript
// src/routes/webhooks.js

router.post('/webhook/whatsapp', async (req, res) => {
  // 1. Validate webhook signature
  const signature = req.headers['x-hub-signature-256'];
  const isValid = validateSignature(req.body, signature, WHATSAPP_APP_SECRET);

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // 2. Process webhook entries
  const entries = req.body.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      const value = change.value;

      // Check for call events
      if (value.calls && value.calls.length > 0) {
        for (const call of value.calls) {
          await processCallEvent(call, value.metadata);
        }
      }
    }
  }

  // 3. Always respond quickly (WhatsApp expects fast response)
  res.status(200).send('OK');
});

async function processCallEvent(call, metadata) {
  const { from, id: callId, event, timestamp, session } = call;
  const phoneNumberId = metadata.phone_number_id;

  console.log(`[WhatsApp] Call event: ${event} from ${from}`);

  // Determine if this is a connect event (multiple formats supported)
  const isConnectEvent = event === 'connect' || event === 'CONNECT';
  const isTerminateEvent = event === 'terminate' || event === 'TERMINATE';

  if (isConnectEvent) {
    // New incoming call
    const sdpOffer = session?.sdp;

    if (!sdpOffer) {
      console.error('[WhatsApp] No SDP offer in connect event');
      return;
    }

    await handleIncomingCall({
      callId,
      from,
      phoneNumberId,
      sdpOffer,
      timestamp
    });

  } else if (isTerminateEvent) {
    // Call ended
    await handleCallTermination({
      callId,
      from,
      reason: call.reason || 'unknown'
    });
  }
}
```

### 6.3 SDP Answer Requirements

WhatsApp requires specific SDP answer format:

```javascript
// src/services/webrtc.js

// CRITICAL: WhatsApp requires setup:active in SDP answer
function createSDPAnswer(sdpOffer) {
  const parsedOffer = sdpTransform.parse(sdpOffer);

  // Find Opus codec in offer
  const audioMedia = parsedOffer.media.find(m => m.type === 'audio');
  const opusCodec = audioMedia.rtp.find(r => r.codec.toLowerCase() === 'opus');

  if (!opusCodec) {
    throw new Error('Opus codec not found in offer');
  }

  // Build answer SDP
  const answer = {
    version: 0,
    origin: {
      username: '-',
      sessionId: Date.now(),
      sessionVersion: 2,
      netType: 'IN',
      ipVer: 4,
      address: '127.0.0.1'
    },
    name: '-',
    timing: { start: 0, stop: 0 },
    media: [{
      type: 'audio',
      port: 9,
      protocol: 'UDP/TLS/RTP/SAVPF',
      payloads: opusCodec.payload,
      rtp: [opusCodec],
      direction: 'sendrecv',

      // CRITICAL FOR WHATSAPP
      setup: 'active',  // MUST be 'active' in response to 'actpass'

      // ICE and DTLS from offer
      iceUfrag: audioMedia.iceUfrag,
      icePwd: audioMedia.icePwd,
      fingerprint: audioMedia.fingerprint,
      // ... other required fields
    }]
  };

  return sdpTransform.write(answer);
}
```

### 6.4 WhatsApp API - Answering Calls

```javascript
// src/services/whatsapp.js

async function answerCall(phoneNumberId, callId, sdpAnswer) {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/calls/${callId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'accept',
      session: {
        sdp: sdpAnswer
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to answer call: ${JSON.stringify(error)}`);
  }

  return response.json();
}
```

### 6.5 WebRTC Peer Connection

```javascript
// src/services/webrtc.js

async function setupWebRTC(sdpOffer, onAudioReceived) {
  // Create peer connection
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  // Handle incoming audio track
  pc.ontrack = (event) => {
    if (event.track.kind === 'audio') {
      const audioSink = new RTCAudioSink(event.track);

      audioSink.ondata = (data) => {
        // data.samples: Int16Array (PCM16)
        // data.sampleRate: 48000
        // data.channelCount: 2 (stereo)

        const buffer = Buffer.from(
          data.samples.buffer,
          data.samples.byteOffset,
          data.samples.byteLength
        );

        onAudioReceived(buffer, data.sampleRate, data.channelCount);
      };
    }
  };

  // Set remote description (WhatsApp's offer)
  await pc.setRemoteDescription(new RTCSessionDescription({
    type: 'offer',
    sdp: sdpOffer
  }));

  // Create audio source for sending AI responses
  const audioSource = new wrtc.nonstandard.RTCAudioSource();
  const track = audioSource.createTrack();
  pc.addTrack(track);

  // Create and set answer
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  return {
    peerConnection: pc,
    audioSource,
    sdpAnswer: pc.localDescription.sdp
  };
}
```

### 6.6 Audio Queue for WhatsApp

```javascript
// Critical for smooth audio playback - sends 10ms chunks at real-time rate
class AudioQueue {
  constructor(audioSource) {
    this.audioSource = audioSource;
    this.buffer = Buffer.alloc(0);

    // Constants for 48kHz Stereo (WhatsApp requirement)
    this.SAMPLE_RATE = 48000;
    this.CHANNEL_COUNT = 2;
    this.CHUNK_DURATION_MS = 10;
    this.SAMPLES_PER_CHUNK = 480;     // (48000 * 10) / 1000
    this.BYTES_PER_CHUNK = 1920;      // 480 * 2 channels * 2 bytes

    // Start 10ms interval
    this.interval = setInterval(() => this.tick(), 10);
  }

  enqueue(pcm16Data) {
    this.buffer = Buffer.concat([this.buffer, pcm16Data]);
  }

  tick() {
    if (this.buffer.length < this.BYTES_PER_CHUNK) return;

    const chunk = this.buffer.slice(0, this.BYTES_PER_CHUNK);
    this.buffer = this.buffer.slice(this.BYTES_PER_CHUNK);

    // Convert to Int16Array for WebRTC
    const samples = new Int16Array(this.SAMPLES_PER_CHUNK * this.CHANNEL_COUNT);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = chunk.readInt16LE(i * 2);
    }

    // Send to WebRTC
    this.audioSource.onData({
      samples,
      sampleRate: this.SAMPLE_RATE,
      bitsPerSample: 16,
      channelCount: this.CHANNEL_COUNT,
      numberOfFrames: this.SAMPLES_PER_CHUNK
    });
  }

  clear() {
    this.buffer = Buffer.alloc(0);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

---

## 7. Voice Activity Detection & Interruption Handling

### 7.1 VAD Configuration by Provider

#### OpenAI VAD

```javascript
turn_detection: {
  type: 'server_vad',
  threshold: 0.5,              // 0.0 (sensitive) to 1.0 (less sensitive)
  prefix_padding_ms: 300,      // Audio before speech detection
  silence_duration_ms: 700     // Silence before turn ends
}
```

#### Gemini VAD

```javascript
realtimeInputConfig: {
  automaticActivityDetection: {
    disabled: false,
    startOfSpeechSensitivity: 'START_SENSITIVITY_MEDIUM',  // LOW, MEDIUM, HIGH
    endOfSpeechSensitivity: 'END_SENSITIVITY_MEDIUM',       // LOW, MEDIUM, HIGH
    prefixPaddingMs: 300,
    silenceDurationMs: 700
  }
}
```

### 7.2 VAD Sensitivity Mapping

| Setting | OpenAI (threshold) | Gemini (sensitivity) |
|---------|-------------------|---------------------|
| Very Sensitive | 0.2 - 0.3 | `START_SENSITIVITY_HIGH` |
| Normal | 0.5 | `START_SENSITIVITY_MEDIUM` |
| Less Sensitive | 0.7 - 0.8 | `START_SENSITIVITY_LOW` |

### 7.3 Interruption Detection

```javascript
// Track agent speaking state
this.isSpeaking = false;
this.currentResponseId = null;

// On response created (OpenAI)
case 'response.created':
  this.currentResponseId = message.response?.id;
  this.isSpeaking = true;
  break;

// On response done
case 'response.done':
  this.isSpeaking = false;
  this.currentResponseId = null;
  break;

// On user speech started
case 'input_audio_buffer.speech_started':
  if (this.isSpeaking) {
    // User interrupted!
    this.cancelCurrentResponse();

    this.handlers.onUserInterrupted({
      timestamp: Date.now(),
      interruptionCount: ++this.interruptionCount
    });
  }
  break;
```

### 7.4 Response Cancellation

```javascript
cancelCurrentResponse() {
  if (!this.isConnected) return;

  // OpenAI
  if (this.provider === 'OPENAI' && this.currentResponseId) {
    this.send({ type: 'response.cancel' });
  }

  // Gemini - interrupt by sending empty audio or new input
  if (this.provider === 'GEMINI') {
    // Gemini automatically handles interruption
  }

  this.isSpeaking = false;
  this.currentResponseId = null;
}
```

### 7.5 Silence Timeout

```javascript
// 3-minute silence timeout to end inactive calls
startSilenceMonitoring() {
  this.lastUserSpeechTime = Date.now();
  this.SILENCE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

  this.silenceCheckInterval = setInterval(() => {
    const silenceDuration = Date.now() - this.lastUserSpeechTime;

    if (silenceDuration >= this.SILENCE_TIMEOUT_MS) {
      this.handlers.onSilenceTimeout({ silenceDuration });
    }
  }, 30000); // Check every 30 seconds
}
```

---

## 8. Call Recording

### 8.1 Recording Structure

Audio chunks are collected during the call and saved as WAV files.

```javascript
// Start recording
recordingManager.startRecording(callId);

// Add audio chunks (both user and assistant)
recordingManager.addChunk(callId, audioBuffer, role);

// Stop and save
const recordingUrl = await recordingManager.stopRecording(callId);
```

### 8.2 WAV File Generation

```javascript
function createWavFile(audioChunks, sampleRate = 24000) {
  const data = Buffer.concat(audioChunks);
  const channels = 1;
  const bitsPerSample = 16;

  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // Chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  header.writeUInt16LE(channels * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}
```

### 8.3 Storage Upload

```javascript
// Upload to Supabase Storage
const { data, error } = await supabase.storage
  .from('recordings')
  .upload(`calls/${callId}.wav`, wavBuffer, {
    contentType: 'audio/wav'
  });

// Get public URL
const { data: urlData } = supabase.storage
  .from('recordings')
  .getPublicUrl(`calls/${callId}.wav`);
```

---

## 9. Database Schema

### 9.1 Integration Accounts (Unified Provider Table)

A single table for all external integrations (WhatsApp, Twilio, future providers):

```sql
CREATE TABLE chatapp.integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,

  -- Integration type
  provider VARCHAR(50) NOT NULL,  -- 'whatsapp', 'twilio', 'vonage', etc.

  -- Display info
  display_name VARCHAR(255),
  description TEXT,

  -- Common fields
  phone_number VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Provider-specific credentials and config (encrypted as needed)
  credentials JSONB NOT NULL DEFAULT '{}',
  /*
    WhatsApp example:
    {
      "business_account_id": "123456789",
      "phone_number_id": "987654321",
      "access_token": "encrypted_token",
      "webhook_verify_token": "verify_token"
    }

    Twilio example:
    {
      "account_sid": "ACxxxx",
      "auth_token": "encrypted_token",
      "phone_number_sid": "PNxxxx"
    }
  */

  -- Provider-specific settings
  settings JSONB DEFAULT '{}',
  /*
    Example:
    {
      "webhook_url": "https://...",
      "default_ai_provider": "OPENAI",
      "recording_enabled": true
    }
  */

  -- Webhook configuration (for providers that support it)
  webhook_secret VARCHAR(255),
  webhook_url VARCHAR(500),

  -- Usage tracking
  last_used_at TIMESTAMP,
  total_calls INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Constraints
  UNIQUE(provider, phone_number),
  CONSTRAINT valid_provider CHECK (provider IN ('whatsapp', 'twilio', 'vonage', 'bandwidth'))
);

-- Index for fast lookups
CREATE INDEX idx_integration_accounts_company ON chatapp.integration_accounts(company_id);
CREATE INDEX idx_integration_accounts_provider ON chatapp.integration_accounts(provider);
CREATE INDEX idx_integration_accounts_phone ON chatapp.integration_accounts(phone_number);
```

### 9.2 Call Sessions

```sql
CREATE TABLE chatapp.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chatapp.conversations(id) ON DELETE CASCADE,
  chatbot_id UUID NOT NULL REFERENCES chatapp.chatbots(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES chatapp.companies(id) ON DELETE CASCADE,

  -- Call metadata
  source VARCHAR(50) NOT NULL,  -- 'web', 'whatsapp', 'twilio'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  ai_provider VARCHAR(50) NOT NULL,  -- 'OPENAI', 'GEMINI'

  -- Integration reference
  integration_account_id UUID REFERENCES chatapp.integration_accounts(id),

  -- External references (provider-specific IDs grouped in JSONB)
  external_refs JSONB DEFAULT '{}',
  /*
    WhatsApp example:
    {
      "call_id": "wamid.xxx",
      "from_number": "+1234567890",
      "phone_number_id": "123456"
    }

    Twilio example:
    {
      "call_sid": "CAxxxx",
      "from_number": "+1234567890",
      "to_number": "+0987654321",
      "account_sid": "ACxxxx"
    }

    Web example:
    {
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1"
    }
  */

  -- Caller info (collected during call)
  caller_info JSONB DEFAULT '{}',
  /*
    {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "company": "Acme Inc"
    }
  */

  -- Timing
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Recording
  recording_url VARCHAR(500),
  recording_storage_path VARCHAR(500),
  recording_duration_seconds INTEGER,

  -- Analytics
  total_turns INTEGER DEFAULT 0,
  interruption_count INTEGER DEFAULT 0,

  -- AI Configuration used for this call
  voice_config JSONB DEFAULT '{}',
  /*
    {
      "voice": "alloy",
      "vad_threshold": 0.5,
      "silence_duration_ms": 700
    }
  */

  -- Outcome/Summary
  end_reason VARCHAR(100),  -- 'user_ended', 'timeout', 'error', 'transferred'
  summary TEXT,
  sentiment_score DECIMAL(3,2),  -- -1.0 to 1.0

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_sessions_company ON chatapp.call_sessions(company_id);
CREATE INDEX idx_call_sessions_chatbot ON chatapp.call_sessions(chatbot_id);
CREATE INDEX idx_call_sessions_status ON chatapp.call_sessions(status);
CREATE INDEX idx_call_sessions_source ON chatapp.call_sessions(source);
CREATE INDEX idx_call_sessions_created ON chatapp.call_sessions(created_at);
```

### 9.3 Call Transcripts

```sql
CREATE TABLE chatapp.call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES chatapp.call_sessions(id) ON DELETE CASCADE,

  -- Transcript content
  role VARCHAR(50) NOT NULL,  -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,

  -- Timing
  timestamp_ms INTEGER,  -- Milliseconds from call start
  duration_ms INTEGER,   -- Duration of this utterance

  -- Additional metadata
  is_final BOOLEAN DEFAULT TRUE,  -- For streaming transcripts
  confidence DECIMAL(3,2),        -- Speech recognition confidence

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast retrieval
CREATE INDEX idx_call_transcripts_session ON chatapp.call_transcripts(call_session_id);
CREATE INDEX idx_call_transcripts_created ON chatapp.call_transcripts(created_at);
```

### 9.4 Voice Configuration in Agents List

The `AgentListItem` interface includes voice configuration:

```typescript
interface AgentListItem {
  agent_identifier: string;
  name: string;
  designation: string;
  routing_prompt: string;
  agent_type: 'orchestrator' | 'worker';
  color: string;
  default_system_prompt: string;
  default_model_id: string;
  model_settings?: {
    temperature?: number;
    max_tokens?: number;
  };
  knowledge_base_enabled: boolean;
  knowledge_categories: string[];
  tools: string[];
  sort_order: number;

  // Voice configuration (for call chatbots)
  voice_config?: {
    // Provider-specific voice selection
    openai_voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';
    gemini_voice?: 'Kore' | 'Aoede' | 'Puck' | 'Charon' | 'Fenrir';

    // VAD settings (unified, mapped to provider-specific)
    vad_threshold?: number;  // 0.0 - 1.0 (mapped to Gemini sensitivity)
    silence_duration_ms?: number;  // Default: 700
    prefix_padding_ms?: number;    // Default: 300

    // Gemini-specific (optional)
    gemini_start_sensitivity?: 'START_SENSITIVITY_LOW' | 'START_SENSITIVITY_MEDIUM' | 'START_SENSITIVITY_HIGH';
    gemini_end_sensitivity?: 'END_SENSITIVITY_LOW' | 'END_SENSITIVITY_MEDIUM' | 'END_SENSITIVITY_HIGH';
  };
}
```

---

## 10. Web Widget Call UI Configuration

### 10.1 Call Widget Configuration Interface

```typescript
interface CallWidgetConfig {
  // General settings
  enabled: boolean;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  // Colors
  colors: {
    primary: string;           // Main button/orb color (e.g., '#4F46E5')
    primaryHover: string;      // Button hover state
    secondary: string;         // Secondary elements
    background: string;        // Widget background
    text: string;             // Primary text color
    textMuted: string;        // Secondary text color
    success: string;          // Connected/active state
    error: string;            // Error state
    warning: string;          // Warning state
  };

  // Call button/orb appearance
  callButton: {
    style: 'orb' | 'pill' | 'square' | 'circle';
    size: 'small' | 'medium' | 'large';  // 48px, 64px, 80px
    iconOnly: boolean;         // Show icon only or icon + text
    label?: string;            // Button text (if not iconOnly)
    animation: 'pulse' | 'glow' | 'bounce' | 'none';
    showTooltip: boolean;
    tooltipText?: string;
  };

  // Orb-specific styling (when style is 'orb')
  orb: {
    glowIntensity: 'low' | 'medium' | 'high';
    glowColor?: string;        // Override primary color glow
    pulseSpeed: 'slow' | 'normal' | 'fast';
    borderRadius: number;      // Percentage (50 = circle)
    shadow: 'none' | 'soft' | 'medium' | 'hard';

    // State-specific orb colors
    states: {
      idle: string;            // Default state
      connecting: string;      // Connecting to call
      active: string;          // Call in progress
      speaking: string;        // AI is speaking
      listening: string;       // AI is listening
      error: string;           // Error state
    };
  };

  // Call dialog/modal appearance
  callDialog: {
    width: number;             // Dialog width in pixels
    borderRadius: number;      // Border radius in pixels
    showBackdrop: boolean;
    backdropBlur: boolean;

    // Header
    showHeader: boolean;
    headerTitle?: string;
    showCloseButton: boolean;

    // Avatar/visualizer
    showAvatar: boolean;
    avatarUrl?: string;
    avatarFallback?: string;   // Initials or icon
    showVisualizer: boolean;   // Audio waveform visualizer
    visualizerStyle: 'bars' | 'wave' | 'circle';
    visualizerColor?: string;

    // Status display
    showStatus: boolean;
    showDuration: boolean;
    showTranscript: boolean;
    transcriptHeight: number;  // Max height in pixels
  };

  // Control buttons during call
  controls: {
    showMuteButton: boolean;
    showEndCallButton: boolean;
    showVolumeControl: boolean;
    buttonStyle: 'icon' | 'icon-label' | 'pill';
    buttonSize: 'small' | 'medium' | 'large';
  };

  // Branding
  branding: {
    showPoweredBy: boolean;
    companyLogo?: string;
    companyName?: string;
  };

  // Accessibility
  accessibility: {
    highContrast: boolean;
    reduceMotion: boolean;
    screenReaderAnnouncements: boolean;
  };
}
```

### 10.2 Default Call Widget Configuration

```typescript
const defaultCallWidgetConfig: CallWidgetConfig = {
  enabled: true,
  position: 'bottom-right',

  colors: {
    primary: '#4F46E5',        // Indigo
    primaryHover: '#4338CA',
    secondary: '#6B7280',
    background: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },

  callButton: {
    style: 'orb',
    size: 'medium',
    iconOnly: true,
    animation: 'pulse',
    showTooltip: true,
    tooltipText: 'Start voice call',
  },

  orb: {
    glowIntensity: 'medium',
    pulseSpeed: 'normal',
    borderRadius: 50,
    shadow: 'soft',
    states: {
      idle: '#4F46E5',
      connecting: '#F59E0B',
      active: '#10B981',
      speaking: '#3B82F6',
      listening: '#10B981',
      error: '#EF4444',
    },
  },

  callDialog: {
    width: 380,
    borderRadius: 16,
    showBackdrop: true,
    backdropBlur: true,
    showHeader: true,
    headerTitle: 'Voice Assistant',
    showCloseButton: true,
    showAvatar: true,
    showVisualizer: true,
    visualizerStyle: 'wave',
    showStatus: true,
    showDuration: true,
    showTranscript: true,
    transcriptHeight: 200,
  },

  controls: {
    showMuteButton: true,
    showEndCallButton: true,
    showVolumeControl: false,
    buttonStyle: 'icon',
    buttonSize: 'medium',
  },

  branding: {
    showPoweredBy: true,
  },

  accessibility: {
    highContrast: false,
    reduceMotion: false,
    screenReaderAnnouncements: true,
  },
};
```

### 10.3 Database Schema for Widget Config

The call widget configuration is stored in the `chatbots` table:

```sql
-- Add to chatbots table
ALTER TABLE chatapp.chatbots
ADD COLUMN call_widget_config JSONB DEFAULT '{}';
```

Or as part of the existing `widget_config` column with a `call` sub-object:

```typescript
interface ChatbotWidgetConfig {
  // Existing chat widget config
  chat: { /* ... */ };

  // Call widget config
  call: CallWidgetConfig;
}
```

---

## 11. Key Configuration Constants

### 11.1 Call Status

```javascript
const CALL_STATUS = {
  PENDING: 'pending',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  NO_ANSWER: 'no_answer',
  BUSY: 'busy',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
};
```

### 11.2 Call Sources

```javascript
const CALL_SOURCE = {
  WEB: 'web',
  WHATSAPP: 'whatsapp',
  TWILIO: 'twilio',
  VONAGE: 'vonage',    // Future
  BANDWIDTH: 'bandwidth' // Future
};
```

### 11.3 AI Providers

```javascript
const AI_PROVIDER = {
  OPENAI: 'OPENAI',
  GEMINI: 'GEMINI'
};
```

### 11.4 WebSocket Events

```javascript
const WEBSOCKET_EVENTS = {
  // Client → Server
  START_CALL: 'start_call',
  AUDIO_DATA: 'audio_data',
  END_CALL: 'end_call',

  // Server → Client
  CALL_STARTED: 'call_started',
  AUDIO_RESPONSE: 'audio_response',
  TRANSCRIPT: 'transcript',
  CONVERSATION_COMPLETE: 'conversation_complete',
  CALL_ENDED: 'call_ended',
  ERROR: 'error',
  STATUS: 'status',
  STOP_AUDIO: 'stop_audio',
  AGENT_SPEAKING: 'agent_speaking',
  AGENT_LISTENING: 'agent_listening'
};
```

### 11.5 OpenAI Events

```javascript
const OPENAI_EVENTS = {
  // Input
  SESSION_UPDATE: 'session.update',
  INPUT_AUDIO_BUFFER_APPEND: 'input_audio_buffer.append',
  INPUT_AUDIO_BUFFER_COMMIT: 'input_audio_buffer.commit',
  INPUT_AUDIO_BUFFER_CLEAR: 'input_audio_buffer.clear',
  RESPONSE_CREATE: 'response.create',
  RESPONSE_CANCEL: 'response.cancel',
  CONVERSATION_ITEM_CREATE: 'conversation.item.create',

  // Output
  SESSION_CREATED: 'session.created',
  SESSION_UPDATED: 'session.updated',
  RESPONSE_CREATED: 'response.created',
  RESPONSE_DONE: 'response.done',
  RESPONSE_AUDIO_DELTA: 'response.audio.delta',
  RESPONSE_AUDIO_TRANSCRIPT_DELTA: 'response.audio_transcript.delta',
  RESPONSE_AUDIO_TRANSCRIPT_DONE: 'response.audio_transcript.done',
  RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE: 'response.function_call_arguments.done',
  INPUT_AUDIO_BUFFER_SPEECH_STARTED: 'input_audio_buffer.speech_started',
  INPUT_AUDIO_BUFFER_SPEECH_STOPPED: 'input_audio_buffer.speech_stopped',
  ERROR: 'error'
};
```

### 11.6 Gemini Events

```javascript
const GEMINI_EVENTS = {
  // Session
  SETUP_COMPLETE: 'setupComplete',

  // Content
  SERVER_CONTENT: 'serverContent',

  // Tool calls
  TOOL_CALL: 'toolCall',
  TOOL_CALL_CANCELLATION: 'toolCallCancellation',

  // Audio
  INTERRUPTED: 'interrupted',
  TURN_COMPLETE: 'turnComplete',

  // Errors
  ERROR: 'error',
  CLOSE: 'close'
};
```

---

## 12. Dependencies

### 12.1 Core Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server framework |
| `ws` | WebSocket server |
| `wrtc` | Node.js WebRTC implementation |
| `@discordjs/opus` | Opus codec encoding/decoding |
| `@alexanderolsen/libsamplerate-js` | High-quality audio resampling |
| `sdp-transform` | SDP parsing and generation |
| `uuid` | Session ID generation |
| `@google/genai` | Google Gemini Live API SDK |

### 12.2 Installation Notes

```bash
# wrtc requires native compilation
npm install wrtc

# Opus encoder requires native compilation
npm install @discordjs/opus

# libsamplerate requires WASM
npm install @alexanderolsen/libsamplerate-js

# Gemini SDK
npm install @google/genai
```

### 12.3 System Requirements

- Node.js 18+ (for wrtc compatibility)
- Native build tools (for opus)
- Linux/macOS recommended (Windows has limited wrtc support)

---

## 13. Environment Variables

### 13.1 Complete Environment Configuration

```bash
# ===================
# Server Configuration
# ===================
PORT=3000
NODE_ENV=production
BASE_URL=https://voice.example.com

# ===================
# AI Provider Selection
# ===================
# Options: OPENAI, GEMINI
WEB_CALL_AI=OPENAI
WHATSAPP_CALL_AI=OPENAI

# ===================
# OpenAI Configuration
# ===================
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-realtime-2025-08-28
OPENAI_VOICE=ash
# Available voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=4096

# ===================
# Gemini Configuration
# ===================
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-native-audio-preview-09-2025
GEMINI_VOICE=Kore
# Available voices: Kore, Aoede, Puck, Charon, Fenrir

# ===================
# WhatsApp Configuration
# ===================
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...  # For webhook signature validation

# ===================
# Twilio Configuration (Optional)
# ===================
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# ===================
# Recording & Storage
# ===================
ENABLE_CALL_RECORDING=true
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# ===================
# Database
# ===================
DATABASE_URL=postgresql://...

# ===================
# Multi-tenant (chat.buzzi.ai specific)
# ===================
DEFAULT_COMPANY_ID=...
DEFAULT_CHATBOT_ID=...
```

---

## Summary

The voice.buzzi.ai application demonstrates a complete voice AI implementation with:

1. **Dual AI Provider Support**: Both OpenAI Realtime API and Google Gemini Live API with unified interface
2. **Multi-source calls**: Browser WebSocket, WhatsApp WebRTC, and Twilio (future)
3. **Complex audio pipeline**: Multi-codec (PCM16, Opus, µ-law), multi-sample-rate conversion (8kHz, 16kHz, 24kHz, 48kHz)
4. **Provider-specific VAD**: OpenAI threshold-based vs Gemini sensitivity-based
5. **Interruption handling**: Server-side VAD with response cancellation
6. **WhatsApp-specific requirements**: Opus codec, stereo audio, SDP setup:active
7. **Function calling**: Unified interface for tools across providers
8. **Call recording**: WAV file generation and cloud storage
9. **Unified integration accounts**: Single table for WhatsApp, Twilio, future providers
10. **Configurable web widget**: Extensive UI customization for call button, dialog, and controls

This reference implementation provides the foundation for the multi-tenant call chatbot feature in chat.buzzi.ai.
