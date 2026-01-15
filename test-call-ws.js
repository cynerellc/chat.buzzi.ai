const { WebSocket } = require('ws');

// First create a session
const sessionData = JSON.parse(require('child_process').execSync(
  `curl -s -X POST 'http://localhost:3000/api/widget/call/session' -H 'Content-Type: application/json' -d '{"chatbotId":"307d0928-8e2d-4696-b611-2de96e554816","companyId":"fb5b1a08-2c95-49c1-9861-a5c62c32ca97","callerName":"Test User"}'`
).toString());

console.log('Session created:', sessionData.sessionId);
console.log('Connecting to:', sessionData.wsUrl);

// Create WebSocket with explicit options to disable all extensions
const ws = new WebSocket(sessionData.wsUrl, [], {
  // Disable compression/extensions
  skipUTF8Validation: true,
});

// Also try setting a specific websocket-extensions header
ws.on('open', () => {
  console.log('WebSocket connected');
});

ws.on('message', (data, isBinary) => {
  console.log('Raw data received, binary:', isBinary, 'length:', data.length);
  try {
    const msg = JSON.parse(data.toString());
    console.log('Received:', msg.type, JSON.stringify(msg.data));
    
    // When we get STATUS:ready, send START_CALL
    if (msg.type === 'status' && msg.data?.status === 'ready') {
      console.log('Sending START_CALL');
      ws.send(JSON.stringify({ type: 'start_call', data: { name: 'Test User' } }));
    }
    
    // When we get CALL_STARTED, the call is active
    if (msg.type === 'call_started') {
      console.log('Call started successfully!');
      setTimeout(() => {
        console.log('Sending END_CALL');
        ws.send(JSON.stringify({ type: 'end_call' }));
      }, 1000);
    }
    
    // When call ends, close connection
    if (msg.type === 'call_ended') {
      console.log('Call ended. Test complete!');
      ws.close();
      process.exit(0);
    }
  } catch (e) {
    console.error('Failed to parse message:', e.message);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed, code:', code, 'reason:', reason.toString());
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('Timeout');
  ws.close();
  process.exit(1);
}, 30000);
