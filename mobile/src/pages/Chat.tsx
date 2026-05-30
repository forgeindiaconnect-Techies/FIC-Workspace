import React from 'react';
import tw from 'twrnc';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from '../lib/router';
import {
  ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Image, useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import {
  CheckCheck, ChevronLeft, Mic, MicOff, PhoneOff,
  Plus, Search, Send, Shield, ShieldCheck, Users, X, UserPlus,
  MessageSquare, MoreVertical, Paperclip, Camera, Hash,
  Bell, Star, Smile, Edit, Edit3, Edit2, Home, Grid, FileText
} from 'lucide-react-native';
import { api, getSession, SOCKET_URL } from '../lib/api';
import { getRTCPeerConnectionClass, getMediaDevices, getIceServers, RTCView } from '../lib/webrtc';
import { callManager } from '../lib/callManager';



/* --- helpers ----------------------------------------------- */
const avatarFor = (name: string) => {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U';
};
const formatTime = (v?: string | Date) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getFileLabel = (fileData: { originalName?: string; url?: string } | null | undefined) => {
  const name = String(fileData?.originalName || '').trim();
  if (name) return name;
  const fromUrl = String(fileData?.url || '').split('/').pop() || '';
  if (fromUrl) return fromUrl;
  return 'Attachment';
};

const uniqueMessages = (items: any[]) => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const m of items || []) {
    const idKey = m?.id ? `id:${m.id}` : '';
    const fp =
      idKey ||
      `fp:${String(m?.user || '').toLowerCase()}|${String(m?.time || '')}|${String(m?.text || '')}`;
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(m);
  }
  return out;
};

/* --- avatar colors ------------------------------------------ */
const AVATAR_COLORS = ['#006b5e','#4c5b71','#96f3e1','#d5e3fc','#74777d','#0d1c2e'];
const colorFor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

export default function Chat() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const s = React.useMemo(() => getStyles(width, height, isMobile), [width, height, isMobile]);
  const navigate = useNavigate();
  
  /* -- state -- */
  const [tab, setTab] = React.useState<'chats'|'groups'|'calls'|'status'>('chats');
  const [selectedChat, setSelectedChat] = React.useState<any>(null);
  const [directMessages, setDirectMessages] = React.useState<any[]>([]);
  const [groupMessages, setGroupMessages] = React.useState<any[]>([]);
  const [groupedStatuses, setGroupedStatuses] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>([{ id: 'init', user: 'Workspace', time: 'Now', text: 'Select a chat to start messaging.', self: false }]);
  const [inputVal, setInputVal] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loadingChannels, setLoadingChannels] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [uploadingFile, setUploadingFile] = React.useState(false);

  /* modals */
  const [addMemberModal, setAddMemberModal] = React.useState(false);
  const [createGroupModal, setCreateGroupModal] = React.useState(false);
  const [statusCreatorOpen, setStatusCreatorOpen] = React.useState(false);
  const [statusViewerData, setStatusViewerData] = React.useState<any>(null); // The user object containing statuses
  const [statusActiveIndex, setStatusActiveIndex] = React.useState(0);
  const [statusPaused, setStatusPaused] = React.useState(false);
  const [audioCallModal, setAudioCallModal] = React.useState(false);
  const [plusMenu, setPlusMenu] = React.useState(false);
  const [appsMenu, setAppsMenu] = React.useState(false);
  const [chatOptionsOpen, setChatOptionsOpen] = React.useState(false);

  /* add member form */
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPass, setNewPass] = React.useState('password123');
  const [savingMember, setSavingMember] = React.useState(false);

  /* create group form */
  const [groupName, setGroupName] = React.useState('');
  const [groupDesc, setGroupDesc] = React.useState('');

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';
  const email = user?.email || 'admin@fic.com';

  /* -- call logic via callManager (separate from Meetings /ws/webrtc) -- */
  const [callState, setCallState] = React.useState<'idle'|'calling'|'connected'|'ended'>('idle');
  const [callDuration, setCallDuration] = React.useState(0);
  const [callMuted, setCallMuted] = React.useState(false);

  React.useEffect(() => {
    let t: any;
    if (callState === 'connected') {
      t = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(t);
  }, [callState]);

  // Sync callManager state into local React state for the in-chat active call UI
  React.useEffect(() => {
    callManager.onStateChange = (s) => {
      setCallState(s as any);
      if (s === 'calling' || s === 'connected') setAudioCallModal(true);
      if (s === 'idle' || s === 'ended') setAudioCallModal(false);
    };
    return () => { callManager.onStateChange = null; };
  }, []);

  const startCall = async () => {
    if (!selectedChat || !user) return;
    
    try {
      const success = await callManager.startCall(
        selectedChat.email,
        selectedChat.name,
        user.name || email
      );
      
      if (success) {
        setAudioCallModal(true);
        setCallState('calling');
      } else {
        Alert.alert('Call Failed', 'Unable to initiate call. User may be offline or not reachable.');
        setCallState('idle');
      }
    } catch (err) {
      console.error('[Chat] startCall error', err);
      Alert.alert('Call Error', 'An error occurred while trying to call.');
      setCallState('idle');
    }
  };

  const endCall = () => {
    const success = callManager.hangUp();
    if (success) {
      setAudioCallModal(false);
      setCallState('idle');
    }
  };

  const toggleMute = () => {
    const muted = callManager.toggleMute();
    setCallMuted(!!muted);
  };

  const fmtCall = (s: number) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  /* -- file upload -- */
  const pickDocument = async () => {
    if (uploadingFile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingFile(true);

    try {
      const uploadResult = await api.chat.uploadFile(asset.uri, asset.mimeType || 'application/octet-stream', asset.fileName || 'file');
      setPlusMenu(false);
      await handleSendWithFile(uploadResult);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSendWithFile = async (fileData: { url: string; type: string; originalName: string }) => {
    if (!selectedChat) return;
    const content = '';
    const oid = String(Date.now());
    const fileLabel = getFileLabel(fileData);
    const opt = { id: oid, user: 'You', time: formatTime(new Date()), text: `Sent a file: ${fileLabel}`, self: true, fileUrl: fileData.url, fileType: fileData.type, originalName: fileLabel };
    setMessages(p => uniqueMessages([...p, opt]));
    setDirectMessages(p => p.map(c => c.id === selectedChat.id ? { ...c, lastMsg: `Sent a file: ${fileLabel}`, time: opt.time } : c));
    try {
      const saved = await api.chat.sendMessage(workspaceId, selectedChat.id, content, fileData);
      setMessages(p => p.map(m => m.id === oid ? {
        id: saved._id, user: saved.sender || 'You',
        time: formatTime(saved.timestamp), text: saved.content || `Sent a file: ${saved.originalName || fileLabel}`, self: true,
        fileUrl: saved.fileUrl, fileType: saved.fileType, originalName: saved.originalName || fileLabel
      } : m));
    } catch (e: any) { Alert.alert('Send failed', e.message); }
  };

  /* -- load channels & stories -- */
  const loadChannels = React.useCallback(async () => {
    setLoadingChannels(true);
    try {
      const [data, groupsData, storiesData] = await Promise.all([
        api.chat.getChannels(workspaceId, email),
        api.chat.getGroups(workspaceId, email),
        api.chat.getStories(workspaceId)
      ]);
      const mapped = Array.isArray(data) ? data.map((ch: any) => ({
        id: ch._id, name: ch.displayName || ch.name || ch.email,
        email: ch.email, online: ch.isOnline !== false,
        lastMsg: ch.lastMessageContent || 'Start a conversation',
        time: formatTime(ch.lastMessageTime), unread: 0,
        avatar: ch.avatar || avatarFor(ch.displayName || ch.name || ch.email),
        role: ch.role || 'Member', type: 'dm',
      })) : [];
      setDirectMessages(mapped);
      
      const gMapped = Array.isArray(groupsData) ? groupsData.map((g: any) => ({
        id: g._id, name: g.displayName || g.name,
        lastMsg: g.lastMessageContent || 'Group started',
        time: formatTime(g.lastMessageTime), unread: 0,
        avatar: avatarFor(g.displayName || g.name),
        type: 'group',
      })) : [];
      setGroupMessages(gMapped);

      setGroupedStatuses(Array.isArray(storiesData) ? storiesData : []);
    } catch {
      setDirectMessages([]);
      setGroupMessages([]);
      setGroupedStatuses([]);
    } finally { setLoadingChannels(false); }
  }, [workspaceId, email, user?.id]);

  React.useEffect(() => { loadChannels(); }, [loadChannels]);

  /* -- load messages -- */
  React.useEffect(() => {
    if (!selectedChat) return;
    setLoadingMessages(true);
    api.chat.getMessages(workspaceId, selectedChat.id)
      .then((data: any[]) => {
        const mapped = Array.isArray(data) ? data.map((m: any) => ({
          id: m._id, user: m.sender || m.senderName,
          time: formatTime(m.timestamp), text: m.content || (m.fileUrl ? `Sent a file: ${m.originalName || 'Attachment'}` : ''),
          self: m.senderEmail === email || m.sender === 'You',
          fileUrl: m.fileUrl,
          fileType: m.fileType,
          originalName: m.originalName,
        })) : [];
        const deduped = uniqueMessages(mapped);
        setMessages(deduped.length ? deduped : [{ id: 'init', user: 'Workspace', time: 'Now', text: 'Start your conversation here.', self: false }]);
      })
      .catch(() => setMessages([{ id: 'err', user: 'System', time: 'Now', text: 'Failed to load.', self: false }]))
      .finally(() => setLoadingMessages(false));
  }, [selectedChat, workspaceId, email]);

  const activeList = tab === 'groups' ? groupMessages : directMessages;
  const filteredChats = activeList.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    return !q || `${c.name} ${c.email || ''} ${c.lastMsg}`.toLowerCase().includes(q);
  });

  /* -- send message -- */
  const handleSend = async () => {
    const content = inputVal.trim();
    if (!content || !selectedChat) return;
    const oid = String(Date.now());
    const opt = { id: oid, user: 'You', time: formatTime(new Date()), text: content, self: true };
    setMessages(p => uniqueMessages([...p, opt]));
    setInputVal('');
    setDirectMessages(p => p.map(c => c.id === selectedChat.id ? { ...c, lastMsg: content, time: opt.time } : c));
    try {
      const saved = await api.chat.sendMessage(workspaceId, selectedChat.id, content);
      setMessages(p => p.map(m => m.id === oid ? {
        id: saved._id, user: saved.sender || 'You',
        time: formatTime(saved.timestamp), text: saved.content, self: true,
      } : m));
    } catch (e: any) { Alert.alert('Send failed', e.message); }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat?.id) return;
    setChatOptionsOpen(false);
    Alert.alert(
      'Delete chat?',
      'This will permanently delete this conversation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.chat.deleteConversation(selectedChat.id);
              // Keep the chat selectable, but clear its history in UI.
              setMessages([{ id: 'init', user: 'Workspace', time: 'Now', text: 'Start your conversation here.', self: false }]);
              await loadChannels();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message || 'Unable to delete this chat.');
            }
          },
        },
      ]
    );
  };

  /* -- search and add user -- */
  const handleFindUser = async () => {
    if (!newEmail.trim()) { Alert.alert('Required', 'Email needed.'); return; }
    setSavingMember(true);
    try {
      const userFound = await api.chat.searchUserByEmail(newEmail.trim().toLowerCase());
      await api.chat.startDm([userFound.email, email], email, workspaceId);
      setAddMemberModal(false); setNewEmail('');
      await loadChannels();
      Alert.alert('Done', 'Chat started!');
    } catch (e: any) { Alert.alert('Error', e.message || 'User not found.'); }
    finally { setSavingMember(false); }
  };
  
  /* -- create group -- */
  const handleCreateGroup = async () => {
    if (!groupName.trim()) { Alert.alert('Required', 'Group name needed.'); return; }
    setSavingMember(true);
    try {
      await api.chat.createGroup(workspaceId, groupName.trim(), []);
      setCreateGroupModal(false); setGroupName('');
      await loadChannels();
      Alert.alert('Done', 'Group created!');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSavingMember(false); }
  };

  /* -- post story -- */
  const handlePostStatus = async (statusData: { mediaType: string, mediaUrl?: string, content?: string, bgColor?: string }) => {
    try {
      await api.chat.postStory(workspaceId, statusData);
      await loadChannels();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  /* ------------------------------------------------------------
     AUDIO CALL MODAL
  ------------------------------------------------------------ */
  const renderAudioCallModal = () => (
    <Modal visible={audioCallModal} animationType="slide" transparent onRequestClose={endCall}>
      <View style={s.callOverlay}>
        <View style={s.callCard}>
          {/* avatar */}
          <View style={[s.callAvatar, { backgroundColor: selectedChat ? colorFor(selectedChat.id) : '#0f766e' }]}>
            <Text style={s.callAvatarText}>{selectedChat ? (selectedChat.avatar || avatarFor(selectedChat.name)) : 'ME'}</Text>
          </View>
          <Text style={s.callName}>{selectedChat?.name || 'Unknown'}</Text>
          <Text style={s.callStatus}>{callState === 'connected' ? fmtCall(callDuration) : 'Calling...'}</Text>

          {/* wave animation placeholder */}
          <View style={s.callWaveRow}>
            {[1,2,3,4,5,6,7].map(i => (
              <View key={i} style={[s.callWaveBar, { height: callState === 'connected' ? 8 + (i % 3) * 14 : 8 }]} />
            ))}
          </View>

          {/* controls */}
          <View style={s.callControls}>
            <TouchableOpacity style={[s.callCtrlBtn, callMuted && s.callCtrlRed]} onPress={toggleMute}>
              {callMuted ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
              <Text style={s.callCtrlLabel}>{callMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.callEndBtn} onPress={endCall}>
              <PhoneOff size={26} color="#fff" />
              <Text style={s.callCtrlLabel}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );


  /* ------------------------------------------------------------
     STATUS CREATOR MODAL
  ------------------------------------------------------------ */
  const renderStatusCreatorModal = () => {
    if (!statusCreatorOpen) return null;
    return (
      <Modal visible={statusCreatorOpen} animationType="slide" transparent onRequestClose={() => setStatusCreatorOpen(false)}>
        <View style={tw`flex-1 bg-black justify-between`}>
          <View style={tw`flex-row justify-between items-center px-4 pt-12 pb-4`}>
            <TouchableOpacity onPress={() => setStatusCreatorOpen(false)}>
              <X size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={tw`text-white font-bold text-lg`}>New Status</Text>
            <View style={tw`w-7`} />
          </View>
          
          <View style={tw`flex-1 items-center justify-center p-4`}>
            <TextInput 
              style={tw`text-white text-3xl text-center w-full`}
              placeholder="Type a status"
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              autoFocus
              value={inputVal}
              onChangeText={setInputVal}
            />
          </View>

          <View style={tw`flex-row items-center justify-between p-4 pb-8 bg-black/50`}>
            <TouchableOpacity style={tw`p-2 bg-white/20 rounded-full`} onPress={async () => {
              const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
              if (!res.canceled && res.assets?.[0]) {
                const asset = res.assets[0];
                setUploadingFile(true);
                try {
                  const uploaded = await api.chat.uploadFile(asset.uri, asset.mimeType || 'image/jpeg', asset.fileName || 'status.jpg');
                  await handlePostStatus({ mediaType: asset.type === 'video' ? 'video' : 'image', mediaUrl: uploaded.url, content: inputVal });
                  setStatusCreatorOpen(false);
                  setInputVal('');
                } catch (e: any) { Alert.alert('Upload Failed', e.message); }
                finally { setUploadingFile(false); }
              }
            }}>
              <Camera size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={tw`w-14 h-14 bg-[#25D366] rounded-full items-center justify-center`} disabled={uploadingFile || (!inputVal.trim())} onPress={async () => {
              if (!inputVal.trim()) return;
              await handlePostStatus({ mediaType: 'text', content: inputVal, bgColor: '#FF5722' });
              setStatusCreatorOpen(false);
              setInputVal('');
            }}>
              {uploadingFile ? <ActivityIndicator color="#fff" /> : <Send size={24} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  /* ------------------------------------------------------------
     STATUS VIEWER MODAL
  ------------------------------------------------------------ */
  const videoRef = React.useRef<Video>(null);

  React.useEffect(() => {
    if (!statusViewerData || statusPaused) return;
    const statuses = statusViewerData.statuses || [];
    if (statuses.length === 0) return;

    const activeStatus = statuses[statusActiveIndex];
    const isVideo = activeStatus?.mediaType === 'video';

    // If it's a video, let the video's onPlaybackStatusUpdate handle the transition.
    // If it's an image/text, use a 5-second timer.
    if (!isVideo) {
      const timer = setTimeout(() => {
        if (statusActiveIndex < statuses.length - 1) {
          setStatusActiveIndex(prev => prev + 1);
        } else {
          setStatusViewerData(null);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusViewerData, statusActiveIndex, statusPaused]);

  React.useEffect(() => {
    if (statusViewerData) setStatusActiveIndex(0);
  }, [statusViewerData]);

  const renderStatusViewerModal = () => {
    if (!statusViewerData) return null;
    const statuses = statusViewerData.statuses || [];
    const activeIndex = statusActiveIndex;

    if (!statuses.length) return null;
    const activeStatus = statuses[activeIndex];

    const handleNext = () => {
      if (activeIndex < statuses.length - 1) setStatusActiveIndex(activeIndex + 1);
      else setStatusViewerData(null);
    };

    const handlePrev = () => {
      if (activeIndex > 0) setStatusActiveIndex(activeIndex - 1);
    };

    return (
      <Modal visible={!!statusViewerData} animationType="fade" transparent onRequestClose={() => setStatusViewerData(null)}>
        <View style={s.storyOverlay}>
          <View style={[s.storyCard, { backgroundColor: activeStatus.bgColor || '#000' }]}>
            <View style={s.storyProgressRow}>
              {statuses.map((_: any, i: number) => <View key={i} style={[s.storyProgressBar, i <= activeIndex && s.storyProgressActive]} />)}
            </View>
            <View style={s.storyTopRow}>
              <View style={tw`w-10 h-10 rounded-full bg-[#334155] items-center justify-center overflow-hidden`}>
                {statusViewerData.avatarUrl.includes('dicebear') ? (
                  <Text style={tw`text-white font-bold`}>{avatarFor(statusViewerData.userName)}</Text>
                ) : (
                  <Image source={{ uri: statusViewerData.avatarUrl }} style={tw`w-full h-full`} />
                )}
              </View>
              <Text style={s.storyOwnerName}>{statusViewerData.userName}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setStatusViewerData(null)}>
                <X size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              activeOpacity={1} 
              onPressIn={() => setStatusPaused(true)} 
              onPressOut={() => setStatusPaused(false)}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                if (locationX < 100) handlePrev();
                else handleNext();
              }}
              style={tw`flex-1 items-center justify-center`}
            >
              {activeStatus.mediaType === 'video' && activeStatus.mediaUrl ? (
                <Video
                  ref={videoRef}
                  source={{ uri: activeStatus.mediaUrl }}
                  style={tw`w-full h-full`}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={!statusPaused}
                  isMuted={false}
                  onPlaybackStatusUpdate={(status: any) => {
                    if (status.didJustFinish && !status.isLooping) {
                      handleNext();
                    }
                  }}
                />
              ) : activeStatus.mediaType === 'voice' && activeStatus.mediaUrl ? (
                <View style={tw`w-full h-full items-center justify-center`}>
                  <View style={tw`w-24 h-24 rounded-full bg-[#3CCF6F] items-center justify-center mb-8`}>
                    <Mic size={48} color="#fff" />
                  </View>
                  <View style={tw`flex-row items-center gap-1 h-12`}>
                    {[1,2,3,4,5,4,3,2,1,2,3,4,5,4,3,2,1].map((val, i) => (
                      <View key={i} style={[tw`w-1 bg-white rounded-full`, { height: !statusPaused ? val * 8 : 4 }]} />
                    ))}
                  </View>
                  <Video
                    source={{ uri: activeStatus.mediaUrl }}
                    style={{ width: 0, height: 0 }}
                    shouldPlay={!statusPaused}
                    onPlaybackStatusUpdate={(status: any) => {
                      if (status.didJustFinish) handleNext();
                    }}
                  />
                </View>
              ) : activeStatus.mediaUrl ? (
                 <Image source={{ uri: activeStatus.mediaUrl }} style={tw`w-full h-full`} resizeMode="contain" />
              ) : (
                 <Text style={tw`text-3xl text-white font-bold text-center px-4`}>{activeStatus.content}</Text>
              )}
              {activeStatus.mediaUrl && activeStatus.content && (
                <View style={tw`absolute bottom-10 bg-black/50 px-4 py-2 rounded-lg`}>
                  <Text style={tw`text-white text-lg`}>{activeStatus.content}</Text>
                </View>
              )}
            </TouchableOpacity>

            {statusViewerData.userEmail !== email && (
              <View style={s.storyReplyRow}>
                <TextInput style={s.storyReplyInput} placeholder="Reply..." placeholderTextColor="rgba(255,255,255,0.6)" />
                <TouchableOpacity style={s.storyReplySend}><Send size={18} color="#fff" /></TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  /* ------------------------------------------------------------
     STATUS TAB (UPDATES LIST)
  ------------------------------------------------------------ */
  const renderStatusTab = () => {
    const myGroup = groupedStatuses.find(g => g.userEmail === email);
    const otherGroups = groupedStatuses.filter(g => g.userEmail !== email);
    
    // Determine viewed vs recent
    const hasViewedAll = (group: any) => group.statuses.every((st: any) => st.views.includes(email));
    const recentUpdates = otherGroups.filter(g => !hasViewedAll(g));
    const viewedUpdates = otherGroups.filter(g => hasViewedAll(g));

    return (
      <ScrollView style={tw`flex-1 bg-white`} contentContainerStyle={tw`pb-[90px]`}>
        <Text style={tw`text-[20px] font-bold text-black px-4 py-3 mt-2`}>Status</Text>
        
        {/* My Status */}
        <TouchableOpacity style={tw`flex-row items-center px-4 py-3 bg-white`} onPress={() => {
          if (myGroup && myGroup.statuses.length > 0) setStatusViewerData(myGroup);
          else setStatusCreatorOpen(true);
        }}>
          <View style={tw`w-[56px] h-[56px] rounded-full items-center justify-center mr-4 border-2 ${myGroup ? 'border-[#25D366]' : 'border-transparent'}`}>
             <View style={tw`w-[50px] h-[50px] rounded-full bg-[#E9EDEF] items-center justify-center overflow-hidden relative`}>
               <Text style={tw`text-[#8696A0] text-xl font-bold uppercase`}>{avatarFor(user?.name || email)}</Text>
               {!myGroup && (
                 <View style={tw`absolute bottom-0 right-0 w-5 h-5 bg-[#25D366] rounded-full items-center justify-center border-2 border-white`}>
                   <Plus size={12} color="#fff" />
                 </View>
               )}
             </View>
          </View>
          <View style={tw`flex-1 justify-center border-b border-[#D1D7DB]/50 h-[60px] pr-2`}>
            <Text style={tw`text-[16px] font-semibold text-[#111B21] mb-0.5`}>My status</Text>
            <Text style={tw`text-[14px] text-[#667781]`}>{myGroup ? 'Tap to view your status update' : 'Tap to add status update'}</Text>
          </View>
        </TouchableOpacity>

        {/* Recent Updates */}
        {recentUpdates.length > 0 && (
          <View>
            <Text style={tw`text-[13px] font-bold text-[#667781] px-4 py-2 mt-2 bg-[#F0F2F5]`}>Recent updates</Text>
            {recentUpdates.map(group => (
              <TouchableOpacity key={group.userEmail} style={tw`flex-row items-center px-4 py-3 bg-white`} onPress={() => {
                setStatusViewerData(group);
                group.statuses.forEach((s: any) => { if (!s.views.includes(email)) api.chat.viewStatus(s._id); });
              }}>
                <View style={tw`w-[56px] h-[56px] rounded-full items-center justify-center mr-4 border-2 border-[#25D366]`}>
                  <View style={tw`w-[50px] h-[50px] rounded-full bg-[#E9EDEF] items-center justify-center overflow-hidden`}>
                    <Text style={tw`text-[#8696A0] text-xl font-bold uppercase`}>{avatarFor(group.userName)}</Text>
                  </View>
                </View>
                <View style={tw`flex-1 justify-center border-b border-[#D1D7DB]/50 h-[60px] pr-2`}>
                  <Text style={tw`text-[16px] font-semibold text-[#111B21] mb-0.5`}>{group.userName}</Text>
                  <Text style={tw`text-[14px] text-[#667781]`}>{group.statuses.length} new update{group.statuses.length > 1 ? 's' : ''}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Viewed Updates */}
        {viewedUpdates.length > 0 && (
          <View>
            <Text style={tw`text-[13px] font-bold text-[#667781] px-4 py-2 mt-2 bg-[#F0F2F5]`}>Viewed updates</Text>
            {viewedUpdates.map(group => (
              <TouchableOpacity key={group.userEmail} style={tw`flex-row items-center px-4 py-3 bg-white`} onPress={() => setStatusViewerData(group)}>
                <View style={tw`w-[56px] h-[56px] rounded-full items-center justify-center mr-4 border-2 border-[#D1D7DB]`}>
                  <View style={tw`w-[50px] h-[50px] rounded-full bg-[#E9EDEF] items-center justify-center overflow-hidden`}>
                    <Text style={tw`text-[#8696A0] text-xl font-bold uppercase`}>{avatarFor(group.userName)}</Text>
                  </View>
                </View>
                <View style={tw`flex-1 justify-center border-b border-[#D1D7DB]/50 h-[60px] pr-2`}>
                  <Text style={tw`text-[16px] font-semibold text-[#111B21] mb-0.5`}>{group.userName}</Text>
                  <Text style={tw`text-[14px] text-[#667781]`}>Viewed</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  /* ------------------------------------------------------------
     FIND USER MODAL
  ------------------------------------------------------------ */
  const renderAddMemberModal = () => (
    <Modal visible={addMemberModal} animationType="slide" transparent onRequestClose={() => setAddMemberModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalTopRow}>
            <Text style={s.modalTitle}>Find User</Text>
            <TouchableOpacity onPress={() => setAddMemberModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <View style={s.formGroup}>
            <Text style={s.fieldLabel}>Email Address</Text>
            <TextInput style={s.modalInput} value={newEmail} onChangeText={setNewEmail} placeholder="user@company.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAddMemberModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={handleFindUser} disabled={savingMember}>
              {savingMember ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Start Chat</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /* ------------------------------------------------------------
     CREATE GROUP MODAL
  ------------------------------------------------------------ */
  const renderCreateGroupModal = () => (
    <Modal visible={createGroupModal} animationType="slide" transparent onRequestClose={() => setCreateGroupModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalTopRow}>
            <Text style={s.modalTitle}>New Group</Text>
            <TouchableOpacity onPress={() => setCreateGroupModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          <View style={s.groupIconPicker}>
            <View style={s.groupIconCircle}><Hash size={28} color="#fff" /></View>
            <Text style={s.groupIconHint}>Tap to change icon</Text>
          </View>
          <View style={s.formGroup}>
            <Text style={s.fieldLabel}>Group Name</Text>
            <TextInput style={s.modalInput} value={groupName} onChangeText={setGroupName} placeholder="e.g. Design Team" placeholderTextColor="#94a3b8" />
          </View>
          <View style={s.formGroup}>
            <Text style={s.fieldLabel}>Description (optional)</Text>
            <TextInput style={[s.modalInput, { height: 72, paddingTop: 10 }]} value={groupDesc} onChangeText={setGroupDesc} placeholder="What's this group about?" placeholderTextColor="#94a3b8" multiline textAlignVertical="top" />
          </View>
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setCreateGroupModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={handleCreateGroup} disabled={savingMember}>
              {savingMember ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Create Group</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /* ------------------------------------------------------------
     SIDEBAR
  ------------------------------------------------------------ */
  const renderSidebar = () => (
    <View style={tw`flex-1 md:w-[390px] md:flex-none bg-white border-r border-[#D1D7DB]`}>
      
      {/* TopAppBar */}
      <View style={tw`flex-row justify-between items-center px-4 h-16 bg-white border-b border-[#D1D7DB]`}>
        <View style={tw`flex-row items-center gap-2`}>
          <Image source={require('../../assets/Chat.png')} style={tw`w-10 h-10`} resizeMode="contain" />
          <Text style={tw`text-[22px] font-bold text-[#25D366] tracking-tight`}>KURAL</Text>
        </View>
        <View style={tw`flex-row items-center gap-1`}>
          <TouchableOpacity style={tw`w-10 h-10 rounded-full justify-center items-center bg-transparent`} onPress={() => navigate('/home')}>
            <Home size={20} color="#667781" />
          </TouchableOpacity>
          <TouchableOpacity style={tw`w-10 h-10 rounded-full justify-center items-center bg-transparent`} onPress={() => { setAppsMenu(p => !p); setPlusMenu(false); }}>
            <Grid size={20} color="#667781" />
          </TouchableOpacity>
          <TouchableOpacity style={tw`w-10 h-10 rounded-full justify-center items-center bg-transparent`} onPress={() => setPlusMenu(p => !p)}>
            <Plus size={20} color="#667781" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Plus dropdown */}
      {plusMenu && (
        <View style={[s.plusMenu, tw`absolute top-[70px] right-4 z-50 bg-white`]}>
          {[
            { icon: <UserPlus size={16} color="#2563eb" />, label: 'New Direct Message', action: () => { setAddMemberModal(true); setPlusMenu(false); } },
            { icon: <Users size={16} color="#7c3aed" />, label: 'Create Group', action: () => { setCreateGroupModal(true); setPlusMenu(false); } },
          ].map(item => (
            <TouchableOpacity key={item.label} style={s.plusMenuItem} onPress={item.action}>
              <View style={s.plusMenuIcon}>{item.icon}</View>
              <Text style={s.plusMenuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Apps dropdown */}
      {appsMenu && (
        <View style={[s.plusMenu, tw`absolute top-[70px] right-14 z-50 bg-white min-w-[200px]`]}>
          <Text style={tw`text-xs font-bold text-gray-500 uppercase px-4 py-2 border-b border-gray-100`}>Switch App</Text>
          {[
            { icon: <Image source={require('../../assets/Mail.png')} style={tw`w-5 h-5`} />, label: 'Mail', action: () => { navigate('/mail'); setAppsMenu(false); } },
            { icon: <Image source={require('../../assets/Meet.png')} style={tw`w-5 h-5`} />, label: 'Meet', action: () => { navigate('/meetings'); setAppsMenu(false); } },
            { icon: <Image source={require('../../assets/Chat.png')} style={tw`w-5 h-5`} />, label: 'Kural', action: () => { navigate('/chat'); setAppsMenu(false); } },
            ...(user?.role === 'company-admin' || user?.email === 'admin@fic.com' ? [{ icon: <Users size={16} color="#7c3aed" />, label: 'Team', action: () => { navigate('/team'); setAppsMenu(false); } }] : []),
            ...(user?.role === 'super-admin' ? [{ icon: <ShieldCheck size={16} color="#dc2626" />, label: 'Subscriptions', action: () => { navigate('/superadmin'); setAppsMenu(false); } }] : [])
          ].map(item => (
            <TouchableOpacity key={item.label} style={s.plusMenuItem} onPress={item.action}>
              <View style={s.plusMenuIcon}>{item.icon}</View>
              <Text style={s.plusMenuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={tw`px-4 py-3 bg-white`}>
        <View style={tw`flex-row items-center h-9 bg-[#F0F2F5] rounded-full px-4 gap-3`}>
          <Search size={16} color="#667781" />
          <TextInput 
            style={tw`flex-1 text-[#111B21] text-[15px] p-0`}
            placeholder="Search" 
            placeholderTextColor="#667781" 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
          />
        </View>
      </View>



      {/* List */}
      {loadingChannels ? (
        <View style={tw`flex-1 p-8 items-center justify-center`}><ActivityIndicator color="#25D366" size="large" /></View>
      ) : tab === 'status' ? (
        renderStatusTab()
      ) : (
        <ScrollView style={tw`flex-1 bg-white`} contentContainerStyle={tw`pb-[90px]`}>
          {filteredChats.map(chat => (
            <TouchableOpacity key={chat.id} onPress={() => setSelectedChat(chat)}
              style={tw`flex-row items-center px-4 py-0 w-full bg-white`}>
              <View style={tw`w-[56px] h-[56px] rounded-full bg-[#E9EDEF] items-center justify-center mr-4 my-3 overflow-hidden`}>
                <Text style={tw`text-[#8696A0] text-xl font-bold uppercase`}>{chat.avatar}</Text>
              </View>
              <View style={tw`flex-1 justify-center border-b border-[#D1D7DB]/50 h-[85px] pr-2`}>
                <View style={tw`flex-row justify-between items-center mb-0.5`}>
                  <Text style={tw`text-[16px] font-semibold text-[#111B21] flex-1`} numberOfLines={1}>{chat.name}</Text>
                  <Text style={tw`text-[12px] font-medium ml-2 ${chat.unread > 0 ? 'text-[#25D366]' : 'text-[#667781]'}`}>{chat.time}</Text>
                </View>
                <View style={tw`flex-row justify-between items-center`}>
                  <Text style={tw`text-[15px] text-[#667781] flex-1`} numberOfLines={1}>{chat.lastMsg}</Text>
                  {chat.unread > 0 && (
                    <View style={tw`w-[20px] h-[20px] bg-[#25D366] rounded-full items-center justify-center mt-0.5 ml-2`}>
                      <Text style={tw`text-[11px] font-bold text-white`}>{chat.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {filteredChats.length === 0 && (
            <View style={tw`p-8 items-center`}>
              <Text style={tw`text-[#667781]`}>No conversations</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      {isMobile && !selectedChat && (
        <TouchableOpacity style={tw`absolute bottom-[96px] right-4 w-14 h-14 bg-[#25D366] rounded-2xl items-center justify-center z-50`} onPress={() => setAddMemberModal(true)}>
          <MessageSquare size={24} color="#ffffff" fill="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Bottom Navbar */}
      <View style={tw`absolute bottom-0 left-0 right-0 h-20 bg-white border-t border-[#D1D7DB] flex-row justify-around items-center px-2 pb-2 z-40`}>
        <TouchableOpacity style={tw`items-center p-2 mt-1`} onPress={() => setTab('chats')}>
          <View style={tw`w-16 h-8 ${tab === 'chats' ? 'bg-[#25D366]/20' : 'bg-transparent'} rounded-full items-center justify-center mb-1`}>
            <MessageSquare size={20} color={tab === 'chats' ? '#25D366' : '#667781'} fill={tab === 'chats' ? '#25D366' : 'transparent'} />
          </View>
          <Text style={tw`text-[12px] font-medium ${tab === 'chats' ? 'text-[#25D366] font-bold' : 'text-[#667781]'}`}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tw`items-center p-2 mt-1`} onPress={() => setTab('status')}>
          <View style={tw`w-16 h-8 ${tab === 'status' ? 'bg-[#25D366]/20' : 'bg-transparent'} rounded-full items-center justify-center mb-1`}>
            <View style={tw`w-5 h-5 rounded-full border-2 ${tab === 'status' ? 'border-[#25D366]' : 'border-[#667781]'} border-dashed`} />
          </View>
          <Text style={tw`text-[12px] font-medium ${tab === 'status' ? 'text-[#25D366] font-bold' : 'text-[#667781]'}`}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tw`items-center p-2 mt-1`} onPress={() => setTab('groups')}>
          <View style={tw`w-16 h-8 ${tab === 'groups' ? 'bg-[#25D366]/20' : 'bg-transparent'} rounded-full items-center justify-center mb-1`}>
            <Users size={22} color={tab === 'groups' ? '#25D366' : '#667781'} />
          </View>
          <Text style={tw`text-[12px] font-medium ${tab === 'groups' ? 'text-[#25D366] font-bold' : 'text-[#667781]'}`}>Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tw`items-center p-2 mt-1`} onPress={() => setTab('calls')}>
          <View style={tw`w-16 h-8 ${tab === 'calls' ? 'bg-[#25D366]/20' : 'bg-transparent'} rounded-full items-center justify-center mb-1`}>
             <PhoneOff size={20} color={tab === 'calls' ? '#25D366' : '#667781'} />
          </View>
          <Text style={tw`text-[12px] font-medium ${tab === 'calls' ? 'text-[#25D366] font-bold' : 'text-[#667781]'}`}>Calls</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ------------------------------------------------------------
     ACTIVE CHAT PANEL
  ------------------------------------------------------------ */
  const renderActiveChat = () => {
    if (!selectedChat) {
      if (isMobile) return null;
      return (
        <View style={tw`flex-1 items-center justify-center bg-white p-6`}>
          <View style={tw`w-[120px] h-[120px] rounded-full bg-[#E9E9EB] items-center justify-center mb-6`}>
            <MessageSquare size={60} color="#828282" />
          </View>
          <Text style={tw`text-[28px] font-semibold text-black mb-4`}>Messages</Text>
          <Text style={tw`text-[14px] text-[#828282] text-center max-w-[400px]`}>Select a conversation to start messaging.</Text>
          <TouchableOpacity style={tw`mt-8 bg-[#3CCF6F] px-6 py-3 rounded-full flex-row items-center gap-2`} onPress={() => setAddMemberModal(true)}>
            <UserPlus size={18} color="#fff" />
            <Text style={tw`text-white font-bold`}>New Message</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView style={tw`flex-1 bg-white relative`} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Chat header */}
        <View style={tw`flex-row items-center justify-between px-4 py-2 bg-white border-b border-[#E6E6E6] h-16`}>
          <View style={tw`flex-1 flex-row items-center`}>
            {isMobile && (
              <TouchableOpacity onPress={() => setSelectedChat(null)} style={tw`mr-2`}>
                <ChevronLeft size={24} color="#000" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={tw`flex-row items-center flex-1`}>
              <View style={tw`w-8 h-8 rounded-full bg-[#E9E9EB] items-center justify-center mr-3 overflow-hidden`}>
                 {selectedChat.image ? (
                   <Image source={{ uri: selectedChat.image }} style={tw`w-full h-full`} />
                 ) : (
                   <Text style={tw`text-[#828282] text-xs font-bold uppercase`}>{selectedChat.avatar || avatarFor(selectedChat.name)}</Text>
                 )}
              </View>
              <View style={tw`flex-1`}>
                <Text style={tw`text-[16px] font-semibold text-[#000000]`} numberOfLines={1}>{selectedChat.name}</Text>
                <Text style={tw`text-[12px] text-black/50`}>{selectedChat.online ? 'Active now' : 'Offline'}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={tw`flex-row gap-4 items-center`}>
            <TouchableOpacity onPress={startCall}>
              <PhoneOff size={22} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}}>
              <Camera size={22} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChatOptionsOpen(true)}>
              <MoreVertical size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Three-dot options */}
        <Modal visible={chatOptionsOpen} transparent animationType="fade" onRequestClose={() => setChatOptionsOpen(false)}>
          <TouchableOpacity style={s.optionsOverlay} activeOpacity={1} onPress={() => setChatOptionsOpen(false)}>
            <View style={s.optionsSheet}>
              <TouchableOpacity style={s.optionsItem} onPress={handleDeleteChat}>
                <Text style={[s.optionsLabel, s.optionsDanger]}>Delete chat</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Messages */}
        {loadingMessages ? (
          <View style={tw`flex-1 items-center justify-center`}><ActivityIndicator color="#3CCF6F" size="large" /></View>
        ) : (
          <ScrollView style={tw`flex-1 px-4`} contentContainerStyle={tw`py-4 pb-[100px]`}>
            <Text style={tw`text-[#828282] text-[12px] text-center my-4`}>Today</Text>
            
            {messages.length === 0 ? (
              <View style={tw`items-center py-10`}>
                <Text style={tw`text-[#828282] text-[13px]`}>No messages here yet.</Text>
              </View>
            ) : messages.map((msg, idx) => {
              const next = messages[idx + 1];
              const showAv = !msg.self && (!next || next.self !== msg.self);
              return (
                <View key={msg.id} style={tw`flex-row mb-1 items-end ${msg.self ? 'justify-end' : 'justify-start'}`}>
                  {!msg.self && showAv && (
                    <View style={tw`w-6 h-6 rounded-full bg-[#E9E9EB] items-center justify-center mr-2 mb-1`}>
                      <Text style={tw`text-[9px] font-bold text-[#828282]`}>{avatarFor(msg.user)}</Text>
                    </View>
                  )}
                  {!msg.self && !showAv && <View style={tw`w-8`} />}
                  
                  <View style={tw`max-w-[70%] px-4 py-2 ${msg.self ? 'bg-[#3CCF6F]' : 'bg-[#E9E9EB]'} ${msg.self ? 'rounded-[18px] rounded-br-[4px]' : 'rounded-[18px] rounded-bl-[4px]'}`}>
                    {msg.fileUrl && (
                      <View style={tw`mb-2 rounded-lg overflow-hidden`}>
                        {msg.fileType?.startsWith('image/') ? (
                          <Image source={{ uri: msg.fileUrl }} style={tw`w-[200px] h-[150px] rounded-lg`} resizeMode="cover" />
                        ) : (
                          <View style={tw`flex-row items-center bg-black/5 p-2 rounded-lg gap-2`}>
                            <View style={tw`w-8 h-8 bg-[#828282] items-center justify-center rounded-full`}>
                              <FileText size={16} color="#fff" />
                            </View>
                            <Text style={tw`text-[13px] color-[#000] flex-1`} numberOfLines={1}>{msg.fileUrl?.split('/').pop() || 'File'}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    <Text style={tw`text-[14px] ${msg.self ? 'text-white' : 'text-[#000000]'} font-medium leading-[20px]`}>{msg.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={tw`absolute bottom-0 left-0 right-0 bg-white px-4 pb-8 pt-2`}>
          <View style={tw`flex-row items-center border border-[#E0E0E0] rounded-[20px] bg-white pl-4 pr-2 min-h-[40px] max-h-[100px]`}>
            <TextInput 
              style={[tw`flex-1 text-[14px] text-black py-2`, { outlineStyle: 'none' } as any]} 
              placeholder="Reply" 
              placeholderTextColor="#828282"
              value={inputVal} 
              onChangeText={setInputVal} 
              multiline 
            />
            
            {!inputVal.trim() ? (
               <View style={tw`flex-row items-center gap-3 ml-2`}>
                 <TouchableOpacity onPress={pickDocument} disabled={uploadingFile}>
                   {uploadingFile ? <ActivityIndicator size="small" color="#828282" /> : <Camera size={20} color="#828282" />}
                 </TouchableOpacity>
                 <TouchableOpacity>
                   <Smile size={20} color="#828282" />
                 </TouchableOpacity>
                 <TouchableOpacity>
                   <Mic size={20} color="#828282" />
                 </TouchableOpacity>
               </View>
            ) : (
               <TouchableOpacity style={tw`ml-2 w-8 h-8 bg-[#3CCF6F] rounded-full items-center justify-center`} onPress={handleSend} disabled={!inputVal.trim()}>
                 <Send size={14} color="#fff" />
               </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  /* ------------------------------------------------------------
     ROOT RENDER
  ------------------------------------------------------------ */
  return (
    <View style={s.root}>
      {renderAudioCallModal()}
      {renderStatusCreatorModal()}
      {renderStatusViewerModal()}
      {renderAddMemberModal()}
      {renderCreateGroupModal()}
      {(!isMobile || !selectedChat) && renderSidebar()}
      {(!isMobile || selectedChat) && renderActiveChat()}
    </View>
  );
}

/* ------------------------------------------------------------
   STYLES
------------------------------------------------------------ */
const getStyles = (width: number, height: number, isMobile: boolean) => StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f5f9' },

  /* sidebar */
  sidebar: { flex: isMobile ? 1 : 0, width: isMobile ? '100%' : 380, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sidebarTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  secureBadgeText: { fontSize: 11, color: '#0f766e', fontWeight: '700' },
  plusBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },

  /* plus menu */
  plusMenu: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  plusMenuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  plusMenuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  plusMenuLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  /* stories */
  storiesRow: { maxHeight: 110, marginTop: 4 },
  storiesContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  storyItem: { alignItems: 'center', gap: 8, width: 72 },
  storyRingOwn: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#006b5e', padding: 4, alignItems: 'center', justifyContent: 'center' },
  storyAvatarOwn: { width: '100%', height: '100%', borderRadius: 32, backgroundColor: '#96f3e1', alignItems: 'center', justifyContent: 'center' },
  storyAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  storyName: { fontSize: 12, fontWeight: '500', color: '#44474c', textAlign: 'center' },

  /* search */
  searchBarWrapper: { paddingHorizontal: 16, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 24, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 15, color: '#0d1c2e' },

  /* chat list */
  chatList: { flex: 1 },
  chatListContent: { paddingHorizontal: 16, paddingBottom: 100 },
  messagesHeader: { fontSize: 13, fontWeight: '600', color: '#74777d', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9' },
  chatCardUnread: { backgroundColor: '#eff4ff' },
  avatarWrap: { marginRight: 16, position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarRead: { opacity: 0.8 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#ffffff' },
  chatInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
  chatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { flex: 1, fontSize: 16, color: '#0d1c2e' },
  textBold: { fontWeight: '700' },
  textSemiBold: { fontWeight: '600' },
  chatTime: { fontSize: 12 },
  timeUnread: { color: '#006b5e', fontWeight: '700' },
  timeRead: { color: '#74777d', fontWeight: '500' },
  chatPreview: { flex: 1, fontSize: 14, color: '#44474c' },
  chatRightIndicator: { marginLeft: 12, alignItems: 'flex-end', justifyContent: 'center' },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#006b5e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  
  /* fab */
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, backgroundColor: '#006b5e', borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 50 },

  /* empty states */
  loadingPane: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyList: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyListTitle: { fontSize: 16, fontWeight: '600', color: '#44474c' },
  callsEmptyPane: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  callsEmptyTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  callsEmptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 24 },
  createGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  createGroupBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  /* chat panel */
  chatPanel: { flex: 1, backgroundColor: '#f8fafc' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyStateIcon: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#96f3e1', alignItems: 'center', justifyContent: 'center' },
  emptyStateTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  emptyStateSub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  emptyStateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#006b5e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyStateBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  /* chat header */
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  chatHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  backBtn: { marginRight: 8 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerAvatarText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerOnlineDot: { width: 8, height: 8, borderRadius: 4 },
  headerStatusText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  chatHeaderActions: { flexDirection: 'row', gap: 6 },
  headerActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  /* messages */
  feed: { flex: 1 },
  feedContent: { padding: 16, paddingBottom: 24 },
  dateSep: { alignItems: 'center', marginVertical: 12 },
  dateSepText: { fontSize: 11, fontWeight: '800', color: '#94a3b8', backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, textTransform: 'uppercase' },
  noMsgBox: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  noMsgTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  noMsgSub: { fontSize: 13, color: '#64748b' },
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  msgRowSelf: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  msgAvatarText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  msgAvatarSpacer: { width: 38 },
  bubble: { maxWidth: '76%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleSelf: { backgroundColor: '#006b5e', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextSelf: { color: '#fff' },
  bubbleTextOther: { color: '#0f172a' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 },
  bubbleTime: { fontSize: 10, fontWeight: '700' },
  bubbleTimeSelf: { color: 'rgba(255,255,255,0.65)' },
  bubbleTimeOther: { color: '#94a3b8' },
  filePreview: { marginTop: 8, borderRadius: 12, overflow: 'hidden', maxWidth: '100%' },
  fileImage: { width: 150, height: 100, borderRadius: 8 },
  fileBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, gap: 8 },
  fileName: { fontSize: 12, color: '#475569', flex: 1 },

  /* input bar */
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  inputIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  inputField: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, minHeight: 40, maxHeight: 100, justifyContent: 'center' },
  textInput: { fontSize: 15, color: '#0f172a', paddingVertical: 8 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#006b5e', alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: '#cbd5e1' },

  /* audio call modal */
  callOverlay: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  callCard: { width: '100%', maxWidth: 340, backgroundColor: '#1e293b', borderRadius: 32, padding: 32, alignItems: 'center', gap: 16 },
  callAvatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  callAvatarText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  callName: { fontSize: 22, fontWeight: '900', color: '#fff' },
  callStatus: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  callWaveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 40, marginVertical: 8 },
  callWaveBar: { width: 4, backgroundColor: '#0f766e', borderRadius: 2, minHeight: 8 },
  callControls: { flexDirection: 'row', gap: 20, marginTop: 8 },
  callCtrlBtn: { alignItems: 'center', gap: 6, backgroundColor: '#334155', width: 64, height: 64, borderRadius: 32, justifyContent: 'center' },
  callCtrlRed: { backgroundColor: 'rgba(239,68,68,0.2)' },
  callEndBtn: { alignItems: 'center', gap: 6, backgroundColor: '#ef4444', width: 72, height: 72, borderRadius: 36, justifyContent: 'center' },
  callCtrlLabel: { fontSize: 10, fontWeight: '800', color: '#fff', textAlign: 'center' },

  /* story modal */
  storyOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  storyCard: { width: '100%', height: '100%', padding: 20, justifyContent: 'space-between' },
  storyProgressRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  storyProgressBar: { flex: 1, height: 3, backgroundColor: '#334155', borderRadius: 2 },
  storyProgressActive: { backgroundColor: '#fff' },
  storyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  storyAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  storyAvatarSmallText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  storyOwnerName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  storyTime: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  storyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  storyEmoji: { fontSize: 64 },
  storyText: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  storyReplyRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingBottom: 20 },
  storyReplyInput: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#334155', paddingHorizontal: 16, color: '#fff', fontSize: 14, backgroundColor: '#1e293b' },
  storyReplySend: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },

  /* modals */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 16 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  formGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: '#0f172a', fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  primaryBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  groupIconPicker: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  groupIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  groupIconHint: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  /* chat options (three dots) */
  optionsOverlay: { flex: 1, backgroundColor: 'transparent' },
  optionsSheet: {
    position: 'absolute',
    top: 64,
    right: 16,
    minWidth: 180,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  optionsItem: { paddingHorizontal: 14, paddingVertical: 12 },
  optionsLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  optionsDanger: { color: '#dc2626' },
});
