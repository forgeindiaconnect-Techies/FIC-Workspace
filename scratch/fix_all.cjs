const fs = require('fs');

let c = fs.readFileSync('d:/New folder/src/pages/ChatApp.jsx', 'utf8');
const startIdx = c.indexOf('  const handleSelectChannel = (ch) => {');
const endIdx = c.indexOf('  const handleDeleteChat = async () => {');

if (startIdx > -1 && endIdx > -1) {
  const replacement = `  const handleSelectChannel = (ch) => {
    setSelected(ch);
    const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
    readTimestamps[ch._id] = new Date().toISOString();
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
        body: JSON.stringify({
          workspaceId: 'independent',
          name: groupName,
          type: 'group',
          members: [...selectedGroupMembers, currentUserEmail],
          createdBy: currentUserEmail
        })
      });
      const newChannel = await res.json();
      if (res.ok) {
        setChannels(prev => [newChannel, ...prev]);
        setSelected(newChannel);
        setIsCreatingGroup(false);
        setGroupName('');
        setSelectedGroupMembers([]);
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const addMembersToGroup = async (channelId, newMemberEmails) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(\`/api/chat/group/\${channelId}/members\`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ members: newMemberEmails })
      });
      if (!res.ok) throw new Error('Failed to add members');
      const updatedGroup = await res.json();
      setChannels(prev => prev.map(ch => ch._id === channelId ? { ...ch, members: updatedGroup.members } : ch));
    } catch (err) {
      console.error('Failed to add members:', err);
    }
  };

`;
  
  c = c.slice(0, startIdx) + replacement + c.slice(endIdx);
  fs.writeFileSync('d:/New folder/src/pages/ChatApp.jsx', c);
  console.log('Successfully replaced functions.');
} else {
  console.error('Could not find start or end index', startIdx, endIdx);
}
