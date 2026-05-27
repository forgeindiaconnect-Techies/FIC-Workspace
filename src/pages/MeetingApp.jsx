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
  Share2, LayoutGrid, Ghost, ChevronUp, Smile, Pin, Clock, Radio, Hexagon
, Wand2, Sparkles, FlipHorizontal, Lock, Play, PhoneOff, ChevronRight} from 'lucide-react';

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

  // Fix: Ensure local video is attached to the video element whenever appState changes or stream is ready
  useEffect(() => {
    if (userVideo.current && streamRef.current) {
      userVideo.current.srcObject = streamRef.current;
    }
  }, [appState, videoOn]); // Re-run when appState changes to ensure new video element gets the stream

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
      
      // Setup Audio Routing
      if (audioContextRef.current && audioDestinationRef.current) {
        const audioTrack = remoteStream.getAudioTracks()[0];
        if (audioTrack) {
          const source = audioContextRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
          source.connect(audioDestinationRef.current);
          source.connect(audioContextRef.current.destination);
        }
      }

      // Auto-add to active speakers if they are sending audio
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
          // Initiate offers with peers whose ID sorts higher (avoid SDP glare)
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
              // The other peer will send the offer — just register the peer
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
      // Resolve meeting via REST to get MongoDB _id
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

      // Connect WebSocket signaling with the MongoDB _id
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
      
      // Fetch chat history
      const roomID = `${workspaceId}-${code}`.toUpperCase();
      fetch(getApiUrl(`/api/chat/${workspaceId}/${roomID}`), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          const history = data.map(m => ({
            user: m.sender,
            text: m.content,
            time: new Date(m.timestamp).toLocaleTimeString()
          }));
          setMeetingMessages(history);
        })
        .catch(err => console.error("Failed to fetch chat history:", err));
    }
    return () => clearInterval(interval);
  }, [appState]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = micOn);
      streamRef.current.getVideoTracks().forEach(track => track.enabled = videoOn);
    }
  }, [micOn, videoOn]);

  useEffect(() => {
    if ((appState === 'lobby' || appState === 'in-call') && !streamRef.current) {
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          frameRate: { ideal: 30 } 
        }, 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      })
        .then(stream => {
          streamRef.current = stream;
          if (userVideo.current) userVideo.current.srcObject = stream;
          setPermissionError(null);
        })
        .catch(err => {
          console.error("❌ Media error:", err);
          setPermissionError(err.name);
        });
    }
  }, [appState]);

  return (
    <div className="relative w-full h-full bg-[#0a0b0d] text-white overflow-hidden font-sans">
      
      {/* 1. LOBBY STATE */}
      {appState === 'lobby' && (
        <div className="h-screen w-screen flex flex-col items-center justify-center p-8 bg-[#0a0b0d]">
           <div className="w-full max-w-2xl space-y-10 animate-fade">
              <div className="relative aspect-video bg-[#1a1b1e] rounded-[40px] overflow-hidden border-2 border-white/5 shadow-2xl">
                 <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full object-cover mirror ${!videoOn ? 'hidden' : ''}`} />
                 {!videoOn && <div className="absolute inset-0 flex items-center justify-center"><UserAvatar name={auth.user} /></div>}
                 
                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                    <button onClick={() => setMicOn(!micOn)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500'}`}><Mic size={24} /></button>
                    <button onClick={() => setVideoOn(!videoOn)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${videoOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500'}`}><VideoIcon size={24} /></button>
                 </div>
              </div>
              <div className="text-center space-y-6">
                 <div className="space-y-1">
                    <h2 className="text-3xl font-black">Ready to join?</h2>
                    <div className="flex items-center justify-center gap-3 mt-2">
                       <div 
                          onClick={copyMeetingInvite}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-all group"
                       >
                          <span className="text-[9px] font-black uppercase text-zinc-500">ID:</span>
                          <span className="text-xs font-bold text-white tabular-nums tracking-wider">{code}</span>
                          {copiedInvite ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-500 group-hover:text-white" />}
                       </div>
                       {password && (
                          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                             <span className="text-[9px] font-black uppercase text-zinc-500">Pass:</span>
                             <span className="text-xs font-bold text-white tracking-wider">{password}</span>
                          </div>
                       )}
                    </div>
                 </div>

                 {permissionError && (
                    <div className="max-w-md mx-auto p-4 bg-rose-500/10 border border-rose-500/20 rounded-[24px] flex items-center gap-4 text-left animate-pulse">
                       <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                          <AlertCircle size={20} />
                       </div>
                       <div>
                          <p className="text-xs font-black uppercase text-rose-500">
                             {permissionError === 'NotReadableError' ? 'Device Already in Use' : 'Permissions Required'}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-medium">
                             {permissionError === 'NotReadableError' 
                               ? 'Your camera or microphone is being used by another application. Please close other meeting apps and try again.' 
                               : 'Please allow camera and microphone access in your browser settings to join the call.'}
                          </p>
                       </div>
                    </div>
                 )}

                 <p className="text-zinc-500 text-sm">Check your camera and microphone before joining the meeting.</p>
                 <button 
                    onClick={handleJoinCall} 
                    disabled={!!permissionError}
                    className="px-12 py-4 bg-[#5244e1] disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                 >
                    {(location.state?.intent === 'create' || new URLSearchParams(location.search).get('intent') === 'create') ? 'Create Meeting Now' : 'Join Meeting Now'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 2. IN-CALL STATE */}
      {appState === 'in-call' && !roomError && (
        <div className="h-screen w-screen flex flex-col bg-[#0a0b0d]">
          
          {/* Top Bar */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#0a0b0d]">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live</span>
                </div>
                <div className="flex flex-col">
                   <h1 className="text-sm font-bold text-white leading-none">{meetingMetadata?.title || 'Nexus Sync'}</h1>
                   <div className="flex items-center gap-2 mt-1">
                      <div 
                        onClick={copyMeetingInvite}
                        className="flex items-center gap-1.5 cursor-pointer group"
                      >
                         <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">{code}</p>
                         {copiedInvite ? <Check size={10} className="text-emerald-500" /> : <Link size={10} className="text-zinc-700 group-hover:text-zinc-500" />}
                      </div>
                      {password && (
                         <>
                            <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PWD: {password}</p>
                         </>
                      )}
                   </div>
                </div>
             </div>

             <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                   {peers.slice(0, 3).map(p => <div key={p.peerID} className="border-2 border-[#0a0b0d] rounded-full"><UserAvatar name={p.name} size="sm" /></div>)}
                   {peers.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-[#1a1b1e] border-2 border-[#0a0b0d] flex items-center justify-center text-[10px] font-bold">
                         +{peers.length - 3}
                      </div>
                   )}
                </div>
                <div className="h-8 w-px bg-white/10 mx-2" />
                <button className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-400"><Hexagon size={20}/></button>
                <button className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-400"><Maximize2 size={20}/></button>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex overflow-hidden">
             
             {/* Tiles Grid - SFU Optimized */}
             <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                <div className={`grid gap-6 h-full 
                   ${peers.length === 0 ? 'grid-cols-1' : 
                     peers.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 
                     'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                   
                   {/* Local Tile (Always Prioritized) */}
                   <div className={`relative rounded-[32px] bg-[#1a1b1e] border-2 transition-all duration-500 overflow-hidden flex items-center justify-center aspect-video
                      ${speakingUser === 'local' ? 'border-[#5244e1] shadow-[0_0_30px_rgba(82,68,225,0.2)]' : 'border-white/5'}`}>
                      <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full object-cover mirror ${!videoOn ? 'hidden' : ''}`} />
                      {!videoOn && <UserAvatar name={auth.user} />}
                      <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold border border-white/10 flex items-center gap-2 z-10">
                         {!micOn && <MicOff size={10} className="text-rose-500" />}
                         {auth.user} (You)
                      </div>
                   </div>

                   {/* Remote Tiles - Prioritize Active Speakers */}
                   {peers
                     .sort((a, b) => {
                        const aActive = activeSpeakers.includes(a.peerID) ? 1 : 0;
                        const bActive = activeSpeakers.includes(b.peerID) ? 1 : 0;
                        return bActive - aActive;
                     })
                     .slice(0, performanceMode ? 5 : 11) // Limit active streams in performance mode
                     .map((peer) => (
                        <RemoteVideo 
                           key={peer.peerID} 
                           peer={peer} 
                           isSpeaking={speakingUser === peer.peerID || activeSpeakers.includes(peer.peerID)} 
                        />
                     ))
                   }
                   
                   {/* Hidden Participants Count */}
                   {peers.length > (performanceMode ? 5 : 11) && (
                      <div className="relative rounded-[32px] bg-[#0f1012] border border-white/5 flex flex-col items-center justify-center aspect-video">
                         <Users size={32} className="text-zinc-700 mb-2" />
                         <p className="text-xs font-bold text-zinc-500">+{peers.length - (performanceMode ? 5 : 11)} more participants</p>
                      </div>
                   )}
                </div>
             </div>

             {/* Users Sidebar */}
             {activeSidebar === 'participants' && (
                <div className="w-80 bg-[#0f1012] border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300">
                   <div className="p-6 flex items-center justify-between border-b border-white/5">
                      <h3 className="text-sm font-bold">Users</h3>
                      <button onClick={() => setActiveSidebar(null)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500"><X size={18}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {/* Local User in list */}
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
                         <UserAvatar name={auth.user} size="sm" />
                         <div className="flex-1">
                            <p className="text-xs font-bold">{auth.user}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">You</p>
                         </div>
                         <div className="flex gap-3 text-zinc-500">
                            {micOn ? <Mic size={14}/> : <MicOff size={14} className="text-rose-500"/>}
                            {videoOn ? <VideoIcon size={14}/> : <VideoOff size={14} className="text-rose-500"/>}
                         </div>
                      </div>
                      {/* Remote Users in list */}
                      {peers.map(p => (
                         <div key={p.peerID} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all">
                            <UserAvatar name={p.name} size="sm" />
                            <div className="flex-1">
                               <p className="text-xs font-bold">{p.name}</p>
                            </div>
                            <div className="flex gap-3 text-zinc-500">
                               <Mic size={14}/>
                               <VideoIcon size={14}/>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             )}

             {/* Chat Sidebar */}
             {activeSidebar === 'chat' && (
                <div className="w-80 bg-[#0f1012] border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300">
                   <div className="p-6 flex items-center justify-between border-b border-white/5">
                      <h3 className="text-sm font-bold">Chat</h3>
                      <button onClick={() => setActiveSidebar(null)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500"><X size={18}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {meetingMessages.map((msg, i) => (
                         <div key={i} className={`flex flex-col ${msg.user === auth.user ? 'items-end' : 'items-start'}`}>
                            <p className="text-[8px] font-bold text-zinc-500 mb-1">{msg.user}</p>
                            <div className={`px-3 py-2 rounded-xl text-xs ${msg.user === auth.user ? 'bg-[#5244e1]' : 'bg-white/5 border border-white/5'}`}>
                               {msg.text}
                            </div>
                         </div>
                      ))}
                   </div>
                   <div className="p-4 border-t border-white/5">
                      <div className="relative">
                         <input 
                            type="text" 
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Type message..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-indigo-500/50"
                         />
                         <button onClick={sendChatMessage} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500"><Send size={14}/></button>
                      </div>
                   </div>
                </div>
             )}

             {/* Security Sidebar */}
             {activeSidebar === 'security' && (
                <div className="w-80 bg-[#0f1012] border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300">
                   <div className="p-6 flex items-center justify-between border-b border-white/5">
                      <h3 className="text-sm font-bold">Security</h3>
                      <button onClick={() => setActiveSidebar(null)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500"><X size={18}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-6">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                               <Shield size={18} />
                            </div>
                            <div>
                               <p className="text-xs font-bold text-white">Lock Meeting</p>
                               <p className="text-[10px] text-zinc-500">Block new entries</p>
                            </div>
                         </div>
                          <button 
                             onClick={() => setRoomLocked(p => !p)}
                             className={`w-10 h-6 rounded-full transition-all relative ${roomLocked ? 'bg-indigo-600' : 'bg-zinc-800'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${roomLocked ? 'right-1' : 'left-1'}`} />
                         </button>
                      </div>

                      {isHost && waitingQueue.length > 0 && (
                         <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Waiting for Entry ({waitingQueue.length})</h4>
                            {waitingQueue.map(user => (
                               <div key={user.id} className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                     <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                        {user.name.charAt(0)}
                                     </div>
                                     <p className="text-[10px] font-bold text-white">{user.name}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <button 
                                         onClick={() => setWaitingQueue(q => q.filter(u => u.id !== user.id))}
                                         className="px-2 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-lg"
                                      >Admit</button>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </div>
             )}
          </div>

          {/* Bottom Bar Controls */}
          <div className="h-20 md:h-24 px-4 md:px-8 flex items-center justify-between border-t border-white/5 bg-[#0a0b0d]">
             <div className="hidden md:block w-48">
                <span className="text-sm font-bold tabular-nums text-zinc-400">{formatTime(duration)}</span>
             </div>

             <div className="flex items-center gap-1 md:gap-2">
                <button onClick={() => setMicOn(!micOn)} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all ${micOn ? 'bg-white/5 hover:bg-white/10' : 'bg-rose-500 shadow-lg shadow-rose-500/20'}`}>
                   {micOn ? <Mic size={16}/> : <MicOff size={16}/>}
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">{micOn ? 'Mute' : 'Unmute'}</span>
                </button>
                <button onClick={() => setVideoOn(!videoOn)} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all ${videoOn ? 'bg-white/5 hover:bg-white/10' : 'bg-rose-500 shadow-lg shadow-rose-500/20'}`}>
                   {videoOn ? <VideoIcon size={16}/> : <VideoOff size={16}/>}
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">{videoOn ? 'Stop' : 'Start'} Video</span>
                </button>

                <div className="h-8 w-px bg-white/5 mx-1 md:mx-2" />

                <button onClick={() => setActiveSidebar(activeSidebar === 'participants' ? null : 'participants')} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all ${activeSidebar === 'participants' ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`}>
                   <Users size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">Users</span>
                </button>
                <button onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all ${activeSidebar === 'chat' ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`}>
                   <MessageSquare size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">Chat</span>
                </button>
                <button onClick={handleStartAI} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all ${aiAssistantActive ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`}>
                   <Wand2 size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">AI Bot</span>
                </button>
                {isHost && (
                   <button onClick={() => setHostControlsModal(true)} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all bg-white/5 hover:bg-white/10 text-zinc-400">
                      <Shield size={16}/>
                      <span className="hidden md:block text-[7px] font-bold uppercase mt-1">Security</span>
                   </button>
                )}
                <button onClick={toggleScreenShare} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`}>
                   <Monitor size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">Share</span>
                </button>
                
                <button className="hidden sm:flex w-10 h-10 md:w-12 md:h-12 rounded-full flex-col items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-400">
                   <Disc size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">Record</span>
                </button>
                <button className="w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-400">
                   <MoreVertical size={16}/>
                   <span className="hidden md:block text-[7px] font-bold uppercase mt-1">More</span>
                </button>
             </div>

             <div className="w-24 md:w-48 flex justify-end">
                <button onClick={handleEndCall} className="px-4 md:px-6 py-2 md:py-3 bg-[#e11d48] hover:bg-[#be123c] text-white rounded-full font-black text-[8px] md:text-[10px] uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-all">
                   End
                </button>
             </div>
          </div>
        </div>
      )}

      {/* HOST CONTROLS MODAL */}
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
                       className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${hostControlsTab === tab ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
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
                             <button onClick={() => setWaitingRoomEnabled(!waitingRoomEnabled)} className={`w-12 h-7 rounded-full transition-all relative ${waitingRoomEnabled ? 'bg-blue-500' : 'bg-white/10'}`}>
                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${waitingRoomEnabled ? 'right-1' : 'left-1'}`} />
                             </button>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                             <div className="flex-1">
                                <p className="text-sm font-bold text-white">Lock Meeting</p>
                                <p className="text-[10px] font-medium text-zinc-400">Prevent anyone else from joining</p>
                             </div>
                             <button onClick={() => setRoomLocked(!roomLocked)} className={`w-12 h-7 rounded-full transition-all relative ${roomLocked ? 'bg-blue-500' : 'bg-white/10'}`}>
                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${roomLocked ? 'right-1' : 'left-1'}`} />
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

      {/* 3. ENDED STATE */}
      {appState === 'ended' && (
        <div className="h-screen w-screen flex flex-col items-center justify-center p-6 text-center animate-fade bg-[#0a0b0d]">
           <div className="max-w-md w-full space-y-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto"><Check size={40} /></div>
              <h1 className="text-3xl font-black">Meeting Ended</h1>
              <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 grid grid-cols-2 gap-4">
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
