const fs = require('fs');
let content = fs.readFileSync('src/pages/MeetingApp.jsx', 'utf8');

// Remove sendWs
content = content.replace(/const sendWs = useCallback\(\(type, data\) => \{[\s\S]*?\}\, \[\]\);/, '');

// Remove createPeerConnection
// This function is quite large, going from `const createPeerConnection = (targetPeerId, stream, name) => {`
// to the closing brace `};` before `const toggleScreenShare`.
const cpcRegex = /const createPeerConnection = \(targetPeerId, stream, name\) => \{[\s\S]*?return pc;\n  \};/;
content = content.replace(cpcRegex, '');

fs.writeFileSync('src/pages/MeetingApp.jsx', content);
console.log('Removed old functions.');
