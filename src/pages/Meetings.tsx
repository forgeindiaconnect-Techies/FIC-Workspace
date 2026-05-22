import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import {
  Video, Plus, Calendar, Clock, Users, Play, Bell, BellRing,
  Mic, MicOff, VideoOff, PhoneOff, Copy, Lock, Shield,
  X, Send, MessageSquare, LogIn, ChevronRight, Wifi, ScreenShare,
} from 'lucide-react-native';
import { api, getSession, SOCKET_URL } from '../lib/api';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const MOCK_MEETINGS = [
  { id: '1', title: 'Product Sync', time: '10:00 AM', duration: '45m', attendees: 5, color: '#2563eb', status: 'scheduled' },
  { id: '2', title: 'Design Review', time: '1:30 PM', duration: '1h', attendees: 3, color: '#7c3aed', status: 'scheduled' },
  { id: '3', title: 'Client Workshop', time: '4:00 PM', duration: '30m', attendees: 8, color: '#f97316', status: 'live' },
];
const MOCK_HISTORY = [
  { id: 'h1', title: 'Q3 Planning Sync', time: 'Yesterday', duration: '1h 15m', attendees: 8, color: '#64748b', status: 'ended' },
  { id: 'h2', title: 'Sprint Retrospective', time: 'Mon', duration: '45m', attendees: 6, color: '#64748b', status: 'ended' },
];
const ROOMS = [
  { id: 'NEXUS-BOARDROOM', title: 'General Boardroom', tag: 'BR', members: 4, color: '#2563eb' },
  { id: 'NEXUS-ENG', title: 'Developer Sandbox', tag: 'DS', members: 2, color: '#0f766e' },
  { id: 'NEXUS-DESIGN', title: 'UX Design Workshop', tag: 'UX', members: 0, color: '#7c3aed' },
];

const fmtDur = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const avatarFor = (name: string) =>
  String(name || 'U').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U';

export default function Meetings() {
  const [meetings, setMeetings] = React.useState<any[]>(MOCK_MEETINGS);
  const [history] = React.useState<any[]>(MOCK_HISTORY);
  const [reminders, setReminders] = React.useState<string[]>([]);
  const [activeRoom, setActiveRoom] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  // Modals
  const [createModal, setCreateModal] = React.useState(false);
  const [joinModal, setJoinModal] = React.useState(false);
  const [scheduleModal, setScheduleModal] = React.useState(false);
  const [roomsModal, setRoomsModal] = React.useState(false);
  const [summaryModal, setSummaryModal] = React.useState(false);
  const [summaryText, setSummaryText] = React.useState('');
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  // Form fields
  const [meetTitle, setMeetTitle] = React.useState('');
  const [meetPass, setMeetPass] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [joinPass, setJoinPass] = React.useState('');
  const [schedTitle, setSchedTitle] = React.useState('');
  const [schedDate, setSchedDate] = React.useState('2026-06-01');
  const [schedTime, setSchedTime] = React.useState('10:00 AM');
  const [schedDur, setSchedDur] = React.useState('45');

  // In-call state
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);
  const [callDur, setCallDur] = React.useState(0);
  const [sidePanel, setSidePanel] = React.useState<'chat' | 'people' | null>(null);
  const [chatMsgs, setChatMsgs] = React.useState([
    { id: '1', sender: 'System', text: 'Meeting started. Say hello!' },
  ]);
  const [chatInput, setChatInput] = React.useState('');
  const [audioLevels, setAudioLevels] = React.useState([4, 4, 4, 4, 4]);

  // Web-only camera stream (works in browser, gracefully skipped on native)
  const videoRef = React.useRef<any>(null);
  const [webStream, setWebStream] = React.useState<any>(null);
  const [camGranted, setCamGranted] = React.useState(false);

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';

  // Call timer
  React.useEffect(() => {
    let t: any;
    if (activeRoom) { t = setInterval(() => setCallDur(p => p + 1), 1000); }
    else { setCallDur(0); }
    return () => clearInterval(t);
  }, [activeRoom]);

  // Audio level animation
  React.useEffect(() => {
    let t: any;
    if (activeRoom && !isMuted) {
      t = setInterval(() => setAudioLevels([
        Math.floor(Math.random() * 55) + 10,
        Math.floor(Math.random() * 75) + 15,
        Math.floor(Math.random() * 65) + 10,
        Math.floor(Math.random() * 85) + 15,
        Math.floor(Math.random() * 45) + 10,
      ]), 150);
    } else { setAudioLevels([4, 4, 4, 4, 4]); }
    return () => clearInterval(t);
  }, [activeRoom, isMuted]);

  // Fullscreen flag
  React.useEffect(() => {
    (global as any).isFullScreenMeetingActive = !!activeRoom;
    return () => { (global as any).isFullScreenMeetingActive = false; };
  }, [activeRoom]);

  // Web camera (browser only - safe, no native module needed)
  React.useEffect(() => {
    if (activeRoom && Platform.OS === 'web' && !isVideoOff) {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            setWebStream(stream);
            setCamGranted(true);
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
              }
            }, 300);
          })
          .catch(() => setCamGranted(false));
      }
    } else {
      if (webStream) {
        webStream.getTracks().forEach((t: any) => t.stop());
        setWebStream(null);
      }
    }
    return () => {
      if (webStream) webStream.getTracks().forEach((t: any) => t.stop());
    };
  }, [activeRoom, isVideoOff]);

  // Mute web audio tracks
  React.useEffect(() => {
    if (webStream) {
      webStream.getAudioTracks().forEach((t: any) => { t.enabled = !isMuted; });
    }
  }, [isMuted, webStream]);

  // Fetch meetings
  React.useEffect(() => {
    api.meetings.getMeetings(workspaceId).then((data: any[]) => {
      if (Array.isArray(data) && data.length > 0) {
        setMeetings(data.map((m: any) => ({
          id: m._id || m.joinCode, title: m.title,
          time: new Date(m.scheduledAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: `${m.durationMinutes || 60}m`,
          attendees: m.participantIds?.length || 1,
          color: m.status === 'live' ? '#10b981' : '#2563eb',
          status: m.status || 'scheduled',
        })));
      }
    }).catch(() => {});
  }, []);

  // Enter room - CRASH-PROOF: no native module calls
  const enterRoom = async (room: any) => {
    setLoading(true);
    try {
      setActiveRoom(room);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start meeting.');
    } finally {
      setLoading(false);
    }
  };

  // End call
  const endCall = async () => {
    if (webStream) {
      webStream.getTracks().forEach((t: any) => t.stop());
      setWebStream(null);
    }
    try {
      if (activeRoom?.id && !String(activeRoom.id).startsWith('local-')) {
        await api.meetings.endMeeting(activeRoom.id);
      }
    } catch {}
    setActiveRoom(null);
    setSidePanel(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCamGranted(false);
  };

  const normalizeCode = (c: string) => {
    const t = c.trim().toUpperCase();
    const d = t.replace(/\D/g, '');
    return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : t;
  };

  const startMeeting = async () => {
    if (!meetTitle.trim()) { Alert.alert('Required', 'Enter a meeting title.'); return; }
    setLoading(true);
    try {
      const res = await api.meetings.registerLiveMeeting({ title: meetTitle, password: meetPass || undefined });
      if (res?._id) await api.meetings.startMeeting(res._id).catch(() => {});
      setCreateModal(false);
      const room = { id: res._id, title: res.title, roomId: res.joinCode, password: meetPass };
      setMeetTitle(''); setMeetPass('');
      await enterRoom(room);
    } catch {
      setCreateModal(false);
      const room = { id: 'local-' + Date.now(), title: meetTitle, roomId: 'NEX-' + Math.random().toString(36).slice(2, 8).toUpperCase(), password: meetPass };
      setMeetTitle(''); setMeetPass('');
      await enterRoom(room);
    }
  };

  const joinMeeting = async () => {
    const code = normalizeCode(joinCode);
    if (!code) { Alert.alert('Required', 'Enter a meeting ID.'); return; }
    setLoading(true);
    try {
      const res = await api.meetings.validateMeeting(code, joinPass || undefined);
      setJoinModal(false);
      const room = { id: res._id || code, title: res.title || `Room ${code}`, roomId: res.joinCode || code, password: joinPass };
      setJoinCode(''); setJoinPass('');
      await enterRoom(room);
    } catch {
      setJoinModal(false);
      const room = { id: code, title: `Room ${code}`, roomId: code, password: joinPass };
      setJoinCode(''); setJoinPass('');
      await enterRoom(room);
    }
  };

  const sendChatMsg = () => {
    if (!chatInput.trim()) return;
    setChatMsgs(p => [...p, { id: String(Date.now()), sender: 'You', text: chatInput.trim() }]);
    setChatInput('');
  };

  const generateSummary = async (id: string) => {
    setSummaryModal(true); setSummaryLoading(true); setSummaryText('');
    try {
      const res = await api.meetings.summarizeMeeting(id);
      setSummaryText(res?.summary || 'No summary available.');
    } catch { setSummaryText('Could not generate summary.'); }
    finally { setSummaryLoading(false); }
  };

  //  ACTIVE MEETING ROOM 
  if (activeRoom) {
    const localUser = user;

    return (
      <View style={s.roomRoot}>

        {/* TOP BAR */}
        <View style={s.roomTopBar}>
          <View style={s.roomTopLeft}>
            <View style={s.liveDot} />
            <Text style={s.liveLabel}>LIVE</Text>
            <View style={s.roomDivider} />
            <Text style={s.roomTitle} numberOfLines={1}>{activeRoom.title}</Text>
          </View>
          <View style={s.roomTopRight}>
            <View style={s.e2eeBadge}>
              <Shield size={11} color="#10b981" />
              <Text style={s.e2eeText}>E2EE</Text>
            </View>
            <Text style={s.roomTimer}>{fmtDur(callDur)}</Text>
          </View>
        </View>

        {/* ROOM ID STRIP */}
        <View style={s.roomIdStrip}>
          <Copy size={12} color="#64748b" />
          <Text style={s.roomIdLabel}>ID:</Text>
          <Text style={s.roomIdValue} selectable>{activeRoom.roomId || activeRoom.id}</Text>
          {activeRoom.password ? (
            <>
              <Lock size={12} color="#64748b" style={{ marginLeft: 12 }} />
              <Text style={s.roomIdLabel}>Pass:</Text>
              <Text style={s.roomIdValue}>{activeRoom.password}</Text>
            </>
          ) : null}
        </View>

        {/* MAIN BODY */}
        <View style={s.roomBody}>

          {/* VIDEO AREA */}
          <View style={s.videoArea}>

            {/* LOCAL VIDEO TILE */}
            <View style={s.videoTileFull}>
              {Platform.OS === 'web' && camGranted && webStream && !isVideoOff ? (
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  autoPlay
                  playsInline
                  muted
                />
              ) : (
                <View style={[s.videoAvatar, { backgroundColor: '#2563eb' }]}>
                  <Text style={s.videoAvatarText}>{avatarFor(localUser?.name || 'You')}</Text>
                  {!isMuted && (
                    <View style={s.waveRow}>
                      {audioLevels.map((h, i) => (
                        <View key={i} style={[s.waveBar, { height: Math.max(3, h * 0.25) }]} />
                      ))}
                    </View>
                  )}
                  {Platform.OS !== 'web' && (
                    <Text style={s.nativeCamNote}>Camera available in APK build</Text>
                  )}
                </View>
              )}
              <View style={s.namePlate}>
                <Shield size={9} color="#fff" />
                <Text style={s.namePlateText} numberOfLines={1}>
                  {localUser?.name || 'You'} (Host)
                </Text>
                {isMuted && <MicOff size={9} color="#ef4444" />}
                {isVideoOff && <VideoOff size={9} color="#ef4444" />}
              </View>
            </View>

            {/* WAITING BANNER */}
            <View style={s.waitingBanner}>
              <Users size={15} color="#64748b" />
              <Text style={s.waitingText}>Share the room ID to invite others</Text>
            </View>

          </View>

          {/* SIDE PANEL */}
          {sidePanel && (
            <View style={s.sidePanel}>
              <View style={s.sidePanelHeader}>
                <Text style={s.sidePanelTitle}>{sidePanel === 'chat' ? 'Chat' : 'People'}</Text>
                <TouchableOpacity onPress={() => setSidePanel(null)}>
                  <X size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {sidePanel === 'chat' ? (
                <View style={s.sidePanelBody}>
                  <ScrollView style={s.sideChatScroll} contentContainerStyle={{ gap: 8, padding: 12 }}>
                    {chatMsgs.map(m => (
                      <View key={m.id} style={[s.sideChatBubble, m.sender === 'You' && s.sideChatBubbleSelf]}>
                        <Text style={s.sideChatSender}>{m.sender}</Text>
                        <Text style={s.sideChatText}>{m.text}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={s.sideChatInput}>
                    <TextInput
                      style={s.sideChatField}
                      value={chatInput}
                      onChangeText={setChatInput}
                      placeholder="Message..."
                      placeholderTextColor="#64748b"
                      onSubmitEditing={sendChatMsg}
                    />
                    <TouchableOpacity style={s.sideChatSend} onPress={sendChatMsg}>
                      <Send size={15} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <ScrollView style={s.sidePanelBody}>
                  <View style={s.peerRow}>
                    <View style={[s.peerAvatar, { backgroundColor: '#2563eb' }]}>
                      <Text style={s.peerAvatarText}>{avatarFor(localUser?.name || 'You')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.peerName}>{localUser?.name || 'You'} (You)</Text>
                      <Text style={s.peerRole}>Host</Text>
                    </View>
                    <Wifi size={14} color="#10b981" />
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* CONTROL DOCK */}
        <View style={s.controlDock}>
          <TouchableOpacity
            style={[s.ctrlBtn, isMuted && s.ctrlBtnRed]}
            onPress={() => {
              if (webStream) webStream.getAudioTracks().forEach((t: any) => { t.enabled = isMuted; });
              setIsMuted(p => !p);
            }}
          >
            {isMuted ? <MicOff size={20} color="#ef4444" /> : <Mic size={20} color="#fff" />}
            <Text style={[s.ctrlLabel, isMuted && { color: '#ef4444' }]}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlBtn, isVideoOff && s.ctrlBtnRed]}
            onPress={() => {
              if (webStream) webStream.getVideoTracks().forEach((t: any) => { t.enabled = isVideoOff; });
              setIsVideoOff(p => !p);
            }}
          >
            {isVideoOff ? <VideoOff size={20} color="#ef4444" /> : <Video size={20} color="#fff" />}
            <Text style={[s.ctrlLabel, isVideoOff && { color: '#ef4444' }]}>{isVideoOff ? 'Start Cam' : 'Stop Cam'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlBtn, sidePanel === 'people' && s.ctrlBtnBlue]}
            onPress={() => setSidePanel(p => p === 'people' ? null : 'people')}
          >
            <Users size={20} color={sidePanel === 'people' ? '#3b82f6' : '#fff'} />
            <Text style={[s.ctrlLabel, sidePanel === 'people' && { color: '#3b82f6' }]}>People</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.ctrlBtn, sidePanel === 'chat' && s.ctrlBtnBlue]}
            onPress={() => setSidePanel(p => p === 'chat' ? null : 'chat')}
          >
            <MessageSquare size={20} color={sidePanel === 'chat' ? '#3b82f6' : '#fff'} />
            <Text style={[s.ctrlLabel, sidePanel === 'chat' && { color: '#3b82f6' }]}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.endCallBtn} onPress={endCall}>
            <PhoneOff size={22} color="#fff" />
            <Text style={[s.ctrlLabel, { color: '#fff' }]}>Leave</Text>
          </TouchableOpacity>
        </View>

      </View>
    );
  }

  //  MEETINGS HOME SCREEN 
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* QUICK ACTIONS */}
      <View style={s.quickGrid}>
        <TouchableOpacity style={[s.quickCard, { backgroundColor: '#2563eb' }]} onPress={() => setCreateModal(true)}>
          <View style={s.quickIcon}><Plus size={22} color="#fff" /></View>
          <Text style={s.quickTitle}>New Meeting</Text>
          <Text style={s.quickSub}>Start instantly</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickCard, { backgroundColor: '#4f46e5' }]} onPress={() => setJoinModal(true)}>
          <View style={s.quickIcon}><LogIn size={22} color="#fff" /></View>
          <Text style={s.quickTitle}>Join</Text>
          <Text style={s.quickSub}>Enter room code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickCard, s.quickCardLight]} onPress={() => setScheduleModal(true)}>
          <View style={[s.quickIcon, { backgroundColor: '#f1f5f9' }]}><Calendar size={22} color="#475569" /></View>
          <Text style={[s.quickTitle, { color: '#0f172a' }]}>Schedule</Text>
          <Text style={[s.quickSub, { color: '#64748b' }]}>Plan ahead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickCard, s.quickCardLight]} onPress={() => setRoomsModal(true)}>
          <View style={[s.quickIcon, { backgroundColor: '#f1f5f9' }]}><Users size={22} color="#475569" /></View>
          <Text style={[s.quickTitle, { color: '#0f172a' }]}>Rooms</Text>
          <Text style={[s.quickSub, { color: '#64748b' }]}>Persistent spaces</Text>
        </TouchableOpacity>
      </View>

      {/* PERSISTENT ROOMS */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Persistent Rooms</Text>
        {ROOMS.map(room => (
          <TouchableOpacity key={room.id} style={s.roomCard} onPress={async () => {
            setLoading(true);
            try {
              const res = await api.meetings.validateMeeting(room.id, undefined);
              await enterRoom({ id: res._id || room.id, title: res.title || room.title, roomId: res.joinCode || room.id });
            } catch {
              await enterRoom({ id: room.id, title: room.title, roomId: room.id });
            } finally { setLoading(false); }
          }}>
            <View style={[s.roomTag, { backgroundColor: room.color + '20' }]}>
              <Text style={[s.roomTagText, { color: room.color }]}>{room.tag}</Text>
            </View>
            <View style={s.roomCardInfo}>
              <Text style={s.roomCardTitle}>{room.title}</Text>
              <Text style={s.roomCardId}>{room.id}</Text>
            </View>
            <View style={[s.memberBadge, { backgroundColor: room.members > 0 ? '#dcfce7' : '#f1f5f9' }]}>
              <View style={[s.memberDot, { backgroundColor: room.members > 0 ? '#22c55e' : '#94a3b8' }]} />
              <Text style={[s.memberText, { color: room.members > 0 ? '#15803d' : '#64748b' }]}>{room.members} online</Text>
            </View>
            <ChevronRight size={16} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </View>

      {/* TODAY'S AGENDA */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Today's Agenda</Text>
        {meetings.map(m => (
          <TouchableOpacity key={m.id} style={s.meetCard} onPress={async () => {
            setLoading(true);
            try {
              const res = await api.meetings.validateMeeting(String(m.id), undefined);
              await enterRoom({ id: res._id || m.id, title: res.title || m.title, roomId: res.joinCode || m.id });
            } catch { await enterRoom(m); }
            finally { setLoading(false); }
          }}>
            <View style={[s.meetColorBar, { backgroundColor: m.color }]} />
            <View style={[s.meetIconBox, { backgroundColor: m.color + '20' }]}>
              {m.status === 'live' ? <Play size={18} color={m.color} fill={m.color} /> : <Clock size={18} color={m.color} />}
            </View>
            <View style={s.meetInfo}>
              <View style={s.meetTitleRow}>
                <Text style={s.meetTitle}>{m.title}</Text>
                {m.status === 'live' && <View style={s.livePill}><Text style={s.livePillText}>LIVE</Text></View>}
                {reminders.includes(m.id) && <BellRing size={13} color="#2563eb" />}
              </View>
              <View style={s.meetMeta}>
                <Clock size={12} color="#94a3b8" />
                <Text style={s.meetMetaText}>{m.time}</Text>
                <Users size={12} color="#94a3b8" style={{ marginLeft: 10 }} />
                <Text style={s.meetMetaText}>{m.attendees}</Text>
                <Text style={s.meetDur}>{m.duration}</Text>
              </View>
            </View>
            <View style={s.meetActions}>
              <TouchableOpacity
                style={[s.bellBtn, reminders.includes(m.id) && s.bellBtnActive]}
                onPress={() => setReminders(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
              >
                <Bell size={15} color={reminders.includes(m.id) ? '#fff' : '#94a3b8'} />
              </TouchableOpacity>
              <View style={[s.joinPill, { backgroundColor: m.color }]}>
                <Text style={s.joinPillText}>Join</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* RECENT MEETINGS */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Recent Meetings</Text>
        {history.map(m => (
          <View key={m.id} style={s.histCard}>
            <View style={[s.histIcon, { backgroundColor: '#f1f5f9' }]}><Clock size={18} color="#64748b" /></View>
            <View style={s.meetInfo}>
              <Text style={s.meetTitle}>{m.title}</Text>
              <View style={s.meetMeta}>
                <Calendar size={12} color="#94a3b8" />
                <Text style={s.meetMetaText}>{m.time}</Text>
                <Users size={12} color="#94a3b8" style={{ marginLeft: 10 }} />
                <Text style={s.meetMetaText}>{m.attendees} attended</Text>
              </View>
            </View>
            <TouchableOpacity style={s.summaryBtn} onPress={() => generateSummary(m.id)}>
              <Text style={s.summaryBtnText}>AI Summary</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* LOADING OVERLAY */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={s.loadingText}>Connecting...</Text>
        </View>
      )}

      {/* CREATE MODAL */}
      <Modal visible={createModal} animationType="slide" transparent onRequestClose={() => setCreateModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTopRow}>
              <Text style={s.modalTitle}>New Meeting</Text>
              <TouchableOpacity onPress={() => setCreateModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            </View>
            <View style={s.formGroup}>
              <Text style={s.fieldLabel}>Title</Text>
              <TextInput style={s.modalInput} value={meetTitle} onChangeText={setMeetTitle} placeholder="Meeting topic" placeholderTextColor="#94a3b8" />
            </View>
            <View style={s.formGroup}>
              <Text style={s.fieldLabel}>Passcode (optional)</Text>
              <TextInput style={s.modalInput} value={meetPass} onChangeText={setMeetPass} placeholder="Leave blank for open access" placeholderTextColor="#94a3b8" secureTextEntry />
            </View>
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setCreateModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={startMeeting} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Start Now</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* JOIN MODAL */}
      <Modal visible={joinModal} animationType="slide" transparent onRequestClose={() => setJoinModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTopRow}>
              <Text style={s.modalTitle}>Join Meeting</Text>
              <TouchableOpacity onPress={() => setJoinModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            </View>
            <View style={s.formGroup}>
              <Text style={s.fieldLabel}>Meeting ID</Text>
              <TextInput style={s.modalInput} value={joinCode} onChangeText={setJoinCode} placeholder="e.g. 123-456-789" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
            </View>
            <View style={s.formGroup}>
              <Text style={s.fieldLabel}>Passcode (if required)</Text>
              <TextInput style={s.modalInput} value={joinPass} onChangeText={setJoinPass} placeholder="Leave blank if none" placeholderTextColor="#94a3b8" secureTextEntry />
            </View>
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setJoinModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={joinMeeting} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Join Session</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SCHEDULE MODAL */}
      <Modal visible={scheduleModal} animationType="slide" transparent onRequestClose={() => setScheduleModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTopRow}>
              <Text style={s.modalTitle}>Schedule Meeting</Text>
              <TouchableOpacity onPress={() => setScheduleModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            </View>
            {[
              { label: 'Title', val: schedTitle, set: setSchedTitle, ph: 'Sprint Planning' },
              { label: 'Date (YYYY-MM-DD)', val: schedDate, set: setSchedDate, ph: '2026-06-01' },
              { label: 'Time', val: schedTime, set: setSchedTime, ph: '10:00 AM' },
              { label: 'Duration (minutes)', val: schedDur, set: setSchedDur, ph: '45' },
            ].map(f => (
              <View key={f.label} style={s.formGroup}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <TextInput style={s.modalInput} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor="#94a3b8" />
              </View>
            ))}
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setScheduleModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={async () => {
                try {
                  await api.meetings.registerLiveMeeting({ title: schedTitle, startTime: new Date(`${schedDate}T12:00:00`), duration: parseInt(schedDur) || 45 });
                  Alert.alert('Scheduled', `"${schedTitle}" scheduled for ${schedDate}`);
                } catch { Alert.alert('Saved', `"${schedTitle}" saved locally.`); }
                setScheduleModal(false);
              }}>
                <Text style={s.primaryBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ROOMS MODAL */}
      <Modal visible={roomsModal} animationType="slide" transparent onRequestClose={() => setRoomsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTopRow}>
              <Text style={s.modalTitle}>Persistent Rooms</Text>
              <TouchableOpacity onPress={() => setRoomsModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            </View>
            {ROOMS.map(room => (
              <TouchableOpacity key={room.id} style={s.roomModalItem} onPress={async () => {
                setRoomsModal(false); setLoading(true);
                try {
                  const res = await api.meetings.validateMeeting(room.id, undefined);
                  await enterRoom({ id: res._id || room.id, title: res.title || room.title, roomId: res.joinCode || room.id });
                } catch { await enterRoom({ id: room.id, title: room.title, roomId: room.id }); }
                finally { setLoading(false); }
              }}>
                <View style={[s.roomTag, { backgroundColor: room.color + '20' }]}>
                  <Text style={[s.roomTagText, { color: room.color }]}>{room.tag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.roomModalTitle}>{room.title}</Text>
                  <Text style={s.roomModalId}>{room.id}</Text>
                </View>
                <View style={[s.memberBadge, { backgroundColor: room.members > 0 ? '#dcfce7' : '#f1f5f9' }]}>
                  <Text style={[s.memberText, { color: room.members > 0 ? '#15803d' : '#64748b' }]}>{room.members} online</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setRoomsModal(false)}>
              <Text style={s.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SUMMARY MODAL */}
      <Modal visible={summaryModal} animationType="slide" transparent onRequestClose={() => setSummaryModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            <View style={s.modalTopRow}>
              <Text style={s.modalTitle}>AI Summary</Text>
              <TouchableOpacity onPress={() => setSummaryModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {summaryLoading ? (
                <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
                  <ActivityIndicator size="large" color="#7c3aed" />
                  <Text style={{ color: '#64748b', fontSize: 14 }}>Generating summary...</Text>
                </View>
              ) : (
                <Text style={s.summaryBody}>{summaryText}</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setSummaryModal(false)}>
              <Text style={s.primaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Home
  container: { flex: 1 },
  content: { paddingBottom: 40, gap: 28 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { flex: 1, minWidth: isMobile ? (width - 40 - 12) / 2 : 180, borderRadius: 24, padding: 20, gap: 10 },
  quickCardLight: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  quickIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  quickSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  section: { gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  roomCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  roomTag: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roomTagText: { fontSize: 14, fontWeight: '900' },
  roomCardInfo: { flex: 1 },
  roomCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  roomCardId: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  memberDot: { width: 7, height: 7, borderRadius: 4 },
  memberText: { fontSize: 11, fontWeight: '700' },
  meetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12, overflow: 'hidden' },
  meetColorBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  meetIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  meetInfo: { flex: 1, minWidth: 0 },
  meetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meetTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  livePill: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  livePillText: { fontSize: 9, fontWeight: '900', color: '#15803d', textTransform: 'uppercase' },
  meetMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  meetMetaText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  meetDur: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginLeft: 8 },
  meetActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  bellBtnActive: { backgroundColor: '#2563eb' },
  joinPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  joinPillText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  histCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  histIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  summaryBtnText: { fontSize: 11, fontWeight: '800', color: '#7c3aed' },
  summaryBody: { fontSize: 14, color: '#334155', lineHeight: 22, padding: 4 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 99 },
  loadingText: { fontSize: 14, color: '#64748b', fontWeight: '700' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 14 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  formGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  primaryBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  roomModalItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#f8fafc', gap: 12, marginBottom: 8 },
  roomModalTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  roomModalId: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  // Meeting room
  roomRoot: { flex: 1, backgroundColor: '#0a0f1e' },
  roomTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  roomTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  liveLabel: { fontSize: 10, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  roomDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)' },
  roomTitle: { fontSize: 15, fontWeight: '800', color: '#fff', flex: 1 },
  roomTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  e2eeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  e2eeText: { fontSize: 10, fontWeight: '900', color: '#10b981' },
  roomTimer: { fontSize: 14, fontWeight: '900', color: '#10b981', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  roomIdStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)', gap: 6 },
  roomIdLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  roomIdValue: { fontSize: 12, fontWeight: '700', color: '#60a5fa' },
  roomBody: { flex: 1, flexDirection: 'row' },
  videoArea: { flex: 1, padding: 8, gap: 8 },
  videoTileFull: { flex: 1, backgroundColor: '#111827', borderRadius: 16, overflow: 'hidden', position: 'relative', minHeight: 200 },
  videoAvatar: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  videoAvatarText: { fontSize: 36, fontWeight: '900', color: '#fff' },
  nativeCamNote: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  waveBar: { width: 3, backgroundColor: '#10b981', borderRadius: 2, minHeight: 3 },
  namePlate: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  namePlateText: { flex: 1, fontSize: 11, fontWeight: '800', color: '#fff' },
  waitingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12 },
  waitingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  sidePanel: { width: 280, backgroundColor: 'rgba(15,23,42,0.97)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.06)' },
  sidePanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sidePanelTitle: { fontSize: 14, fontWeight: '900', color: '#fff' },
  sidePanelBody: { flex: 1 },
  sideChatScroll: { flex: 1 },
  sideChatBubble: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 10, gap: 3, alignSelf: 'flex-start', maxWidth: '85%' },
  sideChatBubbleSelf: { backgroundColor: '#2563eb', alignSelf: 'flex-end' },
  sideChatSender: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
  sideChatText: { fontSize: 13, color: '#fff', lineHeight: 18 },
  sideChatInput: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  sideChatField: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#fff' },
  sideChatSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  peerRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  peerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  peerAvatarText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  peerName: { fontSize: 13, fontWeight: '800', color: '#fff' },
  peerRole: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  controlDock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, paddingVertical: 14, backgroundColor: 'rgba(15,23,42,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  ctrlBtn: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, minWidth: 52 },
  ctrlBtnRed: { backgroundColor: 'rgba(239,68,68,0.15)' },
  ctrlBtnBlue: { backgroundColor: 'rgba(59,130,246,0.15)' },
  ctrlLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', textAlign: 'center' },
  endCallBtn: { alignItems: 'center', gap: 5, backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
});
