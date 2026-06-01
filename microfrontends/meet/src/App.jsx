import React, { useState, useEffect, useRef } from 'react';
import { Video, Plus, UserPlus, PhoneOff, Mic, MicOff, VideoOff, Users, Clock, Loader2, ArrowRight, X, Home } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('auth') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleAuthInit = (event) => {
      const { type, token: newToken, auth: newAuth } = event.data || {};
      if (type === 'AUTH_INIT') {
        console.log('[Meet MFE] Received auth session from Shell');
        localStorage.setItem('token', newToken);
        localStorage.setItem('auth', JSON.stringify(newAuth));
        setToken(newToken);
        setAuth(newAuth);
        setReady(true);
      }
    };

    window.addEventListener('message', handleAuthInit);

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MFE_READY', mfeId: 'meet' }, '*');
    } else {
      setReady(true);
    }

    return () => window.removeEventListener('message', handleAuthInit);
  }, []);

  if (!auth || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-zinc-400">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-green-500" size={32} />
          <p className="text-xs font-bold uppercase tracking-widest">Verifying Workspace Session...</p>
        </div>
      </div>
    );
  }

  return <MeetingsClient auth={auth} token={token} />;
}

function MeetingsClient({ auth, token }) {
  const [inMeeting, setInMeeting] = useState(false);
  const [meetingCode, setMeetingCode] = useState('');
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Audio/Video control toggles in active huddle
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Active peers list
  const [peers, setPeers] = useState([
    { id: '1', name: 'Sarah Miller', speaking: false, role: 'Co-Host' },
    { id: '2', name: 'David Chen', speaking: true, role: 'Participant' },
    { id: '3', name: 'Alex Rivera', speaking: false, role: 'Participant' }
  ]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/meetings/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.meetings) {
        setHistory(data.meetings);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleCreateMeeting = async () => {
    if (!newTitle) return;
    setCreating(true);

    try {
      const response = await fetch(`${API_URL}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle,
          durationMinutes: 60,
          recordingEnabled: true
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMeetingDetails(data);
        setInMeeting(true);
        setNewTitle('');
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to create meeting:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinMeeting = async (code) => {
    const targetCode = code || meetingCode;
    if (!targetCode) return;
    setJoining(true);

    try {
      const response = await fetch(`${API_URL}/meetings/join/${targetCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMeetingDetails(data);
        setInMeeting(true);
        setMeetingCode('');
      } else {
        alert(data.error || 'Failed to join meeting.');
      }
    } catch (err) {
      console.error('Failed to join meeting:', err);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveMeeting = async () => {
    setInMeeting(false);
    setMeetingDetails(null);
    fetchHistory();
  };

  if (inMeeting && meetingDetails) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#080b12] text-zinc-100 font-sans overflow-hidden">
        {/* Huddle Header */}
        <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-[#0c1220]/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-extrabold text-sm tracking-tight">{meetingDetails.title}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 font-mono">
              ROOM CODE: {meetingDetails.joinCode || meetingDetails.roomId}
            </span>
          </div>

          <div className="flex items-center gap-3 bg-green-500/10 px-3 py-1 rounded-xl border border-green-500/20 text-[10px] font-bold text-green-400">
            <span>RTC ACTIVE</span>
          </div>
        </header>

        {/* Video Huddles Canvas */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 overflow-y-auto">
          {/* Host Video Card */}
          <div className="bg-[#0f172a] rounded-[24px] border border-zinc-800 overflow-hidden relative group">
            {camOn ? (
              <div className="w-full h-full bg-[#1b253b]/35 flex items-center justify-center relative">
                <span className="font-black text-4xl text-blue-500">{auth.user[0]}</span>
                <span className="absolute bottom-4 left-4 bg-zinc-900/60 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md text-white border border-zinc-800">
                  {auth.user} (Host)
                </span>
                {!micOn && (
                  <span className="absolute bottom-4 right-4 bg-red-600 p-1.5 rounded-lg border border-red-500 text-white">
                    <MicOff size={12} />
                  </span>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-[#0a0d14] flex flex-col items-center justify-center gap-2">
                <div className="w-16 h-16 rounded-full bg-zinc-850 flex items-center justify-center text-xl font-bold border border-zinc-800">
                  {auth.user[0]}
                </div>
                <span className="text-[10px] font-bold text-zinc-500">Camera Off</span>
              </div>
            )}
          </div>

          {/* Active Peers Video Cards */}
          {peers.map((peer) => (
            <div key={peer.id} className="bg-[#0f172a] rounded-[24px] border border-zinc-800 overflow-hidden relative group">
              <div className={`w-full h-full bg-[#1b253b]/15 flex items-center justify-center relative ${peer.speaking ? 'border-2 border-green-500/60 shadow-lg shadow-green-500/5' : ''}`}>
                <span className="font-bold text-2xl text-zinc-500">{peer.name[0]}</span>
                <span className="absolute bottom-4 left-4 bg-zinc-900/60 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md text-white border border-zinc-800">
                  {peer.name} ({peer.role})
                </span>
                {peer.speaking && (
                  <span className="absolute bottom-4 right-4 bg-green-600 p-1.5 rounded-lg border border-green-500 text-white">
                    <Mic size={12} className="animate-bounce" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Media Controls Footer bar */}
        <footer className="h-20 border-t border-zinc-850 bg-[#0c1220] px-8 flex items-center justify-between shrink-0">
          <div className="flex gap-2.5">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${
                micOn ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-white' : 'bg-red-950/20 border-red-500/20 text-red-500 hover:bg-red-950/40'
              }`}
            >
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button
              onClick={() => setCamOn(!camOn)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${
                camOn ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-white' : 'bg-red-950/20 border-red-500/20 text-red-500 hover:bg-red-950/40'
              }`}
            >
              {camOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          </div>

          <button
            onClick={handleLeaveMeeting}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all"
          >
            <PhoneOff size={15} />
            <span>End Call</span>
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden bg-[#090d16] text-zinc-100">
      {/* Left panel: Quick Launcher Actions */}
      <div className="w-96 shrink-0 flex flex-col border-r border-zinc-850 p-8 gap-8 overflow-y-auto bg-[#0e1424]/40">
        <button onClick={() => { window.parent.postMessage({ type: 'NAVIGATE_HOME' }, '*'); }} className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-2xl font-bold text-xs tracking-wide transition-all">
          <Home size={14} /> Back to Home
        </button>
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1.5 block">Huddle Portal</span>
          <h2 className="text-2xl font-black text-white leading-tight tracking-tight">Instant Collaborative Video</h2>
        </div>

        {/* Join Meeting Box */}
        <div className="bg-[#0f172a]/60 border border-zinc-800 p-6 rounded-[28px] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">Join via Code</h3>
          <div className="relative">
            <input
              type="text"
              value={meetingCode}
              onChange={e => setMeetingCode(e.target.value)}
              placeholder="e.g. 592-381-042"
              className="w-full bg-[#1b253b]/50 border border-zinc-800 rounded-2xl pl-4 pr-12 py-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition-all font-mono"
            />
            <button
              onClick={() => handleJoinMeeting()}
              disabled={joining || !meetingCode}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center text-white disabled:opacity-40"
            >
              {joining ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
            </button>
          </div>
        </div>

        {/* Create Meeting Box */}
        <div className="bg-[#0f172a]/60 border border-zinc-800 p-6 rounded-[28px] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">Schedule Room</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Meeting Title (e.g. Standup)"
              className="w-full bg-[#1b253b]/50 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition-all"
            />
            <button
              onClick={handleCreateMeeting}
              disabled={creating || !newTitle}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-green-500/10"
            >
              {creating ? 'Starting Session...' : 'Create Instant Room'}
            </button>
          </div>
        </div>
      </div>

      {/* Right panel: History & Rooms */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#070b13]">
        <div className="px-8 py-6 border-b border-zinc-850 flex items-center gap-2">
          <Clock size={16} className="text-zinc-500" />
          <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400">Past Huddle History logs</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 divide-y divide-zinc-900/60">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-green-500" size={18} />
              <span>Loading meetings...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500">No past meetings recorded</div>
          ) : (
            history.map((meet) => (
              <div key={meet._id} className="py-4 flex items-center justify-between border-b border-zinc-850/40">
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-white">{meet.title}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono">Join Code: {meet.joinCode}</p>
                </div>
                <button
                  onClick={() => handleJoinMeeting(meet.joinCode)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Join Again
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
