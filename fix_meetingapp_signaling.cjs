const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/MeetingApp.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. We need to find `const connectSignaling = useCallback((signalingRoomId, token) => {`
// And replace it with `const handleSignalingMessage = useCallback(async (msg) => {`
// Then remove the WebSocket setup lines!

let startIdx = content.indexOf('  const connectSignaling = useCallback((signalingRoomId, token) => {');
if (startIdx === -1) throw new Error('Could not find connectSignaling');

let onmessageIdx = content.indexOf('    ws.onmessage = async (e) => {', startIdx);
if (onmessageIdx === -1) throw new Error('Could not find ws.onmessage');

let tryIdx = content.indexOf('      try {', onmessageIdx);
let catchIdx = content.indexOf('      } catch (err) {', tryIdx);

// We'll replace everything from connectSignaling down to tryIdx with our new handler
let newHandlerStart = `  const handleSignalingMessage = useCallback(async (msg) => {
    try {
      const e = { data: JSON.stringify(msg) }; // Mock event object to preserve existing code
`;

let beforeConnect = content.substring(0, startIdx);
let insideCatch = content.substring(tryIdx + 11); // Skip "      try {\n"

// Now we need to find the end of connectSignaling.
// It ends with:
//     ws.onerror = (e) => { ... }
//   }, [roomId, ...]);
let endIdx = content.indexOf('  }, [roomId,', startIdx);
let endEndIdx = content.indexOf(']);', endIdx) + 3;

// Find the end of ws.onmessage
let endOnMessageIdx = content.lastIndexOf('    };', endIdx);
if (endOnMessageIdx === -1) throw new Error('Could not find end of ws.onmessage');

// We just keep the logic inside the try block, up to the end of the onmessage handler
let handlerBody = content.substring(tryIdx, endOnMessageIdx);

let newHandler = `  const handleSignalingMessage = useCallback(async (msg) => {
${handlerBody}
  }, [roomId, peers, isScreenSharing, isRecording, auth]);
`;

let afterConnect = content.substring(endEndIdx);

content = beforeConnect + newHandler + afterConnect;

// Now fix the useWebRTC call
content = content.replace(
  /onMessage: \(msg\) => \{\s*\/\/[^\n]*\n\s*if \(wsRef\.current && wsRef\.current\.onmessage\) \{\s*wsRef\.current\.onmessage\(\{ data: JSON\.stringify\(msg\) \}\);\s*\}\s*\}/,
  'onMessage: handleSignalingMessage'
);

// We need to move the `const handleSignalingMessage` ABOVE `const { ... } = useWebRTC`
// Let's find `useWebRTC`
let useWebRTCIdx = content.indexOf('  const {');
let useWebRTCCall = content.indexOf('useWebRTC({', useWebRTCIdx);
if (useWebRTCIdx !== -1 && useWebRTCCall !== -1) {
  // Instead of moving it, let's just use `handleSignalingMessage` inside `useEffect`?
  // Wait, `handleSignalingMessage` requires `roomId`, `peers`, etc.
  // We can just keep `onMessage: (msg) => { if(handleSignalingMessageRef.current) handleSignalingMessageRef.current(msg); }`
  
  content = content.replace(
    'onMessage: handleSignalingMessage',
    'onMessage: (msg) => {\n      if (handleSignalingMessageRef.current) handleSignalingMessageRef.current(msg);\n    }'
  );
  
  // Add `handleSignalingMessageRef` near the top
  content = content.replace(
    '  const [appState, setAppState] = useState(\'joining\');',
    '  const [appState, setAppState] = useState(\'joining\');\n  const handleSignalingMessageRef = useRef(null);'
  );
  
  // Add useEffect to update the ref
  let handlerMatch = `  const handleSignalingMessage = useCallback(async (msg) => {`;
  content = content.replace(
    handlerMatch,
    `  useEffect(() => {\n    handleSignalingMessageRef.current = handleSignalingMessage;\n  }, [handleSignalingMessage]);\n\n` + handlerMatch
  );
}

// Remove the old useEffect that called connectSignaling
content = content.replace(
  /  useEffect\(\(\) => \{\n\s*const token = localStorage\.getItem\('token'\);\n\s*if \(token\) connectSignaling\(meetingIdRef\.current, token\);\n\s*\}, \[.*?\]\);\n/s,
  ''
);

// Remove `connectSignaling(signalingRoomId, token);` from handleJoinCall
content = content.replace(/\s*connectSignaling\(signalingRoomId, token\);/g, '');

fs.writeFileSync(filePath, content);
console.log('Successfully refactored MeetingApp.jsx');
