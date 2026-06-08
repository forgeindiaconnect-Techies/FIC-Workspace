const fs = require('fs');
let content = fs.readFileSync('src/pages/MeetingApp.jsx', 'utf8');

// Remove createPeerConnection using precise match
const cpcStart = 'const createPeerConnection = (targetPeerId, stream, name) => {';
const startIndex = content.indexOf(cpcStart);
if (startIndex !== -1) {
  const endIndex = content.indexOf('return pc;\n  };', startIndex);
  if (endIndex !== -1) {
    const fullMatch = content.substring(startIndex, endIndex + 15);
    content = content.replace(fullMatch, '');
    console.log('Removed createPeerConnection');
  }
}

fs.writeFileSync('src/pages/MeetingApp.jsx', content);
console.log('Done.');
