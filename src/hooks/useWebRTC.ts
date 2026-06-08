import { useEffect, useRef, useCallback } from 'react';

export const useWebRTC = ({
  roomId,
  token,
  isReady,
  onMessage,
  onPeerTrackAdded,
  onPeerLeft
}: {
  roomId: string | null;
  token: string | null;
  isReady: boolean;
  onMessage?: (msg: any) => void;
  onPeerTrackAdded?: (peerId: string) => void;
  onPeerLeft?: (peerId: string) => void;
}) => {
  // 1. All streams and peer connections MUST be in refs, never useState
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  
  const socketRef = useRef<WebSocket | null>(null);
  const hasJoinedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);

  const sendWs = useCallback((type: string, data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  // 7. Fix AbortError on video play - exposed for RemoteVideo components to use
  const safePlay = async (videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!videoEl || !videoEl.isConnected || !stream) return;
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    try {
      await videoEl.play();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Video play error:', err);
      }
    }
  };

  // 4. Fix audio/video cut on refresh — use replaceTrack not recreate
  const rejoinWithNewStream = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = newStream;
      peerConnectionsRef.current.forEach(pc => {
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === 'audio') {
            sender.replaceTrack(newStream.getAudioTracks()[0]);
          }
          if (sender.track?.kind === 'video') {
            sender.replaceTrack(newStream.getVideoTracks()[0]);
          }
        });
      });
    } catch (error) {
      console.error('Failed to rejoin with new stream', error);
    }
  };

  // 5. Fix screen share auto-cut and black screen after refresh
  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    
    // Remove screen track sender
    peerConnectionsRef.current.forEach(pc => {
       const senders = pc.getSenders().filter(s => s.track?.kind === 'video' && s.track?.label?.toLowerCase().includes('screen'));
       senders.forEach(s => pc.removeTrack(s));
    });

    // Restore camera track to all peers
    rejoinWithNewStream();
  };

  // 5. Fix screen share auto-cut and black screen after refresh
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      peerConnectionsRef.current.forEach(async (pc, peerId) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, screenStream);
        }
        // Renegotiate with each peer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWs('offer', {
          targetPeerId: peerId,
          sdp: offer,
          isScreenShare: true
        });
      });

      // Handle OS-level stop (user clicks browser stop button)
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error('Failed to start screen share', err);
    }
  };

  // 9. Fix createPeerConnection with stale connection guard
  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    // Close stale connection if exists
    if (peerConnectionsRef.current.has(peerId)) {
      peerConnectionsRef.current.get(peerId)?.close();
      peerConnectionsRef.current.delete(peerId);
      remoteStreamsRef.current.delete(peerId);
      remoteScreenStreamsRef.current.delete(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendWs('ice-candidate', {
          targetPeerId: peerId,
          candidate: e.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        peerConnectionsRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
        remoteScreenStreamsRef.current.delete(peerId);
      }
    };

    // 8. Fix black screen on receiver side after presenter refreshes
    pc.ontrack = (event: RTCTrackEvent) => {
      if (!isMountedRef.current) return;
      let remoteStream = event.streams && event.streams[0];
      if (!remoteStream && event.track) {
         remoteStream = new MediaStream([event.track]);
      }
      
      const isScreenShare = event.track.label?.toLowerCase().includes('screen') 
        || event.transceiver?.mid === 'screen';

      if (isScreenShare) {
        if (!remoteScreenStreamsRef.current.has(peerId)) {
            remoteScreenStreamsRef.current.set(peerId, remoteStream);
        } else {
            const existing = remoteScreenStreamsRef.current.get(peerId);
            if (existing && !existing.getTracks().includes(event.track)) {
               existing.addTrack(event.track);
            }
        }
      } else {
        if (!remoteStreamsRef.current.has(peerId)) {
            remoteStreamsRef.current.set(peerId, remoteStream);
        } else {
            const existing = remoteStreamsRef.current.get(peerId);
            const tracks = existing?.getTracks() || [];
            const existingTrackOfKind = tracks.find(t => t.kind === event.track.kind);
            if (existingTrackOfKind && existingTrackOfKind.id !== event.track.id) {
                existing?.removeTrack(existingTrackOfKind);
            }
            if (existing) existing.addTrack(event.track);
        }
      }
      
      if (onPeerTrackAdded) onPeerTrackAdded(peerId);
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  };

  // 6. Fix late joiners not seeing screen share
  const handleNewPeer = async (peerId: string, polite: boolean) => {
    const pc = createPeerConnection(peerId);

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // If screen share is active, also add screen track
    if (screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      pc.addTrack(screenTrack, screenStreamRef.current);
    }

    if (!polite) {
       try {
         const offer = await pc.createOffer();
         await pc.setLocalDescription(offer);
         sendWs('offer', { targetPeerId: peerId, sdp: offer });
       } catch (err) {
         console.warn('Failed to create offer', err);
       }
    }
    return pc;
  };

  const connectSignaling = () => {
    // Abstracting signaling connection for the user to integrate with their specific socket logic
    let API_URL = 'http://localhost:5000';
    try {
        API_URL = import.meta.env.VITE_API_URL || API_URL;
    } catch(e){}

    let wsBase = API_URL;
    if (wsBase.startsWith('https://')) wsBase = wsBase.replace('https://', 'wss://');
    else if (wsBase.startsWith('http://')) wsBase = wsBase.replace('http://', 'ws://');
    else wsBase = `wss://${wsBase}`;
    wsBase = wsBase.replace(/\/+$/, '');

    const wsUrl = `${wsBase}/ws/webrtc`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      socketRef.current?.send(JSON.stringify({ 
         type: 'join', 
         data: {
             token,
             roomId,
             meetingId: roomId,
             joinCode: roomId
         }
      }));
    };

    socketRef.current.onmessage = async (event) => {
      if (!isMountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (onMessage) onMessage(msg);
      } catch (err) {
        console.error('Signaling error:', err);
      }
    };
  };

  // 3. Fix WebSocket 1006 abnormal closure — proper cleanup
  const cleanup = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'leave', data: {} }));
        socketRef.current.close(1000, 'User left');
      } catch (e) {}
    }
    
    // Reliably notify backend of leave on tab close so AI summaries trigger
    if (token && roomId) {
      let API_URL = 'http://localhost:5000';
      try { API_URL = import.meta.env.VITE_API_URL || API_URL; } catch(e){}
      const leaveUrl = `${API_URL}/api/meetings/${encodeURIComponent(roomId)}/leave`;
      try {
        fetch(leaveUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true
        }).catch(() => {});
      } catch (e) {}
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    remoteScreenStreamsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // 2. Fix double WebSocket connection
  useEffect(() => {
    if (!isReady || !roomId || !token) return;
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    
    // Fetch ICE Servers (optional, matching existing implementation)
    const fetchIce = async () => {
        try {
            let API_URL = 'http://localhost:5000';
            try { API_URL = import.meta.env.VITE_API_URL || API_URL; } catch(e){}
            const res = await fetch(`${API_URL}/api/meet/ice-servers`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) iceServersRef.current = data;
        } catch(e) {}
        connectSignaling();
    };
    fetchIce();

    window.addEventListener('beforeunload', cleanup);

    return () => {
      isMountedRef.current = false;
      cleanup();
      window.removeEventListener('beforeunload', cleanup);
    };
  }, [roomId, token, isReady]);

  return {
    localStreamRef,
    screenStreamRef,
    remoteStreamsRef,
    remoteScreenStreamsRef,
    peerConnectionsRef,
    socketRef,
    startScreenShare,
    stopScreenShare,
    rejoinWithNewStream,
    createPeerConnection,
    handleNewPeer,
    cleanup,
    safePlay,
    sendWs
  };
};
