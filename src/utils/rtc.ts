// utils/rtc.ts
export const getRTCPeerConnection = (): any => {
  if (typeof window === 'undefined') return null;
  return (
    window.RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection ||
    (globalThis as any).RTCPeerConnection
  );
};

export const isWebRTCAvailable = (): boolean => {
  return !!getRTCPeerConnection();
};

export const createSafePeerConnection = (
  config: RTCConfiguration
): RTCPeerConnection => {
  const PeerConnection = getRTCPeerConnection();
  if (!PeerConnection) {
    throw new Error('RTCPeerConnection not available');
  }
  return new PeerConnection(config) as RTCPeerConnection;
};
