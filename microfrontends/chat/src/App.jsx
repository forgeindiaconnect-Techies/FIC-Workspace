import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Search, Users, Plus, X, Loader2, Paperclip, FileText, Download, Image as ImageIcon, Home, Grid, Phone, ArrowLeft, MoreVertical, Mic, Smile } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('auth') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleAuthInit = (event) => {
      const { type, token: newToken, auth: newAuth } = event.data || {};
      if (type === 'AUTH_INIT') {
        console.log('[Chat MFE] Received auth session from Shell');
        localStorage.setItem('token', newToken);
        localStorage.setItem('auth', JSON.stringify(newAuth));
        setToken(newToken);
        setAuth(newAuth);
        setReady(true);
      }
    };

    window.addEventListener('message', handleAuthInit);

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MFE_READY', mfeId: 'chat' }, '*');
    } else {
      setReady(true);
    }

    return () => window.removeEventListener('message', handleAuthInit);
  }, []);

  if (!auth || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#667781]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-[#25D366]" size={32} />
          <p className="text-xs font-bold uppercase tracking-widest text-[#667781]">Verifying Session...</p>
        </div>
      </div>
    );
  }

  return <ChatClient auth={auth} token={token} />;
}

// ─── File Preview Component ───
function FilePreview({ fileUrl, fileType, originalName, isMe }) {
  if (!fileUrl) return null;

  const isImage = fileType?.startsWith('image/');
  const isVideo = fileType?.startsWith('video/');
  const isAudio = fileType?.startsWith('audio/');
  const isPdf = fileType === 'application/pdf';
  const fileName = originalName || 'Attachment';

  if (isImage) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-black/5 max-w-[320px] cursor-pointer group relative"
        onClick={() => window.open(fileUrl, '_blank')}>
        <img src={fileUrl} alt={fileName} className="w-full h-auto object-cover rounded-lg" loading="lazy" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Download size={24} className="text-white drop-shadow-lg" />
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-black/5 max-w-[360px]">
        <video src={fileUrl} controls className="w-full rounded-lg" preload="metadata" />
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-black/5 p-3 bg-black/5">
        <audio src={fileUrl} controls className="w-full h-8" preload="metadata" />
        <p className="text-[10px] text-gray-500 mt-1 truncate">{fileName}</p>
      </div>
    );
  }

  // Generic file
  return (
    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
      className={`mt-2 flex items-center gap-3 px-3 py-2.5 rounded-lg border max-w-[300px] group transition-all ${isMe ? 'bg-[#c3e8be] border-[#c3e8be] hover:bg-[#b5dbb0]' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
        {isPdf ? <FileText size={18} /> : <Paperclip size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate transition-colors ${isMe ? 'text-[#111B21]' : 'text-[#111B21]'}`}>{fileName}</p>
        <p className="text-[11px] text-[#667781] uppercase">{fileType?.split('/')[1] || 'File'}</p>
      </div>
      <Download size={16} className="text-[#667781] group-hover:text-[#111B21] transition-colors shrink-0" />
    </a>
  );
}

function ChatClient({ auth, token }) {
  const workspaceId = auth.workspaceId || 'demo';
  const currentUserEmail = auth.email || 'guest@example.com';

  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchChannels = async () => {
    try {
      const response = await fetch(`${API_URL}/channels/${workspaceId}?email=${encodeURIComponent(currentUserEmail)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setChannels(data);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  };

  const fetchMessages = async (channelId) => {
    if (!channelId) return;
    setLoadingMessages(true);
    try {
      const response = await fetch(`${API_URL}/chat/${workspaceId}/${channelId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [workspaceId, currentUserEmail, token]);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel._id);
    }
  }, [activeChannel, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e, fileData = null) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !fileData) return;
    if (!activeChannel) return;
    setSending(true);

    try {
      const payload = {
        content: fileData ? (newMessage.trim() || `Sent a file: ${fileData.originalName}`) : newMessage.trim()
      };
      if (fileData) {
        payload.fileUrl = fileData.url;
        payload.fileType = fileData.type;
        payload.originalName = fileData.originalName;
      }

      const response = await fetch(`${API_URL}/chat/${workspaceId}/${activeChannel._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, data]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/chat/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        await handleSendMessage(null, data);
      } else {
        console.error('Upload failed:', data.error);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredChannels = channels.filter(c =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#111B21] font-sans">
      
      {/* Sidebar: Chats List (Kural Main View) */}
      <div className={`w-full md:w-[390px] md:max-w-[400px] shrink-0 flex flex-col h-full bg-white relative ${activeChannel ? 'hidden md:flex border-r border-[#D1D7DB]' : 'flex'}`}>
        
        {/* TopAppBar */}
        <div className="flex justify-between items-center px-4 h-16 shrink-0 bg-white border-b border-[#D1D7DB] sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[#25D366] leading-7 tracking-tight">KURAL</h1>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-10 h-10 rounded-full hover:bg-[#F0F2F5] flex items-center justify-center transition-colors">
              <Home size={20} className="text-[#667781]" />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-[#F0F2F5] flex items-center justify-center transition-colors">
              <Grid size={20} className="text-[#667781]" />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-[#F0F2F5] flex items-center justify-center transition-colors">
              <MoreVertical size={20} className="text-[#667781]" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 shrink-0">
          <div className="relative flex items-center w-full h-9 bg-[#F0F2F5] rounded-full px-4 gap-3">
            <Search size={16} className="text-[#667781] shrink-0" />
            <input 
              type="text"
              placeholder="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-[#111B21] placeholder-[#667781]/70 text-base w-full h-full"
            />
          </div>
        </div>

        {/* Chat List Items */}
        <div className="flex-1 overflow-y-auto pb-[90px]">
          {loadingChannels ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-[#25D366]" size={24} />
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#667781]">No conversations found</div>
          ) : (
            filteredChannels.map(c => {
              const isActive = activeChannel?._id === c._id;
              // Mock unread logic based on channel status or data
              const isUnread = false; 
              
              return (
                <div
                  key={c._id}
                  onClick={() => setActiveChannel(c)}
                  className={`flex items-center px-4 py-0 gap-4 cursor-pointer w-full transition-colors ${isActive ? 'bg-[#F0F2F5]' : 'bg-white hover:bg-[#F0F2F5]'}`}
                >
                  <div className="w-14 h-14 rounded-full bg-[#E9EDEF] flex items-center justify-center shrink-0 overflow-hidden my-3">
                    <span className="text-[#8696A0] text-xl font-bold uppercase">{c.displayName[0]}</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center border-b border-[#D1D7DB]/50 h-[85px] pr-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-base font-semibold text-[#111B21] truncate leading-6">{c.displayName}</span>
                      <span className={`text-xs font-medium shrink-0 leading-4 ${isUnread ? 'text-[#25D366]' : 'text-[#667781]'}`}>
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[15px] font-normal text-[#667781] truncate leading-5">{c.lastMessageContent || 'Start a conversation'}</span>
                      {isUnread && (
                        <div className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5 shadow-sm">
                          1
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Floating Action Button (FAB) */}
        <button className="absolute bottom-[96px] right-4 w-14 h-14 bg-[#25D366] rounded-[16px] flex items-center justify-center shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] hover:bg-[#20bd5a] transition-all transform hover:scale-105 z-20">
          <MessageSquare size={24} className="text-white fill-current" />
        </button>

        {/* Bottom Navigation Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-white border-t border-[#D1D7DB] flex justify-around items-center px-2 z-30 pb-2">
          <button className="flex flex-col items-center justify-center gap-1 px-4 py-2 mt-1">
            <div className="w-16 h-8 bg-[#25D366]/20 rounded-full flex items-center justify-center">
              <MessageSquare size={20} className="text-[#25D366] fill-current" />
            </div>
            <span className="text-[12px] font-bold text-[#25D366] tracking-[0.24px]">Chats</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 px-4 py-2 mt-1">
            <div className="h-8 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-[#667781] border-dashed" />
            </div>
            <span className="text-[12px] font-medium text-[#667781] tracking-[0.24px]">Status</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 px-4 py-2 mt-1">
            <div className="h-8 flex items-center justify-center">
              <Users size={22} className="text-[#667781]" />
            </div>
            <span className="text-[12px] font-medium text-[#667781] tracking-[0.24px]">Communities</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 px-4 py-2 mt-1">
            <div className="h-8 flex items-center justify-center">
              <Phone size={20} className="text-[#667781]" />
            </div>
            <span className="text-[12px] font-medium text-[#667781] tracking-[0.24px]">Calls</span>
          </button>
        </div>

      </div>

      {/* Message Chat Feed Pane */}
      <div className={`flex-1 flex flex-col h-full relative ${activeChannel ? 'flex' : 'hidden md:flex bg-[#F0F2F5]'}`}>
        {activeChannel ? (
          <>
            {/* Active Channel Header */}
            <header className="h-16 bg-[#F0F2F5] px-4 flex items-center justify-between shrink-0 border-b border-[#D1D7DB] z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveChannel(null)} className="md:hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-[#E9EDEF]">
                  <ArrowLeft size={24} className="text-[#667781]" />
                </button>
                <div className="w-10 h-10 rounded-full bg-[#D1D7DB] flex items-center justify-center text-lg font-bold text-white shrink-0 overflow-hidden cursor-pointer">
                  {activeChannel.displayName[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col cursor-pointer">
                  <h3 className="text-base font-semibold text-[#111B21] leading-5">{activeChannel.displayName}</h3>
                  <p className="text-[13px] text-[#667781] leading-4 truncate">click here for contact info</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 rounded-full hover:bg-[#E9EDEF] flex items-center justify-center transition-colors">
                  <Search size={20} className="text-[#667781]" />
                </button>
                <button className="w-10 h-10 rounded-full hover:bg-[#E9EDEF] flex items-center justify-center transition-colors">
                  <MoreVertical size={20} className="text-[#667781]" />
                </button>
              </div>
            </header>

            {/* Chat Messages */}
            <div 
              className="flex-1 overflow-y-auto p-4 md:p-8 space-y-3 bg-[#EFEAE2]" 
              style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}
            >
              {loadingMessages ? (
                <div className="p-12 text-center text-sm text-[#667781] flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-[#25D366]" size={24} />
                  <span className="bg-white/80 px-3 py-1 rounded-full shadow-sm mt-2">Fetching secure messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-[#667781]">
                  <div className="bg-white/80 p-4 rounded-xl shadow-sm flex flex-col items-center text-center">
                    <p className="text-sm font-medium text-[#111B21] mb-1">Send a message to start the chat</p>
                    <p className="text-[11px] uppercase tracking-wider text-[#667781]">End-to-end encrypted</p>
                  </div>
                </div>
              ) : (
                messages.map((m, index) => {
                  const isMe = m.sender === 'You';
                  // Group logic (simplified, checks if prev msg was same sender)
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const isFirstInGroup = !prevMsg || prevMsg.sender !== m.sender;
                  
                  return (
                    <div key={m._id} className={`flex max-w-[85%] md:max-w-[65%] ${isMe ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                      <div className={`relative px-2.5 py-1.5 rounded-lg shadow-sm text-[14.2px] leading-[19px] ${
                        isMe 
                          ? `bg-[#D9FDD3] text-[#111B21] ${isFirstInGroup ? 'rounded-tr-none' : ''}` 
                          : `bg-white text-[#111B21] ${isFirstInGroup ? 'rounded-tl-none' : ''}`
                      }`}>
                        
                        {/* Decorative tail for first message in group */}
                        {isFirstInGroup && (
                          <div className={`absolute top-0 w-3 h-3 ${isMe ? 'right-[-8px] bg-[#D9FDD3]' : 'left-[-8px] bg-white'}`} style={{ clipPath: isMe ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)' }}></div>
                        )}

                        {!isMe && isFirstInGroup && m.senderName && (
                          <div className="text-[12.5px] font-bold text-[#e53935] leading-tight mb-1">{m.senderName}</div>
                        )}
                        
                        <div className="flex flex-col">
                          {m.content && !(m.fileUrl && m.content.startsWith('Sent a file:')) && (
                            <span className="whitespace-pre-wrap break-words">{m.content}</span>
                          )}
                          <FilePreview fileUrl={m.fileUrl} fileType={m.fileType} originalName={m.originalName} isMe={isMe} />
                          
                          {/* Timestamp and Checkmarks */}
                          <div className={`flex items-center gap-1 mt-0.5 self-end ml-4 ${m.fileUrl && isMe ? 'mt-1' : ''}`}>
                            <span className="text-[10.5px] text-[#667781] min-w-[45px] text-right">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && <CheckCheck size={14} className="text-[#53bdeb] ml-0.5" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Upload progress indicator */}
            {isUploading && (
              <div className="px-6 py-2 bg-[#F0F2F5] border-t border-[#D1D7DB] flex items-center gap-3">
                <Loader2 className="animate-spin text-[#25D366]" size={16} />
                <span className="text-[13px] font-medium text-[#111B21]">Uploading media...</span>
              </div>
            )}

            {/* Chat Input form footer */}
            <form onSubmit={handleSendMessage} className="px-4 py-3 bg-[#F0F2F5] border-t border-[#D1D7DB] flex items-end gap-2 shrink-0 z-10 min-h-[62px]">
              
              <button type="button" className="p-2.5 text-[#8696A0] hover:text-[#54656F] shrink-0 mb-0.5">
                <Smile size={26} strokeWidth={1.5} />
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 text-[#8696A0] hover:text-[#54656F] transition-colors disabled:opacity-40 shrink-0 mb-0.5"
                title="Attach"
              >
                <Plus size={26} strokeWidth={2} />
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
              />

              <div className="flex-1 bg-white rounded-xl flex items-center min-h-[42px] max-h-32 mb-1 px-3 border border-transparent shadow-sm">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message"
                  className="w-full bg-transparent border-none outline-none text-[#111B21] text-[15px] py-2.5 placeholder-[#8696A0]"
                />
              </div>

              {newMessage.trim() ? (
                <button
                  type="submit"
                  disabled={sending || isUploading}
                  className="p-2.5 text-[#8696A0] hover:text-[#25D366] transition-colors shrink-0 mb-0.5 disabled:opacity-40"
                >
                  <Send size={24} className="fill-current transform ml-1" />
                </button>
              ) : (
                <button type="button" className="p-2.5 text-[#8696A0] hover:text-[#54656F] shrink-0 mb-0.5">
                  <Mic size={24} />
                </button>
              )}
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#F0F2F5] text-[#54656F] border-b-[6px] border-[#25D366]">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/512px-WhatsApp.svg.png" alt="Kural Desktop" className="w-24 h-24 opacity-20 grayscale" />
            <div className="text-center max-w-md px-6">
              <h2 className="text-3xl font-light text-[#41525D] mb-4">Kural for Web</h2>
              <p className="text-[14px] leading-6 text-[#667781] mb-6">Send and receive messages without keeping your phone online.<br/>Use Kural on up to 4 linked devices and 1 phone at the same time.</p>
            </div>
            <div className="absolute bottom-10 text-[13px] flex items-center gap-1.5 opacity-60">
              <span className="font-semibold tracking-wide">End-to-end encrypted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
