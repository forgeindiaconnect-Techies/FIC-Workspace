import React from 'react';
import {
  ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Image, useWindowDimensions,
} from 'react-native';
import {
  CheckCheck, ChevronLeft, Mic, MicOff, PhoneOff,
  Plus, Search, Send, Shield, Users, X, UserPlus,
  MessageSquare, MoreVertical, Paperclip, Camera, Hash,
  Bell, Star, Smile, Edit, Edit3, Edit2
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
  
  /* -- state -- */
  const [tab, setTab] = React.useState<'chats'|'groups'|'calls'>('chats');
  const [selectedChat, setSelectedChat] = React.useState<any>(null);
  const [directMessages, setDirectMessages] = React.useState<any[]>([]);
  const [groupMessages, setGroupMessages] = React.useState<any[]>([]);
  const [stories, setStories] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>([{ id: 'init', user: 'Workspace', time: 'Now', text: 'Select a chat to start messaging.', self: false }]);
  const [inputVal, setInputVal] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loadingChannels, setLoadingChannels] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  /* modals */
  const [addMemberModal, setAddMemberModal] = React.useState(false);
  const [createGroupModal, setCreateGroupModal] = React.useState(false);
  const [storyModal, setStoryModal] = React.useState<any>(null);
  const [audioCallModal, setAudioCallModal] = React.useState(false);
  const [plusMenu, setPlusMenu] = React.useState(false);
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

      const sMapped = Array.isArray(storiesData) ? storiesData.map((s: any) => ({
        id: s._id, name: s.userName, avatar: s.userAvatar || avatarFor(s.userName), color: colorFor(s.userId), isOwn: s.userId === user?.id, image: s.content
      })) : [];
      setStories(sMapped);
    } catch {
      setDirectMessages([]);
      setGroupMessages([]);
      setStories([]);
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
          time: formatTime(m.timestamp), text: m.content,
          self: m.senderEmail === email || m.sender === 'You',
        })) : [];
        const deduped = uniqueMessages(mapped);
        setMessages(deduped.length ? deduped : [{ id: 'init', user: 'Workspace', time: 'Now', text: 'Start your conversation here.', self: false }]);
      })
      .catch(() => setMessages([{ id: 'err', user: 'System', time: 'Now', text: 'Failed to load.', self: false }]))
      .finally(() => setLoadingMessages(false));
  }, [selectedChat, workspaceId, email]);

  const filteredChats = directMessages.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    return !q || `${c.name} ${c.email} ${c.lastMsg}`.toLowerCase().includes(q);
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
  const handlePostStory = async (content: string) => {
    if (!content.trim()) return;
    try {
      await api.chat.postStory(workspaceId, content);
      await loadChannels();
      Alert.alert('Done', 'Status updated!');
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
     STORY VIEWER MODAL
  ------------------------------------------------------------ */
  const renderStoryModal = () => (
    <Modal visible={!!storyModal} animationType="fade" transparent onRequestClose={() => setStoryModal(null)}>
      <View style={s.storyOverlay}>
        <View style={[s.storyCard, { backgroundColor: storyModal ? colorFor(storyModal.id) : '#0f766e' }]}>
          {/* progress bar */}
          <View style={s.storyProgressRow}>
            {[0,1,2].map(i => <View key={i} style={[s.storyProgressBar, i === 0 && s.storyProgressActive]} />)}
          </View>
          <View style={s.storyTopRow}>
            <View style={s.storyAvatarSmall}>
              <Text style={s.storyAvatarSmallText}>{storyModal?.avatar}</Text>
            </View>
            <Text style={s.storyOwnerName}>{storyModal?.name}</Text>
            <Text style={s.storyTime}>2m ago</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setStoryModal(null)}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={s.storyContent}>
            {storyModal?.isOwn ? (
               <TextInput 
                 style={[s.storyReplyInput, { fontSize: 24, textAlign: 'center', height: 100 }]} 
                 placeholder="Type status..." 
                 placeholderTextColor="rgba(255,255,255,0.6)" 
                 autoFocus
                 onSubmitEditing={(e) => {
                   handlePostStory(e.nativeEvent.text);
                   setStoryModal(null);
                 }}
               />
            ) : (
               <Text style={s.storyText}>{storyModal?.image || `Status update from ${storyModal?.name}`}</Text>
            )}
          </View>
          {!storyModal?.isOwn && (
            <View style={s.storyReplyRow}>
              <TextInput style={s.storyReplyInput} placeholder="Reply to status" placeholderTextColor="rgba(255,255,255,0.6)" />
              <TouchableOpacity style={s.storyReplySend}><Send size={18} color="#fff" /></TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

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
    <View style={s.sidebar}>
      {/* Header */}
      <View style={s.sidebarHeader}>
        <View>
          <Text style={s.sidebarTitle}>Kural</Text>
          <View style={s.secureBadge}>
            <Shield size={11} color="#0f766e" />
            <Text style={s.secureBadgeText}>End-to-End Encrypted</Text>
          </View>
        </View>
        {/* Plus menu */}
        <TouchableOpacity style={s.plusBtn} onPress={() => setPlusMenu(p => !p)}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Plus dropdown */}
      {plusMenu && (
        <View style={s.plusMenu}>
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

      {/* Search */}
      <View style={s.searchBarWrapper}>
        <View style={s.searchBar}>
          <Search size={20} color="#74777d" style={s.searchIcon} />
          <TextInput style={s.searchInput} placeholder="Find a conversation..." placeholderTextColor="rgba(116,119,125,0.6)" value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>

      {/* Stories row (only when there are stories) */}
      {stories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.storiesRow} contentContainerStyle={s.storiesContent}>
          {stories.map((story, i) => (
            <TouchableOpacity key={story.id} style={s.storyItem} onPress={() => setStoryModal(story)}>
              {story.image ? (
                <Image source={{ uri: story.image }} style={s.storyAvatarImg} />
              ) : (
                <View style={[s.storyAvatarOwn, { backgroundColor: story.color || colorFor(story.id) }]}>
                  <Text style={s.storyAvatarSmallText}>{story.avatar || avatarFor(story.name)}</Text>
                </View>
              )}
              <Text style={s.storyName} numberOfLines={1}>{story.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      {loadingChannels ? (
        <View style={s.loadingPane}><ActivityIndicator color="#006b5e" /></View>
      ) : (
        <ScrollView style={s.chatList} contentContainerStyle={s.chatListContent}>
          <Text style={s.messagesHeader}>Messages</Text>
          {filteredChats.map(chat => (
            <TouchableOpacity key={chat.id} onPress={() => setSelectedChat(chat)}
              style={[s.chatCard, chat.unread > 0 && s.chatCardUnread]}>
              <View style={s.avatarWrap}>
                {chat.image ? (
                  <Image source={{ uri: chat.image }} style={[s.avatar, !chat.unread && s.avatarRead]} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: colorFor(chat.id) }]}>
                    {chat.type === 'group' ? <Users size={28} color="#4c5b71" /> : <Text style={s.avatarText}>{chat.avatar}</Text>}
                  </View>
                )}
                {chat.online && chat.unread > 0 && <View style={s.onlineDot} />}
              </View>
              <View style={s.chatInfo}>
                <View style={s.chatRow}>
                  <Text style={[s.chatName, chat.unread > 0 ? s.textBold : s.textSemiBold]} numberOfLines={1}>{chat.name}</Text>
                  <Text style={[s.chatTime, chat.unread > 0 ? s.timeUnread : s.timeRead]}>{chat.time}</Text>
                </View>
                <View style={s.chatRow}>
                  <Text style={[s.chatPreview, chat.unread > 0 && s.textSemiBold]} numberOfLines={1}>{chat.lastMsg}</Text>
                </View>
              </View>
              <View style={s.chatRightIndicator}>
                {chat.unread > 0 ? (
                  <View style={s.unreadBadge}><Text style={s.unreadText}>{chat.unread}</Text></View>
                ) : chat.read ? (
                  <CheckCheck size={16} color="#74777d" />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
          {filteredChats.length === 0 && (
            <View style={s.emptyList}>
              <MessageSquare size={36} color="#c4c6cd" />
              <Text style={s.emptyListTitle}>No conversations</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      {isMobile && !selectedChat && (
        <TouchableOpacity style={s.fab} onPress={() => setAddMemberModal(true)}>
          <Edit2 size={24} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );

  /* ------------------------------------------------------------
     ACTIVE CHAT PANEL
  ------------------------------------------------------------ */
  const renderActiveChat = () => {
    if (!selectedChat) {
      if (isMobile) return null;
      return (
        <View style={s.emptyState}>
          <View style={s.emptyStateIcon}><MessageSquare size={44} color="#0f766e" /></View>
          <Text style={s.emptyStateTitle}>Select a conversation</Text>
          <Text style={s.emptyStateSub}>Choose from your chats or start a new one.</Text>
          <TouchableOpacity style={s.emptyStateBtn} onPress={() => setAddMemberModal(true)}>
            <UserPlus size={16} color="#fff" />
            <Text style={s.emptyStateBtnText}>New Message</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView style={s.chatPanel} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Chat header */}
        <View style={s.chatHeader}>
          <View style={s.chatHeaderLeft}>
            {isMobile && (
              <TouchableOpacity onPress={() => setSelectedChat(null)} style={s.backBtn}>
                <ChevronLeft size={24} color="#0f172a" />
              </TouchableOpacity>
            )}
            <View style={[s.headerAvatar, { backgroundColor: colorFor(selectedChat.id) }]}>
              <Text style={s.headerAvatarText}>{selectedChat.avatar || avatarFor(selectedChat.name)}</Text>
            </View>
            <View style={s.headerInfo}>
              <Text style={s.headerName} numberOfLines={1}>{selectedChat.name}</Text>
              <View style={s.headerStatusRow}>
                <View style={[s.headerOnlineDot, { backgroundColor: selectedChat.online ? '#22c55e' : '#94a3b8' }]} />
                <Text style={s.headerStatusText}>{selectedChat.online ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
          </View>
          <View style={s.chatHeaderActions}>
            <TouchableOpacity style={s.headerActionBtn} onPress={() => setChatOptionsOpen(true)}>
              <MoreVertical size={18} color="#64748b" />
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
          <View style={s.loadingPane}><ActivityIndicator color="#0f766e" /></View>
        ) : (
          <ScrollView style={s.feed} contentContainerStyle={s.feedContent}>
            <View style={s.dateSep}><Text style={s.dateSepText}>Today</Text></View>
            {messages.length === 0 ? (
              <View style={s.noMsgBox}>
                <Text style={s.noMsgTitle}>No messages yet</Text>
                <Text style={s.noMsgSub}>Say hello </Text>
              </View>
            ) : messages.map((msg, idx) => {
              const next = messages[idx + 1];
              const showAv = !msg.self && (!next || next.self !== msg.self);
              return (
                <View key={msg.id} style={[s.msgRow, msg.self ? s.msgRowSelf : s.msgRowOther]}>
                  {!msg.self && (showAv
                    ? <View style={[s.msgAvatar, { backgroundColor: colorFor(selectedChat.id) }]}><Text style={s.msgAvatarText}>{avatarFor(msg.user)}</Text></View>
                    : <View style={s.msgAvatarSpacer} />
                  )}
                  <View style={[s.bubble, msg.self ? s.bubbleSelf : s.bubbleOther]}>
                    <Text style={[s.bubbleText, msg.self ? s.bubbleTextSelf : s.bubbleTextOther]}>{msg.text}</Text>
                    <View style={s.bubbleMeta}>
                      <Text style={[s.bubbleTime, msg.self ? s.bubbleTimeSelf : s.bubbleTimeOther]}>{msg.time || 'Now'}</Text>
                      {msg.self && <CheckCheck size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 3 }} />}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <TouchableOpacity style={s.inputIconBtn}><Smile size={20} color="#94a3b8" /></TouchableOpacity>
          <TouchableOpacity style={s.inputIconBtn}><Paperclip size={20} color="#94a3b8" /></TouchableOpacity>
          <View style={s.inputField}>
            <TextInput style={s.textInput} placeholder="Type a message" placeholderTextColor="#94a3b8"
              value={inputVal} onChangeText={setInputVal} multiline />
          </View>
          <TouchableOpacity style={[s.sendBtn, !inputVal.trim() && s.sendBtnOff]} onPress={handleSend} disabled={!inputVal.trim()}>
            <Send size={18} color="#fff" />
          </TouchableOpacity>
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
      {renderStoryModal()}
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
  plusMenu: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 },
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
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 24, paddingHorizontal: 16, height: 48, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 15, color: '#0d1c2e' },

  /* chat list */
  chatList: { flex: 1 },
  chatListContent: { paddingHorizontal: 16, paddingBottom: 100 },
  messagesHeader: { fontSize: 13, fontWeight: '600', color: '#74777d', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 8, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
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
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, backgroundColor: '#006b5e', borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 50 },

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

  /* input bar */
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 8 },
  inputIconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  inputField: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, minHeight: 40, maxHeight: 100, justifyContent: 'center' },
  textInput: { fontSize: 15, color: '#0f172a', paddingVertical: 8 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#006b5e', alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: '#cbd5e1' },

  /* audio call modal */
  callOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  callCard: { width: '100%', maxWidth: 340, backgroundColor: '#0f172a', borderRadius: 32, padding: 32, alignItems: 'center', gap: 16 },
  callAvatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  callAvatarText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  callName: { fontSize: 22, fontWeight: '900', color: '#fff' },
  callStatus: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  callWaveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 40, marginVertical: 8 },
  callWaveBar: { width: 4, backgroundColor: '#0f766e', borderRadius: 2, minHeight: 8 },
  callControls: { flexDirection: 'row', gap: 20, marginTop: 8 },
  callCtrlBtn: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', width: 64, height: 64, borderRadius: 32, justifyContent: 'center' },
  callCtrlRed: { backgroundColor: 'rgba(239,68,68,0.2)' },
  callEndBtn: { alignItems: 'center', gap: 6, backgroundColor: '#ef4444', width: 72, height: 72, borderRadius: 36, justifyContent: 'center' },
  callCtrlLabel: { fontSize: 10, fontWeight: '800', color: '#fff', textAlign: 'center' },

  /* story modal */
  storyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  storyCard: { width: '100%', height: '100%', padding: 20, justifyContent: 'space-between' },
  storyProgressRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  storyProgressBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  storyProgressActive: { backgroundColor: '#fff' },
  storyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  storyAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  storyAvatarSmallText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  storyOwnerName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  storyTime: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  storyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  storyEmoji: { fontSize: 64 },
  storyText: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  storyReplyRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingBottom: 20 },
  storyReplyInput: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 16, color: '#fff', fontSize: 14 },
  storyReplySend: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  optionsItem: { paddingHorizontal: 14, paddingVertical: 12 },
  optionsLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  optionsDanger: { color: '#dc2626' },
});
