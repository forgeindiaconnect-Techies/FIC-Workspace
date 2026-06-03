const WebSocket = require('ws');
console.log('Connecting to ws://127.0.0.1:3001/ws/calls...');
const ws = new WebSocket('ws://127.0.0.1:3001/ws/calls');
ws.on('open', () => {
  console.log('Connected!');
  ws.close();
});
ws.on('error', (err) => {
  console.error('Error:', err.message);
});
ws.on('close', () => {
  console.log('Closed');
});
