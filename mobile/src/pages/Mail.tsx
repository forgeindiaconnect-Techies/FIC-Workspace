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
  Modal,
  ActivityIndicator,
  Alert,
  useWindowDimensions
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { 
  Archive, 
  Trash2, 
  Search, 
  Star, 
  MoreVertical, 
  Plus, 
  ChevronLeft,
  Inbox,
  Send,
  FileText,
  Mail as MailIcon,
  X,
  Reply,
  CornerUpRight
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

import { api, getSession, SOCKET_URL } from '../lib/api';

const buildLocalSmartDraft = (prompt: string, subject: string, context: string) => {
  const subjectLine = subject.trim() ? ` regarding "${subject.trim()}"` : '';
  const contextLine = context.trim()
    ? 'I have reviewed the earlier message and will keep the response aligned with it.'
    : 'I wanted to share a clear update.';

  return [
    'Hi,',
    '',
    `${contextLine} ${prompt.trim() || `Please find my response${subjectLine} below.`}`,
    '',
    'Please let me know if you would like me to add more detail or adjust the timing.',
    '',
    'Best regards,'
  ].join('\n');
};

export default function Mail() {
  const [activeFolder, setActiveFolder] = React.useState('inbox');
  const [mailList, setMailList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEmail, setSelectedEmail] = React.useState<any>(null);

  // Compose Modal State
  const [composeVisible, setComposeVisible] = React.useState(false);
  const [composeTo, setComposeTo] = React.useState('');
  const [composeSubject, setComposeSubject] = React.useState('');
  const [composeBody, setComposeBody] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [aiGenerating, setAiGenerating] = React.useState(false);

  const handleAiSuggest = async () => {
    if (!composeBody.trim()) {
      Alert.alert("Input Required", "Please type a short prompt in the body so the AI knows what to draft.");
      return;
    }
    setAiGenerating(true);
    try {
      const response = await api.mail.getSmartReply(
        composeBody, 
        composeSubject,
        selectedEmail ? selectedEmail.body : ''
      );
      if (response && response.suggestion) {
        setComposeBody(response.suggestion);
      } else {
        Alert.alert("Notice", "AI generation returned an empty response.");
      }
    } catch (err: any) {
      console.warn(err);
      setComposeBody(buildLocalSmartDraft(composeBody, composeSubject, selectedEmail ? selectedEmail.body : ''));
      Alert.alert("AI Provider Unreachable", "A local smart draft was created instead.");
    } finally {
      setAiGenerating(false);
    }
  };

  const fetchEmails = async (folder: string) => {
    setLoading(true);
    try {
      const data = await api.mail.getMails(folder);
      setMailList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Could not fetch emails:", err);
      setMailList([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEmails(activeFolder);
  }, [activeFolder]);

  // Real-time WebSockets logic
  React.useEffect(() => {
    const { user } = getSession();
    if (!user || !user.email) return;

    let ws: WebSocket | null = null;
    try {
      // Derive WebSocket base: replace https://  wss:// and http://  ws://
      const wsBase = SOCKET_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
      const wsUrl = `${wsBase}/ws/mail?email=${encodeURIComponent(user.email)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => console.log('Mail Socket Connected for Real-Time Sync');
      ws.onmessage = (e) => {
        const payload = JSON.parse(e.data);
        if (payload.type === 'NEW_MAIL') {
          // If viewing inbox, prepend it
          if (activeFolder === 'inbox') {
            setMailList(prev => [payload.mail, ...prev]);
          }
        }
      };
      ws.onerror = (e) => console.log('Mail Socket Error:', e);
    } catch (e) {
      console.warn('Mail Socket Init failed', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [activeFolder]);

  const handleSendMail = async () => {
    if (!composeTo.trim()) return Alert.alert("Error", "Please provide a recipient");
    setSending(true);
    try {
      await api.mail.sendMail({
        to: composeTo.split(',').map(e => e.trim()),
        subject: composeSubject || '(No Subject)',
        body: composeBody
      });
      setComposeVisible(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      if (activeFolder === 'sent') fetchEmails('sent');
      Alert.alert("Success", "Email sent securely.");
    } catch (e) {
      console.warn(e);
      Alert.alert("Failed", "Could not send the email.");
    } finally {
      setSending(false);
    }
  };

  const handleOpenEmail = async (email: any) => {
    setSelectedEmail(email);
    if (!email.isRead) {
      setMailList(prev => prev.map(m => m._id === email._id ? { ...m, isRead: true } : m));
      await api.mail.markRead(email._id);
    }
  };

  const toggleStar = async (email: any) => {
    // Optimistic UI
    if (selectedEmail?._id === email._id) {
      setSelectedEmail({ ...selectedEmail, isStarred: !email.isStarred });
    }
    setMailList(prev => prev.map(m => m._id === email._id ? { ...m, isStarred: !m.isStarred } : m));
    
    try {
      await api.mail.toggleStar(email._id);
    } catch (err) {
      console.warn(err);
      fetchEmails(activeFolder); // Revert on failure
    }
  };

  const moveMail = async (emailId: string, destFolder: string) => {
    setMailList(prev => prev.filter(m => m._id !== emailId));
    if (selectedEmail?._id === emailId) setSelectedEmail(null);
    try {
      await api.mail.moveMail(emailId, destFolder);
    } catch (e) {
      console.warn(e);
      fetchEmails(activeFolder);
    }
  };

  const deleteMail = async (emailId: string) => {
    setMailList(prev => prev.filter(m => m._id !== emailId));
    if (selectedEmail?._id === emailId) setSelectedEmail(null);
    try {
      await api.mail.deleteMail(emailId);
    } catch (e) {
      console.warn(e);
      fetchEmails(activeFolder);
    }
  };

  const renderSidebar = () => {
    const folders = [
      { id: 'inbox', label: 'Inbox', icon: Inbox },
      { id: 'starred', label: 'Starred', icon: Star },
      { id: 'sent', label: 'Sent', icon: Send },
      { id: 'drafts', label: 'Drafts', icon: FileText },
      { id: 'archive', label: 'Archive', icon: Archive },
      { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    return (
      <View style={styles.sidebarContainer}>
        <TouchableOpacity 
          style={styles.mainComposeBtn}
          onPress={() => setComposeVisible(true)}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.mainComposeText}>Compose Mail</Text>
        </TouchableOpacity>

        <View style={styles.folderList}>
          {folders.map(folder => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            return (
              <TouchableOpacity 
                key={folder.id} 
                style={[styles.folderItem, isActive && styles.folderItemActive]}
                onPress={() => { setActiveFolder(folder.id); setSelectedEmail(null); }}
              >
                <Icon size={18} color={isActive ? "#2563eb" : "#64748b"} />
                <Text style={[styles.folderText, isActive && styles.folderTextActive]}>{folder.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    );
  };

  const renderMailList = () => {
    return (
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{activeFolder.charAt(0).toUpperCase() + activeFolder.slice(1)}</Text>
          <View style={styles.searchWrapper}>
            <Search size={16} color="#94a3b8" />
            <TextInput 
              placeholder="Search..." 
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : mailList.length === 0 ? (
          <View style={styles.emptyBox}>
            <MailIcon size={48} color="#e2e8f0" />
            <Text style={styles.emptyText}>Nothing to see here</Text>
          </View>
        ) : (
          <ScrollView style={styles.listScroller}>
            {mailList.map((email) => {
              const displayDate = new Date(email.sentAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
              return (
                <TouchableOpacity 
                  key={email._id} 
                  onPress={() => handleOpenEmail(email)}
                  style={[
                    styles.mailCard, 
                    !email.isRead && activeFolder !== 'sent' && styles.unreadCard,
                    selectedEmail?._id === email._id && styles.selectedCard
                  ]}
                >
                  <View style={styles.mailTop}>
                    <View style={styles.senderGroup}>
                      <TouchableOpacity onPress={() => toggleStar(email)}>
                        <Star size={16} color={email.isStarred ? "#fbbf24" : "#cbd5e1"} fill={email.isStarred ? "#fbbf24" : "none"} />
                      </TouchableOpacity>
                      <Text style={[styles.senderName, !email.isRead && activeFolder !== 'sent' && styles.boldText]}>
                        {activeFolder === 'sent' ? `To: ${email.recipientEmails.join(', ')}` : email.senderName}
                      </Text>
                    </View>
                    <Text style={[styles.mailTime, !email.isRead && activeFolder !== 'sent' && styles.boldText]}>{displayDate}</Text>
                  </View>
                  <Text style={[styles.mailSubject, !email.isRead && activeFolder !== 'sent' && styles.boldText]} numberOfLines={1}>{email.subject}</Text>
                  <Text style={styles.mailPreview} numberOfLines={1}>{email.body.replace(/\n/g, ' ')}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderDetailView = () => {
    if (!selectedEmail) {
      if (isMobile) return null; // Detail view doesn't exist on mobile if not selected
      return (
        <View style={styles.detailPlaceholder}>
          <MailIcon size={64} color="#f1f5f9" />
          <Text style={styles.placeholderText}>Select an item to read</Text>
        </View>
      );
    }

    const displayDateFull = new Date(selectedEmail.sentAt).toLocaleString();
    const { width: contentWidth } = useWindowDimensions();

    return (
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <View style={styles.detailActionsLeft}>
            {isMobile && (
              <TouchableOpacity onPress={() => setSelectedEmail(null)} style={styles.backBtn}>
                <ChevronLeft size={24} color="#64748b" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => moveMail(selectedEmail._id, activeFolder === 'archive' ? 'inbox' : 'archive')}
            >
              <Archive size={18} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => {
                if (activeFolder === 'trash') deleteMail(selectedEmail._id);
                else moveMail(selectedEmail._id, 'trash');
              }}
            >
              <Trash2 size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View style={styles.detailActionsRight}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => toggleStar(selectedEmail)}>
              <Star size={18} color={selectedEmail.isStarred ? "#fbbf24" : "#64748b"} fill={selectedEmail.isStarred ? "#fbbf24" : "none"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}><MoreVertical size={18} color="#64748b" /></TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.detailBodyScroller} contentContainerStyle={styles.detailBody}>
          <Text style={styles.detailSubjectBig}>{selectedEmail.subject}</Text>
          
          <View style={styles.senderHeaderBox}>
            <View style={styles.senderAvatarBox}>
              <Text style={styles.avatarLetter}>{selectedEmail.senderName[0]}</Text>
            </View>
            <View style={styles.senderMetaBox}>
              <Text style={styles.senderNameBold}>{selectedEmail.senderName}</Text>
              <Text style={styles.senderEmailSub}>From: {selectedEmail.senderEmail}</Text>
              <Text style={styles.senderEmailSub}>To: {selectedEmail.recipientEmails.join(', ')}</Text>
            </View>
            <Text style={styles.detailTime}>{displayDateFull}</Text>
          </View>

          <View style={styles.emailBodyContentBox}>
            {selectedEmail.body && selectedEmail.body.includes('<') && selectedEmail.body.includes('>') ? (
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html: selectedEmail.body }}
                baseStyle={{ fontSize: 14, color: '#334155', lineHeight: 22 }}
              />
            ) : (
              <Text style={styles.emailContentText}>{selectedEmail.body}</Text>
            )}
          </View>
          
          <View style={styles.replyFooterActions}>
            <TouchableOpacity 
              style={styles.replyQuickBtn}
              onPress={() => {
                setComposeTo(selectedEmail.senderEmail);
                setComposeSubject(`Re: ${selectedEmail.subject}`);
                setComposeVisible(true);
              }}
            >
              <Reply size={16} color="#64748b" />
              <Text style={styles.replyQuickText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.replyQuickBtn}
              onPress={() => {
                setComposeTo('');
                setComposeSubject(`Fwd: ${selectedEmail.subject}`);
                setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${selectedEmail.senderEmail}\nDate: ${displayDateFull}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`);
                setComposeVisible(true);
              }}
            >
              <CornerUpRight size={16} color="#64748b" />
              <Text style={styles.replyQuickText}>Forward</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.replyQuickBtn}
              onPress={async () => {
                try {
                  const html = `
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                        <style>
                          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                          h1 { font-size: 24px; color: #1e293b; margin-bottom: 5px; }
                          .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
                        </style>
                      </head>
                      <body>
                        <h1>${selectedEmail.subject}</h1>
                        <div class="meta">
                          <strong>From:</strong> ${selectedEmail.senderName} &lt;${selectedEmail.senderEmail}&gt;<br>
                          <strong>Date:</strong> ${new Date(selectedEmail.sentAt).toLocaleString()}<br>
                        </div>
                        <div class="content">
                          ${selectedEmail.body}
                        </div>
                      </body>
                    </html>
                  `;
                  const { uri } = await Print.printToFileAsync({ html });
                  await Sharing.shareAsync(uri);
                } catch (error: any) {
                  Alert.alert('Error generating PDF', error.message);
                }
              }}
            >
              <FileText size={16} color="#64748b" />
              <Text style={styles.replyQuickText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Compose Modal */}
      <Modal
        visible={composeVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setComposeVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.composeModalBox}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>New Message</Text>
              <TouchableOpacity onPress={() => setComposeVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.composeField}>
              <Text style={styles.composeLabel}>To:</Text>
              <TextInput 
                style={styles.composeInput} 
                value={composeTo}
                onChangeText={setComposeTo}
                placeholder="email@example.com, another@example.com"
                placeholderTextColor="#cbd5e1"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.composeField}>
              <TextInput 
                style={styles.composeInput} 
                value={composeSubject}
                onChangeText={setComposeSubject}
                placeholder="Subject"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <TextInput 
              style={styles.composeBodyInput} 
              value={composeBody}
              onChangeText={setComposeBody}
              multiline={true}
              textAlignVertical="top"
            />

            <View style={styles.composeFooter}>
              <TouchableOpacity style={styles.trashBtn} onPress={() => setComposeVisible(false)}>
                <Trash2 size={20} color="#94a3b8" />
              </TouchableOpacity>
              
              <View style={styles.footerRight}>
                <TouchableOpacity 
                  style={[styles.aiBtn, aiGenerating && { opacity: 0.7 }]} 
                  onPress={handleAiSuggest}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Text style={styles.aiBtnText}> AI Suggest</Text>}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.sendBtn, sending && { opacity: 0.7 }]} 
                  onPress={handleSendMail}
                  disabled={sending}
                >
                  {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
                  {!sending && <Send size={16} color="#fff" style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {(!isMobile || !selectedEmail) && (
        <View style={styles.layoutLeft}>
          {!isMobile && renderSidebar()}
          {renderMailList()}
        </View>
      )}

      {(!isMobile || selectedEmail) && (
        <View style={styles.layoutRight}>
          {renderDetailView()}
        </View>
      )}

      {/* Mobile Floating Action Button */}
      {isMobile && !selectedEmail && (
        <TouchableOpacity style={styles.fabBtn} onPress={() => setComposeVisible(true)}>
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      )}
      
      {/* Mobile simple folder strip */}
      {isMobile && !selectedEmail && (
        <View style={styles.mobileFolderStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['inbox', 'starred', 'sent', 'archive', 'trash'].map(f => (
              <TouchableOpacity 
                key={f}
                style={[styles.mobileFolderTab, activeFolder === f && styles.mobileFolderTabActive]}
                onPress={() => setActiveFolder(f)}
              >
                <Text style={[styles.mobileFolderText, activeFolder === f && styles.mobileFolderTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  layoutLeft: {
    flex: isMobile ? 1 : 1.2,
    flexDirection: 'row',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  layoutRight: {
    flex: isMobile ? 1 : 2,
    backgroundColor: '#fff',
  },
  
  // Sidebar (Desktop)
  sidebarContainer: {
    width: 240,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  mainComposeBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 24,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  mainComposeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  folderList: {
    gap: 8,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  folderItemActive: {
    backgroundColor: '#eff6ff',
  },
  folderText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  folderTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },

  // Mobile folders
  mobileFolderStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mobileFolderTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
  },
  mobileFolderTabActive: {
    backgroundColor: '#2563eb',
  },
  mobileFolderText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  mobileFolderTextActive: {
    color: '#fff',
  },

  // List View
  listContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 16,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
  },
  listScroller: {
    flex: 1,
    marginBottom: isMobile ? 60 : 0, // avoid mobile strip
  },
  mailCard: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  unreadCard: {
    backgroundColor: '#f8fafc',
  },
  selectedCard: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    paddingLeft: 16,
  },
  mailTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  senderName: {
    fontSize: 14,
    color: '#334155',
  },
  mailTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  mailSubject: {
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 4,
    paddingLeft: 28, // align past star
  },
  mailPreview: {
    fontSize: 13,
    color: '#64748b',
    paddingLeft: 28,
  },
  boldText: {
    fontWeight: '800',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
  },

  // Detail View
  detailPlaceholder: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  placeholderText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 16,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  backBtn: {
    marginRight: 8,
  },
  detailBodyScroller: {
    flex: 1,
  },
  detailBody: {
    padding: 24,
    paddingBottom: 60,
  },
  detailSubjectBig: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 24,
  },
  senderHeaderBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  senderAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4f46e5',
  },
  senderMetaBox: {
    flex: 1,
    justifyContent: 'center',
  },
  senderNameBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  senderEmailSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  detailTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emailBodyContentBox: {
    minHeight: 200,
  },
  emailContentText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  replyFooterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 24,
  },
  replyQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    gap: 8,
  },
  replyQuickText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  // Compose Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: isMobile ? 'flex-end' : 'center',
    alignItems: 'center',
  },
  composeModalBox: {
    width: isMobile ? '100%' : 600,
    height: isMobile ? '90%' : 600,
    backgroundColor: '#fff',
    borderTopLeftRadius: isMobile ? 32 : 16,
    borderTopRightRadius: isMobile ? 32 : 16,
    borderBottomLeftRadius: isMobile ? 0 : 16,
    borderBottomRightRadius: isMobile ? 0 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: isMobile ? 32 : 16,
    borderTopRightRadius: isMobile ? 32 : 16,
  },
  composeTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  composeField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 20,
  },
  composeLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    width: 30,
  },
  composeInput: {
    flex: 1,
    height: 50,
    fontSize: 14,
    color: '#0f172a',
  },
  composeBodyInput: {
    flex: 1,
    padding: 20,
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  composeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  trashBtn: {
    padding: 10,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiBtn: {
    backgroundColor: '#ede9fe',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  aiBtnText: {
    color: '#8b5cf6',
    fontWeight: '800',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  // FAB
  fabBtn: {
    position: 'absolute',
    right: 24,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  }
});
