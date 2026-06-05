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
  useWindowDimensions,
  Image,
  TouchableWithoutFeedback,
  Linking
} from 'react-native';
import RenderHtml, { HTMLElementModel, HTMLContentModel } from 'react-native-render-html';
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
  CornerUpRight,
  Menu,
  Home,
  Grid,
  MessageSquare,
  Video,
  Paperclip,
  Image as ImageIcon,
  Bold,
  Italic,
  List,
  ChevronDown,
  Users,
  ShieldCheck
} from 'lucide-react-native';
import { useNavigate } from '../lib/router';
import tw from 'twrnc';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { api, getSession, SOCKET_URL, API_URL } from '../lib/api';

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

const renderTextWithLinks = (text: string, navigate?: any) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|nexus-workspace:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <Text key={i} style={{ color: '#0052CC', textDecorationLine: 'underline' }} onPress={() => {
          if (part.startsWith('nexus-workspace://meet/room/') && navigate) {
            const parsed = part.replace('nexus-workspace://meet/room/', '');
            const [roomId, query] = parsed.split('?');
            const pwdMatch = query ? query.match(/(?:^|&)pwd=([^&]+)/) : null;
            navigate(`/meetings?joinCode=${roomId}&pwd=${pwdMatch ? pwdMatch[1] : ''}`);
          } else {
            Linking.openURL(part).catch(e => console.warn(e));
          }
        }}>
          {part}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
};

export default function Mail() {
  const { width } = useWindowDimensions();
  const navigate = useNavigate();
  const isMobile = width < 768;
  const contentWidth = width;
  const styles = React.useMemo(() => getStyles(width, isMobile), [width, isMobile]);

  const [activeFolder, setActiveFolder] = React.useState('inbox');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [appSwitcherOpen, setAppSwitcherOpen] = React.useState(false);
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
  const [attachments, setAttachments] = React.useState<Array<{name: string; uri: string; type: string; size: number; cloudUrl?: string}>>([]);
  const [uploading, setUploading] = React.useState(false);

  const CLOUDINARY_CLOUD = 'dfou7lxtg';
  const CLOUDINARY_UPLOAD_PRESET = 'mail_attachments';
  const CLOUDINARY_FOLDER = 'c-726de3a6883bccf114775c7a84376e';

  const uploadToCloudinary = async (file: {uri: string; name: string; type: string}): Promise<string> => {
    // Convert file to base64 and upload via backend proxy (keeps API secret server-side)
    const fileRes = await fetch(file.uri);
    const blob = await fileRes.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { token } = getSession();
    const res = await fetch(`${API_URL}/api/mail/upload-attachment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ fileBase64: base64, fileName: file.name, mimeType: file.type }),
    });
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    const data = await res.json();
    if (!data?.url) throw new Error('Upload failed: no URL returned');
    return data.url;
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
      if (result.canceled) return;
      const files = result.assets.map((a: any) => ({ name: a.name, uri: a.uri, type: a.mimeType || 'application/octet-stream', size: a.size || 0 }));
      setAttachments(prev => [...prev, ...files]);
    } catch (e) { console.warn('Document pick error:', e); }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permission needed', 'Please grant photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsMultipleSelection: true, quality: 0.85 });
      if (result.canceled) return;
      const files = result.assets.map((a: any) => ({ name: a.fileName || `image_${Date.now()}.jpg`, uri: a.uri, type: a.type === 'video' ? 'video/mp4' : 'image/jpeg', size: a.fileSize || 0 }));
      setAttachments(prev => [...prev, ...files]);
    } catch (e) { console.warn('Image pick error:', e); }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      let list = Array.isArray(data) ? data : [];
      setMailList(list);
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
      // Upload attachments to Cloudinary first
      let uploadedAttachments: Array<{name: string; url: string; size: number; type: string}> = [];
      if (attachments.length > 0) {
        setUploading(true);
        uploadedAttachments = await Promise.all(
          attachments.map(async (att) => {
            const url = await uploadToCloudinary({ uri: att.uri, name: att.name, type: att.type });
            return { name: att.name, url, size: att.size, type: att.type };
          })
        );
        setUploading(false);
      }
      await api.mail.sendMail({
        to: composeTo.split(',').map(e => e.trim()),
        subject: composeSubject || '(No Subject)',
        body: composeBody,
        attachments: uploadedAttachments,
      });
      setComposeVisible(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setAttachments([]);
      if (activeFolder === 'sent') fetchEmails('sent');
      Alert.alert("Success", "Email sent securely.");
    } catch (e) {
      console.warn(e);
      setUploading(false);
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
      <View style={tw`flex-1 bg-[#F8F9FB] pt-[16px]`}>
        {/* Search Bar Section */}
        <View style={tw`px-[16px] mb-[16px]`}>
          <View style={[tw`flex-row items-center px-[16px] w-full h-[58px] bg-[#FFFFFF] rounded-[12px] border border-[#C3C6D6]`, { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }]}>
            <Search size={18} color="#737685" style={tw`mr-3`} />
            <TextInput 
              placeholder="Search in mail" 
              placeholderTextColor="#434654"
              style={tw`flex-1 text-[16px] text-[#434654]`}
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
          <ScrollView style={tw`flex-1`} contentContainerStyle={tw`px-[16px] pb-[120px] gap-[8px]`}>
            {mailList.map((email, index) => {
              const displayDate = new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isUnread = !email.isRead && activeFolder !== 'sent';
              
              return (
                <TouchableOpacity 
                  key={email._id}
                  onPress={() => handleOpenEmail(email)}
                  style={[
                    tw`flex-col p-[16px] w-full h-[108px] bg-[#FFFFFF] rounded-[12px] gap-[4px]`,
                    isUnread ? tw`border-l-[4px] border-[#003D9B]` : {},
                    { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }
                  ]}
                >
                  {/* Name and Time row */}
                  <View style={tw`flex-row justify-between items-center w-full h-[24px]`}>
                    <View style={tw`flex-row items-center flex-1 pr-2`}>
                      {email.isStarred && <Star size={14} color="#fbbf24" fill="#fbbf24" style={tw`mr-1`} />}
                      <Text style={tw`font-bold text-[16px] text-[#191C1E] flex-1`} numberOfLines={1}>
                        {activeFolder === 'sent' ? `To: ${email.recipientEmails.join(', ')}` : email.senderName}
                      </Text>
                    </View>
                    <Text style={tw`font-medium text-[12px] tracking-[0.24px] ${isUnread ? 'text-[#003D9B]' : 'text-[#737685]'}`}>
                      {displayDate}
                    </Text>
                  </View>
                  
                  {/* Subject */}
                  <View style={tw`w-full h-[24px]`}>
                    <Text style={tw`font-medium text-[16px] text-[#191C1E]`} numberOfLines={1}>
                      {email.subject}
                    </Text>
                  </View>
                  
                  {/* Snippet */}
                  <View style={tw`w-full h-[20px]`}>
                    <Text style={tw`font-normal text-[14px] leading-[20px] text-[#434654]`} numberOfLines={1}>
                      {email.body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
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
                customHTMLElementModels={{
                  a: HTMLElementModel.fromCustomModel({
                    tagName: 'a',
                    mixedUAStyles: {
                      marginVertical: 4,
                      padding: 12
                    },
                    contentModel: HTMLContentModel.block
                  })
                }}
                renderersProps={{
                  a: {
                    onPress: (event, href) => {
                      if (href.startsWith('nexus-workspace://meet/room/')) {
                        const parsed = href.replace('nexus-workspace://meet/room/', '');
                        const [roomId, query] = parsed.split('?');
                        const pwdMatch = query ? query.match(/(?:^|&)pwd=([^&]+)/) : null;
                        navigate(`/meetings?joinCode=${roomId}&pwd=${pwdMatch ? pwdMatch[1] : ''}`);
                      } else {
                        Linking.openURL(href).catch(err => console.warn('Cannot open url:', err));
                      }
                    }
                  }
                }}
              />
            ) : (
              <Text style={styles.emailContentText}>{renderTextWithLinks(selectedEmail.body, navigate)}</Text>
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
                  if (Platform.OS === 'web') {
                    const { token } = getSession();
                    const response = await fetch(`${API_URL}/api/mail/export-pdf`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ html })
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to export PDF');
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Meeting_Summary_${new Date().getTime()}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } else {
                    const { uri } = await Print.printToFileAsync({ html });
                    await Sharing.shareAsync(uri);
                  }
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

  const { user } = getSession();

  return (
    <View style={tw`flex-1 flex-col bg-[#F8F9FB]`}>
      {/* Custom Mail TopBar */}
      {!selectedEmail && (
        <View style={tw`flex-row items-center justify-between px-[16px] h-[64px] bg-[#F8F9FB]`}>
          <View style={tw`flex-row items-center gap-[4px]`}>
            <TouchableOpacity onPress={() => setDrawerOpen(true)} style={tw`w-[34px] h-[28px] rounded-full items-center justify-center p-[8px]`}>
              <Menu size={18} color="#003D9B" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <Text style={tw`text-[16px] font-bold text-[#003D9B] capitalize tracking-[0.24px]`}>
            {activeFolder}
          </Text>
          <View style={tw`flex-row items-center gap-[12px]`}>
            <TouchableOpacity onPress={() => navigate('/home')} style={tw`w-[34px] h-[28px] items-center justify-center`}>
              <Home size={18} color="#003D9B" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAppSwitcherOpen(true)} style={tw`w-[34px] h-[28px] items-center justify-center`}>
              <Grid size={18} color="#003D9B" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity style={tw`w-[32px] h-[32px] rounded-full overflow-hidden bg-[#D4E0F8] items-center justify-center`}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={tw`w-full h-full`} resizeMode="cover" />
              ) : (
                <Text style={tw`text-[#576377] font-bold text-[14px]`}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.container}>
      {/* Compose Modal */}
      <Modal
        visible={composeVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setComposeVisible(false)}
      >
        <View style={tw`flex-1 bg-[#FFFFFF]`}>
          {/* Header - TopAppBar */}
          <View style={[tw`absolute top-0 left-0 right-0 h-[64px] bg-[#F8F9FB] flex-row justify-between items-center px-[16px] z-10`]}>
            <View style={tw`flex-row items-center gap-[16px]`}>
              <TouchableOpacity onPress={() => setComposeVisible(false)} style={tw`w-[40px] h-[40px] items-center justify-center rounded-full`}>
                <X size={20} color="#434654" />
              </TouchableOpacity>
              <Text style={tw`font-bold text-[20px] text-[#003D9B] tracking-[-0.2px]`}>Compose</Text>
            </View>
            <View style={tw`flex-row items-center gap-[8px]`}>
              <TouchableOpacity 
                style={[tw`flex-row items-center justify-center px-[24px] py-[8px] bg-[#0052CC] rounded-full h-[32px] gap-[8px]`, sending && {opacity: 0.7}]}
                onPress={handleSendMail}
                disabled={sending}
              >
                {sending ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Send size={16} color="#C4D2FF" />
                    <Text style={tw`font-bold text-[11px] text-[#C4D2FF] tracking-[0.55px]`}>SEND</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={tw`w-[40px] h-[40px] items-center justify-center rounded-full`}>
                <MoreVertical size={20} color="#434654" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Content Area - adjusted bottom for attachments + toolbar */}
          <ScrollView style={tw`absolute top-[64px] ${attachments.length > 0 ? 'bottom-[153px]' : 'bottom-[57px]'} left-0 right-0 bg-[#FFFFFF]`} contentContainerStyle={tw`pb-[20px]`}>
            {/* Input Fields Container */}
            <View style={tw`px-[16px]`}>
              
              {/* To Field */}
              <View style={tw`flex-row items-center h-[69px] border-b border-[#C3C6D6] py-[16px]`}>
                <Text style={tw`font-bold text-[11px] text-[#434654] tracking-[0.55px] w-[48px]`}>TO</Text>
                <TextInput 
                  style={tw`flex-1 text-[14px] text-[#191C1E] py-[9px] px-[12px]`}
                  value={composeTo}
                  onChangeText={setComposeTo}
                  placeholder="Recipients"
                  placeholderTextColor="#C3C6D6"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={tw`w-[32px] h-[32px] items-center justify-center rounded-full`}>
                  <ChevronDown size={16} color="#434654" />
                </TouchableOpacity>
              </View>

              {/* Subject Field */}
              <View style={tw`flex-row items-center h-[72px] border-b border-[#C3C6D6] py-[16px]`}>
                <TextInput 
                  style={tw`flex-1 text-[16px] font-medium text-[#191C1E] py-[10px] px-[12px]`}
                  value={composeSubject}
                  onChangeText={setComposeSubject}
                  placeholder="Subject"
                  placeholderTextColor="#C3C6D6"
                />
              </View>
            </View>

            {/* Message Body */}
            <View style={tw`p-[16px] min-h-[200px]`}>
              <TextInput 
                style={tw`flex-1 text-[14px] text-[#191C1E] px-[12px] py-[8px]`}
                value={composeBody}
                onChangeText={setComposeBody}
                placeholder="Compose email"
                placeholderTextColor="#C3C6D6"
                multiline={true}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Attachment Preview Strip */}
          {attachments.length > 0 && (
            <View style={tw`absolute bottom-[57px] left-0 right-0 bg-[#F8F9FB] border-t border-[#C3C6D6]`}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-center px-[12px] py-[8px] gap-[8px]`}>
                {attachments.map((att, idx) => (
                  <View key={idx} style={[tw`flex-row items-center bg-[#FFFFFF] rounded-[8px] px-[10px] py-[6px] gap-[6px] border border-[#C3C6D6]`, {maxWidth: 180}]}>
                    <Paperclip size={14} color="#0052CC" />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[11px] font-bold text-[#191C1E]`} numberOfLines={1}>{att.name}</Text>
                      <Text style={tw`text-[10px] text-[#737685]`}>{formatFileSize(att.size)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeAttachment(idx)} style={tw`w-[16px] h-[16px] items-center justify-center`}>
                      <X size={12} color="#737685" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Section - Formatting and Tools Bar */}
          <View style={tw`absolute bottom-0 left-0 right-0 h-[57px] bg-[#F3F4F6] border-t border-[#C3C6D6] flex-row items-center justify-between px-[16px]`}>
            <View style={tw`flex-row items-center gap-[4px]`}>
              <TouchableOpacity onPress={pickDocument} style={tw`w-[40px] h-[40px] items-center justify-center rounded-[8px]`}>
                <Paperclip size={20} color={attachments.length > 0 ? "#0052CC" : "#434654"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} style={tw`w-[40px] h-[40px] items-center justify-center rounded-[8px]`}>
                <ImageIcon size={20} color="#434654" />
              </TouchableOpacity>
              <TouchableOpacity style={tw`w-[40px] h-[40px] items-center justify-center rounded-[8px]`}>
                <Bold size={20} color="#434654" />
              </TouchableOpacity>
              <TouchableOpacity style={tw`w-[40px] h-[40px] items-center justify-center rounded-[8px]`}>
                <Italic size={20} color="#434654" />
              </TouchableOpacity>
              
              <View style={tw`w-[1px] h-[24px] bg-[#C3C6D6] mx-[4px]`} />
              
              <TouchableOpacity style={tw`w-[40px] h-[40px] items-center justify-center rounded-[8px]`}>
                <List size={20} color="#434654" />
              </TouchableOpacity>
            </View>
            
            <View style={tw`flex-row items-center gap-[8px]`}>
              {(uploading || sending) && (
                <View style={tw`flex-row items-center gap-[4px]`}>
                  <ActivityIndicator size="small" color="#0052CC" />
                  <Text style={tw`text-[11px] text-[#0052CC] font-medium`}>{uploading ? 'Uploading...' : 'Sending...'}</Text>
                </View>
              )}
              {attachments.length > 0 && (
                <View style={tw`bg-[#0052CC] rounded-full w-[18px] h-[18px] items-center justify-center`}>
                  <Text style={tw`text-[10px] text-[#fff] font-bold`}>{attachments.length}</Text>
                </View>
              )}
              <TouchableOpacity style={tw`flex-row items-center h-[32px] px-[12px] bg-[#D4E0F8] rounded-[8px]`} onPress={handleAiSuggest}>
                {aiGenerating ? <ActivityIndicator size="small" color="#0052CC" /> : <Text style={tw`font-bold text-[12px] text-[#0052CC]`}> AI</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* App Switcher Dropdown */}
      {appSwitcherOpen && (
        <Modal transparent visible={appSwitcherOpen} onRequestClose={() => setAppSwitcherOpen(false)} animationType="fade">
          <TouchableWithoutFeedback onPress={() => setAppSwitcherOpen(false)}>
            <View style={{ flex: 1 }}>
              <TouchableWithoutFeedback>
                <View style={[
                  tw`absolute bg-white overflow-hidden`,
                  {
                    width: Math.min(200, width - 32),
                    right: isMobile ? 14 : 24,
                    top: isMobile ? 60 : 70,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 20,
                    elevation: 10,
                  }
                ]}>
                  <Text style={tw`text-xs font-bold text-gray-500 uppercase px-4 py-2 border-b border-gray-100`}>Switch App</Text>
                  {[
                    { icon: <Image source={require('../../assets/Mail.png')} style={tw`w-5 h-5`} />, label: 'Mail', action: () => { navigate('/mail'); setAppSwitcherOpen(false); } },
                    { icon: <Image source={require('../../assets/Meet.png')} style={tw`w-5 h-5`} />, label: 'Meet', action: () => { navigate('/meetings'); setAppSwitcherOpen(false); } },
                    { icon: <Image source={require('../../assets/Chat.png')} style={tw`w-5 h-5`} />, label: 'Kural', action: () => { navigate('/chat'); setAppSwitcherOpen(false); } },
                    ...(user?.role === 'company-admin' || user?.email === 'admin@fic.com' ? [{ icon: <Users size={16} color="#7c3aed" />, label: 'Team', action: () => { navigate('/team'); setAppSwitcherOpen(false); } }] : []),
                    ...(user?.role === 'super-admin' ? [{ icon: <ShieldCheck size={16} color="#dc2626" />, label: 'Subscriptions', action: () => { navigate('/superadmin'); setAppSwitcherOpen(false); } }] : [])
                  ].map(item => (
                    <TouchableOpacity key={item.label} style={tw`flex-row items-center px-4 py-3.5 gap-3 border-b border-[#f1f5f9]`} onPress={item.action}>
                      <View style={tw`w-8 h-8 rounded-[10px] bg-[#f8fafc] items-center justify-center mr-3`}>{item.icon}</View>
                      <Text style={tw`text-[14px] font-bold text-[#0f172a]`}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Navigation Drawer */}
      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <TouchableOpacity style={tw`flex-1 bg-[rgba(0,0,0,0.4)]`} activeOpacity={1} onPress={() => setDrawerOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={tw`w-[320px] h-full bg-[#F3F4F6] rounded-r-[12px] py-[24px] shadow-lg flex-col justify-between`}>
            
            <View style={tw`flex-1`}>
              {/* Profile Header */}
              <View style={tw`px-[16px] pb-[24px]`}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={tw`w-[64px] h-[64px] rounded-full border-[2px] border-[#0052CC]`} />
                ) : (
                  <View style={tw`w-[64px] h-[64px] rounded-full border-[2px] border-[#0052CC] bg-[#D4E0F8] items-center justify-center`}>
                    <Text style={tw`text-[24px] font-bold text-[#576377]`}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
                  </View>
                )}
                <View style={tw`mt-[8px]`}>
                  <Text style={tw`text-[16px] font-bold text-[#191C1E]`}>{user?.name || 'User'}</Text>
                  <Text style={tw`text-[14px] text-[#434654]`}>{user?.email || 'user@example.com'}</Text>
                </View>
              </View>

              {/* Nav Items */}
              <ScrollView style={tw`flex-1`} contentContainerStyle={tw`px-[8px] gap-[4px]`}>
                {[
                  { id: 'inbox', label: 'Inbox', icon: Inbox },
                  { id: 'starred', label: 'Starred', icon: Star },
                  { id: 'snoozed', label: 'Snoozed', icon: Archive },
                  { id: 'sent', label: 'Sent', icon: Send },
                  { id: 'drafts', label: 'Drafts', icon: FileText },
                  { id: 'trash', label: 'Trash', icon: Trash2 },
                ].map(f => {
                  const isActive = activeFolder === f.id;
                  const Icon = f.icon;
                  return (
                    <TouchableOpacity 
                      key={f.id}
                      onPress={() => { setActiveFolder(f.id); setDrawerOpen(false); setSelectedEmail(null); }}
                      style={[tw`flex-row items-center px-[16px] py-[12px] gap-[16px] rounded-full h-[48px]`, isActive ? tw`bg-[#D4E0F8]` : {}]}
                    >
                      <Icon size={18} color={isActive ? "#576377" : "#434654"} />
                      <Text style={[tw`text-[16px] font-bold`, isActive ? tw`text-[#576377]` : tw`text-[#434654]`]}>{f.label}</Text>
                      {isActive && f.id === 'inbox' && (
                        <View style={tw`ml-auto`}>
                          <Text style={tw`text-[11px] font-bold text-[#576377] tracking-[0.55px]`}>15.3k</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <View style={tw`px-[24px] pt-[24px]`}>
                  <Text style={tw`text-[11px] font-bold uppercase text-[#737685] tracking-[0.55px]`}>LABELS</Text>
                </View>
                <TouchableOpacity style={tw`flex-row items-center px-[16px] py-[12px] gap-[16px] rounded-full h-[48px]`}>
                  <View style={tw`w-[20px] h-[16px] items-center justify-center`}><View style={tw`w-[12px] h-[12px] rounded-full bg-[#003D9B]`} /></View>
                  <Text style={tw`text-[16px] font-bold text-[#434654]`}>Work</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tw`flex-row items-center px-[16px] py-[12px] gap-[16px] rounded-full h-[48px]`}>
                  <View style={tw`w-[20px] h-[16px] items-center justify-center`}><View style={tw`w-[12px] h-[12px] rounded-full bg-[#BA1A1A]`} /></View>
                  <Text style={tw`text-[16px] font-bold text-[#434654]`}>Personal</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View style={tw`px-[8px] pt-[16px] border-t border-[#C3C6D6]`}>
              <TouchableOpacity style={tw`flex-row items-center px-[16px] py-[12px] gap-[16px] rounded-full h-[48px]`}>
                <View style={tw`w-[20px] h-[20px] items-center justify-center`}><Archive size={18} color="#434654" /></View>
                <Text style={tw`text-[16px] font-bold text-[#434654]`}>Settings</Text>
              </TouchableOpacity>
            </View>

          </TouchableOpacity>
        </TouchableOpacity>
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

      {/* FAB Simulation */}
      {isMobile && !selectedEmail && (
        <TouchableOpacity 
          style={[tw`absolute right-[24px] bottom-[96px] w-[56px] h-[56px] bg-[#0052CC] rounded-[16px] items-center justify-center z-10`, { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 }]} 
          onPress={() => setComposeVisible(true)}
        >
          <View style={tw`w-[22.5px] h-[22.5px] items-center justify-center rounded-sm`}>
            <Plus size={22.5} color="#C4D2FF" strokeWidth={3} />
          </View>
        </TouchableOpacity>
      )}

    </View>
    </View>
  );
}

const getStyles = (width: number, isMobile: boolean) => StyleSheet.create({
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
