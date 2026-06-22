const fs = require('fs');
let c = fs.readFileSync('d:/New folder/src/pages/ChatApp.jsx', 'utf8');

const startIdx = c.indexOf('{activeTab === \\'home\\' ? (');
const endIdx = c.indexOf('<section className="w-80 border-r border-[#C6C6CD] bg-white flex flex-col shrink-0 z-10">');

if (startIdx > -1 && endIdx > -1) {
  const replacement = `{activeTab === 'home' ? (
                        <HomeTab
                          members={members.filter(m => m.email !== currentUserEmail)}
                          workspaceId={workspaceId}
                          onViewAllMembers={() => setIsFindingFriends(true)}
                          onStartChat={(user) => { startChat(user); setActiveTab('messenger'); }}
                        />
                     ) : (
                        <>
                           {(activeTab === 'messenger' || activeTab === 'channels') && (
                              `;
  c = c.slice(0, startIdx) + replacement + c.slice(endIdx);
  fs.writeFileSync('d:/New folder/src/pages/ChatApp.jsx', c);
  console.log('Fixed render block successfully.');
} else {
  console.log('Indices not found!', startIdx, endIdx);
}
