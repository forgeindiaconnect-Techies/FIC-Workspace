"use client";
import { useEffect, useRef, useCallback } from 'react';
import { isWebRTCAvailable } from '../utils/rtc';

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
  const isNegotiatingRef = useRef<Map<string, boolean>>(new Map());
  const reconnectAttemptsRef = useRef<number>(0);
  const MAX_RECONNECTS = 3;

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

      // Add screen track as a separate stream to all peer connections
      peerConnectionsRef.current.forEach(async (pc, peerId) => {
        const sender = pc.addTrack(screenTrack, screenStreamRef.current!);
        const transceiver = pc.getTransceivers().find(t => t.sender === sender);
        if (transceiver) transceiver.direction = 'sendonly';

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
    if (!isWebRTCAvailable()) {
      throw new Error('RTCPeerConnection not available');
    }

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

    // Add local camera and microphone tracks safely
    if (localStreamRef.current) {
      const existingSenderKinds = pc.getSenders()
        .map(s => s.track?.kind)
        .filter(Boolean);

      localStreamRef.current.getTracks().forEach(track => {
        // Only add if not already added
        if (!existingSenderKinds.includes(track.kind)) {
          pc.addTrack(track, localStreamRef.current!);
        }
      });
    }

    // Add screen share tracks if currently active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, screenStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendWs('ice-candidate', {
          targetPeerId: peerId,
          candidate: e.candidate
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      // NOTE: shouldInitiateOfferRef logic is in MeetingApp, but here we just prevent tight loops
      if (isNegotiatingRef.current.get(peerId)) return; // prevent loop
      if (pc.signalingState !== 'stable') return; // critical guard against loop
      
      isNegotiatingRef.current.set(peerId, true);
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return; // check again after await
        
        await pc.setLocalDescription(offer);
        socketRef.current?.send(JSON.stringify({
          type: 'offer',
          data: {
            targetPeerId: peerId,
            sdp: offer
          }
        }));
      } catch (e) {
        console.error('Negotiation error:', e);
      } finally {
        isNegotiatingRef.current.set(peerId, false);
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
      
      const existingCameraStream = remoteStreamsRef.current.get(peerId);
      const hasCameraVideo = existingCameraStream && existingCameraStream.getVideoTracks().length > 0;
      
      const isScreenShare = event.track.label?.toLowerCase().includes('screen') 
        || event.transceiver?.mid === 'screen'
        || (event.track.kind === 'video' && hasCameraVideo && existingCameraStream!.id !== remoteStream.id)
        || ((window as any).pendingScreenShare && (window as any).pendingScreenShare.has(peerId));

      if (isScreenShare) {
        if ((window as any).pendingScreenShare) {
           (window as any).pendingScreenShare.delete(peerId);
        }
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
            if (existing) {
              const tracks = existing.getTracks();
              const existingTrackOfKind = tracks.find(t => t.kind === event.track.kind);
              if (existingTrackOfKind && existingTrackOfKind.id !== event.track.id) {
                  existing.removeTrack(existingTrackOfKind);
              }
              existing.addTrack(event.track);
            }
        }
      }

      // Ensure robust audio playback via dedicated audio element
      if (event.track.kind === 'audio') {
        let audioEl = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio-${peerId}`;
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Audio play error:', err);
        });
      }
      
      if (onPeerTrackAdded) onPeerTrackAdded(peerId);
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  };

  // 6. Fix late joiners not seeing screen share
  const handleNewPeer = async (peerId: string, polite: boolean) => {
    const pc = createPeerConnection(peerId);

    // Add local tracks safely
    if (localStreamRef.current) {
      const existingSenderKinds = pc.getSenders()
        .map(s => s.track?.kind)
        .filter(Boolean);

      localStreamRef.current.getTracks().forEach(track => {
        if (!existingSenderKinds.includes(track.kind)) {
          pc.addTrack(track, localStreamRef.current!);
        }
      });
    }

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
    if (reconnectAttemptsRef.current >= MAX_RECONNECTS) {
      console.error('Max reconnect attempts reached for signaling server.');
      return;
    }

    // Abstracting signaling connection for the user to integrate with their specific socket logic
    let API_URL = 'http://localhost:5000';
    try {
        API_URL = (import.meta as any).env.VITE_API_URL || API_URL;
    } catch(e){}
    // NOTE: WebSocket connection logic was moved back to MeetingApp to prevent double-socket duplicate sessions
    // and infinite signaling loops. MeetingApp.jsx populates socketRef.current and manages the lifecycle.
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
      try { API_URL = (import.meta as any).env.VITE_API_URL || API_URL; } catch(e){}
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
    // Hard stop if not in browser or WebRTC not available
    if (typeof window === 'undefined') return;
    if (!isWebRTCAvailable()) {
      console.error('WebRTC not supported in this environment');
      return;
    }
    if (!isReady || !roomId || !token) return;
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    isMountedRef.current = true;
    
    // Fetch ICE Servers (optional, matching existing implementation)
    const fetchIce = async () => {
        try {
            let API_URL = 'http://localhost:5000';
            try { API_URL = (import.meta as any).env.VITE_API_URL || API_URL; } catch(e){}
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
