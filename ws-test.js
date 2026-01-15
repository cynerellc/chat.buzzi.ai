const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

// Create a simple HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: false,
});

wss.on('connection', (ws) => {
  console.log('Server: Client connected');
  ws.send(JSON.stringify({ type: 'hello', data: 'world' }));
  
  ws.on('message', (data) => {
    console.log('Server received:', data.toString());
    ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
  });
});

server.listen(3099, () => {
  console.log('Test server listening on ws://localhost:3099/ws');
  
  // Connect as client
  const client = new WebSocket('ws://localhost:3099/ws', {
    perMessageDeflate: false,
  });
  
  client.on('open', () => {
    console.log('Client: Connected');
  });
  
  client.on('message', (data) => {
    console.log('Client received:', data.toString());
    server.close();
    process.exit(0);
  });
  
  client.on('error', (err) => {
    console.error('Client error:', err.message);
    process.exit(1);
  });
});
