const fs = require('fs');
let content = fs.readFileSync('src/pages/MeetingApp.jsx', 'utf8');

// 1. Add import
if (!content.includes('import { useWebRTC }')) {
  content = content.replace('import MeetingLayout', 'import { useWebRTC } from \'../hooks/useWebRTC\';\nimport MeetingLayout');
}

// 2. Remove Refs
const refsToRemove = [
  'const wsRef = useRef(null);',
  'const streamRef = useRef();',
  'const screenStreamRef = useRef();',
  'const screenSendersRef = useRef(new Map());',
  'const cameraSendersRef = useRef(new Map());',
  'const candidateQueue = useRef(new Map());',
  'const iceCandidateBufferRef = useRef(new Map());',
  'const createPeerConnectionRef = useRef(null);',
  'const shouldInitiateOfferRef = useRef(null);',
  'const sendWsRef = useRef(null);'
];
refsToRemove.forEach(ref => {
  content = content.replace(ref, '');
});

// 3. Update RemoteVideo component
content = content.replace(
  /const RemoteVideo = \(\{ peer, stream, isSpeaking, mobileStyle, isScreen \}\) => \{[\s\S]*?const currentStream = stream \|\| peer\.stream;/,
  `const RemoteVideo = ({ peer, stream, isSpeaking, mobileStyle, isScreen, remoteStreamsRef, remoteScreenStreamsRef }) => {
  const videoRef = useRef();
  const [hasVideo, setHasVideo] = useState(false);
  let currentStream = stream;
  if (!currentStream && peer) {
    if (isScreen && remoteScreenStreamsRef?.current) {
      currentStream = remoteScreenStreamsRef.current.get(peer.peerID || peer.peerId);
    } else if (!isScreen && remoteStreamsRef?.current) {
      currentStream = remoteStreamsRef.current.get(peer.peerID || peer.peerId);
    } else {
      currentStream = peer.stream;
    }
  }`
);

// 4. Hook integration
const hookCall = `
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
    cleanup,
    safePlay,
    sendWs
  } = useWebRTC({
    roomId: meetingMetadata ? (meetingMetadata._id || meetingMetadata.meetingId) : code,
    token: auth.token || auth?.user?.token || localStorage.getItem('token'),
    isReady: appState === 'in-call',
    onMessage: (msg) => {
      // Simulate ws.onmessage event to keep the old logic working
      if (wsRef.current && wsRef.current.onmessage) {
         wsRef.current.onmessage({ data: JSON.stringify(msg) });
      }
    },
    onPeerTrackAdded: (peerId) => {
       setPeers(prev => [...prev]); 
    },
    onPeerLeft: (peerId) => {
       setPeers(prev => prev.filter(p => p.peerID !== peerId && p.peerId !== peerId));
       setPinnedUser(prev => (prev === peerId || prev === \`\${peerId}_screen\`) ? null : prev);
    }
  });

  const sendWsRef = useRef(sendWs);
  const createPeerConnectionRef = useRef(createPeerConnection);
  useEffect(() => {
    sendWsRef.current = sendWs;
    createPeerConnectionRef.current = createPeerConnection;
  }, [sendWs, createPeerConnection]);
`;

content = content.replace('const [performanceMode, setPerformanceMode] = useState(false);', 'const [performanceMode, setPerformanceMode] = useState(false);\n' + hookCall);

fs.writeFileSync('src/pages/MeetingApp.jsx', content);
console.log('Script completed.');
