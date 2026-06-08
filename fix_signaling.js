const fs = require('fs');

let code = fs.readFileSync('src/pages/MeetingApp.jsx', 'utf8');

// The easiest way to fix the loop without removing connectSignaling entirely 
// is to bypass the ws.onmessage recursion.
// In MeetingApp.jsx, the onMessage prop is:
// onMessage: (msg) => {
//   if (wsRef.current && wsRef.current.onmessage) {
//      wsRef.current.onmessage({ data: JSON.stringify(msg) });
//   }
// },

// We change this to:
// onMessage: (msg) => {
//   if (window.handleSignalingMessage) {
//      window.handleSignalingMessage({ data: JSON.stringify(msg) });
//   }
// },
// And inside connectSignaling, we do:
// window.handleSignalingMessage = async (e) => { ... }

// But relying on window is dirty. Let's create a ref `const messageHandlerRef = useRef(null);`
// wait, we can just replace `wsRef.current.onmessage({ data: JSON.stringify(msg) });`
// with `if (messageHandlerRef.current) messageHandlerRef.current({ data: JSON.stringify(msg) });`

let changed = false;

if (!code.includes('const messageHandlerRef = useRef(null);')) {
  code = code.replace(
    'const intentionalCloseRef = useRef(false);',
    'const intentionalCloseRef = useRef(false);\n  const messageHandlerRef = useRef(null);'
  );
  changed = true;
}

if (code.includes('wsRef.current && wsRef.current.onmessage')) {
  code = code.replace(
    /if \(wsRef\.current && wsRef\.current\.onmessage\) \{\s*wsRef\.current\.onmessage\(\{ data: JSON\.stringify\(msg\) \}\);\s*\}/,
    'if (messageHandlerRef.current) {\n         messageHandlerRef.current({ data: JSON.stringify(msg) });\n      }'
  );
  changed = true;
}

if (code.includes('ws.onmessage = async (e) => {') && !code.includes('messageHandlerRef.current = async (e) => {')) {
  code = code.replace(
    'ws.onmessage = async (e) => {',
    'messageHandlerRef.current = async (e) => {\n      // Bind to ws so inside we can use it\n      const wsLocal = ws;'
  );
  // Also we need to bind ws.onmessage to it so native WS messages still work!
  // Wait, if we replace `ws.onmessage = async (e) => {`, we should do BOTH.
  code = code.replace(
    'messageHandlerRef.current = async (e) => {\n      // Bind to ws so inside we can use it\n      const wsLocal = ws;',
    'ws.onmessage = async (e) => { ... } // removed'
  );
  // Let's use a simpler regex replacement
}

fs.writeFileSync('src/pages/MeetingApp.jsx', code);
console.log('Done:', changed);
