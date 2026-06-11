import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Plus, Calendar, Clock, Users, ChevronRight, LogIn, 
  Check, X, Loader2, Bell, BellRing, Video, Play, Search, Home
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

  // Form states
  const [meetTitle, setMeetTitle] = useState('');
  const [meetPass, setMeetPass] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPass, setJoinPass] = useState('');
  const [reminders, setReminders] = useState([]);
  const [instantAi, setInstantAi] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const [newMeeting, setNewMeeting] = useState({
    title: '',
    startTime: '',
    duration: 60,
    aiEnabled: true
  });

  const generateSummary = (mtg) => {
     setSelectedMeeting(mtg);
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/meetings/history?page=1&limit=20`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        const meetingsList = Array.isArray(data) ? data : (data.meetings || []);
        setMeetings(meetingsList.filter(m => m.status?.toLowerCase() !== 'ended'));
        setPastMeetings(meetingsList.filter(m => m.status?.toLowerCase() === 'ended'));
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
    const password = meetPass || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
       const res = await fetch(getApiUrl('/api/meetings'), {
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
             passcode: password || '',
             aiEnabled: instantAi,
             intent: 'create'
          })
       });
       const meeting = await res.json();
       if (!res.ok) {
         throw new Error(meeting.error || 'Failed to create meeting.');
       }
       setCreateModal(false);
       navigate(`/w/${workspaceId}/meet/room/${meeting.joinCode}?pwd=${password}&intent=join`);
    } catch (e) {
       console.error("Failed to pre-register meeting:", e);
       alert(e.message || 'Failed to create meeting. Please try again.');
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
        const res = await fetch(getApiUrl(`/api/meetings/join/${encodeURIComponent(finalCode)}?passcode=${encodeURIComponent(finalPwd || '')}`), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (res.ok && (data._id || data.meetingId || data.joinCode)) {
            setJoinModal(false);
            navigate(`/w/${finalWorkspaceId}/meet/room/${data.joinCode || finalCode}?pwd=${finalPwd}&intent=join`);
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
    const password = Math.random().toString(36).substring(2, 8).toUpperCase();

    const meetingData = {
      workspaceId,
      title: newMeeting.title || 'Scheduled Meeting',
      scheduledAt: newMeeting.startTime,
      durationMinutes: newMeeting.duration || 60,
      host: auth.user,
      hostEmail: auth.email,
      passcode: password,
      aiEnabled: newMeeting.aiEnabled
    };

    try {
      const res = await fetch(getApiUrl('/api/meetings'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(meetingData)
      });
      if (res.ok) {
        setScheduleModal(false);
        fetchMeetings();
        setNewMeeting({ title: '', startTime: '', duration: 60, aiEnabled: true });
      }
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
    } finally {
      setLoading(false);
    }
  };

  const enterPersistentRoom = async (room) => {
     try {
       await fetch(getApiUrl('/api/meetings'), {
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

  return (
    <MeetingLayout>
      <div className="h-full bg-slate-50 overflow-y-auto font-sans text-slate-900 flex flex-col items-center">
        <div className="w-full max-w-5xl px-6 py-8 space-y-8">
          
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-800">Meetings Dashboard</h1>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button onClick={() => setCreateModal(true)} className="flex flex-col items-start gap-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all rounded-lg p-5 text-left">
               <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                 <Plus size={20} className="text-blue-700" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-slate-900">New Meeting</p>
                 <p className="text-xs text-slate-500 mt-1">Start an instant meeting</p>
               </div>
            </button>
            <button onClick={() => setJoinModal(true)} className="flex flex-col items-start gap-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all rounded-lg p-5 text-left">
               <div className="w-10 h-10 rounded bg-indigo-100 flex items-center justify-center">
                 <LogIn size={20} className="text-indigo-700" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-slate-900">Join Meeting</p>
                 <p className="text-xs text-slate-500 mt-1">Enter a room code or link</p>
               </div>
            </button>
            <button onClick={() => setScheduleModal(true)} className="flex flex-col items-start gap-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all rounded-lg p-5 text-left">
               <div className="w-10 h-10 rounded bg-emerald-100 flex items-center justify-center">
                 <Calendar size={20} className="text-emerald-700" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-slate-900">Schedule</p>
                 <p className="text-xs text-slate-500 mt-1">Plan a future meeting</p>
               </div>
            </button>
            <button onClick={() => setRoomsModal(true)} className="flex flex-col items-start gap-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all rounded-lg p-5 text-left">
               <div className="w-10 h-10 rounded bg-orange-100 flex items-center justify-center">
                 <Users size={20} className="text-orange-700" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-slate-900">Persistent Rooms</p>
                 <p className="text-xs text-slate-500 mt-1">Join a dedicated space</p>
               </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Today's Agenda */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Upcoming Meetings</h2>
                <div className="space-y-3">
                   {meetings.length === 0 ? (
                      <div className="py-8 text-center">
                        <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">No upcoming meetings scheduled.</p>
                      </div>
                   ) : (
                     meetings.map(m => (
                       <div key={m._id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-md border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center shrink-0">
                              {m.status === 'live' ? <Play size={18} className="text-blue-600" fill="currentColor" /> : <Clock size={18} className="text-blue-600" />}
                            </div>
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-slate-900">{m.title}</p>
                                  {m.status === 'live' && (
                                     <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">Live</span>
                                  )}
                               </div>
                               <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span className="flex items-center gap-1"><Clock size={12} /> {new Date(m.scheduledAt || m.startTime || m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <span className="flex items-center gap-1"><Users size={12} /> {(m.participants?.length || m.participantIds?.length || 0)} participants</span>
                                  <span>{m.durationMinutes || m.duration || 60} min</span>
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/w/${workspaceId}/meet/room/${m.joinCode || m.roomId || m._id}?intent=join`)} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm font-medium transition-colors">
                               Join
                            </button>
                          </div>
                       </div>
                     ))
                   )}
                </div>
              </div>

              {/* Recent Meetings */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Past Meetings</h2>
                <div className="space-y-3">
                   {pastMeetings.length === 0 ? (
                     <div className="py-8 text-center">
                        <Clock size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">No past meetings found.</p>
                      </div>
                   ) : (
                     pastMeetings.slice(0, 5).map(m => (
                       <div key={m._id} className="flex items-center justify-between gap-4 p-3 rounded-md border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center shrink-0">
                              <Video size={14} className="text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{m.title}</p>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={12} /> {new Date(m.scheduledAt || m.startTime || m.createdAt).toLocaleDateString()}</span>
                                 <span className="text-xs text-slate-500 flex items-center gap-1"><Users size={12} /> {(m.participants?.length || m.participantIds?.length || 0)}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => generateSummary(m)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-[11px] font-bold border border-blue-100 hover:bg-blue-100 transition-colors">
                            Summary & Mail
                          </button>
                       </div>
                     ))
                   )}
                </div>
              </div>
            </div>

            {/* Sidebar (Rooms) */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">Team Rooms</h2>
                <div className="space-y-2">
                   {ROOMS.map(room => (
                     <div key={room.id} onClick={() => enterPersistentRoom(room)} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${room.color}15`, color: room.color }}>
                            <span className="text-xs font-bold">{room.tag}</span>
                         </div>
                         <div>
                            <p className="text-sm font-medium text-slate-800">{room.title}</p>
                            <p className="text-xs text-slate-500">{room.id}</p>
                         </div>
                       </div>
                       <ChevronRight size={16} className="text-slate-400" />
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {createModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                 <h2 className="text-lg font-semibold text-slate-900">Start New Meeting</h2>
                 <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Meeting Title</label>
                    <input type="text" value={meetTitle} onChange={e=>setMeetTitle(e.target.value)} placeholder="e.g. Design Sync" className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                 </div>
                 <div>
                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Passcode (optional)</label>
                    <input type="password" value={meetPass} onChange={e=>setMeetPass(e.target.value)} placeholder="Leave blank for open access" className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                 </div>
                 <label className="flex items-center gap-2 cursor-pointer mt-4">
                     <input type="checkbox" checked={instantAi} onChange={e => setInstantAi(e.target.checked)} className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 w-4 h-4" />
                     <span className="text-sm font-medium text-slate-700">Enable Meeting Summarizer & Mailer</span>
                  </label>
              </div>
              <div className="flex gap-3 justify-end">
                 <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                 <button onClick={handleStartInstant} disabled={loading} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center min-w-[100px]">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Start Now'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {joinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                 <h2 className="text-lg font-semibold text-slate-900">Join a Meeting</h2>
                 <button onClick={() => setJoinModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-4 mb-6">
                 <div>
                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Meeting ID or Link</label>
                    <input type="text" value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="e.g. 123-456-789" className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                 </div>
                 <div>
                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Passcode (if required)</label>
                    <input type="password" value={joinPass} onChange={e=>setJoinPass(e.target.value)} placeholder="Leave blank if none" className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                 </div>
              </div>
              <div className="flex gap-3 justify-end">
                 <button onClick={() => setJoinModal(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                 <button onClick={handleJoin} disabled={isValidating} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center min-w-[100px]">
                    {isValidating ? <Loader2 size={16} className="animate-spin" /> : 'Join'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {scheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                 <h2 className="text-lg font-semibold text-slate-900">Schedule Meeting</h2>
                 <button onClick={() => setScheduleModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleSchedule} className="space-y-4 mb-6">
                 <div>
                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Meeting Title</label>
                    <input required type="text" value={newMeeting.title} onChange={e=>setNewMeeting({...newMeeting, title: e.target.value})} placeholder="e.g. Weekly Sync" className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-xs font-medium text-slate-700 mb-1.5 block">Start Time</label>
                       <input required type="datetime-local" value={newMeeting.startTime} onChange={e=>setNewMeeting({...newMeeting, startTime: e.target.value})} className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                       <label className="text-xs font-medium text-slate-700 mb-1.5 block">Duration (min)</label>
                       <input required type="number" value={newMeeting.duration} onChange={e=>setNewMeeting({...newMeeting, duration: e.target.value})} className="w-full h-10 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                 </div>
                 <label className="flex items-center gap-2 cursor-pointer mt-4">
                     <input type="checkbox" checked={newMeeting.aiEnabled} onChange={e => setNewMeeting({...newMeeting, aiEnabled: e.target.checked})} className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 w-4 h-4" />
                     <span className="text-sm font-medium text-slate-700">Enable Meeting Summarizer & Mailer</span>
                  </label>
                 <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => setScheduleModal(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center min-w-[100px]">
                       {loading ? <Loader2 size={16} className="animate-spin" /> : 'Schedule'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {roomsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-semibold text-slate-900">Persistent Rooms</h2>
                 <button onClick={() => setRoomsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-2 mb-6">
                 {ROOMS.map(room => (
                   <div key={room.id} onClick={() => enterPersistentRoom(room)} className="flex items-center gap-3 bg-white border border-slate-200 rounded-md p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                     <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${room.color}15`, color: room.color }}>
                        <span className="text-xs font-bold">{room.tag}</span>
                     </div>
                     <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{room.title}</p>
                        <p className="text-xs text-slate-500">{room.id}</p>
                     </div>
                     <div className={`flex items-center justify-center px-2 py-1 rounded text-xs font-medium ${room.members > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {room.members} online
                     </div>
                   </div>
                 ))}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setRoomsModal(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Close</button>
              </div>
           </div>
        </div>
      )}

      {selectedMeeting && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl relative z-10 border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <div className="space-y-1">
                    <h2 className="text-lg md:text-xl font-semibold text-slate-900">{selectedMeeting.title}</h2>
                    <p className="text-xs text-slate-500 font-medium">{new Date(selectedMeeting.scheduledAt || selectedMeeting.startTime || selectedMeeting.createdAt).toLocaleDateString()} • {selectedMeeting.host}</p>
                 </div>
                 <button onClick={() => setSelectedMeeting(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                    <X size={20} />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-2 space-y-8">
                       <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-900">Executive Summary</h3>
                          <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded border border-slate-100" dangerouslySetInnerHTML={{ __html: selectedMeeting.summary?.summary || "The meeting intelligence engine is still analyzing the recording." }} />
                       </div>
                       {selectedMeeting.summary?.keyPoints && (
                          <div className="space-y-4">
                             <h3 className="text-lg font-semibold text-slate-900">Key Discussion Points</h3>
                             <ul className="space-y-3 bg-slate-50 p-4 rounded border border-slate-100">
                                {selectedMeeting.summary.keyPoints.map((point, i) => (
                                   <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                      {point}
                                   </li>
                                ))}
                             </ul>
                          </div>
                       )}
                    </div>
                    <div className="space-y-6">
                       <div className="p-6 bg-slate-50 rounded-lg border border-slate-100 space-y-6">
                          <div>
                             <p className="text-xs font-semibold text-slate-500 mb-1">Duration</p>
                             <p className="text-xl font-bold text-slate-900">{selectedMeeting.durationMinutes || selectedMeeting.duration || 60} Min</p>
                          </div>
                          <div className="h-px bg-slate-200" />
                          <div>
                             <p className="text-xs font-semibold text-slate-500 mb-1">Room Code</p>
                             <p className="text-lg font-mono text-slate-900 uppercase">{selectedMeeting.roomId}</p>
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
