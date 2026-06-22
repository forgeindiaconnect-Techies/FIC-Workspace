const fs = require('fs');

let c = fs.readFileSync('d:/New folder/src/pages/ChatApp.jsx', 'utf8');

// 1. Add state
const stateReplacement = `  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

  const handleAddMembersSubmit = async () => {
    if (selectedNewMembers.length === 0 || !selected) return;
    await addMembersToGroup(selected._id, selectedNewMembers);
    setIsAddingMembers(false);
    setSelectedNewMembers([]);
  };`;

c = c.replace(/  const \[isCreatingGroup, setIsCreatingGroup\] = useState\(false\);/, `  const [isCreatingGroup, setIsCreatingGroup] = useState(false);\n${stateReplacement}`);

// 2. Render block
const oldRender = `                     {activeTab === 'home' ? (
                        <HomeTab
                          members={members.filter(m => m.email !== currentUserEmail)}
                          workspaceId={workspaceId}
                          onViewAllMembers={() => setIsFindingFriends(true)}
                          onStartChat={(user) => { startChat(user); setActiveTab('messenger'); }}
                        />
                     ) : activeTab === 'channels' ? (
                        <ChannelsTab 
                           channels={channels} 
                           members={members} 
                           currentUserEmail={currentUserEmail} 
                           onCreateGroup={() => setIsCreatingGroup(true)} 
                           onSelectGroup={(ch) => { handleSelectChannel(ch); setActiveTab('messenger'); }}
                           onAddMembersToGroup={addMembersToGroup}
                        />
                     ) : (
                        <>
                           {activeTab === 'messenger' && (`;

const newRender = `                     {activeTab === 'home' ? (
                        <HomeTab
                          members={members.filter(m => m.email !== currentUserEmail)}
                          workspaceId={workspaceId}
                          onViewAllMembers={() => setIsFindingFriends(true)}
                          onStartChat={(user) => { startChat(user); setActiveTab('messenger'); }}
                        />
                     ) : (
                        <>
                           {(activeTab === 'messenger' || activeTab === 'channels') && (`;
c = c.replace(oldRender, newRender);

// 3. Left Sidebar Filter
const oldFilter = `                                 <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {channels
                                      .filter(ch => ['dm', 'direct'].includes(ch.type) && ch.hasMessages)`;

const newFilter = `                                 <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {activeTab === 'channels' && (
                                       <div className="px-2 mb-2 pt-1">
                                          <button onClick={() => setIsCreatingGroup(true)} className="w-full bg-[#2170E4] hover:bg-[#1A5BB8] text-white py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center justify-center gap-2">
                                             <Plus size={16} /> Create Team
                                          </button>
                                       </div>
                                    )}
                                    {channels
                                      .filter(ch => activeTab === 'channels' ? ch.type === 'group' : ['dm', 'direct'].includes(ch.type) && ch.hasMessages)`;
c = c.replace(oldFilter, newFilter);

// 4. Chat Header
const oldHeader = `                                            <span className="text-[12px] font-medium text-[#009668] mt-0.5 tracking-wide">
                                               {['dm', 'direct'].includes(selected.type) ? (selected.isOnline ? 'Active now' : (selected.lastSeen ? \`Last seen \${formatLastSeen(selected.lastSeen)}\` : 'Offline')) : 'Group Chat'}
                                            </span>
                                         </div>
                                      </div>
                                   </div>`;

const newHeader = `                                            <span className="text-[12px] font-medium text-[#009668] mt-0.5 tracking-wide">
                                               {['dm', 'direct'].includes(selected.type) ? (selected.isOnline ? 'Active now' : (selected.lastSeen ? \`Last seen \${formatLastSeen(selected.lastSeen)}\` : 'Offline')) : \`\${selected.members?.length || 0} members\`}
                                            </span>
                                         </div>
                                      </div>
                                      {selected.type === 'group' && (
                                         <button onClick={() => setIsAddingMembers(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EFF4FF] text-[#2170E4] hover:bg-[#E1EBFD] transition-colors text-[13px] font-semibold">
                                            <UserPlus size={16} />
                                            Add Members
                                         </button>
                                      )}
                                   </div>`;
c = c.replace(oldHeader, newHeader);

// 5. Add Members Modal
const addMembersModal = `        {isAddingMembers && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/10 backdrop-blur-md">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border border-white p-2">
              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Add to Team</h2>
                  <button onClick={() => setIsAddingMembers(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all"><X size={18} /></button>
                </div>
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-4">Select Team Members</div>
                  <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {members.filter(m => m.email !== currentUserEmail && !selected.members?.includes(m.email)).map(member => {
                      const isSelected = selectedNewMembers.includes(member.email);
                      return (
                        <div key={member._id} onClick={() => setSelectedNewMembers(prev => isSelected ? prev.filter(e => e !== member.email) : [...prev, member.email])} className={\`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all \${isSelected ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-gray-50 border-transparent'} border\`}>
                          <div className={\`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[14px] transition-colors \${isSelected ? 'bg-blue-500 text-white' : 'bg-[#E34A56] text-white'}\`}>
                            {member.name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={\`font-bold truncate text-[14px] \${isSelected ? 'text-blue-900' : 'text-gray-900'}\`}>{member.name}</h4>
                            <p className="text-[12px] text-gray-400 truncate">{member.email}</p>
                          </div>
                          <div className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors \${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-200'}\`}>
                            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                    {members.filter(m => m.email !== currentUserEmail && !selected.members?.includes(m.email)).length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">All users are already in this group.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 pt-2">
                <button disabled={selectedNewMembers.length === 0} onClick={handleAddMembersSubmit} className="w-full bg-[#C1D4F9] text-white font-bold py-4 rounded-[1.5rem] hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-[#C1D4F9] disabled:hover:shadow-none">
                  Add Members
                </button>
              </div>
            </div>
          </div>
        )}

`;

c = c.replace('{isCreatingGroup && (', addMembersModal + '{isCreatingGroup && (');

// 6. Delete ChannelsTab
const channelsTabStart = c.indexOf('const ChannelsTab =');
if (channelsTabStart > -1) {
  const endRichInput = c.indexOf('const RichInput =');
  if (endRichInput > -1) {
    c = c.slice(0, channelsTabStart) + c.slice(endRichInput);
  }
}

fs.writeFileSync('d:/New folder/src/pages/ChatApp.jsx', c);
console.log('Refactor script applied successfully!');
