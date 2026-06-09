import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

let nativeWebRTC: any = null;
let iframeRTCWindow: any = null;

try {
  nativeWebRTC = require('react-native-webrtc');
} catch {
  nativeWebRTC = null;
}

const getBrowserGlobal = () => {
  if (typeof globalThis !== 'undefined') return globalThis as any;
  if (typeof window !== 'undefined') return window as any;
  return null;
};

const getBrowserWindows = () => {
  const windows: any[] = [];
  const g = getBrowserGlobal();
  if (g) windows.push(g);
  if (typeof window !== 'undefined' && window !== g) windows.push(window as any);

  if (typeof document !== 'undefined') {
    try {
      if (!iframeRTCWindow) {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        iframe.style.cssText = 'display:none;width:0;height:0;border:0';
        document.documentElement.appendChild(iframe);
        iframeRTCWindow = iframe.contentWindow;
      }
      if (iframeRTCWindow) windows.push(iframeRTCWindow);
    } catch {}
  }

  return windows;
};

const firstAvailable = (names: string[]) => {
  for (const win of getBrowserWindows()) {
    for (const name of names) {
      if (win?.[name]) return win[name];
    }
  }
  return null;
};

function getNativeRTCView() {
  return nativeWebRTC?.RTCView || null;
}

function readRTCPeerConnection(): any {
  if (nativeWebRTC?.RTCPeerConnection) return nativeWebRTC.RTCPeerConnection;
  return firstAvailable(['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection', 'msRTCPeerConnection']);
}

function readRTCIceCandidate(): any {
  if (nativeWebRTC?.RTCIceCandidate) return nativeWebRTC.RTCIceCandidate;
  return firstAvailable(['RTCIceCandidate', 'webkitRTCIceCandidate']);
}

function readRTCSessionDescription(): any {
  if (nativeWebRTC?.RTCSessionDescription) return nativeWebRTC.RTCSessionDescription;
  return firstAvailable(['RTCSessionDescription', 'webkitRTCSessionDescription']);
}

function readMediaDevices(): any {
  if (nativeWebRTC?.mediaDevices) return nativeWebRTC.mediaDevices;
  if (typeof navigator === 'undefined') return null;
  return navigator.mediaDevices || null;
}

export function getRTCPeerConnectionClass(): any {
  return readRTCPeerConnection();
}

export function getRTCIceCandidateClass(): any {
  return readRTCIceCandidate();
}

export function getRTCSessionDescriptionClass(): any {
  return readRTCSessionDescription();
}

function readMediaStream(): any {
  if (nativeWebRTC?.MediaStream) return nativeWebRTC.MediaStream;
  if (typeof MediaStream !== 'undefined') return MediaStream;
  return null;
}

export function getMediaStreamClass(): any {
  return readMediaStream();
}

export function getMediaDevices(): any {
  return readMediaDevices();
}

export async function getDisplayMedia(options?: any): Promise<any> {
  const md = readMediaDevices();
  if (md && typeof md.getDisplayMedia === 'function') {
    return md.getDisplayMedia(options);
  }
  throw new Error('getDisplayMedia is not supported in this environment');
}

export function getIsWebRTCAvailable(): boolean {
  return !!readRTCPeerConnection();
}

/** STUN/TURN servers for peer connections (set EXPO_PUBLIC_TURN_* for NAT traversal). */
export function getIceServers(): Array<{ urls: string | string[]; username?: string; credential?: string }> {
  const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.EXPO_PUBLIC_TURN_USERNAME,
      credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}

/** Call once at app startup on native builds (required for react-native-webrtc). */
export function registerWebRTCGlobals() {
  try {
    nativeWebRTC?.registerGlobals?.();
  } catch {}
}

export function getWebRTCDiagnostics() {
  const g = getBrowserGlobal();
  const iframeWin = getBrowserWindows().find((win) => win === iframeRTCWindow);
  return {
    hasGlobal: !!g,
    hasRTCPeerConnection: !!g?.RTCPeerConnection,
    hasWebkitRTCPeerConnection: !!g?.webkitRTCPeerConnection,
    hasMozRTCPeerConnection: !!g?.mozRTCPeerConnection,
    hasIframeRTCPeerConnection: !!iframeWin?.RTCPeerConnection,
    hasIframeWebkitRTCPeerConnection: !!iframeWin?.webkitRTCPeerConnection,
    hasNativeRTCPeerConnection: !!nativeWebRTC?.RTCPeerConnection,
    hasMediaDevices: !!readMediaDevices(),
    hasGetUserMedia: !!readMediaDevices()?.getUserMedia,
    secureContext: typeof window === 'undefined' ? true : window.isSecureContext,
    protocol: typeof window === 'undefined' ? '' : window.location?.protocol,
    hostname: typeof window === 'undefined' ? '' : window.location?.hostname,
  };
}

// Legacy aliases. Components should prefer the runtime getters above.
export const isWebRTCAvailable: boolean = getIsWebRTCAvailable();
export const RTCPeerConnectionClass: any = readRTCPeerConnection();
export const RTCIceCandidateClass: any = readRTCIceCandidate();
export const RTCSessionDescriptionClass: any = readRTCSessionDescription();
export const mediaDevices: any = readMediaDevices();

export function RTCView(props: any) {
  const NativeRTCView = getNativeRTCView();
  if (NativeRTCView) {
    const streamURL =
      props.streamURL ||
      (typeof props.stream === 'string' ? props.stream : props.stream?.toURL?.());
    return React.createElement(NativeRTCView, {
      streamURL,
      objectFit: props.objectFit === 'contain' ? 'contain' : 'cover',
      style: props.style,
      mirror: props.mirror,
      zOrder: props.zOrder,
    });
  }

  if (readRTCPeerConnection()) {
    return React.createElement(BrowserRTCView, props);
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
      'WebRTC is unavailable in this browser'
    )
  );
}

function BrowserRTCView(props: any) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const stream =
    props.stream && typeof props.stream !== 'string'
      ? props.stream
      : typeof props.streamURL !== 'string'
        ? props.streamURL
        : null;

  const streamTracksCount = stream?.getTracks?.()?.length || 0;

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      return;
    }

    video.srcObject = stream;
    const play = () => video.play?.()?.catch?.(() => {});
    play();

    const handleAddTrack = () => {
      video.srcObject = null;
      video.srcObject = stream;
      play();
    };

    stream.addEventListener?.('addtrack', handleAddTrack);
    return () => stream.removeEventListener?.('addtrack', handleAddTrack);
  }, [stream, streamTracksCount]);

  const flattened = StyleSheet.flatten(props.style) || {};
  const fit = props.objectFit === 'contain' ? 'contain' : 'cover';

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: !!props.muted,
    style: {
      ...flattened,
      width: flattened.width || '100%',
      height: flattened.height || '100%',
      objectFit: fit,
      transform: props.mirror ? 'scaleX(-1)' : undefined,
      backgroundColor: '#111827',
    },
  });
}
