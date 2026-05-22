/**
 * WebRTC wrapper that safely imports react-native-webrtc.
 *
 * react-native-webrtc requires native modules (camera, audio) that are
 * only available in a custom development build or production APK.
 * In Expo Go (standard sandbox), these native modules are not present.
 *
 * This wrapper detects availability and exports either the real
 * react-native-webrtc classes or safe no-op stubs so the app
 * does not crash in Expo Go.
 */

let _RTCPeerConnection: any = null;
let _RTCIceCandidate: any = null;
let _RTCSessionDescription: any = null;
let _mediaDevices: any = null;
let _RTCView: any = null;
let _isAvailable = false;

try {
  const webrtc = require('react-native-webrtc');
  _RTCPeerConnection = webrtc.RTCPeerConnection;
  _RTCIceCandidate = webrtc.RTCIceCandidate;
  _RTCSessionDescription = webrtc.RTCSessionDescription;
  _mediaDevices = webrtc.mediaDevices;
  _RTCView = webrtc.RTCView;
  // Verify the native module is actually loaded (not just JS stubs)
  if (_mediaDevices && typeof _mediaDevices.getUserMedia === 'function') {
    _isAvailable = true;
  }
} catch (e) {
  console.warn('[WebRTC] react-native-webrtc not available (Expo Go). Use a dev build APK for camera/audio.');
}

export const isWebRTCAvailable = _isAvailable;
export const RTCPeerConnection = _RTCPeerConnection;
export const RTCIceCandidate = _RTCIceCandidate;
export const RTCSessionDescription = _RTCSessionDescription;
export const mediaDevices = _mediaDevices;
export const RTCView = _RTCView;
