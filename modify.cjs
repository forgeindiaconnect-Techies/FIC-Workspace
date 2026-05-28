const fs = require('fs');
const path = 'd:/New folder/src/pages/MeetingApp.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /import \{([^}]+)\} from 'lucide-react';/,
  (match, p1) => {
    return 'import {' + p1 + ', Wand2, Sparkles, FlipHorizontal, Lock, Play, PhoneOff, ChevronRight} from \'lucide-react\';';
  }
);

content = content.replace(
  /const \[roomLocked, setRoomLocked\] = useState\(false\);/,
  `const [roomLocked, setRoomLocked] = useState(false);
  const [aiAssistantActive, setAiAssistantActive] = useState(false);
  const [hostControlsModal, setHostControlsModal] = useState(false);
  const [hostControlsTab, setHostControlsTab] = useState('meeting');
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  
  const aiMediaRecorderRef = useRef(null);
  const aiWsRef = useRef(null);
  const isMutedRef = useRef(!micOn);
  useEffect(() => { isMutedRef.current = !micOn; }, [micOn]);
  
  const handleStartAI = async () => {
     if (aiAssistantActive) return;
     try {
        const meetingId = meetingMetadata?._id || meetingMetadata?.meetingId || id;
        if (!meetingId) return;
        setAiAssistantActive(true);
        await fetch(getApiUrl(\`/api/meetings/\${meetingId}/start-ai\`), {
           method: 'POST',
           headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${localStorage.getItem('token')}\`
           },
           body: JSON.stringify({ frontendUrl: window.location.origin })
        });
     } catch(e) {
        console.error('Failed to start AI', e);
        setAiAssistantActive(false);
     }
  };

  useEffect(() => {
    if (aiAssistantActive && streamRef.current && !window.isAIBot) {
      const API_URL = getApiUrl('/');
      let wsBase = API_URL;
      if (wsBase.startsWith('https://')) wsBase = wsBase.replace('https://', 'wss://');
      else if (wsBase.startsWith('http://')) wsBase = wsBase.replace('http://', 'ws://');
      else wsBase = \`wss://\${wsBase}\`;
      wsBase = wsBase.replace(/\\/+$/, '');
      const wsUrl = \`\${wsBase}/ws/audio\`;

      const ws = new WebSocket(wsUrl);
      aiWsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'metadata',
          meetingId: meetingMetadata?._id || meetingMetadata?.meetingId || id,
          userId: auth._id || auth.id || 'unknown-user',
          speakerName: auth.user || 'User'
        }));
      };

      try {
        const audioTracks = streamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          const stream = new MediaStream([audioTracks[0]]);
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
          
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          aiMediaRecorderRef.current = recorder;

          let chunkBuffer = [];
          let flushTimer = null;

          const flush = () => {
             if (chunkBuffer.length === 0 || ws.readyState !== WebSocket.OPEN || isMutedRef.current) {
                chunkBuffer = [];
                return;
             }
             const blob = new Blob(chunkBuffer, { type: recorder.mimeType || 'audio/webm' });
             if (blob.size > 1000) {
                blob.arrayBuffer().then(buf => {
                   if (ws.readyState === WebSocket.OPEN) {
                      ws.send(buf);
                   }
                });
             }
             chunkBuffer = [];
          };

          recorder.ondataavailable = (e) => {
             if (e.data.size > 0) chunkBuffer.push(e.data);
          };

          recorder.start(1000);
          flushTimer = setInterval(flush, 10000);

          return () => {
             if (flushTimer) clearInterval(flushTimer);
             flush();
             if (aiMediaRecorderRef.current) {
                try { aiMediaRecorderRef.current.stop(); } catch {}
                aiMediaRecorderRef.current = null;
             }
             if (aiWsRef.current) {
                aiWsRef.current.close();
                aiWsRef.current = null;
             }
          };
        }
      } catch (e) {
         console.warn('Could not start MediaRecorder for AI:', e);
      }
    }
  }, [aiAssistantActive, streamRef.current]);`
);

content = content.replace(
  /<button onClick=\{\(\) => setActiveSidebar\(activeSidebar === 'chat' \? null : 'chat'\)\} className=\{`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all \$\{activeSidebar === 'chat' \? 'bg-white\/10' : 'bg-white\/5 hover:bg-white\/10 text-zinc-400'\}`\}>([\s\S]*?)<\/button>/,
  `<button onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')} className={\`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all \${activeSidebar === 'chat' ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}\`}>$1</button>
                <button onClick={handleStartAI} className={\`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all \${aiAssistantActive ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}\`}>
                   <Wand2 size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">AI Bot</span>
                </button>
                {isHost && (
                   <button onClick={() => setHostControlsModal(true)} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all bg-white/5 hover:bg-white/10 text-zinc-400">
                      <Shield size={16}/>
                      <span className="hidden md:block text-[7px] font-bold uppercase mt-1">Security</span>
                   </button>
                )}`
);

content = content.replace(
  /\{\/\* 3\. ENDED STATE \*\/\}/,
  `{/* HOST CONTROLS MODAL */}
      {hostControlsModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 animate-in fade-in duration-200">
           <div className="w-full max-w-lg bg-[#0f172a] rounded-t-[32px] overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-300 shadow-2xl border border-white/10">
              <div className="flex items-center justify-center pt-3 pb-1">
                 <div className="w-10 h-1 bg-white/10 rounded-full" />
              </div>
              <div className="p-6 pb-2 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                       <Shield size={20} className="text-white" />
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight">Host Controls</h2>
                 </div>
                 <button onClick={() => setHostControlsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">
                    <X size={18} />
                 </button>
              </div>
              
              <div className="px-4 py-3 flex gap-2">
                 {['meeting', 'participants', 'permissions'].map(tab => (
                    <button 
                       key={tab}
                       onClick={() => setHostControlsTab(tab)}
                       className={\`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all \${hostControlsTab === tab ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}\`}
                    >{tab}</button>
                 ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 pt-2">
                 {hostControlsTab === 'meeting' && (
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Meeting Actions</p>
                          <button onClick={handleEndCall} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors group">
                             <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center"><PhoneOff size={18} className="text-white" /></div>
                             <div className="text-left flex-1">
                                <p className="text-sm font-bold text-rose-500">End Meeting for All</p>
                                <p className="text-[10px] font-medium text-rose-500/70">Terminate the session for everyone</p>
                             </div>
                             <ChevronRight size={18} className="text-rose-500/50 group-hover:text-rose-500" />
                          </button>
                       </div>
                       
                       <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Access Settings</p>
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                             <div className="flex-1">
                                <p className="text-sm font-bold text-white">Enable Waiting Room</p>
                                <p className="text-[10px] font-medium text-zinc-400">Hold participants until admitted</p>
                             </div>
                             <button onClick={() => setWaitingRoomEnabled(!waitingRoomEnabled)} className={\`w-12 h-7 rounded-full transition-all relative \${waitingRoomEnabled ? 'bg-blue-500' : 'bg-white/10'}\`}>
                                <div className={\`absolute top-1 w-5 h-5 rounded-full bg-white transition-all \${waitingRoomEnabled ? 'right-1' : 'left-1'}\`} />
                             </button>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                             <div className="flex-1">
                                <p className="text-sm font-bold text-white">Lock Meeting</p>
                                <p className="text-[10px] font-medium text-zinc-400">Prevent anyone else from joining</p>
                             </div>
                             <button onClick={() => setRoomLocked(!roomLocked)} className={\`w-12 h-7 rounded-full transition-all relative \${roomLocked ? 'bg-blue-500' : 'bg-white/10'}\`}>
                                <div className={\`absolute top-1 w-5 h-5 rounded-full bg-white transition-all \${roomLocked ? 'right-1' : 'left-1'}\`} />
                             </button>
                          </div>
                       </div>
                    </div>
                 )}
                 {hostControlsTab === 'participants' && (
                    <div className="space-y-3">
                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Manage Participants ({peers.length + 1})</p>
                       <div className="p-3 bg-white/5 rounded-2xl flex items-center justify-between border border-white/5">
                          <div className="flex items-center gap-3">
                             <UserAvatar name={auth.user} size="sm" />
                             <div>
                                <p className="text-xs font-bold text-white">{auth.user}</p>
                                <p className="text-[9px] font-black uppercase text-blue-500">Host (You)</p>
                             </div>
                          </div>
                       </div>
                       {peers.map(p => (
                          <div key={p.peerID} className="p-3 bg-white/5 rounded-2xl flex items-center justify-between border border-white/5">
                             <div className="flex items-center gap-3">
                                <UserAvatar name={p.name} size="sm" />
                                <p className="text-xs font-bold text-white">{p.name}</p>
                             </div>
                             <div className="flex gap-2">
                                <button className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase text-zinc-300 hover:text-white transition-colors">Kick</button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
                 {hostControlsTab === 'permissions' && (
                    <div className="space-y-4">
                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Allow Participants To:</p>
                       {['Share Screen', 'Chat', 'Unmute themselves', 'Start Video'].map(perm => (
                          <div key={perm} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                             <p className="text-sm font-bold text-white">{perm}</p>
                             <button className="w-12 h-7 rounded-full bg-blue-500 transition-all relative">
                                <div className="absolute top-1 w-5 h-5 rounded-full bg-white right-1" />
                             </button>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* 3. ENDED STATE */}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('MeetingApp.jsx successfully restored and updated!');
