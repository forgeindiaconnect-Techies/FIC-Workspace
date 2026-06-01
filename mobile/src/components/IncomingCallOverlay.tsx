import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing
} from 'react-native';
import { Phone, PhoneOff } from 'lucide-react-native';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { callManager, CallState, CallerInfo } from '../lib/callManager';

const RING_TIMEOUT_MS = 30_000;

export default function IncomingCallOverlay() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [caller, setCaller] = useState<CallerInfo | null>(null);
  const ringRef = useRef<AudioPlayer | null>(null);
  const timeoutRef = useRef<any>(null);

  // Pulse animation for avatar ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Wire callManager events
    callManager.onIncomingCall = (c) => {
      setCaller(c);
      setCallState('ringing');
      startRing();
      startPulse();
      timeoutRef.current = setTimeout(() => {
        callManager.declineCall();
      }, RING_TIMEOUT_MS);
    };

    callManager.onCallAnswered = () => {
      stopRing();
      setCallState('connected');
      clearTimeout(timeoutRef.current);
    };

    callManager.onCallDeclined = () => {
      stopRing();
      setCallState('ended');
      clearTimeout(timeoutRef.current);
      setTimeout(() => { setCallState('idle'); setCaller(null); }, 2000);
    };

    callManager.onCallEnded = () => {
      stopRing();
      setCallState('idle');
      setCaller(null);
      clearTimeout(timeoutRef.current);
    };

    callManager.onStateChange = (s) => {
      setCallState(s);
      if (s === 'idle') { stopRing(); setCaller(null); }
    };

    return () => {
      callManager.onIncomingCall = null;
      callManager.onCallAnswered = null;
      callManager.onCallDeclined = null;
      callManager.onCallEnded = null;
      callManager.onStateChange = null;
    };
  }, []);

  //  Ring sound 

  const startRing = async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      // Use a built-in system sound or a bundled asset
      // We generate a simple beep pattern using expo-audio oscillator workaround
      // For production, replace with: require('../../assets/ringtone.mp3')
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

  //  Pulse animation 

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  };

  //  Handlers 

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
    const success = callManager.declineCall();
    if (!success) {
      console.warn('[IncomingCallOverlay] Failed to decline call');
    }
  };

  const handleHangUp = () => {
    const success = callManager.hangUp();
    if (!success) {
      console.warn('[IncomingCallOverlay] Failed to hang up');
    }
  };

  //  Render 

  if (callState === 'idle') return null;

  const initials = (name: string) =>
    (name || 'U').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>

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
          {callState === 'ringing' && <Text style={styles.statusText}>Incoming voice call...</Text>}
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
                <Phone size={28} color="#fff" />
                <Text style={styles.btnLabel}>Answer</Text>
              </TouchableOpacity>
            </View>
          )}

          {callState === 'connected' && (
            <TouchableOpacity style={[styles.declineBtn, { alignSelf: 'center', marginTop: 32 }]} onPress={handleHangUp}>
              <PhoneOff size={28} color="#fff" />
              <Text style={styles.btnLabel}>End Call</Text>
            </TouchableOpacity>
          )}

          {callState === 'ended' && (
            <Text style={{ color: '#9ca3af', marginTop: 24 }}>Disconnected</Text>
          )}
        </View>
      </View>
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
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  callerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  callerEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 40,
  },
  answerBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowRadius: 12,
    shadowOpacity: 0.5,
    elevation: 8,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowRadius: 12,
    shadowOpacity: 0.5,
    elevation: 8,
  },
  btnLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});
