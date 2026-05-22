/**
 * WebRTC stub for Expo Go compatibility.
 *
 * react-native-webrtc requires a custom native APK build and
 * crashes Expo Go. This stub keeps the app stable in Expo Go
 * while the APK build can swap in the real implementation.
 *
 * Camera/audio in meetings requires building a custom APK:
 *   npx eas build --profile preview --platform android
 */
import React from 'react';
import { View, Text } from 'react-native';

// Always false in Expo Go - true only in a custom APK with native WebRTC
export const isWebRTCAvailable = false;

// No-op classes - safe to instantiate, do nothing
export const RTCPeerConnectionClass: any = null;
export const RTCIceCandidateClass: any = null;
export const RTCSessionDescriptionClass: any = null;
export const mediaDevices: any = null;

// Safe RTCView placeholder - renders a dark box instead of crashing
export function RTCView(props: any) {
  return React.createElement(
    View,
    {
      style: [
        {
          backgroundColor: '#111827',
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flex: 1,
        },
        props.style,
      ],
    },
    React.createElement(
      Text,
      { style: { color: '#475569', fontSize: 11, fontWeight: '600' as const } },
      'Camera requires APK build'
    )
  );
}
