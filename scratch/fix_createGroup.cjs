const fs = require('fs');
let c = fs.readFileSync('d:/New folder/src/pages/ChatApp.jsx', 'utf8');

const mangled = `    readTimestamps[ch._id] = new Date().toISOString();
        body: JSON.stringify({`;

const fixed = `    readTimestamps[ch._id] = new Date().toISOString();
    localStorage.setItem('chat_read_timestamps', JSON.stringify(readTimestamps));
    // Clear unread count locally when opened
    setChannels(prev => prev.map(c => c._id === ch._id ? { ...c, unreadCount: 0 } : c));
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;
    try {
      const res = await fetch(getApiUrl('/api/chat/groups'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`
        },
        body: JSON.stringify({`;

c = c.replace(mangled, fixed);
fs.writeFileSync('d:/New folder/src/pages/ChatApp.jsx', c);
console.log('Fixed createGroup successfully.');
