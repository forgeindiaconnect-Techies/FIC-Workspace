"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiUrl } from '../api';
import { useWebRTC } from '../hooks/useWebRTC';
import { isWebRTCAvailable } from '../utils/rtc';
import MeetingLayout from '../components/MeetingLayout';
import StarRating from '../components/StarRating';
import { 
  Video as VideoIcon, Plus, Mic, MicOff, VideoOff, Phone, 
  Settings, Users, Monitor, MessageSquare, Link, X, 
  Shield, Maximize2, Minimize2, Send, Paperclip, Disc, Hand, MoreVertical, Copy, Check, Loader2, AlertCircle,
  Share2, LayoutGrid, Ghost, ChevronUp, Smile, Pin, PinOff, Clock, Radio, Hexagon
, Wand2, Sparkles, FlipHorizontal, Lock, Play, PhoneOff, ChevronRight, ChevronLeft, Home, Circle} from 'lucide-react';
import LogoImage from '../assets/landing-logo.png';

// --- SUB-COMPONENTS ---

const UserAvatar = ({ name, profilePic, size = 'xl' }) => {
  const initials = (name?.charAt(0) || 'U').toUpperCase();
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

const RemoteVideo = ({ peer, stream, isSpeaking, mobileStyle, isScreen, remoteStreamsRef, remoteScreenStreamsRef }) => {
  const videoRef = useRef();
  const [hasVideo, setHasVideo] = useState(false);
  
  // Use the stream passed in OR look it up from the refs if using the new hook
  let currentStream = stream;
  if (!currentStream && peer) {
    if (isScreen && remoteScreenStreamsRef?.current) {
      currentStream = remoteScreenStreamsRef.current.get(peer.peerID || peer.peerId);
    } else if (!isScreen && remoteStreamsRef?.current) {
      currentStream = remoteStreamsRef.current.get(peer.peerID || peer.peerId);
    } else {
      currentStream = peer.stream;
    }
  }
  
  useEffect(() => { 
    if (currentStream && videoRef.current) { 
      if (videoRef.current.srcObject !== currentStream) {
        videoRef.current.srcObject = currentStream;
      }
      
      const checkTracks = () => {
        const videoTrack = currentStream.getVideoTracks()[0];
        if (videoTrack) {
          setHasVideo(videoTrack.enabled && videoTrack.readyState === 'live');
        } else {
          setHasVideo(false);
        }
      };

      currentStream.onaddtrack = checkTracks;
      currentStream.onremovetrack = checkTracks;
      const videoTrack = currentStream.getVideoTracks()[0];
      if (videoTrack) {
         videoTrack.onunmute = checkTracks;
         videoTrack.onmute = checkTracks;
      }
      
      checkTracks();

      videoRef.current.play().catch(e => {
         if (e.name !== 'AbortError') console.error("Remote video play error:", e);
      });
      
      // Recheck periodically for 5 seconds after stream assignment to catch late-arriving frames
      const intervalId = setInterval(checkTracks, 500);
      const timeoutId = setTimeout(() => clearInterval(intervalId), 5000);
      
      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    } 
  }, [currentStream]);

  const actualHasVideo = isScreen ? true : ((peer.videoEnabled !== false || peer.isScreenSharing) && hasVideo);

  useEffect(() => {
    if (actualHasVideo && videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
         playPromise.catch(e => {
            if (e.name !== 'AbortError') console.warn("Remote video play error:", e);
         });
      }
    }
  }, [actualHasVideo, currentStream]);

  return (
    <div className={`absolute inset-0 w-full h-full ${isScreen ? 'bg-black' : 'bg-[#1a1b1e]'} transition-all duration-500 overflow-hidden flex items-center justify-center
      ${isSpeaking ? 'ring-2 ring-inset ring-[#5244e1] shadow-[inset_0_0_30px_rgba(82,68,225,0.2)]' : ''}`}>
       <video playsInline muted ref={videoRef} autoPlay className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} ${!actualHasVideo ? 'hidden' : ''}`} />
       {!actualHasVideo && (
         mobileStyle ? (
            <div className="absolute inset-0 bg-violet-600 flex flex-col items-center justify-center">
               <span className="text-4xl md:text-6xl font-black text-white">{peer.name?.charAt(0)?.toUpperCase()}</span>
            </div>
         ) : <UserAvatar name={peer.name} profilePic={peer.profilePic} />
       )}
       
       {isSpeaking && (
          <div className="absolute top-3 right-3 bg-[#5244e1] px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse z-10 shadow-lg">
             <div className="w-1.5 h-1.5 bg-white rounded-full" />
             <span className="text-[8px] font-black uppercase tracking-widest text-white">Speaking</span>
          </div>
       )}
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
  // The auth guard useEffect will handle redirection.
  // We cannot return null here because it violates Rules of Hooks.
  const queryParams = new URLSearchParams(location.search);
  const urlPassword = queryParams.get('pwd');
  const urlIntent = location.state?.intent || queryParams.get('intent');
  
  // States
  const [appState, setAppState] = useState('lobby');
  const [code, setCode] = useState(id || '');
  const [password, setPassword] = useState(urlPassword || '');
  const [copied, setCopied] = useState(false);
  const [intent, setIntent] = useState(urlIntent || 'join');

  useEffect(() => {
    if (intent === 'create' && !password) {
      setPassword(Math.random().toString(36).slice(-6).toUpperCase());
    }
  }, [intent]);

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

  const {
    localStreamRef: streamRef,
    screenStreamRef,
    remoteStreamsRef,
    remoteScreenStreamsRef,
    peerConnectionsRef,
    socketRef: wsRef,
    startScreenShare: hookStartScreenShare,
    stopScreenShare: hookStopScreenShare,
    rejoinWithNewStream,
    createPeerConnection,
    handleNewPeer,
    cleanup,
    safePlay,
    sendWs
  } = useWebRTC({
    roomId: meetingMetadata ? (meetingMetadata._id || meetingMetadata.meetingId) : code,
    token: auth.token || auth?.user?.token || localStorage.getItem('token'),
    isReady: appState === 'in-call',
    onMessage: (msg) => {
      // Directly pass to the local handler to prevent WS ref overwriting loop
      if (messageHandlerRef.current) {
         messageHandlerRef.current({ data: JSON.stringify(msg) });
      }
    },
    onPeerTrackAdded: (peerId) => {
       setPeers(prev => [...prev]); 
    },
    onPeerLeft: (peerId) => {
       setPeers(prev => prev.filter(p => p.peerID !== peerId && p.peerId !== peerId));
       setPinnedUser(prev => (prev === peerId || prev === `${peerId}_screen`) ? null : prev);
    }
  });

  const sendWsRef = useRef(sendWs);
  const createPeerConnectionRef = useRef(createPeerConnection);
  useEffect(() => {
    sendWsRef.current = sendWs;
    createPeerConnectionRef.current = createPeerConnection;
  }, [sendWs, createPeerConnection]);

  const [peers, setPeers] = useState([]);
  const [meetingMessages, setMeetingMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [speakingUser, setSpeakingUser] = useState(null); 
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [roomLocked, setRoomLocked] = useState(false);
  const [aiAssistantActive, setAiAssistantActive] = useState(true);
  const [hostControlsModal, setHostControlsModal] = useState(false);
  const [hostControlsTab, setHostControlsTab] = useState('meeting');
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [pinnedUser, setPinnedUser] = useState(null); // 'local' or a peerID
  const [isRecording, setIsRecording] = useState(false);
  const [endedReason, setEndedReason] = useState(null);
  
  // Refs
  const iceCandidateBufferRef = useRef(new Map());
  const peerIdRef = useRef(null);
  const meetingIdRef = useRef(null);
  const shouldInitiateOfferRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const isMountedRef = useRef(true);
  const messageHandlerRef = useRef(null);
  const screenSendersRef = useRef(new Map());
  const cameraSendersRef = useRef(new Map());
  const userVideo = useRef();
  const peersRef = useRef([]);
  
  
  
  
  
  
  
  
  

  const getMediaConstraints = (isVideoOnly = false) => {
    const isMobile = window.innerWidth <= 768;
    const videoConstraints = {
      width: { ideal: isMobile ? 640 : 1280 },
      height: { ideal: isMobile ? 480 : 720 },
      frameRate: { ideal: isMobile ? 24 : 30 }
    };
    if (isVideoOnly) return { video: videoConstraints };
    return {
      video: videoConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  };

  const applyContentHints = (stream) => {
    if (!stream) return;
    stream.getVideoTracks().forEach(track => {
      if ('contentHint' in track) track.contentHint = 'motion';
    });
    stream.getAudioTracks().forEach(track => {
      if ('contentHint' in track) track.contentHint = 'speech';
    });
  };
  const iceServersRef = useRef(null);
  const isJoiningRef = useRef(false);
  
  const audioContextRef = useRef();
  const audioDestinationRef = useRef();
  const mixingRemoteAudioRef = useRef(false);
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);

  const aiMediaRecorderRef = useRef(null);
  const aiWsRef = useRef(null);
  const autoStartedAiRef = useRef(false);
  const isMutedRef = useRef(!micOn);
  const videoOnRef = useRef(videoOn);
  useEffect(() => { isMutedRef.current = !micOn; }, [micOn]);
  useEffect(() => { videoOnRef.current = videoOn; }, [videoOn]);
  


  const startLocalRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      
      audioContextRef.current = audioCtx;
      audioDestinationRef.current = dest;
      
      const hasTabAudio = displayStream.getAudioTracks().length > 0;
      
      if (hasTabAudio) {
        mixingRemoteAudioRef.current = false;
        const displayAudioSource = audioCtx.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
        displayAudioSource.connect(dest);
      } else {
        mixingRemoteAudioRef.current = true;
        peersRef.current.forEach(({ pc }) => {
          if (!pc) return;
          const receiver = pc.getReceivers().find(r => r.track?.kind === 'audio');
          if (receiver && receiver.track && receiver.track.readyState === 'live') {
            try {
               const remoteSource = audioCtx.createMediaStreamSource(new MediaStream([receiver.track]));
               remoteSource.connect(dest);
            } catch(e) {}
          }
        });
      }
      
      if (streamRef.current && streamRef.current.getAudioTracks().length > 0) {
         try {
            const localSource = audioCtx.createMediaStreamSource(new MediaStream([streamRef.current.getAudioTracks()[0]]));
            localSource.connect(dest);
         } catch(e) {}
      }
      
      const tracks = [displayStream.getVideoTracks()[0], ...dest.stream.getAudioTracks()];
      const mixedStream = new MediaStream(tracks);
      
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) mimeType = 'video/webm;codecs=vp8,opus';
      
      const recorder = new MediaRecorder(mixedStream, { mimeType });
      
      recordedChunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Meeting_Recording_${new Date().toISOString().replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      displayStream.getVideoTracks()[0].onended = () => stopLocalRecording();
      
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (e) {
      console.error("Failed to start recording", e);
      alert("Failed to start recording. Please try again.");
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    mixingRemoteAudioRef.current = false;
    audioContextRef.current = null;
    audioDestinationRef.current = null;
  };

  const handleStartAI = async (meetingOverride = null) => {
     if (aiAssistantActive) return;
     try {
        const activeMeeting = meetingOverride || meetingMetadata;
        const meetingId = activeMeeting?._id || activeMeeting?.meetingId || activeMeeting?.joinCode || id;
        if (!meetingId) return;
        const res = await fetch(getApiUrl(`/api/meetings/${encodeURIComponent(meetingId)}/start-ai`), {
           method: 'POST',
           headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
           },
           body: JSON.stringify({ frontendUrl: window.location.origin })
        });
        const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || data.details || 'Failed to start AI Assistant.');
          }
          setAiAssistantActive(true);
          // Manually inject AI Bot into peers array for UI display
          setPeers(prev => {
            if (prev.find(p => p.name === 'Forge India Connect AI')) return prev;
            return [...prev, { peerID: 'ai-assistant-bot', pc: null, stream: null, name: 'Forge India Connect AI' }];
          });
       } catch(e) {
        console.error('Failed to start AI', e);
        setAiAssistantActive(false);
     }
  };

  useEffect(() => {
    if (
      appState === 'in-call' &&
      meetingMetadata?.isHost &&
      !aiAssistantActive &&
      !autoStartedAiRef.current
    ) {
      autoStartedAiRef.current = true;
      handleStartAI(meetingMetadata);
    }
  }, [appState, meetingMetadata, aiAssistantActive]);

  useEffect(() => {
    if (appState === 'in-call' && meetingMetadata?.aiEnabled && !aiAssistantActive) {
      setAiAssistantActive(true);
      setPeers(prev => {
        if (prev.find(p => p.name === 'Forge India Connect AI')) return prev;
        return [...prev, { peerID: 'ai-assistant-bot', pc: null, stream: null, name: 'Forge India Connect AI' }];
      });
    }
  }, [appState, meetingMetadata, aiAssistantActive]);

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
          
          let intervalId;
          const startRecordingCycle = () => {
             if (!ws || ws.readyState !== WebSocket.OPEN) return;
             if (!isMutedRef.current && streamRef.current && streamRef.current.getAudioTracks().length > 0) {
                try {
                   const currentStream = new MediaStream([streamRef.current.getAudioTracks()[0]]);
                   const recorder = new MediaRecorder(currentStream, mimeType ? { mimeType } : undefined);
                   aiMediaRecorderRef.current = recorder;
                   recorder.ondataavailable = (e) => {
                      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                         e.data.arrayBuffer().then(buf => {
                            if (ws.readyState === WebSocket.OPEN) ws.send(buf);
                         });
                      }
                   };
                   recorder.start();
                   setTimeout(() => {
                      if (recorder.state === 'recording') recorder.stop();
                   }, 5000);
                } catch(e) {
                   console.warn("AI recording cycle error:", e);
                }
             }
          };

          intervalId = setInterval(startRecordingCycle, 5000);
          startRecordingCycle();

          return () => {
             clearInterval(intervalId);
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
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'https://workspace-blue-theta-87.vercel.app' : window.location.origin;
    const inviteLink = `${baseUrl}/w/${workspaceId}/meet/room/${code || id}?pwd=${password}&intent=join`;
    const inviteText = `Join my Forge India Connect Meeting:\nLink: ${inviteLink}\nMeeting ID: ${code}\nPassword: ${password}`;
    
    navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  // Fix: Ensure local video is attached to the video element whenever appState changes or stream is ready
  useEffect(() => {
    if (userVideo.current && streamRef.current) {
      if (userVideo.current.srcObject !== streamRef.current) {
        userVideo.current.srcObject = streamRef.current;
      }
    }
  }, [appState, videoOn, pinnedUser, isScreenSharing]); // Re-run when appState/pin changes

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

  

  const handleEndCall = async () => {
    setFinalStats({ duration, participants: peers.length + 1 });
    setAppState('ended');
    localStorage.removeItem('activeMeeting');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setAiAssistantActive(false);
    intentionalCloseRef.current = true;
    if (wsRef.current) {
      try { sendWs('leave', {}); } catch (e) {}
      try { wsRef.current.close(1000, 'user-left'); } catch (e) {}
      wsRef.current = null;
    }
    const token = localStorage.getItem('token');
    const meetingId = meetingMetadata?._id || meetingMetadata?.meetingId || meetingMetadata?.joinCode || id;
    if (token && meetingId) {
      fetch(getApiUrl(`/api/meetings/${encodeURIComponent(meetingId)}/leave`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(err => console.warn('[Meeting] Failed to notify backend leave:', err));

      // Only summarize if the meeting has actually ended (not just a user leaving)
      // The backend will reject with 400 if meeting.status !== 'ended'
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => { try { track.stop() } catch(e){} });
      streamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => { try { track.stop() } catch(e){} });
      screenStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e){}
      audioContextRef.current = null;
    }
    if (peersRef.current) {
      peersRef.current.forEach(p => {
        if (p.pc) { try { p.pc.close(); } catch (err) {} }
      });
      peersRef.current = [];
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setRoomError("Screen sharing is not supported natively by this app or browser. Please ensure you granted the correct permissions.");
        setTimeout(() => setRoomError(null), 5000);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        
        window.isStartingScreenShare = true;
        for (const peerEntry of peersRef.current) {
          const { pc, peerID } = peerEntry;
          if (!pc || pc.connectionState === 'closed') continue;
          try {
            const sender = pc.addTrack(screenTrack, stream);
            screenSendersRef.current.set(peerID, sender);
          } catch (err) {
            console.warn(`[ScreenShare] Failed to addTrack to ${peerID}:`, err);
          }
        }
        setTimeout(() => { window.isStartingScreenShare = false; }, 2000);
        
        // No local video update needed, dual tiles will handle it via state
        
        setIsScreenSharing(true);
        setPinnedUser('local_screen'); // Pin our own screen temporarily
        if (sendWsRef.current) sendWsRef.current('media-state', { audioEnabled: micOn, videoEnabled: videoOn, isScreenSharing: true });
        screenTrack.onended = () => stopScreenShare();
      } catch (err) {
        console.error(err);
        setRoomError('Could not start screen sharing. Permission denied or unsupported.');
        setTimeout(() => setRoomError(null), 5000);
      }
    } else { stopScreenShare(); }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      
      for (const peerEntry of peersRef.current) {
        const { pc, peerID } = peerEntry;
        if (!pc || pc.connectionState === 'closed') continue;
        try {
            const sender = screenSendersRef.current.get(peerID);
            if (sender) {
              pc.removeTrack(sender);
              screenSendersRef.current.delete(peerID);
            }
          } catch (err) {
            console.warn(`[ScreenShare] Failed to removeTrack for ${peerID}:`, err);
          }
      }
      
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      setPinnedUser(prev => prev === 'local_screen' ? null : prev);
      if (sendWsRef.current) sendWsRef.current('media-state', { audioEnabled: micOn, videoEnabled: videoOn, isScreenSharing: false });
    }
  };

  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
    shouldInitiateOfferRef.current = shouldInitiateOffer;
    sendWsRef.current = sendWs;
  }, [createPeerConnection, shouldInitiateOffer, sendWs]);

  const connectSignaling = useCallback((signalingRoomId, token) => {
    if (typeof window === 'undefined') return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close(1000, 'Reconnecting');
      wsRef.current = null;
    }

    intentionalCloseRef.current = false;
    meetingIdRef.current = signalingRoomId;
    const wsUrl = buildWsUrl();
    console.log('[Signaling] Connecting to:', wsUrl, 'room:', signalingRoomId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Signaling] Connected, joining room:', signalingRoomId);
      ws.send(JSON.stringify({
        type: 'join',
        data: { 
          token, 
          meetingId: signalingRoomId,
          roomId: signalingRoomId,
          joinCode: signalingRoomId
        }
      }));
    };

    const handleSignaling = async (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch (err) {
        console.error('[Signaling] Invalid JSON received');
        return; // hard stop
      }

      try {
        if (msg.type === 'joined') {
          peerIdRef.current = msg.peerId;
          setRoomError(null);
          setIsVerifying(false);
          setAppState('in-call');
          if (meetingMetadata?.aiEnabled) {
            setAiAssistantActive(true);
          }
          const rawPeers = msg.existingPeers || [];
          const deduplicatedPeers = [];
          for (const p of rawPeers) {
             if (p.name && p.name !== 'Participant') {
                const existingIdx = deduplicatedPeers.findIndex(dp => dp.name === p.name);
                if (existingIdx !== -1) {
                   deduplicatedPeers[existingIdx] = p; // Keep the latest connection
                } else {
                   deduplicatedPeers.push(p);
                }
             } else {
                deduplicatedPeers.push(p);
             }
          }
          
          const peers = deduplicatedPeers.map(p => ({
            peerId: p.peerId,
            userId: p.userId,
            name: p.name,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          }));
          if (sendWsRef.current) {
             sendWsRef.current('media-state', { audioEnabled: !isMutedRef.current, videoEnabled: videoOnRef.current, isScreenSharing: isScreenSharing });
          }
          
          if (peers.some(peer => peer.name === 'Forge India Connect AI')) {
            setAiAssistantActive(true);
          }
          // Initiate offers with peers whose ID sorts higher (avoid SDP glare)
          for (const peer of peers) {
            let existingPeer = peersRef.current.find(p => p.peerID === peer.peerId);
            if (!existingPeer) {
              peersRef.current.push({ peerID: peer.peerId, pc: null, name: peer.name });
            }
            if (shouldInitiateOfferRef.current(peer.peerId)) {
              const pc = createPeerConnectionRef.current(peer.peerId, streamRef.current, peer.name);
              if (pc) {
                const pRef = peersRef.current.find(p => p.peerID === peer.peerId);
                if (pRef) pRef.pc = pc;
                setPeers(prev => {
                  const newPeers = [...prev];
                  const idx = newPeers.findIndex(p => p.peerID === peer.peerId);
                  if (idx !== -1) {
                    newPeers[idx] = { ...newPeers[idx], pc };
                  } else {
                    newPeers.push({ peerID: peer.peerId, pc, stream: null, name: peer.name, audioEnabled: peer.audioEnabled, videoEnabled: peer.videoEnabled });
                  }
                  return newPeers;
                });
              }
            } else {
              // The other peer will send the offer — just register the peer
              setPeers(prev => {
                if (peer.name === 'Forge India Connect AI') {
                  const existingBot = prev.find(p => p.name === 'Forge India Connect AI');
                  if (existingBot && existingBot.peerID === 'ai-assistant-bot') {
                    return prev.map(p => p.peerID === 'ai-assistant-bot' ? { ...p, peerID: peer.peerId, name: peer.name } : p);
                  } else if (existingBot) return prev;
                }
                if (prev.find(p => p.peerID === peer.peerId)) return prev;
                return [...prev, { peerID: peer.peerId, pc: null, stream: null, name: peer.name, audioEnabled: peer.audioEnabled, videoEnabled: peer.videoEnabled }];
              });
            }
          }
        }
        if (msg.type === 'peer-joined') {
          if (msg.peerId === peerIdRef.current) return;
          if (peersRef.current.find(p => p.peerID === msg.peerId)) return;
          
          // Deduplicate ghost connections based on exact ID.
          // Since the backend now uses unique session IDs, we don't aggressively filter out same-user connections
          const oldPeerRefIndex = peersRef.current.findIndex(p => p.peerID === msg.peerId);
          
          if (oldPeerRefIndex !== -1) {
             const oldPeer = peersRef.current[oldPeerRefIndex];
             if (oldPeer.pc) { try { oldPeer.pc.close(); } catch(e){} }
             peersRef.current.splice(oldPeerRefIndex, 1);
          }
          
          peersRef.current.push({ peerID: msg.peerId, pc: null, name: msg.name, userId: msg.userId });
          
          setPeers(prev => {
             const filteredPrev = prev.filter(p => p.peerID !== msg.peerId);
             
             if (msg.name === 'Forge India Connect AI') {
                const existingBot = filteredPrev.find(p => p.name === 'Forge India Connect AI');
                if (existingBot && existingBot.peerID === 'ai-assistant-bot') {
                   return filteredPrev.map(p => p.peerID === 'ai-assistant-bot' ? { ...p, peerID: msg.peerId, name: msg.name, userId: msg.userId } : p);
                } else if (existingBot) {
                   return filteredPrev;
                }
             }
             if (filteredPrev.find(p => p.peerID === msg.peerId)) return filteredPrev;
             return [...filteredPrev, { peerID: msg.peerId, pc: null, stream: null, name: msg.name || 'Participant', userId: msg.userId }];
          });
          
          if (msg.name === 'Forge India Connect AI') {
            setAiAssistantActive(true);
          }
          
          // CRITICAL: Ensure the new peer knows if we are already sharing our screen!
          if (sendWsRef.current) {
             sendWsRef.current('media-state', { audioEnabled: micOn, videoEnabled: videoOn, isScreenSharing: isScreenSharing });
          }
          
          if (shouldInitiateOfferRef.current(msg.peerId)) {
            const pc = createPeerConnectionRef.current(msg.peerId, streamRef.current, msg.name || 'Participant');
            if (pc) {
              const pRef = peersRef.current.find(p => p.peerID === msg.peerId);
              if (pRef) pRef.pc = pc;
              setPeers(prev => prev.map(p => p.peerID === msg.peerId ? { ...p, pc } : p));
            }
          }
        }
        if (msg.type === 'offer') {
          const fromPeerId = msg.fromPeerId;
          if (msg.isScreenShare) {
             window.pendingScreenShare = window.pendingScreenShare || new Set();
             window.pendingScreenShare.add(fromPeerId);
          }
          if (msg.screenTrackId) {
             window.screenTrackIds = window.screenTrackIds || new Map();
             window.screenTrackIds.set(fromPeerId, msg.screenTrackId);
          }
          if (msg.screenMid) {
             window.screenMids = window.screenMids || new Map();
             window.screenMids.set(fromPeerId, msg.screenMid);
          }
          if (msg.screenStreamId) {
             window.screenStreamIds = window.screenStreamIds || new Map();
             window.screenStreamIds.set(fromPeerId, msg.screenStreamId);
          }
          let pc = peersRef.current.find(p => p.peerID === fromPeerId)?.pc;
          if (!pc) {
            pc = createPeerConnectionRef.current(fromPeerId, streamRef.current, 'Participant');
            let pRef = peersRef.current.find(p => p.peerID === fromPeerId);
            if (pRef) {
               pRef.pc = pc;
            } else {
               peersRef.current.push({ peerID: fromPeerId, pc });
            }
            setPeers(prev => {
               if (prev.find(p => p.peerID === fromPeerId)) {
                  return prev.map(p => p.peerID === fromPeerId ? { ...p, pc } : p);
               }
               return [...prev, { peerID: fromPeerId, pc, stream: null, name: 'Participant' }];
            });
          }
          const polite = !shouldInitiateOfferRef.current(fromPeerId);
          const offerCollision = pc.makingOffer || pc.signalingState !== 'stable';
          const ignoreOffer = !polite && offerCollision;
          
          if (ignoreOffer) return;

          try {
            if (offerCollision && pc.signalingState === 'have-local-offer') {
               await pc.setLocalDescription({ type: 'rollback' });
            }
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
          
          const audioEl = document.getElementById(`audio-${pid}`);
          if (audioEl) {
            audioEl.srcObject = null;
            audioEl.remove();
          }
          
          peersRef.current = peersRef.current.filter(p => p.peerID !== pid);
          setPeers(prev => prev.filter(p => p.peerID !== pid));
          // Auto-unpin if pinned user left
          setPinnedUser(prev => (prev === pid || prev === `${pid}_screen`) ? null : prev);
        }
        if (msg.type === 'peer-media-state') {
          if (msg.fromPeerId === peerIdRef.current) return; // Ignore echoed self-messages
          
          setPeers(prev => prev.map(p => {
            if (p.peerID === msg.fromPeerId) {
               // If screen sharing is stopped, also clear the screenStream to immediately remove the UI tile
               return { ...p, audioEnabled: msg.audioEnabled, videoEnabled: msg.videoEnabled, isScreenSharing: msg.isScreenSharing, screenStream: msg.isScreenSharing ? p.screenStream : null };
            }
            return p;
          }));
          if (msg.isScreenSharing === false) {
             setPinnedUser(prev => (prev === msg.fromPeerId || prev === `${msg.fromPeerId}_screen`) ? null : prev);
          } else if (msg.isScreenSharing) {
             setPinnedUser(`${msg.fromPeerId}_screen`);
          }
        }
        if (msg.type === 'error') {
          console.warn('[Signaling] Server error:', msg.message);
          if (msg.message === 'Room is locked by host') {
            setEndedReason('Room is locked by host.');
            setAppState('ended');
            ws.close();
            return;
          }
          setRoomError(msg.message);
          setIsVerifying(false);
        }
        if (msg.type === 'meeting-ended') {
          setEndedReason('The host has ended this meeting for all participants.');
          handleEndCall();
        }
        if (msg.type === 'kicked') {
          setEndedReason('You have been removed from the meeting by the host.');
          handleEndCall();
        }
        if (msg.type === 'chat-message') {
          setMeetingMessages(prev => [...prev, {
            user: msg.user,
            text: msg.text,
            time: msg.time || new Date().toLocaleTimeString()
          }]);
        }
      } catch (err) {
        console.error('[Signaling] Handler error:', err);
      }
    };
    
    messageHandlerRef.current = handleSignaling;
    ws.onmessage = handleSignaling;

    ws.onerror = (e) => {
      console.warn('[Signaling] WS error:', e?.message || e);
      setRoomError('Signaling server connection failed.');
      setIsVerifying(false);
    };

    ws.onclose = (e) => {
      console.log('[Signaling] WS closed. Code:', e?.code);
      peerIdRef.current = null;
      // Only reconnect if: not intentional close, not a clean 1000 close, component still mounted, and in-call
      if (!intentionalCloseRef.current && e?.code !== 1000 && isMountedRef.current && appState === 'in-call') {
        console.log('[Signaling] Unexpected close, will reconnect...');
        
        // Clean up old peer connections before reconnecting
        peersRef.current.forEach(p => {
          if (p.pc) {
            try { p.pc.close(); } catch (err) {}
          }
        });
        document.querySelectorAll('audio[id^="audio-"]').forEach(el => {
          el.srcObject = null;
          el.remove();
        });
        peersRef.current = [];
        iceCandidateBufferRef.current.clear();
        screenSendersRef.current.clear();
        cameraSendersRef.current.clear();
        setPeers([]);

        setTimeout(() => {
          if (isMountedRef.current && meetingIdRef.current) {
            const token = localStorage.getItem('token');
            if (token) connectSignaling(meetingIdRef.current, token);
          }
        }, 3000);
      }
    };
  }, [appState]);

  useEffect(() => {
    isMountedRef.current = true;

    const cleanupMeeting = () => {
      // Send leave signal before closing
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'leave', data: {} }));
        } catch (e) {}
      }
      // Close all peer connections
      if (peersRef.current) {
        peersRef.current.forEach(p => {
          if (p.pc) {
            try { p.pc.close(); } catch (err) {}
          }
        });
        document.querySelectorAll('audio[id^="audio-"]').forEach(el => {
          el.srcObject = null;
          el.remove();
        });
        peersRef.current = [];
      }
      // Clear all signaling maps
      iceCandidateBufferRef.current.clear();
      screenSendersRef.current.clear();
      cameraSendersRef.current.clear();
      // Close WebSocket with clean code 1000
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        try { wsRef.current.close(1000, 'page-unload'); } catch (e) {}
        wsRef.current = null;
      }
      // Stop all media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
           try { track.stop(); } catch(e){}
        });
        streamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
           try { track.stop(); } catch(e){}
        });
        screenStreamRef.current = null;
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch(e){}
        audioContextRef.current = null;
      }
    };

    window.addEventListener('beforeunload', cleanupMeeting);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', cleanupMeeting);
      cleanupMeeting();
    };
  }, []);


  const handleJoinCall = async () => {
    if (isJoiningRef.current) return;
    isJoiningRef.current = true;
    
    console.log(`📡 [CLIENT] Attempting to join call: ID=${id}`);
    setIsVerifying(true);
    setRoomError(null);

    if (!isWebRTCAvailable()) {
      setPermissionError('WebRTCError');
      setIsVerifying(false);
      isJoiningRef.current = false;
      return;
    }

    let cleanCode = (code || id || '').trim();
    const token = localStorage.getItem('token');

    if (!token) {
      setRoomError('Authentication token not found. Please log in again.');
      setIsVerifying(false);
      isJoiningRef.current = false;
      return;
    }

    if (!streamRef.current && !permissionError) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
        applyContentHints(stream);
        streamRef.current = stream;
        if (userVideo.current) userVideo.current.srcObject = stream;
        setPermissionError(null);
      } catch (err) {
        console.error("Media error during join:", err);
        setPermissionError(err.name);
        setIsVerifying(false);
        isJoiningRef.current = false;
        return;
      }
    }

    try {
      let activePassword = password;
      if (!activePassword) {
         const saved = localStorage.getItem('activeMeeting');
         if (saved) {
           try {
             const parsed = JSON.parse(saved);
             if (parsed.roomId === (code || id || '').trim()) {
                activePassword = parsed.password;
                setPassword(activePassword);
             }
           } catch(e){}
         }
      }

      if (intent === 'create') {
        if (!activePassword) {
          activePassword = Math.random().toString(36).slice(-6).toUpperCase();
          setPassword(activePassword);
        }
        
        const createRes = await fetch(getApiUrl('/api/meetings'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: `${auth.user || 'User'}'s Meeting`,
            passcode: activePassword,
            roomId: cleanCode,
            intent: 'create',
          }),
        });
        const createdMeeting = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createdMeeting.error || 'Failed to create meeting.');
        }
        cleanCode = createdMeeting.joinCode || cleanCode;
        setCode(cleanCode);
        navigate(`/w/${workspaceId}/meet/room/${encodeURIComponent(cleanCode)}?pwd=${encodeURIComponent(activePassword)}&intent=join`, { replace: true });
      }

      // Resolve meeting via REST to get MongoDB _id
      const query = activePassword ? `?passcode=${encodeURIComponent(activePassword)}` : '';
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
      setIsHost(!!data.isHost);
      localStorage.setItem('activeMeeting', JSON.stringify({ roomId: cleanCode, password: activePassword }));

      // Connect WebSocket signaling with the MongoDB _id
      connectSignaling(signalingRoomId, token);
    } catch (err) {
      console.error('[Join] Failed:', err);
      setRoomError(err.message || 'Could not join meeting.');
      setIsVerifying(false);
    } finally {
      isJoiningRef.current = false;
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = { user: auth.user, text: chatInput, time: new Date().toLocaleTimeString() };
    setMeetingMessages(prev => [...prev, msg]);
    setChatInput('');
    if (sendWsRef.current) {
      sendWsRef.current('chat-message', { text: msg.text, user: msg.user, time: msg.time });
    }
  };

  useEffect(() => {
    let interval;
    if (appState === 'in-call') {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [appState]);

  useEffect(() => {
    let mounted = true;
    const toggleMedia = async () => {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.enabled = micOn);
        streamRef.current.getVideoTracks().forEach(track => {
          if (!videoOn) {
            track.stop();
            streamRef.current.removeTrack(track);
          } else {
            track.enabled = true;
          }
        });
        
        if (videoOn && streamRef.current.getVideoTracks().length === 0) {
          try {
            const newStream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(true));
            if (!mounted) {
              newStream.getTracks().forEach(t => t.stop());
              return;
            }
            applyContentHints(newStream);
            const newVideoTrack = newStream.getVideoTracks()[0];
            streamRef.current.addTrack(newVideoTrack);
            
            peersRef.current.forEach(({ pc, peerID }) => {
              if (!pc) return;
              let cameraSender = cameraSendersRef.current.get(peerID);
              if (!cameraSender) {
                cameraSender = pc.getSenders().find(s => s.track && s.track.kind === 'video' && !s.track.label?.toLowerCase().includes('screen'));
                if (cameraSender) cameraSendersRef.current.set(peerID, cameraSender);
              }
              if (cameraSender) {
                cameraSender.replaceTrack(newVideoTrack).catch(e => console.warn("Failed to replace video track:", e));
              } else {
                try {
                  const newSender = pc.addTrack(newVideoTrack, streamRef.current);
                  cameraSendersRef.current.set(peerID, newSender);
                } catch (e) {
                  console.warn("Failed to add new video track:", e);
                }
              }
            });
          } catch (err) {
            console.error("Failed to re-acquire video track:", err);
            if (mounted) setVideoOn(false);
          }
        }
      }
      if (sendWsRef.current) {
        sendWsRef.current('media-state', { audioEnabled: micOn, videoEnabled: videoOn, isScreenSharing });
      }
    };
    
    toggleMedia();
    return () => { mounted = false; };
  }, [micOn, videoOn, isScreenSharing]);

  useEffect(() => {
    if ((appState === 'lobby' || appState === 'in-call') && !streamRef.current) {
      navigator.mediaDevices.getUserMedia(getMediaConstraints())
        .then(stream => {
          applyContentHints(stream);
          streamRef.current = stream;
          stream.getAudioTracks().forEach(track => track.enabled = micOn);
          if (!videoOn) {
            stream.getVideoTracks().forEach(track => {
              track.stop();
              stream.removeTrack(track);
            });
          }
          if (userVideo.current && !isScreenSharing) userVideo.current.srcObject = stream;
          setPermissionError(null);
        })
        .catch(err => {
          console.error("❌ Media error:", err);
          setPermissionError(err.name);
        });
    }
  }, [appState]);
  if (!auth.user) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5244e1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0a0b0d] text-white overflow-hidden font-sans">
      
      {/* 1. LOBBY STATE */}
      {appState === 'lobby' && (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 bg-[#0a0b0d] overflow-y-auto">
           <div className="absolute top-6 left-6 z-10">
             <button onClick={() => navigate(`/w/${workspaceId}/meet`)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
               <Home size={14} /> Home
             </button>
           </div>
           <div className="w-full max-w-2xl space-y-6 md:space-y-10 animate-fade mt-16 md:mt-0">
              <div className="relative aspect-video bg-[#1a1b1e] rounded-[24px] md:rounded-[40px] overflow-hidden border-2 border-white/5 shadow-2xl">
                 <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full object-cover mirror ${!videoOn ? 'hidden' : ''}`} />
                 {!videoOn && <div className="absolute inset-0 flex items-center justify-center"><UserAvatar name={auth.user} /></div>}
                 
                 <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-3 md:gap-4">
                    <button onClick={() => setMicOn(!micOn)} className={`w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500'}`}><Mic size={20} /></button>
                    <button onClick={() => setVideoOn(!videoOn)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${videoOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500'}`}><VideoIcon size={20} /></button>
                 </div>
              </div>
              <div className="text-center space-y-4 md:space-y-6">
                 <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-black">Ready to join?</h2>
                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mt-2">
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

                 <p className="text-zinc-500 text-xs md:text-sm">Check your camera and microphone before joining the meeting.</p>
                 <button 
                    onClick={handleJoinCall} 
                    disabled={!!permissionError}
                    className="px-8 md:px-12 py-3.5 md:py-4 bg-[#5244e1] disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                 >
                    {intent === 'create' ? 'Create Meeting Now' : 'Join Meeting Now'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* 2. IN-CALL STATE */}
      {appState === 'in-call' && !roomError && (
        <div className="h-screen w-screen flex flex-col bg-[#0a0b0d] font-sans">
          
          {/* TOP HEADER */}
          <div className="h-[60px] px-3 md:px-4 flex items-center justify-between border-b border-white/5 bg-[#0a0b0d]">
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <button onClick={handleEndCall} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <ChevronLeft size={20} className="text-gray-700" />
              </button>
            </div>
            <div className="hidden md:flex items-center gap-4 ml-4 shrink-0">
               <img src={LogoImage} alt="Forge India" className="h-6 w-auto object-contain" />
            </div>
            <div className="flex flex-col items-center justify-center flex-1 mx-2 md:mx-4 min-w-0">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 rounded-full border border-rose-200 mb-0.5">
                <div className="w-1 h-1 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black tracking-widest text-rose-600 uppercase">Live</span>
              </div>
              <h1 className="text-xs md:text-[15px] font-black text-white truncate max-w-[120px] sm:max-w-[200px] text-center w-full">{meetingMetadata?.title || 'Meeting Room'}</h1>
            </div>
            <div className="flex flex-col items-end justify-center min-w-[50px] md:min-w-[60px] shrink-0">
              <div className="flex items-center gap-0.5 md:gap-1 mb-0.5">
                <Shield size={10} className="text-emerald-500" />
                <span className="text-[8px] md:text-[9px] font-black tracking-widest text-emerald-600 uppercase hidden sm:inline">E2EE</span>
              </div>
              <span className="text-xs md:text-[13px] font-bold text-zinc-400 font-mono">{formatTime(duration)}</span>
            </div>
          </div>

          {/* ROOM ID STRIP */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 py-2 bg-[#0f1115] border-b border-white/5 px-4 text-center">
            <Copy size={11} className="text-zinc-500" />
            <span className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest">ID:</span>
            <span className="text-[10px] md:text-xs font-bold text-zinc-300 select-all">{code}</span>
            {password && (
              <>
                <Lock size={11} className="text-zinc-500 ml-2 md:ml-3" />
                <span className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest">Pass:</span>
                <span className="text-[10px] md:text-xs font-bold text-zinc-300">{password}</span>
              </>
            )}
          </div>

          {/* MAIN BODY */}
          <div className="flex-1 flex overflow-hidden bg-[#0a0b0d] relative">
            
            {/* VIDEO GRID */}
            <div className={[
              "flex-1 pb-28 md:pb-24 overflow-hidden",
              pinnedUser ? "flex flex-col md:flex-row p-2 md:p-3 gap-2" : 
              (!pinnedUser && peers.length >= 4) ? "p-2 md:p-4 gap-3 horizontal-video-grid" :
              (!pinnedUser && (peers.length === 2 || peers.length === 3)) ? "p-2 md:p-4 grid gap-3 overflow-y-auto content-start grid-cols-2 lg:grid-cols-3" :
              "p-2 md:p-4 grid gap-3 overflow-y-auto content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            ].filter(Boolean).join(" ")}>

              {/* ---- PINNED VIEW: Focus + Strip ---- */}
              {pinnedUser ? (
                <>
                  {/* FOCUSED (PINNED) TILE */}
                  <div className="flex-1 min-h-0 min-w-0 relative rounded-3xl overflow-hidden bg-slate-800">
                    {pinnedUser === 'local' ? (
                      <>
                        <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full object-cover ${(!videoOn) ? 'hidden' : ''} mirror`} />
                        {(!videoOn) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-blue-600">
                            <span className="text-6xl md:text-8xl font-black text-white">{auth.user?.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 right-4 z-20">
                          <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Shield size={14} className="text-emerald-400 shrink-0" />
                              <span className="text-sm font-bold text-white truncate">{auth.user} (You)</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {!micOn && <MicOff size={14} className="text-rose-500" />}
                              {!videoOn && <VideoOff size={14} className="text-rose-500" />}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : pinnedUser === 'local_screen' ? (
                      <>
                        <video playsInline muted ref={el => { if(el && el.srcObject !== screenStreamRef.current) el.srcObject = screenStreamRef.current }} autoPlay className={`w-full h-full object-contain bg-black`} />
                        <div className="absolute bottom-4 left-4 right-4 z-20">
                          <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                            <span className="text-sm font-bold text-white truncate">Your Screen</span>
                          </div>
                        </div>
                        <button onClick={(e) => {
                           e.stopPropagation();
                           const elem = e.currentTarget.parentElement;
                           if(elem.requestFullscreen) elem.requestFullscreen();
                           else if(elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                        }} className="absolute top-3 right-14 z-30 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 transition-all group" title="Fullscreen">
                           <Maximize2 size={16} className="text-white/70 group-hover:text-white" />
                        </button>
                      </>
                    ) : (() => {
                      const isScreenPin = pinnedUser.endsWith('_screen');
                      const basePeerId = isScreenPin ? pinnedUser.replace('_screen', '') : pinnedUser;
                      const pinnedPeer = peers.find(p => p.peerID === basePeerId);
                      if (!pinnedPeer) { setPinnedUser(null); return null; }
                      const streamToRender = null; // Streams are grabbed via refs to prevent re-render issues
                      return (
                        <>
                          <RemoteVideo peer={pinnedPeer} stream={streamToRender} isSpeaking={speakingUser === pinnedPeer.peerID || activeSpeakers.includes(pinnedPeer.peerID)} mobileStyle={false} isScreen={isScreenPin} remoteStreamsRef={remoteStreamsRef} remoteScreenStreamsRef={remoteScreenStreamsRef} />
                          {isScreenPin && (
                            <button onClick={(e) => {
                               e.stopPropagation();
                               const elem = e.currentTarget.parentElement;
                               if(elem.requestFullscreen) elem.requestFullscreen();
                               else if(elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                            }} className="absolute top-3 right-14 z-30 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 transition-all group" title="Fullscreen">
                               <Maximize2 size={16} className="text-white/70 group-hover:text-white" />
                            </button>
                          )}
                          <div className="absolute bottom-4 left-4 right-4 z-20">
                            <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                              <div className="flex items-center gap-2 overflow-hidden">
                                 <span className="text-sm font-bold text-white truncate">{pinnedPeer.name}{isScreenPin ? "'s Screen" : ""}</span>
                              </div>
                              {!isScreenPin && (
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                   {pinnedPeer.audioEnabled === false && <MicOff size={14} className="text-rose-500" />}
                                   {pinnedPeer.videoEnabled === false && <VideoOff size={14} className="text-rose-500" />}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    {/* Unpin button */}
                    <button onClick={() => setPinnedUser(null)} className="absolute top-3 right-3 z-30 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/80 transition-all group" title="Unpin">
                      <PinOff size={16} className="text-white/70 group-hover:text-white" />
                    </button>
                  </div>

                  {/* UNPINNED STRIP */}
                  <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden md:w-[200px] shrink-0 pb-2 md:pb-0">
                    {/* Local tile in strip (if not pinned) */}
                    {pinnedUser !== 'local' && (
                      <div className="relative rounded-2xl overflow-hidden bg-slate-800 w-[140px] md:w-full aspect-video shrink-0 cursor-pointer group" onClick={() => setPinnedUser('local')}>
                        <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover'} ${(!videoOn && !isScreenSharing) ? 'hidden' : ''} ${!isScreenSharing ? 'mirror' : ''}`} />
                        {(!videoOn && !isScreenSharing) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-blue-600">
                            <span className="text-xl font-black text-white">{auth.user?.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20">
                          <div className="bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center justify-between border border-white/10">
                            <span className="text-[10px] font-bold text-white truncate">{isScreenSharing ? 'Your Screen' : `${auth.user} (You)`}</span>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                               {!micOn && <MicOff size={10} className="text-rose-500" />}
                               {!videoOn && <VideoOff size={10} className="text-rose-500" />}
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-1.5 right-1.5 z-30 w-6 h-6 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pin size={12} className="text-white/80" />
                        </div>
                      </div>
                    )}
                    {/* Remote peers in strip (if not pinned) */}
                    {peers.filter(p => p.peerID !== pinnedUser).map(peer => (
                      <div key={peer.peerID} className="relative rounded-2xl overflow-hidden bg-violet-600 w-[140px] md:w-full aspect-video shrink-0 cursor-pointer group" onClick={() => setPinnedUser(peer.peerID)}>
                        <RemoteVideo peer={peer} isSpeaking={speakingUser === peer.peerID || activeSpeakers.includes(peer.peerID)} mobileStyle={true} remoteStreamsRef={remoteStreamsRef} remoteScreenStreamsRef={remoteScreenStreamsRef} />
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20">
                          <div className="bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center justify-between border border-white/10">
                            <span className="text-[10px] font-bold text-white truncate">{peer.name}</span>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                               {peer.audioEnabled === false && <MicOff size={10} className="text-rose-500" />}
                               {peer.videoEnabled === false && <VideoOff size={10} className="text-rose-500" />}
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-1.5 right-1.5 z-30 w-6 h-6 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pin size={12} className="text-white/80" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* ---- NORMAL GRID VIEW ---- */
                <>
              {/* LOCAL CAMERA TILE */}
              {(() => {
                 const tileClass = 'w-full aspect-[4/3] md:aspect-video snap-start';
                 return (
                  <React.Fragment>
                      {isScreenSharing && screenStreamRef.current && (
                         <div className={`relative rounded-3xl overflow-hidden bg-black ${tileClass} cursor-pointer group`}>
                           <video playsInline muted ref={el => { if(el && el.srcObject !== screenStreamRef.current) el.srcObject = screenStreamRef.current }} autoPlay className={`w-full h-full object-contain`} />
                           <div className="absolute bottom-3 left-3 right-3 z-20">
                              <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                                 <span className="text-xs font-bold text-white truncate">Your Screen</span>
                              </div>
                           </div>
                           <button onClick={(e) => {
                              e.stopPropagation();
                              const elem = e.currentTarget.parentElement;
                              if(elem.requestFullscreen) elem.requestFullscreen();
                              else if(elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                           }} className="absolute top-3 right-12 z-30 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all" title="Fullscreen">
                             <Maximize2 size={14} className="text-white/80" />
                           </button>
                           <button onClick={() => setPinnedUser('local_screen')} className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all" title="Pin to fullscreen">
                             <Pin size={14} className="text-white/80" />
                           </button>
                         </div>
                      )}
                      <div className={`relative rounded-3xl overflow-hidden bg-slate-800 ${tileClass} cursor-pointer group`}>
                         <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full object-cover ${(!videoOn) ? 'hidden' : ''} mirror`} />
                         {(!videoOn) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]">
                               <UserAvatar name={auth.user} />
                            </div>
                         )}
                         <div className="absolute bottom-3 left-3 right-3 z-20">
                           <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                              <div className="flex items-center gap-2 overflow-hidden">
                                 <Shield size={12} className="text-emerald-400 shrink-0" />
                                 <span className="text-xs font-bold text-white truncate">{auth.user} (You)</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                 {!micOn && <MicOff size={12} className="text-rose-500" />}
                                 {!videoOn && <VideoOff size={12} className="text-rose-500" />}
                              </div>
                           </div>
                        </div>
                        {/* Pin button overlay */}
                        <button onClick={() => setPinnedUser('local')} className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all" title="Pin to fullscreen">
                          <Maximize2 size={14} className="text-white/80" />
                        </button>
                     </div>
                   </React.Fragment>
                 );
              })()}

              {/* REMOTE PEER TILES */}
              {peers.map((peer) => {
                 const tileClass = 'w-full aspect-[4/3] md:aspect-video snap-start';

                  return (
                 <React.Fragment key={peer.peerID}>
                   <div className={`relative rounded-3xl overflow-hidden bg-violet-600 ${tileClass} cursor-pointer group`}>
                      <RemoteVideo peer={peer} stream={null} isSpeaking={speakingUser === peer.peerID || activeSpeakers.includes(peer.peerID)} remoteStreamsRef={remoteStreamsRef} remoteScreenStreamsRef={remoteScreenStreamsRef} />
                      <div className="absolute bottom-3 left-3 right-3 z-20">
                         <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                            <div className="flex items-center gap-2 overflow-hidden">
                               <span className="text-xs font-bold text-white truncate">{peer.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                               {peer.audioEnabled === false && <MicOff size={12} className="text-rose-500" />}
                               {peer.videoEnabled === false && <VideoOff size={12} className="text-rose-500" />}
                            </div>
                         </div>
                      </div>
                      {/* Pin button overlay */}
                      <button onClick={() => setPinnedUser(peer.peerID)} className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all" title="Pin to fullscreen">
                        <Maximize2 size={14} className="text-white/80" />
                      </button>
                   </div>

                   {peer.isScreenSharing && (
                     <div className={`relative rounded-3xl overflow-hidden bg-violet-800 ${tileClass} cursor-pointer group`}>
                        <RemoteVideo peer={peer} stream={null} isSpeaking={false} mobileStyle={true} isScreen={true} remoteStreamsRef={remoteStreamsRef} remoteScreenStreamsRef={remoteScreenStreamsRef} />
                        <div className="absolute bottom-3 left-3 right-3 z-20">
                           <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl flex items-center justify-between border border-white/10 shadow-lg">
                              <span className="text-xs font-bold text-white truncate">{peer.name}'s Screen</span>
                           </div>
                        </div>
                        <button onClick={(e) => {
                           e.stopPropagation();
                           const elem = e.currentTarget.parentElement;
                           if(elem.requestFullscreen) elem.requestFullscreen();
                           else if(elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                        }} className="absolute top-3 right-12 z-30 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all" title="Fullscreen">
                          <Maximize2 size={14} className="text-white/80" />
                        </button>
                        <button onClick={() => setPinnedUser(`${peer.peerID}_screen`)} className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all" title="Pin to fullscreen">
                          <Pin size={14} className="text-white/80" />
                        </button>
                     </div>
                   )}
                 </React.Fragment>
                 );
              })}

              {/* WAITING BANNER */}
              {peers.length === 0 && (
                 <div className="absolute inset-x-4 bottom-8 flex flex-col items-center justify-center p-4 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl animate-fade-up">
                    <Users size={20} className="text-slate-400 mb-2" />
                    <span className="text-sm font-bold text-slate-300 text-center">Share the room ID to invite others</span>
                 </div>
              )}
                </>
              )}

            </div>

            {/* SIDE PANEL (Chat/Participants) */}
            {activeSidebar && (
               <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-[#1e293b] border-l border-slate-800 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                     <h3 className="text-sm font-black text-white">{activeSidebar === 'chat' ? 'Chat' : 'People'}</h3>
                     <button onClick={() => setActiveSidebar(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
                        <X size={16} />
                     </button>
                  </div>
                  {activeSidebar === 'chat' ? (
                     <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                           {meetingMessages.map((m, i) => (
                              <div key={i} className={`flex flex-col ${m.user === auth.user ? 'items-end' : 'items-start'}`}>
                                 <span className="text-[10px] font-bold text-slate-500 mb-1 px-1">{m.user}</span>
                                 <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] ${m.user === auth.user ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>
                                    <span className="text-sm leading-relaxed">{m.text}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-[#1e293b]">
                           <div className="flex items-center gap-2">
                              <input 
                                 type="text" 
                                 value={chatInput} 
                                 onChange={e => setChatInput(e.target.value)}
                                 onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                                 placeholder="Message..." 
                                 className="flex-1 h-11 bg-slate-900 border border-slate-800 rounded-xl px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                              />
                              <button onClick={sendChatMessage} className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 hover:bg-blue-500">
                                 <Send size={16} className="text-white ml-1" />
                              </button>
                           </div>
                        </div>
                     </div>
                  ) : (
                     <div className="flex-1 overflow-y-auto p-2">
                        <div className="flex items-center gap-3 p-3 mb-1">
                           <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">{auth.user?.charAt(0).toUpperCase()}</div>
                           <div className="flex-1">
                              <p className="text-sm font-bold text-white">{auth.user} (You)</p>
                              <p className="text-[10px] font-black uppercase text-blue-400">{isHost ? 'Host' : 'Attendee'}</p>
                           </div>
                        </div>
                        {peers.map(p => (
                           <div key={p.peerID} className="flex items-center gap-3 p-3 hover:bg-slate-900 rounded-xl transition-colors">
                              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold">{p.name?.charAt(0).toUpperCase()}</div>
                              <div className="flex-1">
                                 <p className="text-sm font-bold text-white">{p.name}</p>
                                 <p className="text-[10px] font-black uppercase text-slate-500">{p.name === 'Forge India Connect AI' ? 'AI Bot' : (() => { const hostId = meetingMetadata?.host?._id?.toString?.() || meetingMetadata?.host?._id || meetingMetadata?.host?.toString?.(); return hostId && p.userId === hostId ? 'Host' : 'Attendee'; })()}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            )}

          </div>

          {/* CONTROL DOCK */}
          <div className="pb-6 pt-4 bg-gradient-to-t from-[#0f172a] to-transparent pointer-events-none absolute bottom-0 inset-x-0 z-30 flex justify-center">
            <div className="pointer-events-auto flex items-center max-w-[95vw] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-1.5 md:gap-3 px-2.5 md:px-6 py-2.5 md:py-4 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-[24px] md:rounded-[32px] shadow-2xl">
               
               <button onClick={() => setMicOn(!micOn)} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0 opacity-100">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'}`}>
                     {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                  </div>
                  <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase hidden md:block ${micOn ? 'text-slate-400' : 'text-rose-500'}`}>{micOn ? 'Mute' : 'Unmute'}</span>
               </button>
               
               <button onClick={() => setVideoOn(!videoOn)} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${videoOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'}`}>
                     {videoOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                  </div>
                  <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase hidden md:block ${videoOn ? 'text-slate-400' : 'text-rose-500'}`}>{videoOn ? 'Stop' : 'Start'}</span>
               </button>

               <div className="w-px h-6 md:h-8 bg-slate-800 mx-0.5 md:mx-1 shrink-0" />

               <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                     <Monitor size={18} />
                  </div>
                  <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase hidden md:block ${isScreenSharing ? 'text-blue-400' : 'text-slate-400'}`}>Share</span>
               </button>

               <button onClick={isRecording ? stopLocalRecording : startLocalRecording} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 animate-pulse' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                     <Circle size={18} className={isRecording ? 'fill-current' : ''} />
                  </div>
                  <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase hidden md:block ${isRecording ? 'text-red-400' : 'text-slate-400'}`}>{isRecording ? 'Stop Rec' : 'Record'}</span>
               </button>

               <button onClick={handleStartAI} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${aiAssistantActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                     <Wand2 size={18} />
                  </div>
                  <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase hidden md:block ${aiAssistantActive ? 'text-emerald-400' : 'text-slate-400'}`}>AI Bot</span>
               </button>

               {isHost && (
                  <button onClick={() => setHostControlsModal(true)} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                     <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${hostControlsModal ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                        <Shield size={18} />
                     </div>
                     <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase hidden md:block ${hostControlsModal ? 'text-blue-400' : 'text-slate-400'}`}>Host</span>
                  </button>
               )}

               <button onClick={() => setActiveSidebar(p => p === 'participants' ? null : 'participants')} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${activeSidebar === 'participants' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                     <Users size={18} />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black tracking-widest uppercase text-slate-400 hidden md:block">People</span>
               </button>

               <button onClick={() => setActiveSidebar(p => p === 'chat' ? null : 'chat')} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${activeSidebar === 'chat' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                     <MessageSquare size={18} />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black tracking-widest uppercase text-slate-400 hidden md:block">Chat</span>
               </button>

               <div className="w-px h-6 md:h-8 bg-slate-800 mx-0.5 md:mx-1 shrink-0" />

               <button onClick={handleEndCall} className="flex flex-col items-center gap-1 w-11 md:w-[60px] shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all">
                     <PhoneOff size={18} />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black tracking-widest uppercase text-rose-500 hidden md:block">End</span>
               </button>

            </div>
          </div>

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
                              <button onClick={() => {
                                 if (window.confirm("Are you sure you want to end the meeting for everyone?")) {
                                    if (sendWsRef.current) sendWsRef.current('end-meeting-all', {});
                                    handleEndCall();
                                 }
                              }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors group">
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
                                 <button onClick={() => {
                                    const newLocked = !roomLocked;
                                    setRoomLocked(newLocked);
                                    if (sendWsRef.current) sendWsRef.current('update-room-settings', { locked: newLocked });
                                 }} className={`w-12 h-7 rounded-full transition-all relative ${roomLocked ? 'bg-blue-500' : 'bg-white/10'}`}>
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
                                    <button onClick={() => {
                                       if (window.confirm(`Kick ${p.name}?`)) {
                                          if (sendWsRef.current) sendWsRef.current('kick-peer', { targetPeerId: p.peerID });
                                          setPeers(prev => prev.filter(peer => peer.peerID !== p.peerID));
                                       }
                                    }} className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase text-zinc-300 hover:text-white transition-colors">Kick</button>
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

        </div>
      )}
      
{/* 3. ENDED STATE */}
      {appState === 'ended' && (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center animate-fade bg-[#0a0b0d] overflow-y-auto">
           <div className="max-w-md w-full space-y-6 md:space-y-8 py-8">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto"><Check size={32} md:size={40} /></div>
              <h1 className="text-2xl md:text-3xl font-black">Meeting Ended</h1>
              {endedReason && (
                 <p className="text-sm md:text-base font-bold text-rose-500 bg-rose-500/10 py-3 px-4 rounded-xl border border-rose-500/20">{endedReason}</p>
              )}
              <div className="bg-white/5 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-white/5 grid grid-cols-2 gap-4">
                 <div><p className="text-[10px] font-black uppercase text-zinc-400">Duration</p><p className="font-black text-sm md:text-base">{Math.floor(finalStats.duration / 60)}m</p></div>
                 <div><p className="text-[10px] font-black uppercase text-zinc-400">Attendees</p><p className="font-black text-sm md:text-base">{finalStats.participants}</p></div>
              </div>
              <button onClick={() => navigate(`/w/${workspaceId}/meet`)} className="w-full py-3.5 md:py-4 bg-[#5244e1] rounded-3xl font-black uppercase tracking-widest text-xs">Return Home Dashboard</button>
           </div>
        </div>
      )}

      {/* 4. ERROR STATE */}
      {roomError && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center animate-fade bg-[#0a0b0d] overflow-y-auto">
           <div className="max-w-md w-full space-y-6 md:space-y-8 py-8">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mx-auto">
                 <AlertCircle size={32} md:size={40} />
              </div>
              <div className="space-y-2">
                 <h1 className="text-2xl md:text-3xl font-black text-white">Join Failed</h1>
                 <p className="text-zinc-500 text-xs md:text-sm">{roomError}</p>
              </div>
              <div className="flex flex-col gap-3">
                 <button 
                    onClick={() => {
                       setRoomError(null);
                       setAppState('lobby');
                       window.location.reload();
                    }} 
                    className="w-full py-3.5 md:py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl font-black uppercase tracking-widest text-xs text-white"
                 >Try Again</button>
                 <button 
                    onClick={() => navigate(`/w/${workspaceId}/meet`)} 
                    className="w-full py-3.5 md:py-4 bg-[#5244e1] rounded-3xl font-black uppercase tracking-widest text-xs text-white"
                 >Return to Dashboard</button>
              </div>
           </div>
        </div>
      )}

      {/* 5. WAITING ROOM STATE */}
      {isWaiting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center animate-fade bg-[#0a0b0d] overflow-y-auto">
           <div className="max-w-md w-full space-y-8 md:space-y-10 py-8">
              <div className="relative">
                 <div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-500/10 rounded-[24px] md:rounded-[32px] flex items-center justify-center text-indigo-500 mx-auto animate-bounce">
                    <Clock size={40} md:size={48} />
                 </div>
                 <div className="absolute -top-1 -right-1 w-6 h-6 md:w-8 md:h-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-[#0a0b0d] animate-pulse">
                    <Shield size={12} md:size={16} className="text-white" />
                 </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                 <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Hang tight!</h1>
                 <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                    The meeting is locked for security. We've notified the host that you're waiting in the lobby.
                 </p>
              </div>

              <div className="p-5 md:p-6 bg-white/5 border border-white/10 rounded-[24px] md:rounded-[32px] space-y-4">
                 <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white uppercase">{auth.user?.charAt(0)}</div>
                    <div>
                       <p className="text-[9px] md:text-xs font-black uppercase text-zinc-500">Joining as</p>
                       <p className="text-sm font-bold text-white">{auth.user}</p>
                    </div>
                 </div>
              </div>

              <div className="pt-6 md:pt-8">
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
