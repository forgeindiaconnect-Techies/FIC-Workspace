/**
 * WebRTC safe wrapper for react-native-webrtc.
 *
 * react-native-webrtc needs native modules compiled into the APK.
 * This wrapper gracefully handles Expo Go (no native modules) vs APK builds.
 *
 * IMPORTANT: You MUST rebuild the APK after adding react-native-webrtc.
 * Run: npx eas build --profile preview --platform android
 */

import { View, Text, StyleSheet } from 'react-native';
import React from 'react';

let _RTCPeerConnection: any = null;
let _RTCIceCandidate: any = null;
let _RTCSessionDescription: any = null;
let _mediaDevices: any = null;
let _RTCView: any = null;
let _isAvailable = false;

try {
  // registerGlobals() is required by react-native-webrtc to set up
  // global RTCPeerConnection, getUserMedia etc. on the native side
  const webrtc = require('react-native-webrtc');

  if (webrtc.registerGlobals) {
    webrtc.registerGlobals();
  }

  _RTCPeerConnection = webrtc.RTCPeerConnection;
  _RTCIceCandidate = webrtc.RTCIceCandidate;
  _RTCSessionDescription = webrtc.RTCSessionDescription;
  _mediaDevices = webrtc.mediaDevices;
  _RTCView = webrtc.RTCView;

  // Confirm native module is actually present (not just JS stubs)
  if (
    _RTCPeerConnection &&
    _mediaDevices &&
    typeof _mediaDevices.getUserMedia === 'function'
  ) {
    _isAvailable = true;
    console.log('[WebRTC] Native module loaded successfully.');
  } else {
    console.warn('[WebRTC] Module loaded but native bridge missing. Rebuild APK.');
  }
} catch (e: any) {
  console.warn('[WebRTC] Not available:', e.message);
}

// Fallback RTCView for Expo Go  shows a placeholder instead of crashing
function RTCViewFallback(props: any) {
  return React.createElement(
    View,
    { style: [{ backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }, props.style] },
    React.createElement(Text, { style: { color: '#64748b', fontSize: 12, fontWeight: '600' } }, 'Camera unavailable in Expo Go')
  );
}

export const isWebRTCAvailable: boolean = _isAvailable;
export const RTCPeerConnectionClass: any = _RTCPeerConnection;
export const RTCIceCandidateClass: any = _RTCIceCandidate;
export const RTCSessionDescriptionClass: any = _RTCSessionDescription;
export const mediaDevices: any = _mediaDevices;
export const RTCView: any = _RTCView || RTCViewFallback;
