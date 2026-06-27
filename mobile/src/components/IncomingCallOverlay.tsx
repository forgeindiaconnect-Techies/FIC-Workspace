import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing,
  PanResponder, Dimensions, SafeAreaView, Alert
} from 'react-native';
import { Phone, PhoneOff, Video, Users, Maximize2, Minimize2 } from 'lucide-react-native';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { callManager, CallState, CallerInfo } from '../lib/callManager';
import { RTCView } from '../lib/webrtc';
import { api, getSession } from '../lib/api';
import { useNavigate } from '../lib/router';

const RING_TIMEOUT_MS = 30_000;
const { width, height } = Dimensions.get('window');

export default function IncomingCallOverlay() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [caller, setCaller] = useState<CallerInfo | null>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const ringRef = useRef<AudioPlayer | null>(null);
  const timeoutRef = useRef<any>(null);
  const navigate = useNavigate();

  // PiP Draggable Position
  const PIP_WIDTH = 120;
  const PIP_HEIGHT = 160;
  const pan = useRef(new Animated.ValueXY({ x: width - PIP_WIDTH - 20, y: height - PIP_HEIGHT - 100 })).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    })
  ).current;

  // Pulse animation for avatar ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const handleCallEvent = (event: any) => {
      switch (event.type) {
        case 'incoming_call':
          setCaller(event.caller);
          setCallState('ringing');
          setIsVideoCall(!!event.isVideo);
          setIsMinimized(false);
          startRing();
          startPulse();
          timeoutRef.current = setTimeout(() => {
            callManager.declineCall();
          }, RING_TIMEOUT_MS);
          break;
        case 'call_answered':
          stopRing();
          setCallState('connected');
          setIsVideoCall(callManager.isVideoCall);
          setLocalStream((callManager as any).localStream);
          clearTimeout(timeoutRef.current);
          break;
        case 'call_declined':
          stopRing();
          setCallState('ended');
          clearTimeout(timeoutRef.current);
          setTimeout(() => resetState(), 2000);
          break;
        case 'call_ended':
          stopRing();
          setCallState('idle');
          resetState();
          clearTimeout(timeoutRef.current);
          break;
        case 'state_change':
          setCallState(event.state);
          if (event.caller && event.caller.email) {
            setCaller(event.caller);
          }
          if (event.state === 'calling') {
            setIsVideoCall(callManager.isVideoCall);
            setIsMinimized(false);
          }
          if (event.state === 'idle') { stopRing(); resetState(); }
          break;
        case 'remote_stream':
          setRemoteStream(event.stream);
          break;
      }
    };

    callManager.addListener(handleCallEvent);
    return () => callManager.removeListener(handleCallEvent);
  }, []);

  const resetState = () => {
    setCaller(null);
    setRemoteStream(null);
    setLocalStream(null);
    setIsMinimized(false);
    setIsVideoCall(false);
    pan.setValue({ x: width - PIP_WIDTH - 20, y: height - PIP_HEIGHT - 100 });
    pan.flattenOffset();
  };

  const startRing = async () => {
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer('https://www.soundjay.com/phone/sounds/telephone-ring-01a.mp3');
      player.loop = true;
      player.volume = 1.0;
      player.play();
      ringRef.current = player;
    } catch (e) {
      console.warn('[IncomingCallOverlay] Ring sound failed', e);
    }
  };

  const stopRing = async () => {
    try {
      if (ringRef.current) {
        ringRef.current.pause();
        ringRef.current.remove();
        ringRef.current = null;
      }
    } catch {}
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  };

  const handleAnswer = async () => {
    clearTimeout(timeoutRef.current);
    try {
      const success = await callManager.answerCall();
      if (!success) {
        console.warn('[IncomingCallOverlay] Failed to answer call');
      }
    } catch (err) {
      console.error('[IncomingCallOverlay] Answer error', err);
    }
  };

  const handleDecline = () => {
    clearTimeout(timeoutRef.current);
    callManager.declineCall();
  };

  const handleHangUp = () => {
    callManager.hangUp();
  };

  const handleAddPeople = async () => {
    if (!caller?.email) return;
    try {
      Alert.alert('Adding People...', 'Generating a meeting room to add participants.');
      
      const { user } = getSession();
      // Generate a new meeting room
      const meeting = await api.meetings.createMeeting({
        title: `${user?.name || 'User'}'s Meeting`,
        duration: 60,
      });

      // Send the meeting link to the peer via chat
      const workspaceId = user?.workspaceId || 'forge-india-connect';
      const userFound = await api.chat.searchUserByEmail(caller.email.toLowerCase());
      const chat = await api.chat.startDm([caller.email, user?.email], user?.email, workspaceId);
      
      const meetingLink = `kural://meeting/${meeting.roomId}`;
      await api.chat.sendMessage(workspaceId, chat._id, `Join me in this meeting room to add more people: ${meetingLink}`);

      // Hang up the 1-to-1 call and navigate to the meeting
      callManager.hangUp();
      navigate(`/meetings?joinCode=${meeting.roomId}`);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to generate meeting room. ' + e.message);
    }
  };

  if (callState === 'idle') return null;

  const initials = (name: string) => (name || 'U').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  if (isMinimized) {
    return (
      <Animated.View 
        style={[styles.pipContainer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity style={styles.pipExpandBtn} onPress={() => setIsMinimized(false)}>
          <Maximize2 size={16} color="#fff" />
        </TouchableOpacity>
        
        {isVideoCall && remoteStream ? (
          <View style={styles.pipVideoContainer}>
            <RTCView streamURL={remoteStream.toURL()} style={styles.pipVideo} objectFit="cover" />
          </View>
        ) : (
          <View style={[styles.avatar, { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1d4ed8' }]}>
             <Text style={styles.avatarText}>{initials(caller?.name || '')}</Text>
          </View>
        )}
      </Animated.View>
    );
  }

  const renderVideoCall = () => (
    <View style={styles.videoOverlay}>
      <SafeAreaView style={styles.videoHeaderRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setIsMinimized(true)}>
          <Minimize2 size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleAddPeople}>
          <Users size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Remote Video */}
      {remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.fullVideo} objectFit="cover" />
      ) : (
        <View style={styles.waitingContainer}>
           <Text style={styles.statusText}>{callState === 'calling' ? 'Calling...' : 'Connecting...'}</Text>
        </View>
      )}

      {/* Local Video PiP */}
      {localStream && (
        <View style={styles.localVideoPip}>
          <RTCView streamURL={localStream.toURL()} style={styles.fullVideo} objectFit="cover" mirror={true} />
        </View>
      )}

      {/* Controls */}
      <SafeAreaView style={styles.videoControls}>
        <TouchableOpacity style={[styles.declineBtn, { width: 64, height: 64, borderRadius: 32 }]} onPress={handleHangUp}>
          <PhoneOff size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );

  const renderVoiceCall = () => (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {callState === 'connected' && (
          <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16 }} onPress={() => setIsMinimized(true)}>
             <Minimize2 size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Avatar */}
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: callState === 'ringing' ? pulseAnim : 1 }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(caller?.name || '')}</Text>
          </View>
        </Animated.View>

        {/* Caller info */}
        <Text style={styles.callerName}>{caller?.name || 'Unknown'}</Text>
        <Text style={styles.callerEmail}>{caller?.email || ''}</Text>

        {/* Status text */}
        {callState === 'ringing' && <Text style={styles.statusText}>Incoming {isVideoCall ? 'video' : 'voice'} call...</Text>}
        {callState === 'calling' && <Text style={styles.statusText}>Calling...</Text>}
        {callState === 'connected' && <Text style={styles.statusText}>Call connected</Text>}
        {callState === 'ended' && <Text style={styles.statusText}>Call ended</Text>}

        {/* Buttons */}
        {callState === 'ringing' && (
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
              <PhoneOff size={28} color="#fff" />
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.answerBtn} onPress={handleAnswer}>
              {isVideoCall ? <Video size={28} color="#fff" /> : <Phone size={28} color="#fff" />}
              <Text style={styles.btnLabel}>Answer</Text>
            </TouchableOpacity>
          </View>
        )}

        {(callState === 'connected' || callState === 'calling') && (
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 32, alignItems: 'center' }}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleHangUp}>
              <PhoneOff size={28} color="#fff" />
              <Text style={styles.btnLabel}>{callState === 'calling' ? 'Cancel' : 'End Call'}</Text>
            </TouchableOpacity>
            {callState === 'connected' && (
              <TouchableOpacity style={[styles.answerBtn, { backgroundColor: '#3b82f6' }]} onPress={handleAddPeople}>
                <Users size={28} color="#fff" />
                <Text style={styles.btnLabel}>Add People</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      {isVideoCall && (callState === 'connected' || callState === 'calling') ? renderVideoCall() : renderVoiceCall()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#1f2937',
    position: 'relative'
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  callerName: { fontSize: 24, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  callerEmail: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  statusText: { fontSize: 14, color: '#9ca3af', marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 40, marginTop: 40 },
  answerBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#16a34a', shadowRadius: 12, shadowOpacity: 0.5, elevation: 8,
  },
  declineBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#dc2626',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#dc2626', shadowRadius: 12, shadowOpacity: 0.5, elevation: 8,
  },
  btnLabel: { fontSize: 11, color: '#fff', fontWeight: '600', marginTop: 4, textAlign: 'center' },
  
  // Video Calling specific
  videoOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  localVideoPip: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3b82f6',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8
  },
  videoHeaderRow: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  videoControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // PiP Global specific
  pipContainer: {
    position: 'absolute',
    width: 120,
    height: 160,
    borderRadius: 16,
    backgroundColor: '#111827',
    overflow: 'hidden',
    zIndex: 99999,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pipVideoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipExpandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
