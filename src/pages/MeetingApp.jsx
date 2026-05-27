import { Buffer } from 'buffer';
import { Buffer } from 'buffer';
import process from 'process';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiUrl } from '../api';
import MeetingLayout from '../components/MeetingLayout';
import StarRating from '../components/StarRating';
import { 
  Video as VideoIcon, Plus, Mic, MicOff, VideoOff, Phone, 
  Settings, Users, Monitor, MessageSquare, Link, X, 
  Shield, Maximize2, Send, Paperclip, Disc, Hand, MoreVertical, Copy, Check, Loader2, AlertCircle,
  Share2, LayoutGrid, Ghost, ChevronUp, Smile, Pin, Clock, Radio, Hexagon, Wand2, Sparkles, FlipHorizontal, Lock, Play, PhoneOff, ChevronRight
} from 'lucide-react';

// --- SUB-COMPONENTS ---

const UserAvatar = ({ name, profilePic, size = 'xl' }) => {
  const initials = name?.charAt(0).toUpperCase() || 'U';
  const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-rose-600', 'bg-amber-600'];
  const bgColor = colors[initials.charCodeAt(0) % colors.length];
  
  return (
    <div className={`rounded-full overflow-hidden flex items-center justify-center font-black text-white shadow-2xl relative
      ${size === 'xl' ? 'w-24 h-24 text-4xl' : size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-12 h-12 text-lg'}`}>
      {profilePic ? (
        <img src={profilePic} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full ${bgColor} flex items-center justify-center`}>
          {initials}
        </div>
      )}
    </div>
  );
};

const RemoteVideo = ({ peer, isSpeaking }) => {
  const videoRef = useRef();
  const [hasVideo, setHasVideo] = useState(false);
  
  useEffect(() => { 
    if (peer.stream && videoRef.current) { 
      videoRef.current.srcObject = peer.stream;
      
      const checkTracks = () => {
        const videoTrack = peer.stream.getVideoTracks()[0];
        if (videoTrack) {
          setHasVideo(videoTrack.enabled && videoTrack.readyState === 'live');
        }
      };

      peer.stream.onaddtrack = checkTracks;
      peer.stream.onremovetrack = checkTracks;
      checkTracks();

      videoRef.current.play().catch(e => console.error("Remote video play error:", e));
    } 
  }, [peer.stream]);

  return (
    <div className={`relative rounded-[32px] bg-[#1a1b1e] border-2 transition-all duration-500 overflow-hidden group aspect-video flex items-center justify-center
      ${isSpeaking ? 'border-[#5244e1] shadow-[0_0_30px_rgba(82,68,225,0.2)]' : 'border-white/5'}`}>
       <video playsInline ref={videoRef} autoPlay className={`w-full h-full object-cover ${!hasVideo ? 'hidden' : ''}`} />
       {!hasVideo && <UserAvatar name={peer.name} profilePic={peer.profilePic} />}
       
       {isSpeaking && (
          <div className="absolute top-4 right-4 bg-[#5244e1] px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse z-10">
             <div className="w-1.5 h-1.5 bg-white rounded-full" />
             <span className="text-[8px] font-black uppercase tracking-widest text-white">Speaking</span>
          </div>
       )}

       <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold border border-white/10 z-10">
          {peer.name}
       </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const MeetingApp = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const { workspaceId, id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Auth Guard
  useEffect(() => {
     if (!auth.user) {
        navigate('/login');
     }
  }, [auth.user, navigate]);
  
  const queryParams = new URLSearchParams(location.search);
  const urlPassword = queryParams.get('pwd');
  
  // States
  const [appState, setAppState] = useState('lobby');
  const [code, setCode] = useState(id || '');
  const [password, setPassword] = useState(urlPassword || '');
  const [copied, setCopied] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState('participants'); 
  const [duration, setDuration] = useState(0);
  const [meetingMetadata, setMeetingMetadata] = useState(null);
  const [finalStats, setFinalStats] = useState({ duration: 0, participants: 0 });
  const [activeSpeakers, setActiveSpeakers] = useState([]); // Track recent speakers for SFU-style optimization
  const [performanceMode, setPerformanceMode] = useState(false);
  const [peers, setPeers] = useState([]);
  const [meetingMessages, setMeetingMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [speakingUser, setSpeakingUser] = useState(null); 
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [roomLocked, setRoomLocked] = useState(false);
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
        await fetch(getApiUrl(`/api/meetings/${meetingId}/start-ai`), {
           method: 'POST',
           headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      else wsBase = `wss://${wsBase}`;
      wsBase = wsBase.replace(/\/+$/, '');
      const wsUrl = `${wsBase}/ws/audio`;

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
  }, [aiAssistantActive, streamRef.current]);
  
  // Refs
  const wsRef = useRef(null);
  const peerIdRef = useRef(null);
  const meetingIdRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const userVideo = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();
  const candidateQueue = useRef(new Map());
  const iceCandidateBufferRef = useRef(new Map());
  const createPeerConnectionRef = useRef(null);
  const shouldInitiateOfferRef = useRef(null);
  const sendWsRef = useRef(null);
  const iceServersRef = useRef(null);
  
  const audioContextRef = useRef();
  const audioDestinationRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);

  const sendWs = useCallback((type, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const shouldInitiateOffer = useCallback((remotePeerId) => {
    const myId = peerIdRef.current;
    if (!myId || !remotePeerId) return true;
    return myId.localeCompare(remotePeerId) > 0;
  }, []);

  const buildWsUrl = () => {
    const API_URL = getApiUrl('/');
    let wsBase = API_URL;
    if (wsBase.startsWith('https://')) wsBase = wsBase.replace('https://', 'wss://');
    else if (wsBase.startsWith('http://')) wsBase = wsBase.replace('http://', 'ws://');
    else wsBase = `wss://${wsBase}`;
    wsBase = wsBase.replace(/\/+$/, '');
    return `${wsBase}/ws/webrtc`;
  };

  const copyMeetingInvite = () => {
    const inviteLink = `${window.location.origin}/w/${workspaceId}/meet/room/${id}?pwd=${password}&intent=join`;
    const inviteText = `Join my Nexus Meeting:\nLink: ${inviteLink}\nMeeting ID: ${code}\nPassword: ${password}`;
    
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  useEffect(() => {
    if (userVideo.current && streamRef.current) {
      userVideo.current.srcObject = streamRef.current;
    }
  }, [appState, videoOn]); 

  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' || 
                  window.location.hostname.startsWith('192.168.');
                  
  const API_URL = getApiUrl('/');
  const [iceServers, setIceServers] = useState([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]);

  useEffect(() => {
    fetch(getApiUrl('/api/meet/ice-servers'))
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setIceServers(data);
      })
      .catch(err => console.error("Failed to fetch ICE servers:", err));
  }, []);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const createPeerConnection = async (targetPeerId, stream, name) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current || iceServers });
    pc.onicecandidate = (event) => {
      if (event.candidate) sendWs('ice-candidate', { targetPeerId, candidate: event.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[ICE] state for ${targetPeerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[ICE] Connection failed for ${targetPeerId}, attempting ICE restart...`);
        setTimeout(async () => {
          try {
            const newOffer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(newOffer);
            sendWs('offer', { targetPeerId, sdp: newOffer });
          } catch (err) {
            console.warn(`[ICE] Restart failed for ${targetPeerId}:`, err);
          }
        }, 1000);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[PC] connection state for ${targetPeerId}: ${state}`);
      if (state === 'connected' || state === 'disconnected' || state === 'failed') {
        setPeers(prev => prev.map(p => p.peerID === targetPeerId ? { ...p, connectionState: state } : p));
      }
    };
    
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers(prev => prev.map(p => p.peerID === targetPeerId ? { ...p, stream: remoteStream } : p));
      
      if (audioContextRef.current && audioDestinationRef.current) {
        const audioTrack = remoteStream.getAudioTracks()[0];
        if (audioTrack) {
          const source = audioContextRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
          source.connect(audioDestinationRef.current);
          source.connect(audioContextRef.current.destination);
        }
      }

      if (remoteStream.getAudioTracks().length > 0) {
         setActiveSpeakers(prev => [...new Set([...prev, targetPeerId])].slice(-4));
      }
    };

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }
    
    return pc;
  };

  const handleEndCall = () => {
    setFinalStats({ duration, participants: peers.length + 1 });
    setAppState('ended');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    intentionalCloseRef.current = true;
    if (wsRef.current) {
      sendWs('leave', {});
      wsRef.current.close();
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        peersRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        if (userVideo.current) userVideo.current.srcObject = stream;
        setIsScreenSharing(true);
        screenTrack.onended = () => stopScreenShare();
      } catch (err) { console.error(err); }
    } else { stopScreenShare(); }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      peersRef.current.forEach(({ pc }) => {
        const videoTrack = streamRef.current?.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      });
      if (userVideo.current) userVideo.current.srcObject = streamRef.current;
      setIsScreenSharing(false);
    }
  };

  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
    shouldInitiateOfferRef.current = shouldInitiateOffer;
    sendWsRef.current = sendWs;
  }, [createPeerConnection, shouldInitiateOffer, sendWs]);

  const connectSignaling = useCallback((signalingRoomId, token) => {
    intentionalCloseRef.current = false;
    const wsUrl = buildWsUrl();
    console.log('[Signaling] Connecting to:', wsUrl, 'room:', signalingRoomId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Signaling] Connected, joining room:', signalingRoomId);
      meetingIdRef.current = signalingRoomId;
      ws.send(JSON.stringify({
        type: 'join',
        data: { token, meetingId: signalingRoomId }
      }));
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'joined') {
          peerIdRef.current = msg.peerId;
          setRoomError(null);
          setIsVerifying(false);
          setAppState('in-call');
          const peers = (msg.existingPeers || []).map(p => ({
            peerId: p.peerId,
            userId: p.userId,
            name: p.name,
          }));
          for (const peer of peers) {
            if (shouldInitiateOfferRef.current(peer.peerId)) {
              const pc = await createPeerConnectionRef.current(peer.peerId, streamRef.current, peer.name);
              if (pc) {
                peersRef.current.push({ peerID: peer.peerId, pc });
                setPeers(prev => [...prev, { peerID: peer.peerId, pc, stream: null, name: peer.name }]);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendWsRef.current('offer', { targetPeerId: peer.peerId, sdp: offer });
              }
            } else {
              setPeers(prev => [...prev, { peerID: peer.peerId, pc: null, stream: null, name: peer.name }]);
            }
          }
        }
        if (msg.type === 'peer-joined') {
          if (msg.peerId === peerIdRef.current) return;
          if (peersRef.current.find(p => p.peerID === msg.peerId)) return;
          setPeers(prev => [...prev, { peerID: msg.peerId, pc: null, stream: null, name: msg.name || 'Participant' }]);
          if (shouldInitiateOfferRef.current(msg.peerId)) {
            const pc = await createPeerConnectionRef.current(msg.peerId, streamRef.current, msg.name || 'Participant');
            if (pc) {
              peersRef.current.push({ peerID: msg.peerId, pc });
              setPeers(prev => prev.map(p => p.peerID === msg.peerId ? { ...p, pc } : p));
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendWsRef.current('offer', { targetPeerId: msg.peerId, sdp: offer });
            }
          }
        }
        if (msg.type === 'offer') {
          const fromPeerId = msg.fromPeerId;
          let pc = peersRef.current.find(p => p.peerID === fromPeerId)?.pc;
          if (!pc) {
            pc = await createPeerConnectionRef.current(fromPeerId, streamRef.current, 'Participant');
            peersRef.current.push({ peerID: fromPeerId, pc });
            setPeers(prev => [...prev, { peerID: fromPeerId, pc, stream: null, name: 'Participant' }]);
          }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } catch (err) {
            console.warn('[WebRTC] setRemoteDescription (offer) failed:', err);
            return;
          }
          const buffered = iceCandidateBufferRef.current.get(fromPeerId) || [];
          iceCandidateBufferRef.current.delete(fromPeerId);
          for (const c of buffered) {
            try { await pc.addIceCandidate(c); } catch (e) {}
          }
          try {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWsRef.current('answer', { targetPeerId: fromPeerId, sdp: answer });
          } catch (err) {
            console.warn('[WebRTC] createAnswer/setLocal failed:', err);
          }
        }
        if (msg.type === 'answer') {
          const fromPeerId = msg.fromPeerId;
          const pc = peersRef.current.find(p => p.peerID === fromPeerId)?.pc;
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            } catch (err) {
              console.warn('[WebRTC] setRemoteDescription (answer) failed:', err);
              return;
            }
            const buffered = iceCandidateBufferRef.current.get(fromPeerId) || [];
            iceCandidateBufferRef.current.delete(fromPeerId);
            for (const c of buffered) {
              try { await pc.addIceCandidate(c); } catch (e) {}
            }
          }
        }
        if (msg.type === 'ice-candidate') {
          const fromPeerId = msg.fromPeerId;
          const item = peersRef.current.find(p => p.peerID === fromPeerId);
          const pc = item?.pc;
          if (pc && pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch (e) {}
          } else {
            const buf = iceCandidateBufferRef.current.get(fromPeerId) || [];
            buf.push(msg.candidate);
            iceCandidateBufferRef.current.set(fromPeerId, buf);
          }
        }
        if (msg.type === 'peer-left') {
          const pid = msg.peerId;
          const peerObj = peersRef.current.find(p => p.peerID === pid);
          if (peerObj?.pc) try { peerObj.pc.close(); } catch {}
          peersRef.current = peersRef.current.filter(p => p.peerID !== pid);
          setPeers(prev => prev.filter(p => p.peerID !== pid));
        }
        if (msg.type === 'error') {
          console.warn('[Signaling] Server error:', msg.message);
          setRoomError(msg.message);
          setIsVerifying(false);
        }
      } catch (err) {
        console.warn('[Signaling] Parse error:', err);
      }
    };

    ws.onerror = (e) => {
      console.warn('[Signaling] WS error:', e?.message || e);
      setRoomError('Signaling server connection failed.');
      setIsVerifying(false);
    };

    ws.onclose = (e) => {
      console.log('[Signaling] WS closed. Code:', e?.code);
      peerIdRef.current = null;
      if (!intentionalCloseRef.current && appState === 'in-call') {
        console.log('[Signaling] Unexpected close, will reconnect...');
        setTimeout(() => {
          if (meetingIdRef.current) {
            const token = localStorage.getItem('token');
            if (token) connectSignaling(meetingIdRef.current, token);
          }
        }, 3000);
      }
    };
  }, [appState]);

  const handleJoinCall = async () => {
    console.log(`📡 [CLIENT] Attempting to join call: ID=${id}`);
    setIsVerifying(true);
    setRoomError(null);

    const cleanCode = id.trim().replace(/-/g, '').toUpperCase();
    const token = localStorage.getItem('token');

    if (!token) {
      setRoomError('Authentication token not found. Please log in again.');
      setIsVerifying(false);
      return;
    }

    try {
      const query = password ? `?passcode=${encodeURIComponent(password)}` : '';
      const res = await fetch(getApiUrl(`/api/meetings/join/${encodeURIComponent(cleanCode)}${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resolve meeting');
      }
      const signalingRoomId = data._id || data.meetingId;
      if (!signalingRoomId) {
        throw new Error('Meeting resolved but no valid signaling ID returned.');
      }
      setMeetingMetadata(data);

      connectSignaling(signalingRoomId, token);
    } catch (err) {
      console.error('[Join] Failed:', err);
      setRoomError(err.message || 'Could not join meeting.');
      setIsVerifying(false);
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = { user: auth.user, text: chatInput, time: new Date().toLocaleTimeString() };
    setMeetingMessages(prev => [...prev, msg]);
    setChatInput('');
  };

  useEffect(() => {
    let interval;
    if (appState === 'in-call') {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000);
      
      const roomID = `${workspaceId}-${code}`.toUpperCase();
      fetch(getApiUrl(`/api/chat/${workspaceId}/${roomID}`), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                 <div><p className="text-[10px] font-black uppercase text-zinc-400">Duration</p><p className="font-black">{Math.floor(finalStats.duration / 60)}m</p></div>
                 <div><p className="text-[10px] font-black uppercase text-zinc-400">Attendees</p><p className="font-black">{finalStats.participants}</p></div>
              </div>
              <button onClick={() => navigate(`/w/${workspaceId}/meet`)} className="w-full py-4 bg-[#5244e1] rounded-3xl font-black uppercase tracking-widest text-xs">Return Home Dashboard</button>
           </div>
        </div>
      )}

      {/* 4. ERROR STATE */}
      {roomError && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center animate-fade bg-[#0a0b0d]">
           <div className="max-w-md w-full space-y-8">
              <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mx-auto">
                 <AlertCircle size={40} />
              </div>
              <div className="space-y-2">
                 <h1 className="text-3xl font-black text-white">Join Failed</h1>
                 <p className="text-zinc-500 text-sm">{roomError}</p>
              </div>
              <div className="flex flex-col gap-3">
                 <button 
                    onClick={() => {
                       setRoomError(null);
                       setAppState('lobby');
                       window.location.reload();
                    }} 
                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl font-black uppercase tracking-widest text-xs text-white"
                 >Try Again</button>
                 <button 
                    onClick={() => navigate(`/w/${workspaceId}/meet`)} 
                    className="w-full py-4 bg-[#5244e1] rounded-3xl font-black uppercase tracking-widest text-xs text-white"
                 >Return to Dashboard</button>
              </div>
           </div>
        </div>
      )}

      {/* 5. WAITING ROOM STATE */}
      {isWaiting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center animate-fade bg-[#0a0b0d]">
           <div className="max-w-md w-full space-y-10">
              <div className="relative">
                 <div className="w-24 h-24 bg-indigo-500/10 rounded-[32px] flex items-center justify-center text-indigo-500 mx-auto animate-bounce">
                    <Clock size={48} />
                 </div>
                 <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-[#0a0b0d] animate-pulse">
                    <Shield size={16} className="text-white" />
                 </div>
              </div>
              
              <div className="space-y-4">
                 <h1 className="text-4xl font-black text-white tracking-tight">Hang tight!</h1>
                 <p className="text-zinc-400 text-sm leading-relaxed">
                    The meeting is locked for security. We've notified the host that you're waiting in the lobby.
                 </p>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] space-y-4">
                 <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white uppercase">{auth.user?.charAt(0)}</div>
                    <div>
                       <p className="text-xs font-black uppercase text-zinc-500">Joining as</p>
                       <p className="text-sm font-bold text-white">{auth.user}</p>
                    </div>
                 </div>
              </div>

              <div className="pt-8">
                 <button 
                    onClick={() => {
                        setIsWaiting(false);
                        setAppState('lobby');
                        navigate(`/w/${workspaceId}/meet`);
                    }} 
                    className="text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                 >Leave Lobby</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default MeetingApp;
