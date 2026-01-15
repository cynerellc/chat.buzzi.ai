const http = require('http');
const { URL } = require('url');

// First create a session
const sessionData = JSON.parse(require('child_process').execSync(
  `curl -s -X POST 'http://localhost:3000/api/widget/call/session' -H 'Content-Type: application/json' -d '{"chatbotId":"307d0928-8e2d-4696-b611-2de96e554816","companyId":"fb5b1a08-2c95-49c1-9861-a5c62c32ca97","callerName":"Test User"}'`
).toString());

console.log('Session created:', sessionData.sessionId);
console.log('WebSocket URL:', sessionData.wsUrl);

// Make raw WebSocket handshake request
const wsUrl = new URL(sessionData.wsUrl);
const options = {
  hostname: wsUrl.hostname,
  port: wsUrl.port || 80,
  path: wsUrl.pathname + wsUrl.search,
  method: 'GET',
  headers: {
    'Connection': 'Upgrade',
    'Upgrade': 'websocket',
    'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
    'Sec-WebSocket-Version': '13',
    // Explicitly omit Sec-WebSocket-Extensions to not request compression
  }
};

console.log('Making request with headers:', options.headers);

const req = http.request(options, (res) => {
  console.log('Response status:', res.statusCode);
  console.log('Response headers:', res.headers);
});

req.on('upgrade', (res, socket, head) => {
  console.log('Upgrade successful!');
  console.log('Response headers:', res.headers);
  console.log('Head buffer:', head);
  
  // Listen for data
  socket.on('data', (data) => {
    console.log('Raw data received, length:', data.length);
    console.log('First bytes:', data.slice(0, 20));
    
    // Parse WebSocket frame manually
    const fin = (data[0] & 0x80) !== 0;
    const rsv1 = (data[0] & 0x40) !== 0;
    const rsv2 = (data[0] & 0x20) !== 0;
    const rsv3 = (data[0] & 0x10) !== 0;
    const opcode = data[0] & 0x0f;
    const masked = (data[1] & 0x80) !== 0;
    const payloadLen = data[1] & 0x7f;
    
    console.log('Frame: fin=', fin, 'rsv1=', rsv1, 'rsv2=', rsv2, 'rsv3=', rsv3, 'opcode=', opcode, 'masked=', masked, 'len=', payloadLen);
    
    socket.end();
    process.exit(0);
  });
  
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.end();

setTimeout(() => process.exit(1), 10000);
