const fs = require('fs');

let content = fs.readFileSync('src/pages/MeetingApp.jsx', 'utf8');

// 1. Add import
if (!content.includes("import { useWebRTC }")) {
  content = content.replace("import MeetingLayout", "import { useWebRTC } from '../hooks/useWebRTC';\nimport MeetingLayout");
}

// 2. Remove old refs that are now handled by useWebRTC
content = content.replace("const wsRef = useRef(null);", "");
content = content.replace("const streamRef = useRef();", "");
content = content.replace("const screenStreamRef = useRef();", "");
content = content.replace("const createPeerConnectionRef = useRef(null);", "");
content = content.replace("const sendWsRef = useRef(null);", "");

// 3. Insert useWebRTC hook call at the top of MeetingApp component (after activeSpeakers)
const hookInsertionPoint = "const [performanceMode, setPerformanceMode] = useState(false);";
const useWebRTCCode = `
  const [signalingRoomId, setSignalingRoomId] = useState(null);
  const [signalingToken, setSignalingToken] = useState(null);

  const handleSignalingMessage = useCallback((msg) => {
      // Basic event delegation for custom signaling logic (chat, kicks, etc.)
      // The core WebRTC events (offer, answer, ice-candidate) are handled by the hook if passed to it,
      // but in this setup, we'll let MeetingApp process them or let the hook handle them.
      // Wait, our useWebRTC hook currently delegates EVERYTHING to onMessage.
      // We need to keep the old ws.onmessage logic here!
  }, []);

  const {
    localStreamRef: streamRef,
    screenStreamRef,
    remoteStreamsRef,
    remoteScreenStreamsRef,
    peerConnectionsRef,
    socketRef: wsRef,
    startScreenShare: hookStartScreenShare,
    stopScreenShare: hookStopScreenShare,
    rejoinWithNewStream,
    createPeerConnection,
    handleNewPeer,
    cleanup: hookCleanup,
    safePlay,
    sendWs
  } = useWebRTC({
    roomId: signalingRoomId,
    token: signalingToken,
    isReady: appState === 'in-call',
    onMessage: (msg) => {
       // We will manually invoke the old ws.onmessage logic by simulating the event
       if (wsRef.current && wsRef.current.onmessage) {
           wsRef.current.onmessage({ data: JSON.stringify(msg) });
       }
    },
    onPeerTrackAdded: (peerId) => {
       setPeers(prev => [...prev]); // Force re-render for new tracks
    }
  });

  // Re-bind sendWsRef and createPeerConnectionRef to the new ones
  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
    sendWsRef.current = sendWs;
  }, [createPeerConnection, sendWs]);
`;

if (!content.includes("const { localStreamRef")) {
  content = content.replace(hookInsertionPoint, hookInsertionPoint + "\n" + useWebRTCCode);
}

// Write it back
fs.writeFileSync('src/pages/MeetingApp_test.jsx', content);
console.log("Refactoring applied to MeetingApp_test.jsx");
