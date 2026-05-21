import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  CheckCheck,
  ChevronLeft,
  Info,
  Lock,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Video,
  X
} from 'lucide-react-native';
import { api, getSession } from '../lib/api';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const fallbackChats = [
  { id: 'demo-1', name: 'Sarah Chen', email: 'sarah@antigraviity.com', online: true, lastMsg: 'Add a real user to start database chat.', time: 'Demo', unread: 0, avatar: 'SC' }
];

const fallbackMessages = [
  { id: 'welcome', user: 'Kural', time: 'Now', text: 'Your workspace messages will appear here once users are added to MongoDB.', self: false }
];

const avatarFor = (name: string) => {
  const parts = String(name || 'User').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
};

const formatTime = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function Chat() {
  const [selectedChat, setSelectedChat] = React.useState<any>(null);
  const [directMessages, setDirectMessages] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>(fallbackMessages);
  const [inputVal, setInputVal] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loadingChannels, setLoadingChannels] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [memberModalVisible, setMemberModalVisible] = React.useState(false);
  const [savingMember, setSavingMember] = React.useState(false);
  const [newMemberName, setNewMemberName] = React.useState('');
  const [newMemberEmail, setNewMemberEmail] = React.useState('');
  const [newMemberPassword, setNewMemberPassword] = React.useState('password123');
  const [connectionNote, setConnectionNote] = React.useState<string | null>(null);

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';
  const email = user?.email || 'admin@antigraviity.com';

  const loadChannels = React.useCallback(async () => {
    setLoadingChannels(true);
    try {
      const data = await api.chat.getChannels(workspaceId, email);
      const mapped = Array.isArray(data)
        ? data.map((ch: any) => ({
            id: ch._id,
            name: ch.displayName || ch.name || ch.email,
            email: ch.email,
            online: ch.isOnline !== false,
            lastMsg: ch.lastMessageContent || 'Start a secure Kural conversation',
            time: formatTime(ch.lastMessageTime),
            unread: 0,
            avatar: ch.avatar || avatarFor(ch.displayName || ch.name || ch.email),
            role: ch.role || 'Member'
          }))
        : [];

      setDirectMessages(mapped);
      setConnectionNote(mapped.length ? null : 'Add a workspace user to start database-backed Kural chats.');
    } catch (err: any) {
      console.warn('Could not load Kural channels:', err);
      setDirectMessages(fallbackChats);
      setConnectionNote('Kural is using demo data because the database API is unreachable.');
    } finally {
      setLoadingChannels(false);
    }
  }, [workspaceId, email]);

  React.useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  React.useEffect(() => {
    if (!selectedChat) return;

    const loadMessages = async () => {
      if (String(selectedChat.id).startsWith('demo-')) {
        setMessages(fallbackMessages);
        return;
      }

      setLoadingMessages(true);
      try {
        const data = await api.chat.getMessages(workspaceId, selectedChat.id);
        const mapped = Array.isArray(data)
          ? data.map((m: any) => ({
              id: m._id,
              user: m.sender || m.senderName,
              time: formatTime(m.timestamp),
              text: m.content,
              self: m.senderEmail === email || m.sender === 'You'
            }))
          : [];
        setMessages(mapped.length ? mapped : []);
      } catch (err) {
        console.warn('Could not load Kural messages:', err);
        setMessages(fallbackMessages);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChat, workspaceId, email]);

  const filteredChats = directMessages.filter(chat => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${chat.name} ${chat.email} ${chat.lastMsg}`.toLowerCase().includes(query);
  });

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim() || !newMemberPassword.trim()) {
      Alert.alert('Missing details', 'Name, email, and password are required.');
      return;
    }

    setSavingMember(true);
    try {
      await api.members.addMember({
        name: newMemberName.trim(),
        email: newMemberEmail.trim().toLowerCase(),
        password: newMemberPassword,
        role: 'Member',
        workspaceId
      });
      setMemberModalVisible(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPassword('password123');
      await loadChannels();
      Alert.alert('User added', 'The new user can now sign in and chat in Kural.');
    } catch (err: any) {
      Alert.alert('Could not add user', err.message || 'Please check the backend connection.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleSend = async () => {
    const content = inputVal.trim();
    if (!content || !selectedChat) return;

    const optimisticId = String(Date.now());
    const optimistic = {
      id: optimisticId,
      user: 'You',
      time: formatTime(new Date()),
      text: content,
      self: true
    };

    setMessages(prev => [...prev, optimistic]);
    setInputVal('');
    setDirectMessages(prev => prev.map(chat => (
      chat.id === selectedChat.id
        ? { ...chat, lastMsg: content, time: optimistic.time }
        : chat
    )));

    if (String(selectedChat.id).startsWith('demo-')) return;

    try {
      const saved = await api.chat.sendMessage(workspaceId, selectedChat.id, content);
      setMessages(prev => prev.map(message => (
        message.id === optimisticId
          ? {
              id: saved._id,
              user: saved.sender || 'You',
              time: formatTime(saved.timestamp),
              text: saved.content,
              self: true
            }
          : message
      )));
    } catch (err: any) {
      Alert.alert('Message not saved', err.message || 'Kural could not reach the database.');
    }
  };

  const renderAddMemberModal = () => (
    <Modal
      visible={memberModalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setMemberModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.memberModal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add workspace user</Text>
              <Text style={styles.modalSub}>Creates a MongoDB user account for login and Kural chat.</Text>
            </View>
            <TouchableOpacity style={styles.iconGhostBtn} onPress={() => setMemberModalVisible(false)}>
              <X size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder="Priya Raman"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="priya@company.com"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Temporary password</Text>
            <TextInput
              style={styles.modalInput}
              value={newMemberPassword}
              onChangeText={setNewMemberPassword}
              secureTextEntry
              placeholder="password123"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMemberModalVisible(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAddMember} disabled={savingMember}>
              {savingMember ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create User</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View>
          <Text style={styles.sidebarTitle}>Kural</Text>
          <View style={styles.secureLine}>
            <ShieldCheck size={13} color="#0f766e" />
            <Text style={styles.sidebarSubtitle}>Database secure network</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addUserBtn} onPress={() => setMemberModalVisible(true)}>
          <UserPlus size={19} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color="#64748b" />
        <TextInput
          placeholder="Search people and messages"
          placeholderTextColor="#64748b"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {connectionNote && (
        <View style={styles.connectionNote}>
          <Lock size={14} color="#0f766e" />
          <Text style={styles.connectionNoteText}>{connectionNote}</Text>
        </View>
      )}

      {loadingChannels ? (
        <View style={styles.loadingPane}>
          <ActivityIndicator color="#0f766e" />
        </View>
      ) : (
        <ScrollView style={styles.chatList} contentContainerStyle={styles.chatListContent}>
          {filteredChats.map(chat => (
            <TouchableOpacity
              key={chat.id}
              onPress={() => setSelectedChat(chat)}
              style={[
                styles.chatCard,
                selectedChat?.id === chat.id && styles.chatCardActive
              ]}
            >
              <View style={styles.avatarWrap}>
                <View style={[styles.avatar, chat.online && styles.avatarOnline]}>
                  <Text style={styles.avatarText}>{chat.avatar || avatarFor(chat.name)}</Text>
                </View>
                {chat.online && <View style={styles.onlineBadge} />}
              </View>
              <View style={styles.chatInfo}>
                <View style={styles.chatHeaderRow}>
                  <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </View>
                <Text style={styles.chatRole} numberOfLines={1}>{chat.email || chat.role}</Text>
                <Text style={styles.chatPreview} numberOfLines={1}>{chat.lastMsg}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {filteredChats.length === 0 && (
            <View style={styles.emptyList}>
              <MessageSquare size={36} color="#cbd5e1" />
              <Text style={styles.emptyListTitle}>No conversations</Text>
              <Text style={styles.emptyListSub}>Add a user to create a Kural direct message.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );

  const renderActiveChat = () => {
    if (!selectedChat) {
      if (isMobile) return null;
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconShell}>
            <MessageSquare size={46} color="#0f766e" />
          </View>
          <Text style={styles.emptyTitle}>Kural workspace chat</Text>
          <Text style={styles.emptySubtitle}>Add a user or select a conversation to start a database-backed thread.</Text>
          <TouchableOpacity style={styles.emptyAction} onPress={() => setMemberModalVisible(true)}>
            <UserPlus size={17} color="#fff" />
            <Text style={styles.emptyActionText}>Add User</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView
        style={styles.activeChat}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatHeader}>
          <View style={styles.headerLeft}>
            {isMobile && (
              <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backBtn}>
                <ChevronLeft size={24} color="#0f172a" />
              </TouchableOpacity>
            )}
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{selectedChat.avatar || avatarFor(selectedChat.name)}</Text>
            </View>
            <View style={styles.headerIdentity}>
              <Text style={styles.headerName} numberOfLines={1}>{selectedChat.name}</Text>
              <Text style={styles.headerStatus} numberOfLines={1}>
                {selectedChat.online ? 'Online' : 'Offline'} - {selectedChat.email || 'Kural member'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn}><Phone size={19} color="#475569" /></TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}><Video size={19} color="#475569" /></TouchableOpacity>
            {!isMobile && <TouchableOpacity style={styles.headerBtn}><Info size={19} color="#475569" /></TouchableOpacity>}
            {!isMobile && <TouchableOpacity style={styles.headerBtn}><MoreVertical size={19} color="#475569" /></TouchableOpacity>}
          </View>
        </View>

        {loadingMessages ? (
          <View style={styles.loadingPane}>
            <ActivityIndicator color="#0f766e" />
          </View>
        ) : (
          <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
            <View style={styles.dateSeparator}>
              <Text style={styles.dateText}>Secure thread</Text>
            </View>

            {messages.length === 0 ? (
              <View style={styles.noMessagesBox}>
                <Text style={styles.noMessagesTitle}>No messages yet</Text>
                <Text style={styles.noMessagesSub}>Send the first message to persist this conversation.</Text>
              </View>
            ) : messages.map((msg, index) => {
              const next = messages[index + 1];
              const showAvatar = !msg.self && (!next || next.self !== msg.self);
              return (
                <View key={msg.id} style={[styles.messageWrapper, msg.self ? styles.wrapperSelf : styles.wrapperOther]}>
                  {!msg.self && (showAvatar ? (
                    <View style={styles.msgAvatar}>
                      <Text style={styles.msgAvatarText}>{avatarFor(msg.user)}</Text>
                    </View>
                  ) : <View style={styles.msgAvatarSpacer} />)}

                  <View style={[
                    styles.bubble,
                    msg.self ? styles.bubbleSelf : styles.bubbleOther
                  ]}>
                    <Text style={[styles.msgText, msg.self ? styles.msgTextSelf : styles.msgTextOther]}>
                      {msg.text}
                    </Text>
                    <View style={styles.msgMeta}>
                      <Text style={[styles.msgTimeInner, msg.self ? styles.msgTimeSelf : styles.msgTimeOther]}>
                        {msg.time || 'Now'}
                      </Text>
                      {msg.self && <CheckCheck size={14} color="#ccfbf1" style={{ marginLeft: 4 }} />}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.attachBtn}>
            <Paperclip size={20} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.inputField}>
            <TextInput
              style={styles.textInput}
              placeholder="Message Kural"
              placeholderTextColor="#64748b"
              value={inputVal}
              onChangeText={setInputVal}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !inputVal.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputVal.trim()}
          >
            <Send size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={styles.container}>
      {renderAddMemberModal()}
      {(!isMobile || !selectedChat) && renderSidebar()}
      {(!isMobile || selectedChat) && renderActiveChat()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  sidebar: {
    flex: isMobile ? 1 : 0.36,
    maxWidth: isMobile ? '100%' : 420,
    minWidth: isMobile ? 0 : 320,
    borderRightWidth: 1,
    borderRightColor: '#dbe4ea',
    backgroundColor: '#f8fafc',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 22,
    paddingBottom: 14,
  },
  sidebarTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
  },
  secureLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  addUserBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  connectionNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  connectionNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#115e59',
    fontWeight: '700',
    lineHeight: 17,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatCardActive: {
    borderColor: '#0f766e',
    backgroundColor: '#f0fdfa',
  },
  avatarWrap: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#164e63',
  },
  avatarOnline: {
    backgroundColor: '#0f766e',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chatName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  chatTime: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  chatRole: {
    marginTop: 2,
    fontSize: 11,
    color: '#0f766e',
    fontWeight: '800',
  },
  chatPreview: {
    marginTop: 5,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  loadingPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  emptyListTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  emptyListSub: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  activeChat: {
    flex: 1,
    backgroundColor: '#eef4f3',
  },
  emptyState: {
    flex: 1,
    backgroundColor: '#eef4f3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIconShell: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 21,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 20,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isMobile ? 14 : 22,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbe4ea',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  backBtn: {
    marginRight: 10,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerStatus: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: isMobile ? 14 : 24,
    paddingBottom: 34,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateText: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '900',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  noMessagesBox: {
    alignItems: 'center',
    padding: 32,
    gap: 6,
  },
  noMessagesTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  noMessagesSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  wrapperSelf: {
    justifyContent: 'flex-end',
  },
  wrapperOther: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#134e4a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  msgAvatarText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
  },
  msgAvatarSpacer: {
    width: 42,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
  },
  bubbleSelf: {
    backgroundColor: '#0f766e',
    borderBottomRightRadius: 5,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4ea',
    borderBottomLeftRadius: 5,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
  },
  msgTextSelf: {
    color: '#fff',
  },
  msgTextOther: {
    color: '#0f172a',
  },
  msgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  msgTimeInner: {
    fontSize: 10,
    fontWeight: '800',
  },
  msgTimeSelf: {
    color: '#ccfbf1',
  },
  msgTimeOther: {
    color: '#94a3b8',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: isMobile ? 12 : 18,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dbe4ea',
    gap: 10,
  },
  attachBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe4ea',
    paddingHorizontal: 14,
  },
  textInput: {
    minHeight: 42,
    maxHeight: 112,
    fontSize: 15,
    color: '#0f172a',
    paddingVertical: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 14,
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  memberModal: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    maxWidth: 330,
  },
  iconGhostBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGroup: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#475569',
  },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  }
});
