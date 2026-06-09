// utils/rtc.ts
export const isWebRTCAvailable = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof window.RTCPeerConnection !== 'undefined'
  );
};

export const createSafePeerConnection = (
  config: RTCConfiguration
): RTCPeerConnection => {
  if (!isWebRTCAvailable()) {
    throw new Error('RTCPeerConnection not available');
  }
  return new RTCPeerConnection(config);
};
