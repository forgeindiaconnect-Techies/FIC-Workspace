import WebSocket from 'ws';

console.log("Attempting to connect to local WebSocket server...");
const ws = new WebSocket("ws://localhost:3001/ws/mail?email=test@test.com");

ws.on('open', () => {
  console.log("WebSocket connection successfully opened!");
  ws.close();
});

ws.on('error', (err) => {
  console.error("WebSocket connection failed with error:", err.message);
});

ws.on('close', (code, reason) => {
  console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`);
});
