import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Video, Calendar, Clock, Plus, Monitor, 
  Mic, MicOff, VideoOff, Shield, ChevronRight, MoreHorizontal,
  History, Settings as SettingsIcon, Users, PlayCircle, X, Loader2,
  Copy, Link2, Layout, Video as VideoIcon, Radio
} from 'lucide-react';

const MeetingHome = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');

  // Auth Guard
  useEffect(() => {
    if (!auth.user) {
      navigate('/login');
    }
  }, [auth.user, navigate]);
  const [roomCode, setRoomCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [pastMeetings, setPastMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    startTime: '',
    duration: 60
  });

  const fetchMeetings = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/meetings?workspaceId=${workspaceId}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.filter(m => m.status !== 'Ended'));
        setPastMeetings(data.filter(m => m.status === 'Ended'));
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [workspaceId]);

  const handleJoin = async () => {
    if (!roomCode) return;
    setIsValidating(true);
    setValidationError(null);

    let finalCode = roomCode;
    let finalPwd = joinPassword;

    if (roomCode.includes('Link:') || roomCode.includes('http')) {
        try {
            // 1. Extract URL from text if it's an invite block
            let urlString = roomCode;
            if (roomCode.includes('Link:')) {
                const parts = roomCode.split('Link:');
                urlString = parts[1].split('\n')[0].trim();
            } else if (roomCode.includes('http') && !roomCode.startsWith('http')) {
                const match = roomCode.match(/https?:\/\/[^\s]+/);
                if (match) urlString = match[0];
            }

            const url = new URL(urlString);
            const pathParts = url.pathname.split('/');
            finalCode = pathParts[pathParts.length - 1];
            const pwd = url.searchParams.get('pwd');
            if (pwd) finalPwd = pwd;
            
            console.log(`📡 [CLIENT] Extracted from paste: code=${finalCode}, pwd=${finalPwd}`);
        } catch (e) {
            console.error('❌ [CLIENT] Failed to parse meeting link/text:', e);
        }
    }

    try {
        const finalWorkspaceId = workspaceId || 'default';
        console.log(`📡 [CLIENT] Validating: code=${finalCode}, pwd=${finalPwd}, workspace=${finalWorkspaceId}`);
        
        // Add a controller to handle timeouts
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const res = await fetch(getApiUrl(`/api/meeting-logic/validate?workspaceId=${finalWorkspaceId}&roomId=${finalCode}&password=${finalPwd}`), {
            signal: controller.signal,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        clearTimeout(timeoutId);
        const data = await res.json();
        console.log(`📡 [CLIENT] Validation response:`, data);
        
        if (data.valid) {
            navigate(`/w/${finalWorkspaceId}/meet/room/${finalCode}?pwd=${finalPwd}&intent=join`);
        } else {
            setValidationError(data.error || 'Invalid meeting code');
        }
    } catch (err) {
        console.error('❌ [CLIENT] Validation Error:', err);
        if (err.name === 'AbortError') {
            setValidationError('Validation timed out. The server might be waking up or deploying. Please try again.');
        } else {
            setValidationError('Validation service unavailable. Please check your connection.');
        }
    } finally {
        setIsValidating(false);
    }
  };

  const handleStartInstant = async () => {
    const user = JSON.parse(localStorage.getItem('auth'));
    if (!user) return navigate('/login');

    const meetingId = Math.floor(1000000000 + Math.random() * 9000000000).toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    const password = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
       // Pre-register meeting to avoid race conditions with other participants joining
       await fetch(getApiUrl('/api/meetings/register'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
             workspaceId,
             title: 'Instant Meeting',
             host: user.user,
             hostEmail: user.email,
             roomId: meetingId,
             password: password || '',
             intent: 'create'
          })
       });
       
       navigate(`/w/${workspaceId}/meet/room/${meetingId}?pwd=${password}&intent=create`);
    } catch (e) {
       console.error("Failed to pre-register meeting:", e);
       // Fallback navigate even if register fails (less ideal)
       navigate(`/w/${workspaceId}/meet/room/${meetingId}?pwd=${password}&intent=create`);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('auth'));
    if (!user) return navigate('/login');
    
    const meetingId = Math.floor(1000000000 + Math.random() * 9000000000).toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    const password = Math.random().toString(36).substring(2, 8).toUpperCase();

    const meetingData = {
      workspaceId,
      title: newMeeting.title,
      startTime: newMeeting.startTime,
      duration: newMeeting.duration,
      host: user.user,
      hostEmail: user.email,
      roomId: meetingId,
      password: password
    };

    try {
      const res = await fetch(getApiUrl('/api/meetings/create'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(meetingData)
      });
      if (res.ok) {
        setShowScheduleModal(false);
        fetchMeetings();
        setNewMeeting({ title: '', startTime: '', duration: 60 });
      }
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
    }
  };

  return (
    <MeetingLayout>
      <div className="h-full bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans text-slate-900 dark:text-zinc-100">
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Nexus Video</h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">High-definition meetings for global teams</p>
            </div>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
                  <Shield size={12} className="text-emerald-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600/80">End-to-end Encrypted</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/5 border border-rose-500/10 rounded-full">
                  <Radio size={12} className="text-rose-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600/80">Cloud Recording Enabled</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Section (Left) */}
            <div className="lg:col-span-8 space-y-6">
               <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-white/5 flex flex-col md:row items-center gap-10">
                  
                  {/* Camera Preview Mockup */}
                  <div className="relative w-full max-w-[320px] aspect-[4/3] bg-slate-100 dark:bg-zinc-800 rounded-[24px] overflow-hidden flex flex-col items-center justify-center border border-slate-200 dark:border-white/10 shadow-inner group">
                     {cameraEnabled ? (
                        <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
                           <VideoIcon size={32} className="text-slate-300" />
                        </div>
                     ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                           <VideoOff size={32} strokeWidth={1.5} />
                           <span className="text-[9px] font-black uppercase tracking-[0.2em]">Camera Off</span>
                        </div>
                     )}
                     
                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <button 
                           onClick={() => setMicEnabled(!micEnabled)}
                           className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${micEnabled ? 'bg-white text-slate-900 shadow-sm' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}
                        >
                           {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                        </button>
                        <button 
                           onClick={() => setCameraEnabled(!cameraEnabled)}
                           className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${cameraEnabled ? 'bg-white text-slate-900 shadow-sm' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}
                        >
                           {cameraEnabled ? <VideoIcon size={14} /> : <VideoOff size={14} />}
                        </button>
                     </div>
                  </div>

                  {/* Join Controls */}
                  <div className="flex-1 space-y-5 w-full text-center md:text-left">
                     <div className="space-y-1">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Ready to join?</h2>
                        <p className="text-slate-500 dark:text-zinc-400 text-xs md:text-sm leading-relaxed max-w-sm">Check your audio and video before entering the secure meeting room.</p>
                     </div>

                     <button 
                        onClick={handleStartInstant}
                        className="w-full py-4 bg-[#5244e1] hover:bg-[#4336c9] text-white rounded-[18px] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95"
                     >
                        <Plus size={16} strokeWidth={3} /> Start Instant Meeting
                     </button>

                     <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                           ref={inputRef}
                           type="text" 
                           placeholder="Meeting ID or Link"
                           value={roomCode}
                           onChange={(e) => setRoomCode(e.target.value)}
                           className="flex-[2] bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[18px] px-5 py-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
                        />
                        <input 
                           type="text" 
                           placeholder="Password"
                           value={joinPassword}
                           onChange={(e) => setJoinPassword(e.target.value)}
                           className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[18px] px-5 py-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
                        />
                        <button 
                           onClick={handleJoin}
                           disabled={!roomCode || isValidating}
                           className="px-6 py-3.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-[18px] font-black text-xs transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 disabled:opacity-50"
                        >
                           {isValidating ? <Loader2 className="animate-spin" size={16} /> : 'Join'}
                        </button>
                     </div>
                     {validationError && <p className="text-rose-500 text-[9px] font-black uppercase tracking-wider px-2">{validationError}</p>}
                  </div>
               </div>

                {/* Bottom Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                   <ActionCard icon={Plus} label="New Meeting" sublabel="START NOW" color="bg-blue-600" onClick={handleStartInstant} />
                   <ActionCard icon={Layout} label="Join Meeting" sublabel="ENTER CODE" color="bg-indigo-600" onClick={() => inputRef.current?.focus()} />
                   <ActionCard icon={Calendar} label="Schedule" sublabel="PLAN AHEAD" color="bg-violet-600" onClick={() => setShowScheduleModal(true)} />
                   <ActionCard icon={Users} label="Share Link" sublabel="INVITE TEAM" color="bg-blue-500" onClick={() => inputRef.current?.focus()} />
                </div>

                {/* Meeting Intelligence History */}
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">Meeting Intelligence</h3>
                      <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">View All Reports</button>
                   </div>
                   
                   {pastMeetings.length === 0 ? (
                      <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-12 border border-slate-100 dark:border-white/5 text-center space-y-4">
                         <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-slate-200">
                            <History size={32} />
                         </div>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No intelligence reports available</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {pastMeetings.slice(0, 4).map(mtg => (
                            <div 
                               key={mtg._id} 
                               onClick={() => setSelectedMeeting(mtg)}
                               className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-[0_8px_20px_rgb(0,0,0,0.02)] hover:scale-[1.02] hover:shadow-xl transition-all cursor-pointer group"
                            >
                               <div className="flex items-start justify-between mb-4">
                                  <div className={`p-3 rounded-2xl transition-all ${mtg.recordingUrl ? 'bg-rose-500/10 text-rose-500 group-hover:bg-rose-500 group-hover:text-white' : 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                     {mtg.recordingUrl ? <Disc size={20} /> : <Monitor size={20} />}
                                  </div>
                                  <div className="flex flex-col items-end">
                                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        {new Date(mtg.startTime).toLocaleDateString()}
                                     </span>
                                     {mtg.recordingUrl && (
                                        <div className="flex items-center gap-1 text-[8px] font-black uppercase text-rose-500 mt-1">
                                           <div className="w-1 h-1 bg-rose-500 rounded-full animate-pulse" />
                                           Recording
                                        </div>
                                     )}
                                  </div>
                               </div>
                               <h4 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{mtg.title}</h4>
                               <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                                  {mtg.summary?.summary || "Meeting processing complete. Intelligence report ready for review."}
                               </p>
                               <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
                                  <div className="flex -space-x-2">
                                     <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-bold">
                                        {mtg.host[0]}
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-indigo-600">
                                     <span className="text-[10px] font-black uppercase tracking-widest">View Insights</span>
                                     <ChevronRight size={14} />
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             </div>

            {/* Sidebar (Right) */}
            <div className="lg:col-span-4 space-y-6">
               <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-white/5 min-h-[480px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-lg font-black text-slate-900 dark:text-white">Schedule</h3>
                     <button onClick={() => navigate(`/w/${workspaceId}/calendar`)} className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors">View Calendar</button>
                  </div>

                  <div className="flex-1 space-y-8">
                     {loading ? (
                        <div className="flex items-center justify-center h-40">
                           <Loader2 className="animate-spin text-slate-300" size={32} />
                        </div>
                     ) : meetings.length === 0 ? (
                        <div className="text-center py-12 space-y-4 opacity-50">
                           <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                              <Calendar size={32} />
                           </div>
                           <p className="text-xs font-bold text-slate-400">No meetings scheduled</p>
                        </div>
                     ) : (
                        meetings.map((mtg, idx) => (
                           <div key={mtg._id} className="flex items-start justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 -mx-3 px-3 py-2.5 rounded-xl transition-all">
                              <div className="space-y-0.5">
                                 <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{mtg.title}</h4>
                                 <p className="text-[9px] font-bold text-slate-400">
                                    {new Date(mtg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </p>
                                 <div className="flex items-center gap-1.5 pt-1.5">
                                    <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[7px] font-black uppercase">
                                       {mtg.host[0]}
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-500">Host: {mtg.host}</span>
                                 </div>
                              </div>
                              <div className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full text-[7px] font-black uppercase tracking-widest text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                 {mtg.roomId.slice(-8)}
                              </div>
                           </div>
                        ))
                     )}
                  </div>

                  {/* Personal ID Card */}
                  <div className="mt-6 p-4 bg-slate-50 dark:bg-white/5 rounded-[20px] space-y-2">
                     <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Your Personal Meeting ID</p>
                     <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">482-019-2841</span>
                        <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all text-slate-400">
                           <Copy size={14} />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal (Reusing existing functionality) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)} />
           <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[40px] p-10 relative z-10 shadow-2xl border border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between mb-8">
                 <h2 className="text-2xl font-black">Schedule Meeting</h2>
                 <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all">
                    <X size={24} />
                 </button>
              </div>
              
              <form onSubmit={handleSchedule} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meeting Title</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Design Review"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={newMeeting.title}
                      onChange={e => setNewMeeting({...newMeeting, title: e.target.value})}
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Time</label>
                       <input 
                         required
                         type="datetime-local" 
                         className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                         value={newMeeting.startTime}
                         onChange={e => setNewMeeting({...newMeeting, startTime: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration (min)</label>
                       <input 
                         required
                         type="number" 
                         className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                         value={newMeeting.duration}
                         onChange={e => setNewMeeting({...newMeeting, duration: e.target.value})}
                       />
                    </div>
                 </div>

                 <button type="submit" className="w-full py-5 bg-[#5244e1] hover:bg-[#4336c9] text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95 mt-4">
                    Confirm Schedule
                 </button>
              </form>
           </div>
        </div>
      )}

       {/* Intelligence Modal */}
       {selectedMeeting && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedMeeting(null)} />
             <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[32px] md:rounded-[40px] shadow-2xl relative z-10 border border-slate-100 dark:border-white/5 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                
                {/* Modal Header */}
                <div className="p-5 md:p-8 border-b border-slate-50 dark:border-white/5 flex items-center justify-between shrink-0">
                   <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white">{selectedMeeting.title}</h2>
                         <div className="px-2 md:px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest">Report</div>
                      </div>
                      <p className="text-[10px] md:text-sm text-slate-500 font-medium">{new Date(selectedMeeting.startTime).toLocaleDateString()} • {selectedMeeting.host}</p>
                   </div>
                   <button onClick={() => setSelectedMeeting(null)} className="p-2 md:p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-400">
                      <X size={20} md:size={24} />
                   </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-10">
                   
                   {/* Recording Player Section */}
                   {selectedMeeting.recordingUrl && (
                      <div className="space-y-4">
                         <h3 className="text-[10px] md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                            <Radio size={14} className="text-rose-500" /> Session Recording
                         </h3>
                         <div className="relative group rounded-[24px] md:rounded-[32px] overflow-hidden bg-slate-950 border border-white/5 aspect-video md:aspect-[21/9] flex items-center justify-center shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-50" />
                            
                            {/* Standard HTML5 Player with custom styling via CSS (simulated here) */}
                            <audio 
                               controls 
                               src={selectedMeeting.recordingUrl} 
                               className="relative z-10 w-full max-w-2xl accent-indigo-500"
                            />
                            
                            <div className="absolute top-6 right-6 flex items-center gap-2">
                               <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest text-white border border-white/10">
                                  HQ Audio
                               </div>
                            </div>

                            <div className="absolute bottom-6 left-8">
                               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Source File</p>
                               <p className="text-xs font-bold text-white/60">{selectedMeeting.recordingUrl.split('/').pop()}</p>
                            </div>
                         </div>
                      </div>
                   )}

                   {/* Summary Section */}
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                      <div className="lg:col-span-2 space-y-8">
                         <div className="space-y-4">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                               <Plus className="rotate-45 text-blue-500" size={18} /> Executive Summary
                            </h3>
                            <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                               {selectedMeeting.summary?.summary || "The meeting intelligence engine is still analyzing the recording. Please check back in a few minutes for the full summary."}
                            </p>
                         </div>

                         {selectedMeeting.summary?.keyPoints && (
                            <div className="space-y-4">
                               <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <Plus className="rotate-45 text-indigo-500" size={18} /> Key Discussion Points
                               </h3>
                               <ul className="space-y-3">
                                  {selectedMeeting.summary.keyPoints.map((point, i) => (
                                     <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-zinc-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                        {point}
                                     </li>
                                  ))}
                               </ul>
                            </div>
                         )}

                         {selectedMeeting.summary?.actionItems && (
                            <div className="space-y-4">
                               <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <Plus className="rotate-45 text-emerald-500" size={18} /> Action Items
                               </h3>
                               <div className="grid grid-cols-1 gap-3">
                                  {selectedMeeting.summary.actionItems.map((item, i) => (
                                     <div key={i} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                           <div className="w-8 h-8 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                                              <Check size={16} />
                                           </div>
                                           <span className="text-sm font-bold text-slate-800 dark:text-white">{item.task}</span>
                                        </div>
                                        <div className="text-right">
                                           <p className="text-[10px] font-black uppercase text-slate-400">{item.owner}</p>
                                           <p className="text-[9px] font-bold text-emerald-600">{item.deadline}</p>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            </div>
                         )}
                      </div>

                      <div className="space-y-8">
                         {/* Sidebar Stats */}
                         <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-[32px] border border-slate-100 dark:border-white/5 space-y-6">
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Duration</p>
                               <p className="text-xl font-black text-slate-900 dark:text-white">{selectedMeeting.duration} Minutes</p>
                            </div>
                            <div className="h-px bg-slate-200 dark:bg-white/5" />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Room Code</p>
                               <p className="text-xl font-black text-slate-900 dark:text-white uppercase tabular-nums">{selectedMeeting.roomId}</p>
                            </div>
                            <div className="h-px bg-slate-200 dark:bg-white/5" />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Insights Confidence</p>
                               <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                     <div className="h-full bg-blue-500 rounded-full" style={{ width: '92%' }} />
                                  </div>
                                  <span className="text-xs font-black">92%</span>
                               </div>
                            </div>
                         </div>

                         {/* Transcript Snippet Toggle */}
                         <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Transcript Preview</h3>
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 h-48 overflow-y-auto text-[11px] leading-relaxed text-slate-500 font-medium font-mono italic">
                               {selectedMeeting.transcript || "Full transcript is available in the workspace records."}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Modal Footer */}
                <div className="p-8 border-t border-slate-50 dark:border-white/5 shrink-0 flex items-center justify-between">
                   <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                      <Copy size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Copy Summary Link</span>
                   </button>
                   <button className="px-8 py-4 bg-[#5244e1] text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                      Export Report
                   </button>
                </div>
             </div>
          </div>
       )}
    </MeetingLayout>
  );
};

const ActionCard = ({ icon: Icon, label, sublabel, color, onClick }) => (
   <button 
      onClick={onClick}
      className="bg-white dark:bg-zinc-900 p-4 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-[0_8px_20px_rgb(0,0,0,0.02)] flex flex-col items-center gap-3 group hover:scale-105 hover:shadow-xl transition-all"
   >
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:rotate-12 transition-transform`}>
         <Icon size={20} />
      </div>
      <div className="text-center">
         <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">{label}</h4>
         <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">{sublabel}</p>
      </div>
   </button>
);

export default MeetingHome;
