import React from 'react';
import { View, Text } from 'react-native';

let nativeWebRTC: any = null;

try {
  nativeWebRTC = require('react-native-webrtc');
} catch (err) {
  nativeWebRTC = null;
}

export const isWebRTCAvailable = !!(
  nativeWebRTC?.RTCPeerConnection &&
  nativeWebRTC?.mediaDevices &&
  nativeWebRTC?.RTCView
);

export const RTCPeerConnectionClass: any = nativeWebRTC?.RTCPeerConnection || null;
export const RTCIceCandidateClass: any = nativeWebRTC?.RTCIceCandidate || null;
export const RTCSessionDescriptionClass: any = nativeWebRTC?.RTCSessionDescription || null;
export const mediaDevices: any = nativeWebRTC?.mediaDevices || null;

const NativeRTCView = nativeWebRTC?.RTCView;

export function RTCView(props: any) {
  if (NativeRTCView) {
    return React.createElement(NativeRTCView, props);
  }

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
