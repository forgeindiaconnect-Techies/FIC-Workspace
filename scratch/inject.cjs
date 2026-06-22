const fs = require('fs');

const file = 'd:/New folder/src/pages/ChatApp.jsx';
let content = fs.readFileSync(file, 'utf8');

const channelsTabComponent = `
const ChannelsTab = ({ channels, members, currentUserEmail, onCreateGroup, onSelectGroup, onAddMembersToGroup }) => {
  const groups = channels.filter(ch => ch.type === 'group' || ch.isGroup);
  
  const [addingToGroup, setAddingToGroup] = React.useState(null);
  const [selectedNewMembers, setSelectedNewMembers] = React.useState([]);

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    await onAddMembersToGroup(addingToGroup, selectedNewMembers);
    setAddingToGroup(null);
    setSelectedNewMembers([]);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white flex flex-col items-center py-10 px-6">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-2xl font-bold text-[#0B1C30]">Teams & Groups</h2>
           <button onClick={onCreateGroup} className="px-5 py-2.5 bg-[#2170E4] text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">
             Create Team
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(group => (
             <div key={group._id} className="border border-[#C6C6CD] rounded-2xl p-5 hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-xl bg-[#EFF4FF] text-[#2170E4] flex items-center justify-center font-bold text-lg">
                       <Hash size={24} />
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-[#0B1C30] cursor-pointer hover:text-[#2170E4]" onClick={() => onSelectGroup(group)}>{group.name}</h3>
                       <p className="text-sm text-[#76777D]">{group.members?.length || 0} members</p>
                     </div>
                  </div>
               </div>
               
               <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                 <div className="flex -space-x-2">
                    {group.members?.slice(0, 5).map((memberEmail, idx) => {
                       const m = members.find(u => u.email === memberEmail);
                       return (
                         <div key={idx} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600">
                            {m ? (m.name ? m.name.charAt(0) : '?') : memberEmail.charAt(0).toUpperCase()}
                         </div>
                       )
                    })}
                    {group.members?.length > 5 && (
                       <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-500">
                          +{group.members.length - 5}
                       </div>
                    )}
                 </div>
                 
                 <div className="flex gap-2">
                   <button onClick={() => setAddingToGroup(group._id)} className="p-2 text-[#45464D] hover:text-[#2170E4] hover:bg-[#EFF4FF] rounded-lg transition-colors" title="Add Members">
                      <UserPlus size={18} />
                   </button>
                   <button onClick={() => onSelectGroup(group)} className="p-2 text-[#45464D] hover:text-[#2170E4] hover:bg-[#EFF4FF] rounded-lg transition-colors" title="Open Chat">
                      <MessageSquare size={18} />
                   </button>
                 </div>
               </div>
             </div>
          ))}
          {groups.length === 0 && (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
               <div className="w-16 h-16 bg-[#F8F9FF] rounded-2xl flex items-center justify-center text-[#2170E4] mb-4 border border-[#C6C6CD] shadow-sm">
                 <Hash size={28} />
               </div>
               <p className="text-[15px] font-semibold text-[#0B1C30]">No teams yet</p>
               <p className="text-[13px] text-[#76777D] mt-1 mb-4">Create your first team to start collaborating</p>
               <button onClick={onCreateGroup} className="px-5 py-2.5 bg-[#2170E4] text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">
                 Create Team
               </button>
            </div>
          )}
        </div>

        {addingToGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-gray-900">Add Members</h2>
                 <button onClick={() => { setAddingToGroup(null); setSelectedNewMembers([]); }} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all"><X size={16} /></button>
              </div>
              
              <div className="p-6">
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 custom-scrollbar pr-2">
                  {members
                    .filter(m => m.email !== currentUserEmail)
                    .filter(m => !groups.find(g => g._id === addingToGroup)?.members?.includes(m.email))
                    .map(member => {
                    const isSelected = selectedNewMembers.includes(member.email);
                    return (
                      <button 
                        key={member.email}
                        onClick={() => setSelectedNewMembers(prev => isSelected ? prev.filter(e => e !== member.email) : [...prev, member.email])}
                        className={\`w-full flex items-center justify-between p-3 rounded-2xl transition-all \${isSelected ? 'bg-[#EFF4FF] border border-[#2170E4]' : 'hover:bg-gray-50 border border-transparent'}\`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#2170e4] text-white flex justify-center items-center font-bold">
                            {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="text-left flex flex-col">
                             <span className="text-[14px] font-semibold text-[#0B1C30]">{member.name || member.email}</span>
                             <span className="text-[11px] text-[#76777D] font-medium">{member.email}</span>
                          </div>
                        </div>
                        <div className={\`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all \${isSelected ? 'bg-[#2170E4] border-[#2170E4]' : 'border-gray-200'}\`}>
                           {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                        </div>
                      </button>
                    );
                  })}
                  {members.filter(m => !groups.find(g => g._id === addingToGroup)?.members?.includes(m.email)).length === 0 && (
                    <p className="text-center py-4 text-sm text-gray-500 font-medium">All workspace members are already in this group.</p>
                  )}
                </div>
                <button 
                  onClick={handleAddMembers}
                  disabled={selectedNewMembers.length === 0}
                  className="w-full py-3.5 bg-[#2170E4] text-white rounded-2xl font-bold text-sm shadow-md disabled:opacity-30 transition-all hover:bg-blue-700 active:scale-95"
                >
                  Add to Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
`;

const oldRenderBlock = `                     {activeTab === 'home' ? (
                        <HomeTab
                          members={members.filter(m => m.email !== currentUserEmail)}
                          workspaceId={workspaceId}
                          onViewAllMembers={() => setIsFindingFriends(true)}
                          onStartChat={(user) => { startChat(user); setActiveTab('messenger'); }}
                        />
                     ) : (
                        <>
                           {activeTab === 'messenger' && (`;

const newRenderBlock = `                     {activeTab === 'home' ? (
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
                           {activeTab === 'messenger' && (`

content = content.replace(oldRenderBlock, newRenderBlock);
content = content.replace('const RichInput = ({ value, onChange, onSend, placeholder }) => {', channelsTabComponent + '\nconst RichInput = ({ value, onChange, onSend, placeholder }) => {');

fs.writeFileSync(file, content);
console.log('Successfully injected ChannelsTab component and modified render block.');
