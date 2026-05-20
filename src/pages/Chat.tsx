import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Dimensions, 
  Platform,
  Image,
  KeyboardAvoidingView
} from 'react-native';
import { 
  Search, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Phone, 
  ChevronLeft, 
  Plus,
  Image as ImageIcon,
  CheckCheck,
  Video,
  Info
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const mockDirectMessages = [
  { id: 'u1', name: 'Alex River', online: true, lastMsg: 'I think they were uploaded to the...', time: '11:22 AM', unread: 0 },
  { id: 'u2', name: 'Sarah Chen', online: true, lastMsg: 'Great work. That was the most...', time: '11:26 AM', unread: 2 },
  { id: 'u3', name: 'Morgan J.', online: false, lastMsg: 'Sent a document', time: 'Yesterday', unread: 0 },
];

const mockMessages = [
  { id: 1, user: 'Sarah Chen', time: '11:20 AM', text: 'Has anyone seen the latest design specs for the file sharing module?', self: false },
  { id: 2, user: 'Alex River', time: '11:22 AM', text: 'I think they were uploaded to the #design channel earlier today.', self: false },
  { id: 3, user: 'You', time: '11:25 AM', text: "On it! I've also implemented the end-to-end encryption layer we discussed.", self: true },
  { id: 4, user: 'Sarah Chen', time: '11:26 AM', text: 'Great work. That was the most critical piece for our enterprise clients.', self: false },
];

import { api, getSession } from '../lib/api';

export default function Chat() {
  const [selectedChat, setSelectedChat] = React.useState<any>(null);
  const [directMessages, setDirectMessages] = React.useState<any[]>(mockDirectMessages);
  const [messages, setMessages] = React.useState<any[]>(mockMessages);
  const [inputVal, setInputVal] = React.useState('');

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';
  const email = user?.email || 'admin@antigraviity.com';

  React.useEffect(() => {
    const loadChannels = async () => {
      try {
        const data = await api.chat.getChannels(workspaceId, email);
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((ch: any) => ({
            id: ch._id,
            name: ch.displayName || ch.name,
            online: ch.isOnline || false,
            lastMsg: ch.lastMessageContent || 'No messages yet',
            time: ch.lastMessageTime ? new Date(ch.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            unread: 0
          }));
          setDirectMessages(mapped);
        }
      } catch (err) {
        // Fallback to mock
      }
    };
    loadChannels();
  }, [workspaceId, email]);

  React.useEffect(() => {
    if (!selectedChat) return;
    const loadMessages = async () => {
      try {
        const data = await api.chat.getMessages(workspaceId, selectedChat.id);
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((m: any) => ({
            id: m._id,
            user: m.sender,
            time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: m.content,
            self: m.senderEmail === email || m.sender === 'You'
          }));
          setMessages(mapped);
        } else {
          setMessages(mockMessages);
        }
      } catch (err) {
        setMessages(mockMessages);
      }
    };
    loadMessages();
  }, [selectedChat, workspaceId, email]);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const newMsg = {
      id: String(Date.now()),
      user: 'You',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: inputVal,
      self: true
    };
    setMessages(prev => [...prev, newMsg]);
    setInputVal('');
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View>
          <Text style={styles.sidebarTitle}>Messaging</Text>
          <Text style={styles.sidebarSubtitle}>Kural Secure Network</Text>
        </View>
        <TouchableOpacity style={styles.plusBtn}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color="#94a3b8" />
        <TextInput 
          placeholder="Search teammates..." 
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      <ScrollView style={styles.chatList}>
        {directMessages.map(chat => (
          <TouchableOpacity 
            key={chat.id} 
            onPress={() => setSelectedChat(chat)}
            style={[
              styles.chatCard,
              selectedChat?.id === chat.id && styles.chatCardActive
            ]}
          >
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: chat.online ? '#e0e7ff' : '#f1f5f9' }]}>
                <Text style={[styles.avatarText, { color: chat.online ? '#4f46e5' : '#64748b' }]}>{chat.name[0]}</Text>
              </View>
              {chat.online && <View style={styles.onlineBadge} />}
            </View>
            <View style={styles.chatInfo}>
              <View style={styles.chatHeaderRow}>
                <Text style={[styles.chatName, chat.unread > 0 && styles.textBold]}>{chat.name}</Text>
                <Text style={[styles.chatTime, chat.unread > 0 && styles.textBoldTime]}>{chat.time}</Text>
              </View>
              <Text style={[styles.chatPreview, chat.unread > 0 && styles.textBold]} numberOfLines={1}>
                {chat.lastMsg}
              </Text>
            </View>
            {chat.unread > 0 && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadText}>{chat.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderActiveChat = () => {
    if (!selectedChat) {
      if (isMobile) return null; // Shouldn't happen based on rendering logic
      return (
        <View style={styles.emptyState}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png' }} 
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>Your Secure Workspace</Text>
          <Text style={styles.emptySubtitle}>Select a conversation or start a new one to begin messaging.</Text>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView 
        style={styles.activeChat} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <View style={styles.headerLeft}>
            {isMobile && (
              <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backBtn}>
                <ChevronLeft size={24} color="#334155" />
              </TouchableOpacity>
            )}
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{selectedChat.name[0]}</Text>
            </View>
            <View>
              <Text style={styles.headerName}>{selectedChat.name}</Text>
              <Text style={styles.headerStatus}>{selectedChat.online ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn}><Phone size={20} color="#64748b" /></TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}><Video size={20} color="#64748b" /></TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}><Info size={20} color="#64748b" /></TouchableOpacity>
          </View>
        </View>

        {/* Messages Feed */}
        <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>Today</Text>
          </View>
          
          {messages.map((msg, index) => {
            const showTail = index === messages.length - 1 || messages[index + 1].self !== msg.self;
            return (
              <View key={msg.id} style={[styles.messageWrapper, msg.self ? styles.wrapperSelf : styles.wrapperOther]}>
                {!msg.self && showTail && (
                  <View style={styles.msgAvatar}>
                    <Text style={styles.msgAvatarText}>{msg.user[0]}</Text>
                  </View>
                )}
                {!msg.self && !showTail && <View style={styles.msgAvatarSpacer} />}
                
                <View style={[
                  styles.bubble, 
                  msg.self ? styles.bubbleSelf : styles.bubbleOther,
                  !showTail && (msg.self ? styles.bubbleSelfNoTail : styles.bubbleOtherNoTail)
                ]}>
                  <Text style={[styles.msgText, msg.self ? styles.msgTextSelf : styles.msgTextOther]}>
                    {msg.text}
                  </Text>
                  <View style={styles.msgMeta}>
                    <Text style={[styles.msgTimeInner, msg.self ? styles.msgTimeSelf : styles.msgTimeOther]}>
                      {msg.time}
                    </Text>
                    {msg.self && <CheckCheck size={14} color="#c7d2fe" style={{ marginLeft: 4 }} />}
                  </View>
                </View>
              </View>
            )
          })}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.attachBtn}>
            <Plus size={24} color="#94a3b8" />
          </TouchableOpacity>
          <View style={styles.inputField}>
            <TextInput 
              style={styles.textInput}
              placeholder="Message..."
              placeholderTextColor="#94a3b8"
              value={inputVal}
              onChangeText={setInputVal}
              multiline
            />
            <TouchableOpacity style={styles.innerAttachBtn}>
              <Paperclip size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          {inputVal.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Send size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn}>
              <Phone size={20} color="#64748b" /> 
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={styles.container}>
      {(!isMobile || !selectedChat) && renderSidebar()}
      {(!isMobile || selectedChat) && renderActiveChat()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  
  // Sidebar Styles
  sidebar: {
    flex: isMobile ? 1 : 0.35,
    maxWidth: isMobile ? '100%' : 380,
    minWidth: 300,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  sidebarSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  chatList: {
    flex: 1,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  chatCardActive: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
    paddingLeft: 17,
  },
  avatarWrap: {
    marginRight: 16,
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  chatPreview: {
    fontSize: 14,
    color: '#64748b',
  },
  textBold: {
    fontWeight: '800',
    color: '#0f172a',
  },
  textBoldTime: {
    color: '#4f46e5',
    fontWeight: '800',
  },
  unreadPill: {
    backgroundColor: '#4f46e5',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    paddingHorizontal: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Active Chat Area
  activeChat: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  emptyState: {
    flex: 1,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 120,
    height: 120,
    opacity: 0.5,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 300,
  },
  
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerStatus: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerBtn: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
  },

  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 24,
    paddingBottom: 40,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 24,
  },
  dateText: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
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
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  msgAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  msgAvatarSpacer: {
    width: 44, // 32 + 12 margin
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
  },
  bubbleSelf: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  bubbleSelfNoTail: {
    borderBottomRightRadius: 24,
  },
  bubbleOtherNoTail: {
    borderBottomLeftRadius: 24,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 11,
    fontWeight: '600',
  },
  msgTimeSelf: {
    color: '#c7d2fe',
  },
  msgTimeOther: {
    color: '#94a3b8',
  },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  attachBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    marginBottom: 4,
  },
  inputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    fontSize: 15,
    color: '#0f172a',
    paddingTop: 8,
    paddingBottom: 8,
  },
  innerAttachBtn: {
    padding: 8,
    marginBottom: 2,
  },
  sendBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 24,
    marginBottom: 2,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  micBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    marginBottom: 2,
  }
});
