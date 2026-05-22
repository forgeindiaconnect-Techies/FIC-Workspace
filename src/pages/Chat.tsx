import React from 'react';
import {
  ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Image,
} from 'react-native';
import {
  CheckCheck, ChevronLeft, Mic, MicOff, Phone, PhoneOff,
  Plus, Search, Send, Shield, Users, Video, X, UserPlus,
  MessageSquare, MoreVertical, Paperclip, Camera, Hash,
  Bell, Star, Smile,
} from 'lucide-react-native';
import { api, getSession } from '../lib/api';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;

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

/* --- mock stories ------------------------------------------- */
const STORIES = [
  { id: 'my', name: 'Your Story', avatar: 'ME', color: '#6366f1', isOwn: true },
  { id: 's1', name: 'Sarah C.', avatar: 'SC', color: '#0f766e', isOwn: false },
  { id: 's2', name: 'Arjun M.', avatar: 'AM', color: '#dc2626', isOwn: false },
  { id: 's3', name: 'Priya R.', avatar: 'PR', color: '#d97706', isOwn: false },
  { id: 's4', name: 'Dev Team', avatar: 'DT', color: '#7c3aed', isOwn: false },
];

/* --- avatar colors ------------------------------------------ */
const AVATAR_COLORS = ['#0f766e','#2563eb','#7c3aed','#dc2626','#d97706','#059669'];
const colorFor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const fallbackChats = [
  { id: 'demo-1', name: 'Sarah Chen', email: 'sarah@antigraviity.com', online: true,
    lastMsg: 'Add a real user to start chatting.', time: 'Demo', unread: 2, avatar: 'SC', type: 'dm' },
];
const fallbackMessages = [
  { id: 'w1', user: 'Kural', time: 'Now', text: 'Messages appear here once users are added.', self: false },
];

export default function Chat() {
  /* -- state -- */
  const [tab, setTab] = React.useState<'chats'|'groups'|'calls'>('chats');
  const [selectedChat, setSelectedChat] = React.useState<any>(null);
  const [directMessages, setDirectMessages] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>(fallbackMessages);
  const [inputVal, setInputVal] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loadingChannels, setLoadingChannels] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  /* modals */
  const [addMemberModal, setAddMemberModal] = React.useState(false);
  const [createGroupModal, setCreateGroupModal] = React.useState(false);
  const [storyModal, setStoryModal] = React.useState<any>(null);
  const [audioCallModal, setAudioCallModal] = React.useState(false);
  const [callActive, setCallActive] = React.useState(false);
  const [callMuted, setCallMuted] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [plusMenu, setPlusMenu] = React.useState(false);

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
  const email = user?.email || 'admin@antigraviity.com';

  /* -- call timer -- */
  React.useEffect(() => {
    let t: any;
    if (callActive) { t = setInterval(() => setCallDuration(p => p + 1), 1000); }
    else { setCallDuration(0); }
    return () => clearInterval(t);
  }, [callActive]);

  const fmtCall = (s: number) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  /* -- load channels -- */
  const loadChannels = React.useCallback(async () => {
    setLoadingChannels(true);
    try {
      const data = await api.chat.getChannels(workspaceId, email);
      const mapped = Array.isArray(data) ? data.map((ch: any) => ({
        id: ch._id, name: ch.displayName || ch.name || ch.email,
        email: ch.email, online: ch.isOnline !== false,
        lastMsg: ch.lastMessageContent || 'Start a conversation',
        time: formatTime(ch.lastMessageTime), unread: 0,
        avatar: ch.avatar || avatarFor(ch.displayName || ch.name || ch.email),
        role: ch.role || 'Member', type: 'dm',
      })) : [];
      setDirectMessages(mapped.length ? mapped : fallbackChats);
    } catch {
      setDirectMessages(fallbackChats);
    } finally { setLoadingChannels(false); }
  }, [workspaceId, email]);

  React.useEffect(() => { loadChannels(); }, [loadChannels]);

  /* -- load messages -- */
  React.useEffect(() => {
    if (!selectedChat) return;
    if (String(selectedChat.id).startsWith('demo-')) { setMessages(fallbackMessages); return; }
    setLoadingMessages(true);
    api.chat.getMessages(workspaceId, selectedChat.id)
      .then((data: any[]) => {
        const mapped = Array.isArray(data) ? data.map((m: any) => ({
          id: m._id, user: m.sender || m.senderName,
          time: formatTime(m.timestamp), text: m.content,
          self: m.senderEmail === email || m.sender === 'You',
        })) : [];
        setMessages(mapped.length ? mapped : []);
      })
      .catch(() => setMessages(fallbackMessages))
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
    setMessages(p => [...p, opt]);
    setInputVal('');
    setDirectMessages(p => p.map(c => c.id === selectedChat.id ? { ...c, lastMsg: content, time: opt.time } : c));
    if (String(selectedChat.id).startsWith('demo-')) return;
    try {
      const saved = await api.chat.sendMessage(workspaceId, selectedChat.id, content);
      setMessages(p => p.map(m => m.id === oid ? {
        id: saved._id, user: saved.sender || 'You',
        time: formatTime(saved.timestamp), text: saved.content, self: true,
      } : m));
    } catch (e: any) { Alert.alert('Send failed', e.message); }
  };

  /* -- add member -- */
  const handleAddMember = async () => {
    if (!newName.trim() || !newEmail.trim()) { Alert.alert('Required', 'Name and email needed.'); return; }
    setSavingMember(true);
    try {
      await api.members.addMember({ name: newName.trim(), email: newEmail.trim().toLowerCase(), password: newPass, role: 'Member', workspaceId });
      setAddMemberModal(false); setNewName(''); setNewEmail(''); setNewPass('password123');
      await loadChannels();
      Alert.alert('Done', 'User added successfully.');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSavingMember(false); }
  };

  /* ------------------------------------------------------------
     AUDIO CALL MODAL
  ------------------------------------------------------------ */
  const renderAudioCallModal = () => (
    <Modal visible={audioCallModal} animationType="slide" transparent onRequestClose={() => { setAudioCallModal(false); setCallActive(false); }}>
      <View style={s.callOverlay}>
        <View style={s.callCard}>
          {/* avatar */}
          <View style={[s.callAvatar, { backgroundColor: selectedChat ? colorFor(selectedChat.id) : '#0f766e' }]}>
            <Text style={s.callAvatarText}>{selectedChat ? (selectedChat.avatar || avatarFor(selectedChat.name)) : 'ME'}</Text>
          </View>
          <Text style={s.callName}>{selectedChat?.name || 'Unknown'}</Text>
          <Text style={s.callStatus}>{callActive ? fmtCall(callDuration) : 'Calling'}</Text>

          {/* wave animation placeholder */}
          <View style={s.callWaveRow}>
            {[1,2,3,4,5,6,7].map(i => (
              <View key={i} style={[s.callWaveBar, { height: callActive ? 8 + (i % 3) * 14 : 8 }]} />
            ))}
          </View>

          {/* controls */}
          <View style={s.callControls}>
            <TouchableOpacity style={[s.callCtrlBtn, callMuted && s.callCtrlRed]} onPress={() => setCallMuted(p => !p)}>
              {callMuted ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
              <Text style={s.callCtrlLabel}>{callMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.callEndBtn} onPress={() => { setAudioCallModal(false); setCallActive(false); }}>
              <PhoneOff size={26} color="#fff" />
              <Text style={s.callCtrlLabel}>End</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.callCtrlBtn} onPress={() => setCallActive(p => !p)}>
              <Phone size={22} color="#fff" />
              <Text style={s.callCtrlLabel}>{callActive ? 'Hold' : 'Answer'}</Text>
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
            <Text style={s.storyEmoji}></Text>
            <Text style={s.storyText}>Status update from {storyModal?.name}</Text>
          </View>
          <View style={s.storyReplyRow}>
            <TextInput style={s.storyReplyInput} placeholder="Reply to story" placeholderTextColor="rgba(255,255,255,0.6)" />
            <TouchableOpacity style={s.storyReplySend}><Send size={18} color="#fff" /></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /* ------------------------------------------------------------
     ADD MEMBER MODAL
  ------------------------------------------------------------ */
  const renderAddMemberModal = () => (
    <Modal visible={addMemberModal} animationType="slide" transparent onRequestClose={() => setAddMemberModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalTopRow}>
            <Text style={s.modalTitle}>Add Member</Text>
            <TouchableOpacity onPress={() => setAddMemberModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
          </View>
          {[
            { label: 'Full Name', val: newName, set: setNewName, ph: 'Priya Raman', secure: false, kb: 'default' as any },
            { label: 'Email', val: newEmail, set: setNewEmail, ph: 'priya@company.com', secure: false, kb: 'email-address' as any },
            { label: 'Password', val: newPass, set: setNewPass, ph: '', secure: true, kb: 'default' as any },
          ].map(f => (
            <View key={f.label} style={s.formGroup}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput style={s.modalInput} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor="#94a3b8" secureTextEntry={f.secure} keyboardType={f.kb} autoCapitalize="none" />
            </View>
          ))}
          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAddMemberModal(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={handleAddMember} disabled={savingMember}>
              {savingMember ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Add User</Text>}
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
            <TouchableOpacity style={s.primaryBtn} onPress={() => { Alert.alert('Group Created', `"${groupName}" group created!`); setCreateGroupModal(false); setGroupName(''); setGroupDesc(''); }}>
              <Text style={s.primaryBtnText}>Create Group</Text>
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
            { icon: <Camera size={16} color="#0f766e" />, label: 'Add Story', action: () => { setStoryModal(STORIES[0]); setPlusMenu(false); } },
          ].map(item => (
            <TouchableOpacity key={item.label} style={s.plusMenuItem} onPress={item.action}>
              <View style={s.plusMenuIcon}>{item.icon}</View>
              <Text style={s.plusMenuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Stories row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.storiesRow} contentContainerStyle={s.storiesContent}>
        {STORIES.map(story => (
          <TouchableOpacity key={story.id} style={s.storyItem} onPress={() => setStoryModal(story)}>
            <View style={[s.storyRing, { borderColor: story.isOwn ? '#e2e8f0' : story.color }]}>
              <View style={[s.storyAvatar, { backgroundColor: story.color }]}>
                {story.isOwn
                  ? <Plus size={18} color="#fff" />
                  : <Text style={s.storyAvatarText}>{story.avatar}</Text>}
              </View>
            </View>
            <Text style={s.storyName} numberOfLines={1}>{story.isOwn ? 'Add Story' : story.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['chats','groups','calls'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>{t.charAt(0).toUpperCase()+t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <TextInput style={s.searchInput} placeholder="Search" placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      {/* List */}
      {loadingChannels ? (
        <View style={s.loadingPane}><ActivityIndicator color="#0f766e" /></View>
      ) : tab === 'calls' ? (
        <View style={s.callsEmptyPane}>
          <Phone size={40} color="#cbd5e1" />
          <Text style={s.callsEmptyTitle}>No recent calls</Text>
          <Text style={s.callsEmptyText}>Start an audio call from any conversation.</Text>
        </View>
      ) : tab === 'groups' ? (
        <View style={s.callsEmptyPane}>
          <Users size={40} color="#cbd5e1" />
          <Text style={s.callsEmptyTitle}>No groups yet</Text>
          <TouchableOpacity style={s.createGroupBtn} onPress={() => setCreateGroupModal(true)}>
            <Plus size={16} color="#fff" />
            <Text style={s.createGroupBtnText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.chatList} contentContainerStyle={s.chatListContent}>
          {filteredChats.map(chat => (
            <TouchableOpacity key={chat.id} onPress={() => setSelectedChat(chat)}
              style={[s.chatCard, selectedChat?.id === chat.id && s.chatCardActive]}>
              <View style={s.avatarWrap}>
                <View style={[s.avatar, { backgroundColor: colorFor(chat.id) }]}>
                  <Text style={s.avatarText}>{chat.avatar || avatarFor(chat.name)}</Text>
                </View>
                {chat.online && <View style={s.onlineDot} />}
              </View>
              <View style={s.chatInfo}>
                <View style={s.chatRow}>
                  <Text style={s.chatName} numberOfLines={1}>{chat.name}</Text>
                  <Text style={s.chatTime}>{chat.time}</Text>
                </View>
                <View style={s.chatRow}>
                  <Text style={s.chatPreview} numberOfLines={1}>{chat.lastMsg}</Text>
                  {chat.unread > 0 && <View style={s.unreadBadge}><Text style={s.unreadText}>{chat.unread}</Text></View>}
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {filteredChats.length === 0 && (
            <View style={s.emptyList}>
              <MessageSquare size={36} color="#cbd5e1" />
              <Text style={s.emptyListTitle}>No conversations</Text>
              <TouchableOpacity style={s.addFirstBtn} onPress={() => setAddMemberModal(true)}>
                <UserPlus size={15} color="#fff" />
                <Text style={s.addFirstBtnText}>Add Member</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
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
            <TouchableOpacity style={s.headerActionBtn} onPress={() => { setAudioCallModal(true); setCallActive(false); }}>
              <Phone size={18} color="#0f766e" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerActionBtn}>
              <Video size={18} color="#0f766e" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerActionBtn}>
              <MoreVertical size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

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
const s = StyleSheet.create({
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
  storiesRow: { maxHeight: 100 },
  storiesContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  storyItem: { alignItems: 'center', gap: 5, width: 62 },
  storyRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, padding: 2, alignItems: 'center', justifyContent: 'center' },
  storyAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  storyAvatarText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  storyName: { fontSize: 10, fontWeight: '700', color: '#475569', textAlign: 'center', width: 60 },

  /* tabs */
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  tabBtnTextActive: { color: '#0f172a', fontWeight: '900' },

  /* search */
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },

  /* chat list */
  chatList: { flex: 1 },
  chatListContent: { paddingHorizontal: 12, paddingBottom: 24 },
  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9' },
  chatCardActive: { backgroundColor: '#f0fdfa', borderColor: '#0f766e' },
  avatarWrap: { marginRight: 12, position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  chatInfo: { flex: 1, minWidth: 0 },
  chatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  chatName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0f172a' },
  chatTime: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  chatPreview: { flex: 1, fontSize: 13, color: '#64748b', marginTop: 2 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { fontSize: 10, fontWeight: '900', color: '#fff' },

  /* empty states */
  loadingPane: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyList: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyListTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f766e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  addFirstBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  callsEmptyPane: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  callsEmptyTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  callsEmptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 24 },
  createGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  createGroupBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  /* chat panel */
  chatPanel: { flex: 1, backgroundColor: '#f8fafc' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyStateIcon: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  emptyStateTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  emptyStateSub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  emptyStateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f766e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
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
  bubbleSelf: { backgroundColor: '#0f766e', borderBottomRightRadius: 4 },
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
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
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
});
