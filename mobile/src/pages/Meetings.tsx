import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, Modal, TextInput, ActivityIndicator,
  Alert, StatusBar, useWindowDimensions,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import {
  Video, Calendar, Clock, Users, Play, Bell, BellRing,
  Mic, MicOff, VideoOff, PhoneOff, Copy, Lock, Shield,
  X, Send, MessageSquare, LogIn, ChevronRight, Wifi,
  FlipHorizontal, MonitorUp, Settings, Sparkles, Wand2, Globe, PhoneForwarded, MoreVertical, Link as LinkIcon, Check, Plus
} from 'lucide-react-native';
import { api, getSession, SOCKET_URL } from '../lib/api';
import {
  RTCView,
  getIsWebRTCAvailable,
  getRTCPeerConnectionClass,
  getRTCIceCandidateClass,
  getRTCSessionDescriptionClass,
  getMediaDevices,
  getMediaStreamClass,
  getWebRTCDiagnostics,
  getIceServers,
  getDisplayMedia,
} from '../lib/webrtc';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

// expo-camera: works in Expo Go AND in APK builds (no custom native code needed)
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';



const MOCK_MEETINGS = [
  { id: '1', title: 'Product Sync', time: '10:00 AM', duration: '45m', attendees: 5, color: '#2563eb', status: 'scheduled' },
  { id: '2', title: 'Design Review', time: '1:30 PM', duration: '1h', attendees: 3, color: '#7c3aed', status: 'scheduled' },
  { id: '3', title: 'Client Workshop', time: '4:00 PM', duration: '30m', attendees: 8, color: '#f97316', status: 'live' },
];
const MOCK_HISTORY = [
  { id: 'h1', title: 'Q3 Planning Sync', time: 'Yesterday', duration: '1h 15m', attendees: 8, color: '#64748b', status: 'ended' },
  { id: 'h2', title: 'Sprint Retrospective', time: 'Mon', duration: '45m', attendees: 6, color: '#64748b', status: 'ended' },
];
const ROOMS = [
  { id: 'NEXUS-BOARDROOM', title: 'General Boardroom', tag: 'BR', members: 4, color: '#2563eb' },
  { id: 'NEXUS-ENG', title: 'Developer Sandbox', tag: 'DS', members: 2, color: '#0f766e' },
  { id: 'NEXUS-DESIGN', title: 'UX Design Workshop', tag: 'UX', members: 0, color: '#7c3aed' },
];

const fmtDur = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const avatarFor = (name: string) =>
  String(name || 'U').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U';

type RemotePeer = { id: string; name: string; peerId?: string; userId?: string };

export default function Meetings() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const contentWidth = width;
  const s = React.useMemo(() => getStyles(width, height, isMobile), [width, height, isMobile]);

  // Camera & microphone permissions via expo-camera hooks
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [meetings, setMeetings] = React.useState<any[]>(MOCK_MEETINGS);
  const [history] = React.useState<any[]>(MOCK_HISTORY);
  const [reminders, setReminders] = React.useState<string[]>([]);
  const [activeRoom, setActiveRoom] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  // Modals
  const [createModal, setCreateModal] = React.useState(false);
  const [joinModal, setJoinModal] = React.useState(false);
  const [scheduleModal, setScheduleModal] = React.useState(false);
  const [roomsModal, setRoomsModal] = React.useState(false);
  const [summaryModal, setSummaryModal] = React.useState(false);
  const [summaryText, setSummaryText] = React.useState('');
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  // Host Controls
  const [hostControlsModal, setHostControlsModal] = React.useState(false);
  const [hostControlsTab, setHostControlsTab] = React.useState<'meeting'|'participants'|'permissions'>('meeting');
  const [meetingLocked, setMeetingLocked] = React.useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = React.useState(false);
  const [allowBeforeHost, setAllowBeforeHost] = React.useState(true);
  const [allowGuests, setAllowGuests] = React.useState(true);
  const [requireAuth, setRequireAuth] = React.useState(false);
  const [muteAllActive, setMuteAllActive] = React.useState(false);
  const [preventUnmute, setPreventUnmute] = React.useState(false);
  const [participantMenuTarget, setParticipantMenuTarget] = React.useState<any>(null);
  const [transferHostModal, setTransferHostModal] = React.useState(false);

  // Form fields
  const [meetTitle, setMeetTitle] = React.useState('');
  const [meetPass, setMeetPass] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [joinPass, setJoinPass] = React.useState('');
  const [schedTitle, setSchedTitle] = React.useState('');
  const [schedDate, setSchedDate] = React.useState('2026-06-01');
  const [schedTime, setSchedTime] = React.useState('10:00 AM');
  const [schedDur, setSchedDur] = React.useState('45');

  // In-call state
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const [facing, setFacing] = React.useState<CameraType>('front');
  const [callDur, setCallDur] = React.useState(0);
  const [sidePanel, setSidePanel] = React.useState<'chat' | 'people' | null>(null);
  const [chatMsgs, setChatMsgs] = React.useState([
    { id: '1', sender: 'System', text: 'Meeting started. Say hello!' },
  ]);
  const [chatInput, setChatInput] = React.useState('');
  const [audioLevels, setAudioLevels] = React.useState([4, 4, 4, 4, 4]);
  const [remotePeers, setRemotePeers] = React.useState<RemotePeer[]>([]);
  const [localStream, setLocalStream] = React.useState<any>(null);
  const [localScreenStream, setLocalScreenStream] = React.useState<any>(null);
  const [remoteStreams, setRemoteStreams] = React.useState<Record<string, any>>({});
  const remoteStreamsRef = React.useRef<Record<string, any>>({});

  // WebSocket signaling ref
  const wsRef = React.useRef<WebSocket | null>(null);
  const peerIdRef = React.useRef<string | null>(null);
  const peerConnectionsRef = React.useRef<Map<string, any>>(new Map());
  const remotePeerKeyRef = React.useRef<Map<string, string>>(new Map());
  const iceCandidateBufferRef = React.useRef<Map<string, any[]>>(new Map());
  const createPeerConnectionRef = React.useRef<any>(null);
  const shouldInitiateOfferRef = React.useRef<(peerId: string) => boolean>(() => true);
  const sendSignalRef = React.useRef<(type: string, data: any) => void>(() => {});
  const localStreamRef = React.useRef<any>(null);
  const intentionalCloseRef = React.useRef(false);
  const dynamicIceServersRef = React.useRef<any[]>(getIceServers());

  const [aiAssistantActive, setAiAssistantActive] = React.useState(false);

  const aiMediaRecorderRef = React.useRef<any>(null);
  const aiWsRef = React.useRef<WebSocket | null>(null);
  const isMutedRef = React.useRef(isMuted);

  React.useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Automatically start AI Assistant when a room is joined (unless this is the bot itself)
  React.useEffect(() => {
    if (activeRoom && !aiAssistantActive && Platform.OS !== 'web' || (activeRoom && !aiAssistantActive && Platform.OS === 'web' && !(window as any).isAIBot)) {
      setAiAssistantActive(true);
      api.meetings.startAIBot(
        activeRoom.id,
        Platform.OS === 'web' ? window.location.origin : 'http://localhost:8081'
      ).catch((err: any) => {
        console.warn('Auto-start AI Assistant failed:', err.message);
        setAiAssistantActive(false);
      });
    }
  }, [activeRoom]);

  // Handle streaming audio to the backend AI transcriber when active
  React.useEffect(() => {
    if (aiAssistantActive && localStream && Platform.OS === 'web' && !(window as any).isAIBot) {
      const wsUrl = SOCKET_URL + '/ws/audio';
      const ws = new WebSocket(wsUrl);
      aiWsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'metadata',
          meetingId: activeRoom?.id || activeRoom?.signalingId,
          userId: user?.id || 'unknown-user',
          speakerName: user?.name || 'User'
        }));
      };

      try {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const stream = new MediaStream([audioTracks[0]]);
          
          // Detect best supported mime type
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
          
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          aiMediaRecorderRef.current = recorder;

          // We collect all chunks and flush every ~10s as a complete valid blob
          let chunkBuffer: Blob[] = [];
          let flushTimer: ReturnType<typeof setInterval> | null = null;

          const flush = () => {
            if (chunkBuffer.length === 0 || ws.readyState !== WebSocket.OPEN || isMutedRef.current) {
              chunkBuffer = [];
              return;
            }
            const blob = new Blob(chunkBuffer, { type: recorder.mimeType || 'audio/webm' });
            if (blob.size > 1000) { // Only send if there's meaningful data (>1KB)
              blob.arrayBuffer().then(buf => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(buf);
                }
              });
            }
            chunkBuffer = [];
          };

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunkBuffer.push(e.data);
            }
          };

          // Collect chunks every 1s, flush full blob every 10s
          recorder.start(1000);
          flushTimer = setInterval(flush, 10000);

          return () => {
            if (flushTimer) clearInterval(flushTimer);
            flush(); // Send any remaining audio before cleanup
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
      
      return () => {
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
  }, [aiAssistantActive, localStream]);

  // MOBILE AUDIO RECORDING — uses expo-av to record and upload chunks for AI transcription
  const mobileRecordingRef = React.useRef<Audio.Recording | null>(null);
  const mobileUploadTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (Platform.OS === 'web') return; // Web uses MediaRecorder approach above
    if (!aiAssistantActive || !activeRoom) return;

    let stopped = false;
    const meetingId = activeRoom.id || activeRoom.signalingId;
    const speakerName = user?.name || 'User';

    const startRecording = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        mobileRecordingRef.current = recording;
        console.log('[MobileAudio] Recording started for meeting', meetingId);
      } catch (err) {
        console.warn('[MobileAudio] Failed to start recording:', err);
      }
    };

    const flushChunk = async () => {
      if (stopped || isMutedRef.current || !mobileRecordingRef.current) return;
      try {
        // Stop current segment and upload it
        await mobileRecordingRef.current.stopAndUnloadAsync();
        const uri = mobileRecordingRef.current.getURI();
        mobileRecordingRef.current = null;

        if (uri && meetingId) {
          console.log('[MobileAudio] Uploading chunk from', uri);
          api.meetings.uploadAudioChunk(meetingId, uri, speakerName)
            .then(res => console.log('[MobileAudio] Chunk transcribed:', res?.text?.slice(0, 60)))
            .catch(e => console.warn('[MobileAudio] Upload failed:', e.message));
        }

        // Immediately start next recording segment
        if (!stopped) {
          await startRecording();
        }
      } catch (e: any) {
        console.warn('[MobileAudio] Flush error:', e.message);
        if (!stopped) await startRecording();
      }
    };

    startRecording();
    // Upload a chunk every 30 seconds
    mobileUploadTimerRef.current = setInterval(flushChunk, 30000);

    return () => {
      stopped = true;
      if (mobileUploadTimerRef.current) {
        clearInterval(mobileUploadTimerRef.current);
        mobileUploadTimerRef.current = null;
      }
      // Final flush on cleanup
      flushChunk().catch(() => {});
    };
  }, [aiAssistantActive, activeRoom]);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      (window as any).isAIBot = false;
      (window as any).joinRoomForBot = async (code: string) => {
        (window as any).isAIBot = true;
        setJoinCode(code);
        
        // Use a slight delay to let state settle
        setTimeout(async () => {
          try {
            const res = await api.meetings.validateMeeting(code, undefined);
            const signalingRoomId = res._id || res.meetingId;
            if (signalingRoomId) {
              await enterRoom({
                id: signalingRoomId,
                title: res.title || 'AI Session',
                roomId: res.joinCode || code,
                signalingId: signalingRoomId,
              });
            }
          } catch (e) {
            console.error('Bot join failed:', e);
          }
        }, 500);
      };
    }
  }, []);

  React.useEffect(() => {
    api.meetings.getIceServers().then(servers => {
      if (servers && servers.length > 0) {
        console.log('[WebRTC] Loaded dynamic ICE servers from backend');
        dynamicIceServersRef.current = servers;
      }
    }).catch(err => {
      console.warn('[WebRTC] Failed to fetch dynamic ICE servers:', err);
    });
  }, []);

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';
  const localUserId = String(user?.id || user?._id || '');
  const peerKeyFor = (peer: any) => peer?.userId ? `user-${peer.userId}` : String(peer?.peerId || peer?.id || Date.now());

  const configureCallAudio = React.useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        staysActiveInBackground: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (err) {
      console.warn('[Audio] Could not enable call audio mode:', err);
    }
  }, []);

  const resetCallAudio = React.useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (err) {
      console.warn('[Audio] Could not reset call audio mode:', err);
    }
  }, []);

  // Call timer
  React.useEffect(() => {
    let t: any;
    if (activeRoom) { t = setInterval(() => setCallDur(p => p + 1), 1000); }
    else { setCallDur(0); }
    return () => clearInterval(t);
  }, [activeRoom]);

  // Audio level animation
  React.useEffect(() => {
    let t: any;
    if (activeRoom && !isMuted) {
      t = setInterval(() => setAudioLevels([
        Math.floor(Math.random() * 55) + 10,
        Math.floor(Math.random() * 75) + 15,
        Math.floor(Math.random() * 65) + 10,
        Math.floor(Math.random() * 85) + 15,
        Math.floor(Math.random() * 45) + 10,
      ]), 150);
    } else { setAudioLevels([4, 4, 4, 4, 4]); }
    return () => clearInterval(t);
  }, [activeRoom, isMuted]);

  // Fullscreen flag
  React.useEffect(() => {
    (global as any).isFullScreenMeetingActive = !!activeRoom;
    return () => { (global as any).isFullScreenMeetingActive = false; };
  }, [activeRoom]);

  const mergeRemotePeers = React.useCallback((peers: RemotePeer[]) => {
    setRemotePeers(prev => {
      const merged = new Map<string, RemotePeer>();
      prev.forEach(peer => merged.set(peer.id, peer));
      peers.forEach(peer => merged.set(peer.id, { ...merged.get(peer.id), ...peer }));
      return Array.from(merged.values());
    });
  }, []);

  const sendSignal = React.useCallback((type: string, data: any) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }, []);

  const stopMediaStream = React.useCallback((stream: any) => {
    try {
      stream?.getTracks?.().forEach((track: any) => track.stop?.());
    } catch {}
  }, []);

  const cleanupPeerConnections = React.useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => {
      try { 
        if ((pc as any)._mediaRecorder) { (pc as any)._mediaRecorder.stop(); }
        if ((pc as any)._audioWs) { (pc as any)._audioWs.close(); }
        pc.close?.(); 
      } catch {}
    });
    peerConnectionsRef.current.clear();
    remotePeerKeyRef.current.clear();
    iceCandidateBufferRef.current.clear();
    remoteStreamsRef.current = {};
    setRemoteStreams({});
  }, []);

  React.useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  /** Only the peer with the higher peerId sends the offer (avoids SDP glare). */
  const shouldInitiateOffer = React.useCallback((remotePeerId: string) => {
    const myPeerId = peerIdRef.current;
    if (!myPeerId || !remotePeerId) return true;
    return myPeerId.localeCompare(remotePeerId) > 0;
  }, []);

  const ensureLocalStream = React.useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (Platform.OS === 'web' && (window as any).isAIBot) {
      // AI bot doesn't need to request actual camera/mic permissions
      // We can just create a dummy stream or skip adding local stream
      // Puppeteer uses fake media devices anyway, so we just request audio
    } else {
      await configureCallAudio();
    }

    const md = getMediaDevices() || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);
    if (!md?.getUserMedia) {
      console.warn('[ensureLocalStream] getUserMedia unavailable', getWebRTCDiagnostics());
      return null;
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: !isVideoOff
        ? {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          }
        : false,
    };

    const stream = await md.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, [configureCallAudio, facing, isVideoOff]);

  const createPeerConnection = React.useCallback(async (targetPeerId: string, peer: RemotePeer, shouldOffer: boolean) => {
    // Use runtime getters — module-level constants may be stale in Expo Web
    const rtcClass = getRTCPeerConnectionClass();
    const rtcAvailable = getIsWebRTCAvailable() || !!rtcClass;
    console.log(`[createPeerConnection] Started for ${targetPeerId}, shouldOffer=${shouldOffer}, rtcAvailable=${rtcAvailable}, rtcClass=${!!rtcClass}`, getWebRTCDiagnostics());
    if (!rtcClass || !targetPeerId) {
      console.log(`[createPeerConnection] Aborting: no RTCPeerConnection class available (rtcAvailable=${rtcAvailable})`);
      return null;
    }

    const existing = peerConnectionsRef.current.get(targetPeerId);
    if (existing) return existing;

    const peerKey = peer.id || peerKeyFor(peer);
    remotePeerKeyRef.current.set(targetPeerId, peerKey);
    mergeRemotePeers([{ ...peer, id: peerKey, peerId: targetPeerId }]);

    const stream = await ensureLocalStream();
    console.log(`[WebRTC] ICE servers (${dynamicIceServersRef.current?.length || 0}):`, JSON.stringify(dynamicIceServersRef.current?.map((s: any) => s.urls)));
    const pc = new rtcClass({
      iceServers: dynamicIceServersRef.current,
    });

    peerConnectionsRef.current.set(targetPeerId, pc);

    if (stream) {
      if (pc.addStream) {
        pc.addStream(stream);
      } else {
        stream.getTracks().forEach((track: any) => {
          pc.addTrack(track, stream);
        });
      }
      console.log(`[WebRTC] Added ${stream.getTracks().length} tracks for ${targetPeerId}`);
    } else {
      console.warn(`[WebRTC] No local stream for ${targetPeerId}, PC created without media`);
    }

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        sendSignal('ice-candidate', { targetPeerId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[ICE] state for ${targetPeerId}: ${state}`);
      if (state === 'failed') {
        console.warn(`[ICE] Connection failed for ${targetPeerId}, attempting ICE restart...`);
        setTimeout(async () => {
          try {
            const newOffer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(newOffer);
            sendSignal('offer', { targetPeerId, sdp: newOffer });
          } catch (err) {
            console.warn(`[ICE] Restart failed for ${targetPeerId}:`, err);
          }
        }, 1000);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[PC] connection state for ${targetPeerId}: ${state}`);
      if (state === 'failed') {
        console.warn(`[PC] Connection failed for ${targetPeerId}`);
        setRemotePeers(prev =>
          prev.map(p =>
            (p.peerId === targetPeerId || p.id === peerKey)
              ? { ...p, connectionState: 'failed' as const }
              : p
          )
        );
      } else if (state === 'connected') {
        setRemotePeers(prev =>
          prev.map(p =>
            (p.peerId === targetPeerId || p.id === peerKey)
              ? { ...p, connectionState: 'connected' as const }
              : p
          )
        );
      }
    };

    pc.ontrack = (event: any) => {
      let incomingStream = event.streams?.[0];
      if (!incomingStream && event.track) {
        const MSClass = getMediaStreamClass();
        if (MSClass) {
          incomingStream = new MSClass([event.track]);
        }
      }
      if (incomingStream) {
        const existing = remoteStreamsRef.current[peerKey];
        if (existing && existing !== incomingStream) {
          incomingStream.getTracks().forEach((t: any) => {
            try { existing.addTrack(t); } catch {}
          });
        } else {
          remoteStreamsRef.current[peerKey] = incomingStream;
          setRemoteStreams(prev => ({ ...prev, [peerKey]: incomingStream }));
          
          if (Platform.OS === 'web' && (window as any).isAIBot && incomingStream.getAudioTracks().length > 0) {
            try {
              if (typeof (window as any).MediaRecorder !== 'undefined') {
                console.log(`[AIBot] Starting audio recorder for peer: ${peerKey}`);
                const wsUrl = SOCKET_URL.replace('http', 'ws') + '/ws/audio';
                const audioWs = new WebSocket(wsUrl);
                
                audioWs.onopen = () => {
                  console.log(`[AIBot] Audio WS connected for peer: ${peerKey}`);
                  audioWs.send(JSON.stringify({
                    type: 'metadata',
                    meetingId: activeRoom?.id || 'unknown',
                    userId: targetPeerId,
                    speakerName: peer.name || 'Participant'
                  }));
                  
                  const mr = new (window as any).MediaRecorder(incomingStream, { mimeType: 'audio/webm' });
                  mr.ondataavailable = (e: any) => {
                    if (e.data && e.data.size > 0 && audioWs.readyState === WebSocket.OPEN) {
                      audioWs.send(e.data);
                    }
                  };
                  mr.start(2000); // chunk every 2 seconds
                  
                  (pc as any)._audioWs = audioWs;
                  (pc as any)._mediaRecorder = mr;
                };
              }
            } catch (e) {
              console.error('[AIBot] Failed to start MediaRecorder on remote stream:', e);
            }
          }
        }
      }
    };

    pc.onaddstream = (event: any) => {
      if (event.stream) {
        setRemoteStreams(prev => ({ ...prev, [peerKey]: event.stream }));
        
        if (Platform.OS === 'web' && (window as any).isAIBot && event.stream.getAudioTracks().length > 0 && !remoteStreamsRef.current[peerKey]) {
          // In case ontrack didn't fire but onaddstream did
          try {
            if (typeof (window as any).MediaRecorder !== 'undefined') {
              console.log(`[AIBot] Starting audio recorder (onaddstream) for peer: ${peerKey}`);
              const wsUrl = SOCKET_URL.replace('http', 'ws') + '/ws/audio';
              const audioWs = new WebSocket(wsUrl);
              
              audioWs.onopen = () => {
                audioWs.send(JSON.stringify({
                  type: 'metadata',
                  meetingId: activeRoom?.id || 'unknown',
                  userId: targetPeerId,
                  speakerName: peer.name || 'Participant'
                }));
                
                const mr = new (window as any).MediaRecorder(event.stream, { mimeType: 'audio/webm' });
                mr.ondataavailable = (e: any) => {
                  if (e.data && e.data.size > 0 && audioWs.readyState === WebSocket.OPEN) {
                    audioWs.send(e.data);
                  }
                };
                mr.start(2000);
                
                (pc as any)._audioWs = audioWs;
                (pc as any)._mediaRecorder = mr;
              };
            }
          } catch (e) {
            console.error('[AIBot] Failed to start MediaRecorder on remote stream:', e);
          }
        }
      }
    };

    if (shouldOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal('offer', { targetPeerId, sdp: offer });
      } catch (err) {
        console.warn(`[WebRTC] createOffer/setLocal failed for ${targetPeerId}:`, err);
      }
    }

    return pc;
  }, [ensureLocalStream, mergeRemotePeers, sendSignal, shouldInitiateOffer]);

  React.useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
    shouldInitiateOfferRef.current = shouldInitiateOffer;
    sendSignalRef.current = sendSignal;
  }, [createPeerConnection, shouldInitiateOffer, sendSignal]);

  const syncRoomParticipants = React.useCallback(async (room: any) => {
    const meetingId = room?.signalingId || room?.id || room?.roomId;
    if (!meetingId) return;

    try {
      const participants = await api.meetings.getParticipants(String(meetingId));
      const peers = (Array.isArray(participants) ? participants : [])
        .filter((p: any) => String(p.userId || '') !== localUserId)
        .map((p: any) => ({
          id: `user-${p.userId || p.id}`,
          userId: p.userId,
          name: p.name || p.email || 'Participant',
        }));
      mergeRemotePeers(peers);
    } catch (err) {
      console.warn('[Meetings] Participant sync failed:', err);
    }
  }, [mergeRemotePeers, user?.id, user?._id]);

  React.useEffect(() => {
    if (!activeRoom) return;

    syncRoomParticipants(activeRoom);
    const t = setInterval(() => syncRoomParticipants(activeRoom), 3000);
    return () => clearInterval(t);
  }, [activeRoom, syncRoomParticipants]);

  React.useEffect(() => {
    localStreamRef.current?.getAudioTracks?.().forEach((track: any) => {
      track.enabled = !isMuted;
    });
    if (activeRoom) {
      sendSignal('media-state', { audioEnabled: !isMuted, videoEnabled: !isVideoOff });
    }
  }, [activeRoom, isMuted, isVideoOff, sendSignal]);

  React.useEffect(() => {
    localStreamRef.current?.getVideoTracks?.().forEach((track: any) => {
      track.enabled = !isVideoOff && !isSharing;
    });
  }, [isVideoOff, isSharing]);

  // Fetch meetings
  React.useEffect(() => {
    api.meetings.getMeetings(workspaceId).then((data: any[]) => {
      if (Array.isArray(data) && data.length > 0) {
        setMeetings(data.map((m: any) => ({
          id: m._id || m.joinCode, title: m.title,
          time: new Date(m.scheduledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: `${m.durationMinutes || 60}m`,
          attendees: m.participantIds?.length || 1,
          color: m.status === 'live' ? '#10b981' : '#2563eb',
          status: m.status || 'scheduled',
        })));
      }
    }).catch(() => {});
  }, []);

  // Connect signaling WebSocket for peer presence
  const connectSignaling = (signalingRoomId: string, token: string, publicRoomId?: string) => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const buildWsUrl = () => {
      let wsBase = SOCKET_URL;
      console.log('[Signaling] Raw SOCKET_URL:', SOCKET_URL);
      if (wsBase.startsWith('https://')) {
        wsBase = wsBase.replace('https://', 'wss://');
      } else if (wsBase.startsWith('http://')) {
        wsBase = wsBase.replace('http://', 'ws://');
      } else if (!wsBase.startsWith('ws://') && !wsBase.startsWith('wss://')) {
        wsBase = `wss://${wsBase}`;
      }
      wsBase = wsBase.replace(/\/+$/, '');
      return `${wsBase}/ws/webrtc`;
    };

    const setupWs = () => {
      const wsUrl = buildWsUrl();
      console.log('[Signaling] Connecting to:', wsUrl, 'room:', signalingRoomId, 'attempt:', reconnectAttempts + 1);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts = 0;
        console.log('[Signaling] Connected, joining room:', signalingRoomId);
        ws.send(JSON.stringify({
          type: 'join',
          data: {
            token,
            meetingId: signalingRoomId,
            roomId: publicRoomId || signalingRoomId,
            joinCode: publicRoomId || undefined,
          }
        }));
      };

      ws.onmessage = async (e: any) => {
        try {
          const msg = JSON.parse(e.data);
          console.log('[Signaling] Received:', msg.type);
          if (msg.type === 'joined') {
            peerIdRef.current = msg.peerId;
            const peers = (msg.existingPeers || [])
              .filter((p: any) => String(p.userId || '') !== localUserId)
              .map((p: any) => {
                const id = peerKeyFor(p);
                if (p.peerId) remotePeerKeyRef.current.set(p.peerId, id);
                return { id, peerId: p.peerId, userId: p.userId, name: p.name };
              });
            mergeRemotePeers(peers);
            const initiateOffer = shouldInitiateOfferRef.current;
            const createPC = createPeerConnectionRef.current;
            peers.forEach((peer: RemotePeer) => {
              if (peer.peerId && createPC) {
                const shouldOffer = initiateOffer(peer.peerId);
                console.log(`[WebRTC] PC for existing peer ${peer.peerId}, shouldOffer=${shouldOffer}, myPeerId=${peerIdRef.current}`);
                createPC(peer.peerId, peer, shouldOffer)
                  .then((pc: any) => {
                    if (pc && !shouldOffer) {
                      setTimeout(async () => {
                        if (pc.iceConnectionState === 'new' && !pc.remoteDescription) {
                          console.log(`[WebRTC] Fallback: sending offer to ${peer.peerId} (no offer received in 5s)`);
                          try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            sendSignalRef.current('offer', { targetPeerId: peer.peerId, sdp: offer });
                          } catch (err) { console.warn('[WebRTC] Fallback offer failed:', err); }
                        }
                      }, 5000);
                    }
                  })
                  .catch((err: any) => console.warn('[WebRTC] PC creation failed:', err));
              }
            });
            console.log('[Signaling] Joined room. Existing peers:', peers.length);
          }
          if (msg.type === 'room-peers') {
            const peers = (msg.peers || [])
              .filter((p: any) => p.peerId !== peerIdRef.current && String(p.userId || '') !== localUserId)
              .map((p: any) => {
                const id = peerKeyFor(p);
                if (p.peerId) remotePeerKeyRef.current.set(p.peerId, id);
                return { id, peerId: p.peerId, userId: p.userId, name: p.name };
              });
            mergeRemotePeers(peers);
          }
          if (msg.type === 'peer-joined') {
            const id = peerKeyFor(msg);
            if (msg.peerId) remotePeerKeyRef.current.set(msg.peerId, id);
            if (String(msg.userId || '') !== localUserId) {
              setRemotePeers(prev => [...prev.filter(p => p.id !== id), { id, peerId: msg.peerId, userId: msg.userId, name: msg.name }]);
              const createPC = createPeerConnectionRef.current;
              if (createPC && msg.peerId) {
                const shouldOffer = shouldInitiateOfferRef.current(msg.peerId);
                console.log(`[WebRTC] PC for new peer ${msg.peerId}, shouldOffer=${shouldOffer}, myPeerId=${peerIdRef.current}`);
                createPC(msg.peerId, { id, peerId: msg.peerId, userId: msg.userId, name: msg.name }, shouldOffer)
                  .then((pc: any) => {
                    if (pc && !shouldOffer) {
                      setTimeout(async () => {
                        if (pc.iceConnectionState === 'new' && !pc.remoteDescription) {
                          console.log(`[WebRTC] Fallback: sending offer to ${msg.peerId} (no offer received in 5s)`);
                          try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            sendSignalRef.current('offer', { targetPeerId: msg.peerId, sdp: offer });
                          } catch (err) { console.warn('[WebRTC] Fallback offer failed:', err); }
                        }
                      }, 5000);
                    }
                  })
                  .catch((err: any) => console.warn('[WebRTC] PC creation failed:', err));
              }
            }
            console.log('[Signaling] Peer joined:', msg.name);
          }
          if (msg.type === 'peer-left') {
            const id = peerKeyFor(msg);
            setRemotePeers(prev => prev.filter(p => p.id !== id && p.id !== msg.peerId));
            const pc = peerConnectionsRef.current.get(msg.peerId);
            try { pc?.close?.(); } catch {}
            peerConnectionsRef.current.delete(msg.peerId);
            remotePeerKeyRef.current.delete(msg.peerId);
            setRemoteStreams(prev => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            console.log('[Signaling] Peer left:', msg.peerId);
          }
          if (msg.type === 'offer') {
            const fromPeerId = msg.fromPeerId;
            console.log(`[WebRTC] Received offer from ${fromPeerId}`);
            // Handle glare: both sides sent offers simultaneously
            const existingPC = peerConnectionsRef.current.get(fromPeerId);
            if (existingPC && existingPC.signalingState === 'have-local-offer') {
              const isPolite = !shouldInitiateOfferRef.current(fromPeerId);
              if (!isPolite) {
                console.log(`[WebRTC] Glare: ignoring offer from ${fromPeerId} (my offer has priority)`);
                return;
              }
              console.log(`[WebRTC] Glare: accepting offer from ${fromPeerId}, recreating PC`);
              existingPC.close();
              peerConnectionsRef.current.delete(fromPeerId);
              iceCandidateBufferRef.current.delete(fromPeerId);
            }
            const peer = {
              id: remotePeerKeyRef.current.get(fromPeerId) || String(fromPeerId),
              peerId: fromPeerId,
              name: 'Participant',
            };
            const createPC = createPeerConnectionRef.current;
            (createPC ? createPC(fromPeerId, peer, false) : createPeerConnection(fromPeerId, peer, false)).then(async (pc: any) => {
              if (!pc) return;
              const RTCSdpClass = getRTCSessionDescriptionClass();
              const desc = RTCSdpClass ? new RTCSdpClass(msg.sdp) : msg.sdp;
              try {
                await pc.setRemoteDescription(desc);
              } catch (err) {
                console.warn(`[WebRTC] setRemoteDescription failed for offer from ${fromPeerId}:`, err);
                return;
              }
              const buffered = iceCandidateBufferRef.current.get(fromPeerId) || [];
              iceCandidateBufferRef.current.delete(fromPeerId);
              for (const c of buffered) {
                await pc.addIceCandidate(c).catch((e: any) => console.warn('[ICE] Buffered candidate failed:', e));
              }
              try {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const signal = sendSignalRef.current;
                signal('answer', { targetPeerId: fromPeerId, sdp: answer });
                console.log(`[WebRTC] Sent answer to ${fromPeerId}`);
              } catch (err) {
                console.warn(`[WebRTC] createAnswer/setLocal failed for ${fromPeerId}:`, err);
              }
            }).catch((err: any) => console.warn('[WebRTC] Offer handling failed:', err));
          }
          if (msg.type === 'answer') {
            const pc = peerConnectionsRef.current.get(msg.fromPeerId);
            if (pc) {
              const RTCSdpClass = getRTCSessionDescriptionClass();
              const desc = RTCSdpClass ? new RTCSdpClass(msg.sdp) : msg.sdp;
              try {
                await pc.setRemoteDescription(desc);
              } catch (err) {
                console.warn(`[WebRTC] setRemoteDescription failed for answer from ${msg.fromPeerId}:`, err);
                return;
              }
              const buffered = iceCandidateBufferRef.current.get(msg.fromPeerId) || [];
              iceCandidateBufferRef.current.delete(msg.fromPeerId);
              for (const c of buffered) {
                await pc.addIceCandidate(c).catch((e: any) => console.warn('[ICE] Buffered candidate failed:', e));
              }
            }
          }
          if (msg.type === 'ice-candidate') {
            const pc = peerConnectionsRef.current.get(msg.fromPeerId);
            if (pc && msg.candidate) {
              const RTCIceClass = getRTCIceCandidateClass();
              const candidate = RTCIceClass ? new RTCIceClass(msg.candidate) : msg.candidate;
              if (!pc.remoteDescription) {
                const buf = iceCandidateBufferRef.current.get(msg.fromPeerId) || [];
                buf.push(candidate);
                iceCandidateBufferRef.current.set(msg.fromPeerId, buf);
              } else {
                pc.addIceCandidate(candidate).catch((err: any) => console.warn('[WebRTC] ICE failed:', err));
              }
            } else if (!pc && msg.candidate) {
              const RTCIceClass = getRTCIceCandidateClass();
              const buf = iceCandidateBufferRef.current.get(msg.fromPeerId) || [];
              buf.push(RTCIceClass ? new RTCIceClass(msg.candidate) : msg.candidate);
              iceCandidateBufferRef.current.set(msg.fromPeerId, buf);
            }
          }
          if (msg.type === 'peer-media-state') {
            const peerKey = remotePeerKeyRef.current.get(msg.fromPeerId) || String(msg.fromPeerId);
            setRemotePeers(prev =>
              prev.map(p =>
                p.id === peerKey || p.peerId === msg.fromPeerId
                  ? { ...p, audioMuted: msg.audioEnabled === false, videoOff: msg.videoEnabled === false }
                  : p
              )
            );
          }
          if (msg.type === 'error') {
            console.warn('[Signaling] Server error:', msg.message);
          }
        } catch (err) {
          console.warn('[Signaling] Parse error:', err);
        }
      };

      ws.onerror = (e: any) => console.warn('[Signaling] WS error:', e?.message || e);

      ws.onclose = (e: any) => {
        console.log('[Signaling] WS closed. Code:', e?.code);
        peerIdRef.current = null;
        if (!intentionalCloseRef.current && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
          console.log(`[Signaling] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
          setTimeout(setupWs, delay);
        }
      };
    };

    setupWs();

    return () => {
      intentionalCloseRef.current = true;
    };
  };

  // Request permissions and enter room
  const enterRoom = async (room: any) => {
    setLoading(true);
    try {
      if (Platform.OS !== 'web') {
        // Request camera permission natively
        if (!cameraPermission?.granted) {
          const camResult = await requestCameraPermission();
          if (!camResult.granted) {
            Alert.alert(
              'Camera Permission Required',
              'Please allow camera access in Settings > Apps > Nexus Workspace > Permissions > Camera',
              [{ text: 'OK' }]
            );
          }
        }
        // Request microphone permission natively
        if (!micPermission?.granted) {
          const micResult = await requestMicPermission();
          if (!micResult.granted) {
            Alert.alert(
              'Microphone Permission Required',
              'Please allow microphone access in Settings > Apps > Nexus Workspace > Permissions > Microphone',
              [{ text: 'OK' }]
            );
          }
        }
      } else {
        // Web context warning for HTTP
        if (typeof window !== 'undefined' && window.isSecureContext === false) {
          Alert.alert(
            'Insecure Connection',
            'Your browser blocks camera access over HTTP. Please test via localhost or HTTPS. Video calling over HTTP will not work on mobile browsers.',
            [{ text: 'OK' }]
          );
        }
      }

      if (getIsWebRTCAvailable() && getMediaDevices()) {
        await ensureLocalStream().catch((err) => {
          console.warn('[WebRTC] Could not start local media:', err);
        });
      } else if (Platform.OS === 'web') {
        console.warn('[WebRTC] WebRTC APIs partially missing. Usually due to insecure context (HTTP).');
      } else {
        Alert.alert(
          'WebRTC Not Supported',
          'Expo Go does not support WebRTC native modules. Please test in a desktop browser or build a custom Expo Dev Client (APK) to use video calling on mobile.',
          [{ text: 'OK' }]
        );
      }

      setActiveRoom(room);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsSharing(false);
      setFacing('front');

      // Connect signaling using the canonical _id as room key
      // This ensures all users with the same meeting join the same signaling room
      const { token } = getSession();
      const finalSignalingId = room.signalingId || (room.id && !String(room.id).startsWith('local-') ? room.id : null);
      
      if (token && finalSignalingId) {
        connectSignaling(finalSignalingId, token, room.roomId || room.joinCode);
      }

    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start meeting.');
    } finally {
      setLoading(false);
    }
  };

  // End call
  const endCall = async () => {
    intentionalCloseRef.current = true;
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'leave', data: {} }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    try {
      const endId = activeRoom?.signalingId || activeRoom?.id;
      if (endId && !String(endId).startsWith('local-')) {
        await api.meetings.leaveMeeting(endId).catch(() => {});
      }
    } catch {}
    cleanupPeerConnections();
    stopMediaStream(localStreamRef.current);
    if (localScreenStream) {
      localScreenStream.getTracks().forEach((t: any) => t.stop());
    }
    resetCallAudio();
    localStreamRef.current = null;
    setLocalScreenStream(null);
    setLocalStream(null);
    setActiveRoom(null);
    setSidePanel(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSharing(false);
    setAiAssistantActive(false);
    setRemotePeers([]);
    setRemoteStreams({});
    peerIdRef.current = null;
  };

  const normalizeCode = (c: string) => {
    const t = c.trim().toUpperCase();
    const d = t.replace(/\D/g, '');
    return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : t;
  };

  const startMeeting = async () => {
    if (!meetTitle.trim()) { Alert.alert('Required', 'Enter a meeting title.'); return; }
    setLoading(true);
    try {
      const res = await api.meetings.registerLiveMeeting({ title: meetTitle, password: meetPass || undefined });
      if (res?._id) await api.meetings.startMeeting(res._id).catch(() => {});
      setCreateModal(false);
      // Use _id as the signaling room key - joiners will also resolve to this same _id
      const signalingRoomId = res._id || res.meetingId;
      if (!signalingRoomId) {
        throw new Error('Meeting created but no valid ID returned for signaling.');
      }

      const room = {
        id: signalingRoomId,
        title: res.title,
        roomId: res.joinCode,
        password: meetPass,
        signalingId: signalingRoomId,
        isHost: true,
        hostId: user?.id,
      };
      setMeetTitle(''); setMeetPass('');
      await enterRoom(room);
    } catch (err: any) {
      setCreateModal(false);
      Alert.alert('Error', err?.message || 'Could not create meeting. Check your connection.');
      setLoading(false);
    }
  };

  const joinMeeting = async () => {
    const code = normalizeCode(joinCode);
    if (!code) { Alert.alert('Required', 'Enter a meeting ID.'); return; }
    setLoading(true);
    try {
      const res = await api.meetings.validateMeeting(code, joinPass || undefined);
      setJoinModal(false);
      // CRITICAL: always use res._id as the signaling room key so all users
      // join the same WebSocket room regardless of how they entered the code.
      // We prioritize the MongoDB _id (res._id or res.meetingId).
      const signalingRoomId = res._id || res.meetingId;
      
      if (!signalingRoomId) {
        throw new Error('Meeting resolved but no valid ID returned for signaling.');
      }

      const room = {
        id: signalingRoomId,
        title: res.title || `Room ${code}`,
        roomId: res.joinCode || code,
        password: joinPass,
        signalingId: signalingRoomId,
        isHost: res.isHost || res.host?._id === user?.id,
        hostId: res.host?._id || res.host,
      };
      setJoinCode(''); setJoinPass('');
      await enterRoom(room);
    } catch (err: any) {
      setJoinModal(false);
      Alert.alert(
        'Could not join',
        `Meeting "${code}" not found or invalid passcode.\n\n${err?.message || 'Check the meeting ID and try again.'}`,
        [{ text: 'OK' }]
      );
      setLoading(false);
    }
  };

  const enterPersistentRoom = async (room: any) => {
    setLoading(true);
    try {
      const res = await api.meetings.validateMeeting(room.id, undefined);
      const signalingRoomId = res._id || res.meetingId;
      if (!signalingRoomId) {
        throw new Error('Room resolved but no valid meeting ID was returned.');
      }
      await enterRoom({
        id: signalingRoomId,
        title: res.title || room.title,
        roomId: res.joinCode || room.id,
        signalingId: signalingRoomId,
        isHost: res.isHost || res.host?._id === user?.id,
        hostId: res.host?._id || res.host,
      });
    } catch (err: any) {
      Alert.alert(
        'Could not join room',
        err?.message || 'This room could not be resolved on the server. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const sendChatMsg = () => {
    if (!chatInput.trim()) return;
    setChatMsgs(p => [...p, { id: String(Date.now()), sender: 'You', text: chatInput.trim() }]);
    setChatInput('');
  };

  const generateSummary = async (id: string) => {
    setSummaryModal(true); setSummaryLoading(true); setSummaryText('');
    try {
      const res = await api.meetings.summarizeMeeting(id);
      setSummaryText(res?.summary || 'No summary available.');
    } catch { setSummaryText('Could not generate summary.'); }
    finally { setSummaryLoading(false); }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm', cancelText = 'Cancel') => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: cancelText, style: 'cancel' },
        { text: confirmText, style: 'destructive', onPress: onConfirm }
      ]);
    }
  };

  const camReady = cameraPermission?.granted && !isVideoOff && !isSharing;
  const rtcAvailableNow = getIsWebRTCAvailable();
  const rtcLocalStreamSource = localStream?.toURL?.() || localStream;

  // ===== HOST CONTROLS MODAL =====
  const isHost = activeRoom?.isHost || (activeRoom?.hostId && activeRoom.hostId === user?.id);

  const renderHostControlsModal = () => (
    <Modal visible={hostControlsModal} transparent animationType="slide" onRequestClose={() => setHostControlsModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155' }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: '#1e40af', borderRadius: 8, padding: 6 }}>
                <Shield size={18} color="#60a5fa" />
              </View>
              <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: '700' }}>Host Controls</Text>
            </View>
            <TouchableOpacity onPress={() => setHostControlsModal(false)} style={{ padding: 8 }}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 4 }}>
            {(['meeting', 'participants', 'permissions'] as const).map(tab => (
              <TouchableOpacity key={tab} onPress={() => setHostControlsTab(tab)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                  backgroundColor: hostControlsTab === tab ? '#1e40af' : 'transparent' }}>
                <Text style={{ color: hostControlsTab === tab ? '#fff' : '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>

            {/* MEETING TAB */}
            {hostControlsTab === 'meeting' && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Meeting Actions</Text>

                <TouchableOpacity onPress={() => { setHostControlsModal(false); setCreateModal(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
                  <View style={{ backgroundColor: '#065f46', borderRadius: 8, padding: 8 }}><Play size={16} color="#34d399" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>Start Instant Meeting</Text>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>Start a new meeting immediately</Text>
                  </View>
                  <ChevronRight size={16} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setHostControlsModal(false); setScheduleModal(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
                  <View style={{ backgroundColor: '#1e3a5f', borderRadius: 8, padding: 8 }}><Calendar size={16} color="#60a5fa" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>Schedule Future Meeting</Text>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>Plan a meeting for later</Text>
                  </View>
                  <ChevronRight size={16} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setTransferHostModal(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
                  <View style={{ backgroundColor: '#3b1f6e', borderRadius: 8, padding: 8 }}><Shield size={16} color="#a78bfa" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>Transfer Host Rights</Text>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>Make another participant host</Text>
                  </View>
                  <ChevronRight size={16} color="#475569" />
                </TouchableOpacity>

                <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 4, overflow: 'hidden', marginTop: 4 }}>
                  {[
                    { label: 'End Meeting for All', desc: 'Terminate the session for everyone', color: '#ef4444', bg: '#450a0a',
                      onPress: () => {
                        setHostControlsModal(false);
                        showConfirm(
                          'End Meeting',
                          'This will end the meeting for all participants.',
                          () => { endCall(); },
                          'End for All',
                          'Cancel'
                        );
                      }},
                    { label: 'Leave (Keep Meeting Active)', desc: 'Leave but keep room running', color: '#f59e0b', bg: '#451a03',
                      onPress: () => { setHostControlsModal(false); endCall(); }},
                  ].map((item, i) => (
                    <TouchableOpacity key={i} onPress={item.onPress}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                        borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#0f172a' }}>
                      <View style={{ backgroundColor: item.bg, borderRadius: 8, padding: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                        <PhoneOff size={14} color={item.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: item.color, fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>{item.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>Waiting Room</Text>
                {[
                  { label: 'Enable Waiting Room', desc: 'Hold participants until admitted', key: 'waitingRoom', value: waitingRoomEnabled, set: setWaitingRoomEnabled },
                ].map((item) => (
                  <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>{item.desc}</Text>
                    </View>
                    <TouchableOpacity onPress={() => item.set(!item.value)}
                      style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: item.value ? '#2563eb' : '#334155',
                        justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                        alignSelf: item.value ? 'flex-end' : 'flex-start' }} />
                    </TouchableOpacity>
                  </View>
                ))}

                {waitingRoomEnabled && (
                  <View style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 4, gap: 0 }}>
                    {[
                      { label: 'Admit All Users', action: () => Alert.alert('Waiting Room', 'All users admitted') },
                      { label: 'Remove from Waiting Room', action: () => Alert.alert('Waiting Room', 'Select user to remove') },
                    ].map((item, i) => (
                      <TouchableOpacity key={i} onPress={item.action}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14,
                          borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#0f172a' }}>
                        <Text style={{ color: '#60a5fa', fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                        <ChevronRight size={16} color="#475569" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* PARTICIPANTS TAB */}
            {hostControlsTab === 'participants' && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Audio Controls</Text>
                <View style={{ backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
                  {[
                    { label: 'Mute All Participants', desc: 'Silence everyone instantly', active: muteAllActive,
                      onPress: () => { setMuteAllActive(true); Alert.alert('Muted', 'All participants have been muted'); }},
                    { label: 'Prevent Participants from Unmuting', active: preventUnmute,
                      onPress: () => setPreventUnmute(p => !p) },
                    { label: 'Request All to Unmute', desc: 'Send unmute request to everyone',
                      onPress: () => Alert.alert('Request Sent', 'Unmute request sent to all participants') },
                  ].map((item: any, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                      borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#0f172a' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                        {item.desc && <Text style={{ color: '#64748b', fontSize: 12 }}>{item.desc}</Text>}
                      </View>
                      {item.active !== undefined ? (
                        <TouchableOpacity onPress={item.onPress}
                          style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: item.active ? '#2563eb' : '#334155',
                            justifyContent: 'center', paddingHorizontal: 3 }}>
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                            alignSelf: item.active ? 'flex-end' : 'flex-start' }} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={item.onPress} style={{ backgroundColor: '#1e40af', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Send</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>Participant List</Text>
                {[{ id: 'local', name: user?.name || 'You', role: 'Host', isLocal: true }, ...remotePeers.map(p => ({ id: p.id, name: p.name, role: 'Attendee', isLocal: false }))]
                  .map((peer) => (
                  <View key={peer.id} style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: peer.isLocal ? '#1e40af' : '#5b21b6', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{avatarFor(peer.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>{peer.name}{peer.isLocal ? ' (You)' : ''}</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>{peer.role}</Text>
                    </View>
                    {!peer.isLocal && (
                      <TouchableOpacity onPress={() => setParticipantMenuTarget(peer)}
                        style={{ backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>Manage</Text>
                      </TouchableOpacity>
                    )}
                    {peer.isLocal && <View style={{ backgroundColor: '#065f46', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: '#34d399', fontSize: 11, fontWeight: '700' }}>HOST</Text></View>}
                  </View>
                ))}

                {/* Participant action menu */}
                {participantMenuTarget && (
                  <View style={{ backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden', marginTop: 4 }}>
                    <View style={{ backgroundColor: '#0f172a', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#60a5fa', fontWeight: '700' }}>Actions for {participantMenuTarget.name}</Text>
                      <TouchableOpacity onPress={() => setParticipantMenuTarget(null)}><X size={16} color="#64748b" /></TouchableOpacity>
                    </View>
                    {[
                      { label: '🔇 Mute Participant', color: '#f1f5f9', onPress: () => { Alert.alert('Muted', `${participantMenuTarget.name} has been muted.`); setParticipantMenuTarget(null); }},
                      { label: '📹 Stop Video', color: '#f1f5f9', onPress: () => { Alert.alert('Video Stopped', `${participantMenuTarget.name}'s video was stopped.`); setParticipantMenuTarget(null); }},
                      { label: '👑 Make Co-Host', color: '#a78bfa', onPress: () => { Alert.alert('Role Updated', `${participantMenuTarget.name} is now a Co-Host.`); setParticipantMenuTarget(null); }},
                      { label: '🎤 Assign Presenter', color: '#60a5fa', onPress: () => { Alert.alert('Role Updated', `${participantMenuTarget.name} is now the Presenter.`); setParticipantMenuTarget(null); }},
                      { label: '🔄 Transfer Host', color: '#f59e0b', onPress: () => {
                        showConfirm(
                          'Transfer Host',
                          `Transfer host rights to ${participantMenuTarget.name}?`,
                          () => {
                            if (Platform.OS === 'web') {
                              window.alert('Host rights transferred.');
                            } else {
                              Alert.alert('Done', 'Host rights transferred.');
                            }
                            setParticipantMenuTarget(null);
                          },
                          'Transfer',
                          'Cancel'
                        );
                      }},
                      { label: '❌ Remove from Meeting', color: '#ef4444', onPress: () => {
                        showConfirm(
                          'Remove Participant',
                          `Remove ${participantMenuTarget.name}?`,
                          () => {
                            if (Platform.OS === 'web') {
                              window.alert(`${participantMenuTarget.name} has been removed.`);
                            } else {
                              Alert.alert('Removed', `${participantMenuTarget.name} has been removed.`);
                            }
                            setParticipantMenuTarget(null);
                          },
                          'Remove',
                          'Cancel'
                        );
                      }},
                      { label: '🚫 Ban (Block Rejoin)', color: '#ef4444', onPress: () => {
                        showConfirm(
                          'Ban Participant',
                          `Ban ${participantMenuTarget.name} from rejoining?`,
                          () => {
                            if (Platform.OS === 'web') {
                              window.alert(`${participantMenuTarget.name} has been banned.`);
                            } else {
                              Alert.alert('Banned', `${participantMenuTarget.name} has been banned.`);
                            }
                            setParticipantMenuTarget(null);
                          },
                          'Ban',
                          'Cancel'
                        );
                      }},
                    ].map((action, i) => (
                      <TouchableOpacity key={i} onPress={action.onPress}
                        style={{ padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#0f172a' }}>
                        <Text style={{ color: action.color, fontSize: 14, fontWeight: '500' }}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* PERMISSIONS TAB */}
            {hostControlsTab === 'permissions' && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Join Permissions</Text>
                {[
                  { label: 'Allow Join Before Host', desc: 'Participants can join early', value: allowBeforeHost, set: setAllowBeforeHost },
                  { label: 'Allow Guest Users', desc: 'Users without accounts can join', value: allowGuests, set: setAllowGuests },
                  { label: 'Require Authentication', desc: 'Force login before joining', value: requireAuth, set: setRequireAuth },
                  { label: 'Lock Meeting', desc: 'Prevent new participants from joining', value: meetingLocked, set: setMeetingLocked },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>{item.desc}</Text>
                    </View>
                    <TouchableOpacity onPress={() => item.set(!item.value)}
                      style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: item.value ? '#2563eb' : '#334155',
                        justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                        alignSelf: item.value ? 'flex-end' : 'flex-start' }} />
                    </TouchableOpacity>
                  </View>
                ))}

                {meetingLocked && (
                  <View style={{ backgroundColor: '#450a0a', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Lock size={16} color="#ef4444" />
                    <Text style={{ color: '#fca5a5', fontSize: 13, flex: 1 }}>Meeting is locked. No new participants can join.</Text>
                  </View>
                )}

                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>Video Permissions</Text>
                {[
                  { label: 'Allow HD Video', desc: 'Enable high definition video', value: true },
                  { label: 'Allow Screen Sharing', desc: 'Participants can share screens', value: true },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, padding: 14 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>{item.label}</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>{item.desc}</Text>
                    </View>
                    <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: '#2563eb', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-end' }} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  //  ACTIVE MEETING ROOM 
  if (activeRoom) {
    const localUser = user;

    return (
      <View style={s.roomRoot}>
        <StatusBar hidden />

        {/* TOP BAR */}
        <View style={s.roomTopBar}>
          <View style={s.roomTopLeft}>
            <View style={s.liveDot} />
            <Text style={s.liveLabel}>LIVE</Text>
            <View style={s.roomDivider} />
            <Text style={s.roomTitle} numberOfLines={1}>{activeRoom.title}</Text>
          </View>
          <View style={s.roomTopRight}>
            <View style={s.e2eeBadge}>
              <Shield size={11} color="#10b981" />
              <Text style={s.e2eeText}>E2EE</Text>
            </View>
            <Text style={s.roomTimer}>{fmtDur(callDur)}</Text>
          </View>
        </View>

        {/* ROOM ID STRIP */}
        <View style={s.roomIdStrip}>
          <Copy size={12} color="#64748b" />
          <Text style={s.roomIdLabel}>ID:</Text>
          <Text style={s.roomIdValue} selectable>{activeRoom.roomId || activeRoom.id}</Text>
          {activeRoom.password ? (
            <>
              <Lock size={12} color="#64748b" style={{ marginLeft: 12 }} />
              <Text style={s.roomIdLabel}>Pass:</Text>
              <Text style={s.roomIdValue}>{activeRoom.password}</Text>
            </>
          ) : null}
        </View>

        {/* MAIN BODY */}
        <View style={s.roomBody}>

          {/* VIDEO GRID */}
          <View style={s.videoGrid}>

            {/* LOCAL CAMERA TILE */}
            <View style={[s.videoTile, remotePeers.length === 0 ? s.videoTileFull : s.videoTileHalf]}>
              {rtcAvailableNow && (localScreenStream || (rtcLocalStreamSource && !isVideoOff && !isSharing)) ? (
                <RTCView
                  style={s.cameraView}
                  stream={localScreenStream || rtcLocalStreamSource}
                  streamURL={typeof (localScreenStream || rtcLocalStreamSource) === 'string' ? (localScreenStream || rtcLocalStreamSource) : undefined}
                  objectFit="cover"
                  mirror={!localScreenStream && facing === 'front'}
                  muted
                />
              ) : camReady ? (
                <CameraView
                  style={s.cameraView}
                  facing={facing}
                  mute={isMuted}
                />
              ) : (
                <View style={[s.videoAvatar, { backgroundColor: '#2563eb' }]}>
                  <Text style={s.videoAvatarText}>{avatarFor(localUser?.name || 'You')}</Text>
                  {isSharing && <Text style={s.sharingLabel}>Screen Sharing</Text>}
                  {isVideoOff && !isSharing && <Text style={s.camOffLabel}>Camera Off</Text>}
                  {!cameraPermission?.granted && !isVideoOff && (
                    <Text style={s.camOffLabel}>Tap camera to enable</Text>
                  )}
                  {!isMuted && (
                    <View style={s.waveRow}>
                      {audioLevels.map((h, i) => (
                        <View key={i} style={[s.waveBar, { height: Math.max(3, h * 0.25) }]} />
                      ))}
                    </View>
                  )}
                </View>
              )}
              <View style={s.namePlate}>
                <Shield size={9} color="#fff" />
                <Text style={s.namePlateText} numberOfLines={1}>{localUser?.name || 'You'} (You)</Text>
                {isMuted && <MicOff size={9} color="#ef4444" />}
                {isVideoOff && <VideoOff size={9} color="#ef4444" />}
              </View>
            </View>

            {/* REMOTE PEER TILES */}
            {remotePeers.slice(0, 3).map(peer => {
              const remoteStream = remoteStreams[peer.id] || (peer.peerId ? remoteStreams[peer.peerId] : null);
              return (
                <View key={peer.id} style={[s.videoTile, s.videoTileHalf]}>
                  {rtcAvailableNow && remoteStream ? (
                    <RTCView
                      style={s.cameraView}
                      stream={remoteStream}
                      objectFit="cover"
                    />
                  ) : (
                    <View style={[s.videoAvatar, { backgroundColor: '#7c3aed' }]}>
                      <Text style={s.videoAvatarText}>{avatarFor(peer.name)}</Text>
                      <Text style={s.connectingText}>{rtcAvailableNow ? 'Connecting media...' : 'WebRTC unavailable'}</Text>
                    </View>
                  )}
                  <View style={s.namePlate}>
                    <Text style={s.namePlateText} numberOfLines={1}>{peer.name}</Text>
                  </View>
                </View>
              );
            })}

            {/* WAITING BANNER */}
            {remotePeers.length === 0 && (
              <View style={s.waitingBanner}>
                <Users size={15} color="#64748b" />
                <Text style={s.waitingText}>Share the room ID to invite others</Text>
              </View>
            )}

          </View>

          {/* SIDE PANEL */}
          {sidePanel && (
            <View style={s.sidePanel}>
              <View style={s.sidePanelHeader}>
                <Text style={s.sidePanelTitle}>{sidePanel === 'chat' ? 'Chat' : 'People'}</Text>
                <TouchableOpacity onPress={() => setSidePanel(null)}>
                  <X size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {sidePanel === 'chat' ? (
                <View style={s.sidePanelBody}>
                  <ScrollView style={s.sideChatScroll} contentContainerStyle={{ gap: 8, padding: 12 }}>
                    {chatMsgs.map(m => (
                      <View key={m.id} style={[s.sideChatBubble, m.sender === 'You' && s.sideChatBubbleSelf]}>
                        <Text style={s.sideChatSender}>{m.sender}</Text>
                        <Text style={s.sideChatText}>{m.text}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={s.sideChatInput}>
                    <TextInput style={s.sideChatField} value={chatInput} onChangeText={setChatInput}
                      placeholder="Message..." placeholderTextColor="#64748b" onSubmitEditing={sendChatMsg} />
                    <TouchableOpacity style={s.sideChatSend} onPress={sendChatMsg}>
                      <Send size={15} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <ScrollView style={s.sidePanelBody}>
                  <View style={s.peerRow}>
                    <View style={[s.peerAvatar, { backgroundColor: '#2563eb' }]}>
                      <Text style={s.peerAvatarText}>{avatarFor(localUser?.name || 'You')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.peerName}>{localUser?.name || 'You'} (You)</Text>
                      <Text style={s.peerRole}>Host</Text>
                    </View>
                    <Wifi size={14} color="#10b981" />
                  </View>
                  {remotePeers.map(peer => (
                    <View key={peer.id} style={s.peerRow}>
                      <View style={[s.peerAvatar, { backgroundColor: '#7c3aed' }]}>
                        <Text style={s.peerAvatarText}>{avatarFor(peer.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.peerName}>{peer.name}</Text>
                        <Text style={s.peerRole}>{peer.name === 'Nexus AI Assistant' ? 'AI Bot' : 'Attendee'}</Text>
                      </View>
                      <Wifi size={14} color="#10b981" />
                    </View>
                  ))}
                  
                  <View style={{ padding: 16 }}>
                    <TouchableOpacity 
                      style={[s.primaryBtn, aiAssistantActive && { backgroundColor: '#10b981' }]} 
                      onPress={async () => {
                        if (aiAssistantActive) return;
                        try {
                          setAiAssistantActive(true);
                          await api.meetings.startAIBot(
                            activeRoom.id,
                            Platform.OS === 'web' ? window.location.origin : 'http://localhost:8081'
                          );
                          Alert.alert('AI Assistant', 'AI bot is joining to transcribe the meeting.');
                        } catch (err: any) {
                          setAiAssistantActive(false);
                          Alert.alert('AI Error', err.message);
                        }
                      }}
                    >
                      <Text style={s.primaryBtnText}>{aiAssistantActive ? 'AI Assistant Active' : 'Enable AI Assistant'}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* CONTROL DOCK */}
        <View style={s.controlDockWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.controlDock}>
            {/* MUTE */}
          <TouchableOpacity style={[s.ctrlBtn, isMuted && s.ctrlBtnRed]} onPress={() => setIsMuted(p => !p)}>
            {isMuted ? <MicOff size={20} color="#ef4444" /> : <Mic size={20} color="#fff" />}
            <Text style={[s.ctrlLabel, isMuted && { color: '#ef4444' }]}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* CAMERA ON/OFF */}
          <TouchableOpacity style={[s.ctrlBtn, isVideoOff && s.ctrlBtnRed]} onPress={async () => {
            if (Platform.OS !== 'web' && !cameraPermission?.granted && !isVideoOff) {
              const result = await requestCameraPermission();
              if (!result.granted) {
                Alert.alert('Camera Permission', 'Enable camera in Settings > Apps > Nexus Workspace > Permissions');
                return;
              }
            }
            setIsVideoOff(p => !p);
          }}>
            {isVideoOff ? <VideoOff size={20} color="#ef4444" /> : <Video size={20} color="#fff" />}
            <Text style={[s.ctrlLabel, isVideoOff && { color: '#ef4444' }]}>{isVideoOff ? 'Start Cam' : 'Stop Cam'}</Text>
          </TouchableOpacity>

          {/* FLIP CAMERA */}
          <TouchableOpacity style={s.ctrlBtn} onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}>
            <FlipHorizontal size={20} color="#fff" />
            <Text style={s.ctrlLabel}>Flip</Text>
          </TouchableOpacity>

          {/* SCREEN SHARE */}
          <TouchableOpacity style={[s.ctrlBtn, isSharing && s.ctrlBtnBlue]} onPress={async () => {
            if (!isSharing) {
              try {
                const displayStream = await getDisplayMedia({ video: true });
                setLocalScreenStream(displayStream);
                setIsSharing(true);
                setIsVideoOff(true);
                
                const screenTrack = displayStream.getVideoTracks()[0];
                if (screenTrack) {
                  peerConnectionsRef.current.forEach((pc: any) => {
                    const senders = pc.getSenders();
                    const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
                    if (videoSender) videoSender.replaceTrack(screenTrack);
                  });
                  screenTrack.onended = () => {
                     setIsSharing(false);
                     setLocalScreenStream(null);
                     const camTrack = localStreamRef.current?.getVideoTracks()[0];
                     if (camTrack) {
                       peerConnectionsRef.current.forEach((pc: any) => {
                          const senders = pc.getSenders();
                          const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
                          if (videoSender) videoSender.replaceTrack(camTrack);
                       });
                     }
                  };
                }
                
                if (Platform.OS !== 'web') {
                  Alert.alert('Screen Share', 'Screen sharing started. Your screen is now visible to participants.', [{ text: 'OK' }]);
                }
              } catch (e: any) {
                Alert.alert('Screen Share Error', e.message || 'Could not start screen sharing');
              }
            } else {
               setIsSharing(false);
               if (localScreenStream) {
                 localScreenStream.getTracks().forEach((t: any) => t.stop());
                 setLocalScreenStream(null);
               }
               const camTrack = localStreamRef.current?.getVideoTracks()[0];
               if (camTrack) {
                 peerConnectionsRef.current.forEach((pc: any) => {
                    const senders = pc.getSenders();
                    const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
                    if (videoSender) videoSender.replaceTrack(camTrack);
                 });
               }
            }
          }}>
            <MonitorUp size={20} color={isSharing ? '#3b82f6' : '#fff'} />
            <Text style={[s.ctrlLabel, isSharing && { color: '#3b82f6' }]}>{isSharing ? 'Sharing' : 'Share'}</Text>
          </TouchableOpacity>

          {/* PEOPLE */}
          <TouchableOpacity style={[s.ctrlBtn, sidePanel === 'people' && s.ctrlBtnBlue]}
            onPress={() => setSidePanel(p => p === 'people' ? null : 'people')}>
            <Users size={20} color={sidePanel === 'people' ? '#3b82f6' : '#fff'} />
            <Text style={[s.ctrlLabel, sidePanel === 'people' && { color: '#3b82f6' }]}>
              {remotePeers.length + 1}
            </Text>
          </TouchableOpacity>

          {/* CHAT */}
          <TouchableOpacity style={[s.ctrlBtn, sidePanel === 'chat' && s.ctrlBtnBlue]}
            onPress={() => setSidePanel(p => p === 'chat' ? null : 'chat')}>
            <MessageSquare size={20} color={sidePanel === 'chat' ? '#3b82f6' : '#fff'} />
            <Text style={[s.ctrlLabel, sidePanel === 'chat' && { color: '#3b82f6' }]}>Chat</Text>
          </TouchableOpacity>

          {/* HOST CONTROLS */}
          {isHost && (
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: '#1e3a5f' }]} onPress={() => setHostControlsModal(true)}>
              <Shield size={20} color="#60a5fa" />
              <Text style={[s.ctrlLabel, { color: '#60a5fa' }]}>Host</Text>
            </TouchableOpacity>
          )}

          {/* END CALL */}
          <TouchableOpacity style={s.endCallBtn} onPress={() => {
            showConfirm(
              'Leave Meeting',
              'Are you sure you want to leave?',
              () => { endCall(); },
              'Leave',
              'Cancel'
            );
          }}>
            <PhoneOff size={22} color="#fff" />
            <Text style={[s.ctrlLabel, { color: '#fff' }]}>Leave</Text>
          </TouchableOpacity>

          </ScrollView>
        </View>

        {renderHostControlsModal()}
      </View>
    );
  }

  //  MEETINGS HOME SCREEN 
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      <View style={s.quickGrid}>
        <TouchableOpacity style={[s.quickCard, { backgroundColor: '#2563eb' }]} onPress={() => setCreateModal(true)}>
          <View style={s.quickIcon}><Plus size={22} color="#fff" /></View>
          <Text style={s.quickTitle}>New Meeting</Text>
          <Text style={s.quickSub}>Start instantly</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickCard, { backgroundColor: '#4f46e5' }]} onPress={() => setJoinModal(true)}>
          <View style={s.quickIcon}><LogIn size={22} color="#fff" /></View>
          <Text style={s.quickTitle}>Join</Text>
          <Text style={s.quickSub}>Enter room code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickCard, s.quickCardLight]} onPress={() => setScheduleModal(true)}>
          <View style={[s.quickIcon, { backgroundColor: '#f1f5f9' }]}><Calendar size={22} color="#475569" /></View>
          <Text style={[s.quickTitle, { color: '#0f172a' }]}>Schedule</Text>
          <Text style={[s.quickSub, { color: '#64748b' }]}>Plan ahead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickCard, s.quickCardLight]} onPress={() => setRoomsModal(true)}>
          <View style={[s.quickIcon, { backgroundColor: '#f1f5f9' }]}><Users size={22} color="#475569" /></View>
          <Text style={[s.quickTitle, { color: '#0f172a' }]}>Rooms</Text>
          <Text style={[s.quickSub, { color: '#64748b' }]}>Persistent spaces</Text>
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Persistent Rooms</Text>
        {ROOMS.map(room => (
          <TouchableOpacity key={room.id} style={s.roomCard} onPress={() => enterPersistentRoom(room)}>
            <View style={[s.roomTag, { backgroundColor: room.color + '20' }]}>
              <Text style={[s.roomTagText, { color: room.color }]}>{room.tag}</Text>
            </View>
            <View style={s.roomCardInfo}>
              <Text style={s.roomCardTitle}>{room.title}</Text>
              <Text style={s.roomCardId}>{room.id}</Text>
            </View>
            <View style={[s.memberBadge, { backgroundColor: room.members > 0 ? '#dcfce7' : '#f1f5f9' }]}>
              <View style={[s.memberDot, { backgroundColor: room.members > 0 ? '#22c55e' : '#94a3b8' }]} />
              <Text style={[s.memberText, { color: room.members > 0 ? '#15803d' : '#64748b' }]}>{room.members} online</Text>
            </View>
            <ChevronRight size={16} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Today's Agenda</Text>
        {meetings.map(m => (
          <TouchableOpacity key={m.id} style={s.meetCard} onPress={async () => {
            setLoading(true);
            try {
              const res = await api.meetings.validateMeeting(String(m.id), undefined);
              const signalingRoomId = res._id || res.meetingId;
              if (!signalingRoomId) {
                throw new Error('Meeting resolved but no valid meeting ID was returned.');
              }
              await enterRoom({
                id: signalingRoomId,
                title: res.title || m.title,
                roomId: res.joinCode || m.id,
                signalingId: signalingRoomId,
                isHost: res.isHost || res.host?._id === user?.id,
                hostId: res.host?._id || res.host,
              });
            } catch (err: any) {
              Alert.alert('Could not join', err?.message || 'This meeting could not be resolved on the server.');
            }
            finally { setLoading(false); }
          }}>
            <View style={[s.meetColorBar, { backgroundColor: m.color }]} />
            <View style={[s.meetIconBox, { backgroundColor: m.color + '20' }]}>
              {m.status === 'live' ? <Play size={18} color={m.color} fill={m.color} /> : <Clock size={18} color={m.color} />}
            </View>
            <View style={s.meetInfo}>
              <View style={s.meetTitleRow}>
                <Text style={s.meetTitle}>{m.title}</Text>
                {m.status === 'live' && <View style={s.livePill}><Text style={s.livePillText}>LIVE</Text></View>}
                {reminders.includes(m.id) && <BellRing size={13} color="#2563eb" />}
              </View>
              <View style={s.meetMeta}>
                <Clock size={12} color="#94a3b8" /><Text style={s.meetMetaText}>{m.time}</Text>
                <Users size={12} color="#94a3b8" style={{ marginLeft: 10 }} /><Text style={s.meetMetaText}>{m.attendees}</Text>
                <Text style={s.meetDur}>{m.duration}</Text>
              </View>
            </View>
            <View style={s.meetActions}>
              <TouchableOpacity style={[s.bellBtn, reminders.includes(m.id) && s.bellBtnActive]}
                onPress={() => setReminders(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}>
                <Bell size={15} color={reminders.includes(m.id) ? '#fff' : '#94a3b8'} />
              </TouchableOpacity>
              <View style={[s.joinPill, { backgroundColor: m.color }]}><Text style={s.joinPillText}>Join</Text></View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Recent Meetings</Text>
        {history.map(m => (
          <View key={m.id} style={s.histCard}>
            <View style={[s.histIcon, { backgroundColor: '#f1f5f9' }]}><Clock size={18} color="#64748b" /></View>
            <View style={s.meetInfo}>
              <Text style={s.meetTitle}>{m.title}</Text>
              <View style={s.meetMeta}>
                <Calendar size={12} color="#94a3b8" /><Text style={s.meetMetaText}>{m.time}</Text>
                <Users size={12} color="#94a3b8" style={{ marginLeft: 10 }} /><Text style={s.meetMetaText}>{m.attendees} attended</Text>
              </View>
            </View>
            <TouchableOpacity style={s.summaryBtn} onPress={() => generateSummary(m.id)}>
              <Text style={s.summaryBtnText}>AI Summary</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={s.loadingText}>Starting meeting...</Text>
        </View>
      )}

      {/* CREATE */}
      <Modal visible={createModal} animationType="slide" transparent onRequestClose={() => setCreateModal(false)}>
        <View style={s.modalOverlay}><View style={s.modalCard}>
          <View style={s.modalTopRow}><Text style={s.modalTitle}>New Meeting</Text><TouchableOpacity onPress={() => setCreateModal(false)}><X size={20} color="#64748b" /></TouchableOpacity></View>
          <View style={s.formGroup}><Text style={s.fieldLabel}>Title</Text><TextInput style={s.modalInput} value={meetTitle} onChangeText={setMeetTitle} placeholder="Meeting topic" placeholderTextColor="#94a3b8" /></View>
          <View style={s.formGroup}><Text style={s.fieldLabel}>Passcode (optional)</Text><TextInput style={s.modalInput} value={meetPass} onChangeText={setMeetPass} placeholder="Leave blank for open access" placeholderTextColor="#94a3b8" secureTextEntry /></View>
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setCreateModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={startMeeting} disabled={loading}>{loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Start Now</Text>}</TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* JOIN */}
      <Modal visible={joinModal} animationType="slide" transparent onRequestClose={() => setJoinModal(false)}>
        <View style={s.modalOverlay}><View style={s.modalCard}>
          <View style={s.modalTopRow}><Text style={s.modalTitle}>Join Meeting</Text><TouchableOpacity onPress={() => setJoinModal(false)}><X size={20} color="#64748b" /></TouchableOpacity></View>
          <View style={s.formGroup}><Text style={s.fieldLabel}>Meeting ID</Text><TextInput style={s.modalInput} value={joinCode} onChangeText={setJoinCode} placeholder="e.g. 123-456-789" placeholderTextColor="#94a3b8" autoCapitalize="characters" /></View>
          <View style={s.formGroup}><Text style={s.fieldLabel}>Passcode (if required)</Text><TextInput style={s.modalInput} value={joinPass} onChangeText={setJoinPass} placeholder="Leave blank if none" placeholderTextColor="#94a3b8" secureTextEntry /></View>
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setJoinModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={joinMeeting} disabled={loading}>{loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Join Session</Text>}</TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* SCHEDULE */}
      <Modal visible={scheduleModal} animationType="slide" transparent onRequestClose={() => setScheduleModal(false)}>
        <View style={s.modalOverlay}><View style={s.modalCard}>
          <View style={s.modalTopRow}><Text style={s.modalTitle}>Schedule Meeting</Text><TouchableOpacity onPress={() => setScheduleModal(false)}><X size={20} color="#64748b" /></TouchableOpacity></View>
          {[{label:'Title',val:schedTitle,set:setSchedTitle,ph:'Sprint Planning'},{label:'Date (YYYY-MM-DD)',val:schedDate,set:setSchedDate,ph:'2026-06-01'},{label:'Time',val:schedTime,set:setSchedTime,ph:'10:00 AM'},{label:'Duration (min)',val:schedDur,set:setSchedDur,ph:'45'}].map(f=>(
            <View key={f.label} style={s.formGroup}><Text style={s.fieldLabel}>{f.label}</Text><TextInput style={s.modalInput} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor="#94a3b8" /></View>
          ))}
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setScheduleModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={async()=>{try{await api.meetings.registerLiveMeeting({title:schedTitle,startTime:new Date(`${schedDate}T12:00:00`),duration:parseInt(schedDur)||45});Alert.alert('Scheduled',`"${schedTitle}" scheduled.`);}catch{Alert.alert('Saved',`"${schedTitle}" saved locally.`);}setScheduleModal(false);}}><Text style={s.primaryBtnText}>Confirm</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* ROOMS */}
      <Modal visible={roomsModal} animationType="slide" transparent onRequestClose={() => setRoomsModal(false)}>
        <View style={s.modalOverlay}><View style={s.modalCard}>
          <View style={s.modalTopRow}><Text style={s.modalTitle}>Persistent Rooms</Text><TouchableOpacity onPress={() => setRoomsModal(false)}><X size={20} color="#64748b" /></TouchableOpacity></View>
          {ROOMS.map(room=>(
            <TouchableOpacity key={room.id} style={s.roomModalItem} onPress={()=>{setRoomsModal(false);enterPersistentRoom(room);}}>
              <View style={[s.roomTag,{backgroundColor:room.color+'20'}]}><Text style={[s.roomTagText,{color:room.color}]}>{room.tag}</Text></View>
              <View style={{flex:1}}><Text style={s.roomModalTitle}>{room.title}</Text><Text style={s.roomModalId}>{room.id}</Text></View>
              <View style={[s.memberBadge,{backgroundColor:room.members>0?'#dcfce7':'#f1f5f9'}]}><Text style={[s.memberText,{color:room.members>0?'#15803d':'#64748b'}]}>{room.members} online</Text></View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.cancelBtn} onPress={()=>setRoomsModal(false)}><Text style={s.cancelBtnText}>Close</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* SUMMARY */}
      <Modal visible={summaryModal} animationType="slide" transparent onRequestClose={() => setSummaryModal(false)}>
        <View style={s.modalOverlay}><View style={[s.modalCard,{maxHeight:'80%'}]}>
          <View style={s.modalTopRow}><Text style={s.modalTitle}>AI Summary</Text><TouchableOpacity onPress={()=>setSummaryModal(false)}><X size={20} color="#64748b" /></TouchableOpacity></View>
          <ScrollView style={{flex:1}}>
            {summaryLoading ? (
              <View style={{alignItems:'center',padding:32,gap:12}}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={{color:'#64748b',fontSize:14}}>Generating...</Text>
              </View>
            ) : (
              summaryText && summaryText.includes('<') && summaryText.includes('>') ? (
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: summaryText }}
                  baseStyle={{ fontSize: 14, color: '#334155', lineHeight: 22 }}
                />
              ) : (
                <Text style={s.summaryBody}>{summaryText}</Text>
              )
            )}
          </ScrollView>
          <TouchableOpacity style={s.primaryBtn} onPress={()=>setSummaryModal(false)}><Text style={s.primaryBtnText}>Close</Text></TouchableOpacity>
        </View></View>
      </Modal>

    </ScrollView>
  );
}

const getStyles = (width: number, height: number, isMobile: boolean) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40, gap: 28 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { flex: 1, minWidth: isMobile ? '45%' : 180, borderRadius: 24, padding: 20, gap: 10 },
  quickCardLight: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  quickIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  quickSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  section: { gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  roomCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  roomTag: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roomTagText: { fontSize: 14, fontWeight: '900' },
  roomCardInfo: { flex: 1 },
  roomCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  roomCardId: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  memberDot: { width: 7, height: 7, borderRadius: 4 },
  memberText: { fontSize: 11, fontWeight: '700' },
  meetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12, overflow: 'hidden' },
  meetColorBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  meetIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  meetInfo: { flex: 1, minWidth: 0 },
  meetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meetTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  livePill: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  livePillText: { fontSize: 9, fontWeight: '900', color: '#15803d', textTransform: 'uppercase' },
  meetMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  meetMetaText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  meetDur: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginLeft: 8 },
  meetActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  bellBtnActive: { backgroundColor: '#2563eb' },
  joinPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  joinPillText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  histCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  histIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  summaryBtnText: { fontSize: 11, fontWeight: '800', color: '#7c3aed' },
  summaryBody: { fontSize: 14, color: '#334155', lineHeight: 22, padding: 4 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 99 },
  loadingText: { fontSize: 14, color: '#64748b', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 14 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  formGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  primaryBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  roomModalItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#f8fafc', gap: 12, marginBottom: 8 },
  roomModalTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  roomModalId: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  // Meeting room
  roomRoot: { flex: 1, backgroundColor: '#0a0f1e' },
  roomTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  roomTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  liveLabel: { fontSize: 10, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  roomDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)' },
  roomTitle: { fontSize: 15, fontWeight: '800', color: '#fff', flex: 1 },
  roomTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  e2eeText: { fontSize: 10, fontWeight: '900', color: '#10b981' },
  roomTimer: { fontSize: 14, fontWeight: '900', color: '#10b981', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  roomIdStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)', gap: 6 },
  roomIdLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  roomIdValue: { fontSize: 12, fontWeight: '700', color: '#60a5fa' },
  roomBody: { flex: 1, flexDirection: 'row' },
  videoGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  videoTile: { backgroundColor: '#111827', borderRadius: 16, overflow: 'hidden', position: 'relative' },
  videoTileFull: { width: '100%', aspectRatio: 4 / 3 },
  videoTileHalf: { width: '48%', aspectRatio: 1 },
  cameraView: { flex: 1, width: '100%', height: '100%' },
  videoAvatar: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 140 },
  videoAvatarText: { fontSize: 36, fontWeight: '900', color: '#fff' },
  camOffLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textAlign: 'center' },
  sharingLabel: { fontSize: 12, color: '#3b82f6', fontWeight: '800' },
  connectingText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  waveBar: { width: 3, backgroundColor: '#10b981', borderRadius: 2, minHeight: 3 },
  namePlate: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  namePlateText: { flex: 1, fontSize: 11, fontWeight: '800', color: '#fff' },
  waitingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, margin: 8, width: '100%' },
  waitingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  sidePanel: { width: isMobile ? '100%' : 280, backgroundColor: 'rgba(15,23,42,0.97)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' },
  sidePanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sidePanelTitle: { fontSize: 14, fontWeight: '900', color: '#fff' },
  sidePanelBody: { flex: 1 },
  sideChatScroll: { flex: 1 },
  sideChatBubble: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 10, gap: 3, alignSelf: 'flex-start', maxWidth: '85%' },
  sideChatBubbleSelf: { backgroundColor: '#2563eb', alignSelf: 'flex-end' },
  sideChatSender: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  sideChatText: { fontSize: 13, color: '#fff', lineHeight: 18 },
  sideChatInput: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  sideChatField: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#fff' },
  sideChatSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  peerRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  peerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  peerAvatarText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  peerName: { fontSize: 13, fontWeight: '800', color: '#fff' },
  peerRole: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  controlDockWrapper: { backgroundColor: 'rgba(15,23,42,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  controlDock: { flexDirection: 'row', alignItems: 'center', minWidth: '100%', justifyContent: 'space-evenly', paddingHorizontal: 8, paddingVertical: 12, gap: 4 },
  ctrlBtn: { alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 14, minWidth: 50 },
  ctrlBtnRed: { backgroundColor: 'rgba(239,68,68,0.15)' },
  ctrlBtnBlue: { backgroundColor: 'rgba(59,130,246,0.15)' },
  ctrlLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', textAlign: 'center' },
  endCallBtn: { alignItems: 'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginLeft: 4 },
});
