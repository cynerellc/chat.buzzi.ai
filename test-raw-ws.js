const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// First create a session
const sessionData = JSON.parse(require('child_process').execSync(
  `curl -s -X POST 'http://localhost:3000/api/widget/call/session' -H 'Content-Type: application/json' -d '{"chatbotId":"307d0928-8e2d-4696-b611-2de96e554816","companyId":"fb5b1a08-2c95-49c1-9861-a5c62c32ca97","callerName":"Test User"}'`
).toString());

console.log('Session created:', sessionData.sessionId);

// Make raw WebSocket handshake
const wsUrl = new URL(sessionData.wsUrl);
const key = crypto.randomBytes(16).toString('base64');

const options = {
  hostname: wsUrl.hostname,
  port: wsUrl.port || 80,
  path: wsUrl.pathname + wsUrl.search,
  method: 'GET',
  headers: {
    'Host': `${wsUrl.hostname}:${wsUrl.port}`,
    'Connection': 'Upgrade',
    'Upgrade': 'websocket',
    'Sec-WebSocket-Key': key,
    'Sec-WebSocket-Version': '13',
  }
};

const req = http.request(options);

req.on('upgrade', (res, socket, head) => {
  console.log('Upgrade successful');
  console.log('Response headers:', JSON.stringify(res.headers));
  
  let totalData = Buffer.alloc(0);
  
  socket.on('data', (chunk) => {
    totalData = Buffer.concat([totalData, chunk]);
    
    // Try to parse as WebSocket frame
    if (totalData.length >= 2) {
      const firstByte = totalData[0];
      const secondByte = totalData[1];
      
      const fin = (firstByte & 0x80) !== 0;
      const rsv1 = (firstByte & 0x40) !== 0;
      const rsv2 = (firstByte & 0x20) !== 0;
      const rsv3 = (firstByte & 0x10) !== 0;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      
      console.log(`Frame header: fin=${fin} rsv1=${rsv1} rsv2=${rsv2} rsv3=${rsv3} opcode=${opcode} masked=${masked} len=${payloadLen}`);
      
      let offset = 2;
      if (payloadLen === 126) {
        payloadLen = totalData.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        payloadLen = Number(totalData.readBigUInt64BE(2));
        offset = 10;
      }
      
      console.log('Actual payload length:', payloadLen, 'offset:', offset);
      
      if (totalData.length >= offset + payloadLen) {
        const payload = totalData.slice(offset, offset + payloadLen);
        console.log('Payload:', payload.toString());
        
        // If it looks like JSON, parse it
        try {
          const json = JSON.parse(payload.toString());
          console.log('Parsed JSON:', json);
          
          if (json.type === 'status' && json.data?.status === 'ready') {
            console.log('SUCCESS! Received STATUS:ready');
            
            // Send start_call message
            const msg = JSON.stringify({ type: 'start_call', data: { name: 'Test' } });
            const msgBuf = Buffer.from(msg);
            const frame = Buffer.alloc(2 + 4 + msgBuf.length);
            frame[0] = 0x81; // fin=1, opcode=1 (text)
            frame[1] = 0x80 | msgBuf.length; // masked, length
            // Mask key (all zeros for simplicity)
            frame[2] = 0; frame[3] = 0; frame[4] = 0; frame[5] = 0;
            msgBuf.copy(frame, 6);
            socket.write(frame);
            console.log('Sent start_call');
          }
        } catch (e) {
          console.log('Not JSON, raw:', payload.toString().substring(0, 100));
        }
        
        totalData = totalData.slice(offset + payloadLen);
      }
    }
  });
  
  socket.on('error', (err) => console.error('Socket error:', err));
  socket.on('close', () => {
    console.log('Socket closed');
    process.exit(0);
  });
});

req.on('response', (res) => {
  console.log('Got HTTP response instead of upgrade:', res.statusCode);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Response body:', body);
    process.exit(1);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});

req.end();

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 30000);
