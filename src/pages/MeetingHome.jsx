import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Plus, Calendar, Clock, Users, ChevronRight, LogIn, Disc, 
  Monitor, Check, X, Loader2, Bell, BellRing, Copy, Video, Play, PlayCircle, Shield, Radio, Search
} from 'lucide-react';

const ROOMS = [
  { id: 'dev-standup', title: 'Daily Standup', tag: 'D', color: '#10b981', members: 4 },
  { id: 'design-sync', title: 'Design Sync', tag: 'UI', color: '#8b5cf6', members: 0 },
  { id: 'all-hands', title: 'All Hands', tag: 'A', color: '#f59e0b', members: 0 },
];

const MeetingHome = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');

  useEffect(() => {
    if (!auth.user) {
      navigate('/login');
    }
  }, [auth.user, navigate]);

  const [meetings, setMeetings] = useState([]);
  const [pastMeetings, setPastMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [roomsModal, setRoomsModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null); // Intelligence Modal

  // Form states
  const [meetTitle, setMeetTitle] = useState('');
  const [meetPass, setMeetPass] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPass, setJoinPass] = useState('');
  const [reminders, setReminders] = useState([]);

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

  const handleStartInstant = async () => {
    setLoading(true);
    const meetingId = Math.floor(1000000000 + Math.random() * 9000000000).toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    const password = meetPass || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
       await fetch(getApiUrl('/api/meetings/register'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
             workspaceId,
             title: meetTitle || 'Instant Meeting',
             host: auth.user,
             hostEmail: auth.email,
             roomId: meetingId,
             password: password || '',
             intent: 'create'
          })
       });
       setCreateModal(false);
       navigate(`/w/${workspaceId}/meet/room/${meetingId}?pwd=${password}&intent=create`);
    } catch (e) {
       console.error("Failed to pre-register meeting:", e);
       setCreateModal(false);
       navigate(`/w/${workspaceId}/meet/room/${meetingId}?pwd=${password}&intent=create`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setIsValidating(true);
    let finalCode = joinCode;
    let finalPwd = joinPass;

    if (joinCode.includes('Link:') || joinCode.includes('http')) {
        try {
            let urlString = joinCode;
            if (joinCode.includes('Link:')) {
                const parts = joinCode.split('Link:');
                urlString = parts[1].split('\n')[0].trim();
            } else if (joinCode.includes('http') && !joinCode.startsWith('http')) {
                const match = joinCode.match(/https?:\/\/[^\s]+/);
                if (match) urlString = match[0];
            }
            const url = new URL(urlString);
            const pathParts = url.pathname.split('/');
            finalCode = pathParts[pathParts.length - 1];
            const pwd = url.searchParams.get('pwd');
            if (pwd) finalPwd = pwd;
        } catch (e) {}
    }

    try {
        const finalWorkspaceId = workspaceId || 'default';
        const res = await fetch(getApiUrl(`/api/meeting-logic/validate?workspaceId=${finalWorkspaceId}&roomId=${finalCode}&password=${finalPwd}`), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.valid) {
            setJoinModal(false);
            navigate(`/w/${finalWorkspaceId}/meet/room/${finalCode}?pwd=${finalPwd}&intent=join`);
        } else {
            alert(data.error || 'Invalid meeting code');
        }
    } catch (err) {
        alert('Validation service unavailable.');
    } finally {
        setIsValidating(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setLoading(true);
    const meetingId = Math.floor(1000000000 + Math.random() * 9000000000).toString().replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    const password = Math.random().toString(36).substring(2, 8).toUpperCase();

    const meetingData = {
      workspaceId,
      title: newMeeting.title || 'Scheduled Meeting',
      startTime: newMeeting.startTime,
      duration: newMeeting.duration || 60,
      host: auth.user,
      hostEmail: auth.email,
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
        setScheduleModal(false);
        fetchMeetings();
        setNewMeeting({ title: '', startTime: '', duration: 60 });
      }
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
    } finally {
      setLoading(false);
    }
  };

  const enterPersistentRoom = async (room) => {
     try {
       await fetch(getApiUrl('/api/meetings/register'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
             workspaceId,
             title: room.title,
             host: auth.user,
             roomId: room.id,
             password: '',
             intent: 'join'
          })
       });
       setRoomsModal(false);
       navigate(`/w/${workspaceId}/meet/room/${room.id}?intent=join`);
     } catch(e) {
       console.error(e);
       setRoomsModal(false);
       navigate(`/w/${workspaceId}/meet/room/${room.id}?intent=join`);
     }
  };

  const generateSummary = (mtg) => {
     setSelectedMeeting(mtg);
  };

  return (
    <MeetingLayout>
      <div className="h-full bg-slate-50 dark:bg-[#0a0f1e] overflow-y-auto font-sans text-slate-900 dark:text-zinc-100 flex flex-col items-center">
        <div className="w-full max-w-4xl px-4 py-8 space-y-10">
          
          {/* Quick Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => setCreateModal(true)} className="flex flex-col items-start gap-4 bg-blue-600 hover:bg-blue-700 transition-colors rounded-[24px] p-5 text-left shadow-lg shadow-blue-600/20 active:scale-95">
               <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
                 <Plus size={22} className="text-white" />
               </div>
               <div>
                 <p className="text-base font-black text-white">New Meeting</p>
                 <p className="text-xs text-white/75 font-medium mt-0.5">Start instantly</p>
               </div>
            </button>
            <button onClick={() => setJoinModal(true)} className="flex flex-col items-start gap-4 bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-[24px] p-5 text-left shadow-lg shadow-indigo-600/20 active:scale-95">
               <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
                 <LogIn size={22} className="text-white" />
               </div>
               <div>
                 <p className="text-base font-black text-white">Join</p>
                 <p className="text-xs text-white/75 font-medium mt-0.5">Enter room code</p>
               </div>
            </button>
            <button onClick={() => setScheduleModal(true)} className="flex flex-col items-start gap-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors rounded-[24px] p-5 text-left active:scale-95">
               <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                 <Calendar size={22} className="text-slate-600 dark:text-slate-300" />
               </div>
               <div>
                 <p className="text-base font-black text-slate-900 dark:text-white">Schedule</p>
                 <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">Plan ahead</p>
               </div>
            </button>
            <button onClick={() => setRoomsModal(true)} className="flex flex-col items-start gap-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors rounded-[24px] p-5 text-left active:scale-95">
               <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                 <Users size={22} className="text-slate-600 dark:text-slate-300" />
               </div>
               <div>
                 <p className="text-base font-black text-slate-900 dark:text-white">Rooms</p>
                 <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">Persistent spaces</p>
               </div>
            </button>
          </div>

          {/* Persistent Rooms */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white px-1">Persistent Rooms</h2>
            <div className="space-y-3">
               {ROOMS.map(room => (
                 <div key={room.id} onClick={() => enterPersistentRoom(room)} className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
                   <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${room.color}20` }}>
                      <span className="text-base font-black" style={{ color: room.color }}>{room.tag}</span>
                   </div>
                   <div className="flex-1">
                      <p className="text-[15px] font-black text-slate-900 dark:text-white leading-tight">{room.title}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 mt-1">{room.id}</p>
                   </div>
                   <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${room.members > 0 ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${room.members > 0 ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
                      <span className="text-[11px] font-bold">{room.members} online</span>
                   </div>
                   <ChevronRight size={18} className="text-slate-400 shrink-0" />
                 </div>
               ))}
            </div>
          </div>

          {/* Today's Agenda */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white px-1">Today's Agenda</h2>
            <div className="space-y-3">
               {meetings.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl p-8 text-center">
                    <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No upcoming meetings</p>
                  </div>
               ) : (
                 meetings.map(m => (
                   <div key={m._id} onClick={() => navigate(`/w/${workspaceId}/meet/room/${m.roomId}?intent=join`)} className="flex flex-col md:flex-row md:items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm overflow-hidden relative group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      <div className="w-11 h-11 bg-blue-500/10 rounded-[14px] flex items-center justify-center shrink-0 ml-2">
                        {m.status === 'live' ? <Play size={18} className="text-blue-500" fill="currentColor" /> : <Clock size={18} className="text-blue-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                           <p className="text-[15px] font-black text-slate-900 dark:text-white leading-tight">{m.title}</p>
                           {m.status === 'live' && (
                              <div className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-md">
                                <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-500 uppercase">Live</span>
                              </div>
                           )}
                           {reminders.includes(m._id) && <BellRing size={13} className="text-blue-500" />}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                           <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                             <Clock size={12} />
                             <span className="text-xs font-bold">{new Date(m.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                             <Users size={12} />
                             <span className="text-xs font-bold">{m.attendees || 0}</span>
                           </div>
                           <span className="text-[11px] font-black text-slate-400 dark:text-slate-500">{m.duration} min</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); setReminders(p => p.includes(m._id) ? p.filter(x=>x!==m._id) : [...p, m._id]); }} className={`w-8 h-8 rounded-full flex items-center justify-center ${reminders.includes(m._id) ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                           <Bell size={14} />
                        </button>
                        <button className="px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-black">Join</button>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>

          {/* Recent Meetings */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white px-1">Recent Meetings</h2>
            <div className="space-y-3">
               {pastMeetings.length === 0 ? (
                 <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl p-8 text-center">
                    <Clock size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No recent meetings</p>
                  </div>
               ) : (
                 pastMeetings.map(m => (
                   <div key={m._id} className="flex flex-col md:flex-row md:items-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl p-4 shadow-sm relative">
                      <div className="w-11 h-11 bg-slate-100 dark:bg-white/5 rounded-[14px] flex items-center justify-center shrink-0">
                        <Clock size={18} className="text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[15px] font-black text-slate-900 dark:text-white leading-tight">{m.title}</p>
                        <div className="flex items-center gap-4 mt-2">
                           <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                             <Calendar size={12} />
                             <span className="text-xs font-bold">{new Date(m.startTime).toLocaleDateString()}</span>
                           </div>
                           <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                             <Users size={12} />
                             <span className="text-xs font-bold">{m.attendees || 0} attended</span>
                           </div>
                        </div>
                      </div>
                      <button onClick={() => generateSummary(m)} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[11px] font-black uppercase tracking-widest shrink-0 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                         AI Summary
                      </button>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {createModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">New Meeting</h2>
                 <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-4 mb-8">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Meeting Title</label>
                    <input type="text" value={meetTitle} onChange={e=>setMeetTitle(e.target.value)} placeholder="e.g. Design Sync" className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Passcode (optional)</label>
                    <input type="password" value={meetPass} onChange={e=>setMeetPass(e.target.value)} placeholder="Leave blank for open access" className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                 </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setCreateModal(false)} className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-black transition-colors hover:bg-slate-50 dark:hover:bg-white/5">Cancel</button>
                 <button onClick={handleStartInstant} disabled={loading} className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors flex items-center justify-center">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Start Now'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* JOIN MODAL */}
      {joinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Join Meeting</h2>
                 <button onClick={() => setJoinModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-4 mb-8">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Meeting ID or Link</label>
                    <input type="text" value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="e.g. 123-456-789" className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Passcode (if required)</label>
                    <input type="password" value={joinPass} onChange={e=>setJoinPass(e.target.value)} placeholder="Leave blank if none" className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                 </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setJoinModal(false)} className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-black transition-colors hover:bg-slate-50 dark:hover:bg-white/5">Cancel</button>
                 <button onClick={handleJoin} disabled={isValidating} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black transition-colors flex items-center justify-center">
                    {isValidating ? <Loader2 size={18} className="animate-spin" /> : 'Join Session'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {scheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Schedule Meeting</h2>
                 <button onClick={() => setScheduleModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleSchedule} className="space-y-4 mb-8">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Meeting Title</label>
                    <input required type="text" value={newMeeting.title} onChange={e=>setNewMeeting({...newMeeting, title: e.target.value})} placeholder="e.g. Design Sync" className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Start Time</label>
                       <input required type="datetime-local" value={newMeeting.startTime} onChange={e=>setNewMeeting({...newMeeting, startTime: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Duration (min)</label>
                       <input required type="number" value={newMeeting.duration} onChange={e=>setNewMeeting({...newMeeting, duration: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                 </div>
                 <button type="submit" disabled={loading} className="w-full h-12 mt-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black transition-colors flex items-center justify-center">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* ROOMS MODAL */}
      {roomsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-4 px-2">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Persistent Rooms</h2>
                 <button onClick={() => setRoomsModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-2 mb-6">
                 {ROOMS.map(room => (
                   <div key={room.id} onClick={() => enterPersistentRoom(room)} className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 rounded-2xl p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                     <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${room.color}20` }}>
                        <span className="text-sm font-black" style={{ color: room.color }}>{room.tag}</span>
                     </div>
                     <div className="flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{room.title}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">{room.id}</p>
                     </div>
                     <div className={`flex items-center justify-center px-2 py-1 rounded-lg ${room.members > 0 ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                        <span className="text-[9px] font-bold uppercase">{room.members} online</span>
                     </div>
                   </div>
                 ))}
              </div>
              <button onClick={() => setRoomsModal(false)} className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-black transition-colors hover:bg-slate-50 dark:hover:bg-white/5">Close</button>
           </div>
        </div>
      )}

       {/* INTELLIGENCE MODAL */}
       {selectedMeeting && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-md animate-in fade-in">
             <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl relative z-10 border border-slate-100 dark:border-white/5 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-5 border-b border-slate-50 dark:border-white/5 flex items-center justify-between shrink-0">
                   <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">{selectedMeeting.title}</h2>
                         <div className="px-2 md:px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest">AI Report</div>
                      </div>
                      <p className="text-[10px] md:text-xs text-slate-500 font-medium">{new Date(selectedMeeting.startTime).toLocaleDateString()} • {selectedMeeting.host}</p>
                   </div>
                   <button onClick={() => setSelectedMeeting(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-400">
                      <X size={20} />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-10">
                   {selectedMeeting.recordingUrl && (
                      <div className="space-y-4">
                         <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                            <Radio size={14} className="text-rose-500" /> Session Recording
                         </h3>
                         <div className="relative group rounded-[24px] overflow-hidden bg-slate-950 border border-white/5 aspect-video md:aspect-[21/9] flex items-center justify-center shadow-2xl">
                            <audio controls src={selectedMeeting.recordingUrl} className="relative z-10 w-full max-w-2xl" />
                         </div>
                      </div>
                   )}

                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                      <div className="lg:col-span-2 space-y-8">
                         <div className="space-y-4">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                               <Plus className="rotate-45 text-blue-500" size={18} /> Executive Summary
                            </h3>
                            <div className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedMeeting.summary?.summary || "The meeting intelligence engine is still analyzing the recording." }} />
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
                      </div>

                      <div className="space-y-8">
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
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       )}

    </MeetingLayout>
  );
};

export default MeetingHome;
