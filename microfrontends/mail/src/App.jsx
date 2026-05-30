import React, { useState, useEffect, useRef } from 'react';
import { Mail as MailIcon, Send, Star, FileText, Trash2, Plus, Paperclip, Search, X, Loader2, Download, Image as ImageIcon, ArrowLeft, MoreVertical, MoreHorizontal, Tag, Reply, Forward, Edit2 } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('auth') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Listen for AUTH_INIT from parent window
    const handleAuthInit = (event) => {
      const { type, token: newToken, auth: newAuth } = event.data || {};
      if (type === 'AUTH_INIT') {
        console.log('[Mail MFE] Received authentication credentials from Shell');
        localStorage.setItem('token', newToken);
        localStorage.setItem('auth', JSON.stringify(newAuth));
        setToken(newToken);
        setAuth(newAuth);
        setReady(true);
      }
    };

    window.addEventListener('message', handleAuthInit);

    // 2. Notify parent window that Mail MFE is ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'MFE_READY', mfeId: 'mail' }, '*');
    } else {
      // If run standalone, consider ready if token is present
      setReady(true);
    }

    return () => window.removeEventListener('message', handleAuthInit);
  }, []);

  if (!auth || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] text-zinc-500">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-[#003D9B]" size={32} />
          <p className="text-xs font-bold uppercase tracking-widest text-[#576377]">Verifying Workspace Session...</p>
        </div>
      </div>
    );
  }

  return <MailClient auth={auth} token={token} />;
}

// ─── Compose Attachment Preview ───
function ComposeAttachmentChip({ att, onRemove }) {
  const ext = att.name?.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <div className="flex items-center gap-2 bg-[#D4E0F8]/50 border border-[#D4E0F8] rounded-xl px-3 py-2">
      <Paperclip size={12} className="text-[#003D9B] shrink-0" />
      <span className="text-[10px] font-bold text-[#191C1E] truncate max-w-[150px]">{att.name}</span>
      <span className="text-[9px] text-[#576377]">{ext}</span>
      <button onClick={onRemove} className="w-4 h-4 rounded-full hover:bg-[#C3C6D6] flex items-center justify-center text-[#576377] hover:text-[#191C1E] transition-all shrink-0">
        <X size={10} />
      </button>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Mail Inner Client
function MailClient({ auth, token }) {
  const workspaceId = auth.workspaceId || 'demo';
  const currentUserEmail = auth.email || 'guest@example.com';
  
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('Inbox');
  const [newMail, setNewMail] = useState({ to: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const composeFileRef = useRef(null);

  const fetchMails = async () => {
    try {
      const response = await fetch(`${API_URL}/mail?folder=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const mappedData = data.map(m => ({
          ...m,
          recipient: m.recipientEmails?.[0] || '',
          sender: m.senderName || m.senderEmail,
          content: m.body,
          timestamp: m.sentAt,
          isDeleted: m.folder === 'trash',
          isDraft: m.folder === 'drafts'
        }));
        setThreads(mappedData);
      }
    } catch (err) {
      console.error('Failed to fetch mails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMails();
  }, [workspaceId, currentUserEmail, token]);

  const filtered = threads.filter(t => {
    if (folder === 'Trash') return t.isDeleted;
    if (t.isDeleted) return false;

    if (folder === 'Inbox') return t.recipient === currentUserEmail && !t.isDraft;
    if (folder === 'Sent') return t.senderEmail === currentUserEmail && !t.isDraft;
    if (folder === 'Drafts') return t.senderEmail === currentUserEmail && t.isDraft;
    if (folder === 'Starred') return t.isStarred;
    return true;
  }).filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.sender.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Upload attachment for compose ───
  const handleComposeFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/mail/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setComposeAttachments(prev => [...prev, data]);
      } else {
        console.error('Attachment upload failed:', data.error);
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
    } finally {
      setUploadingAttachment(false);
      if (composeFileRef.current) composeFileRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!newMail.to || !newMail.subject) return;
    setSending(true);

    try {
      const response = await fetch(`${API_URL}/mail/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: newMail.to.split(',').map(e => e.trim()),
          subject: newMail.subject,
          body: newMail.message,
          attachments: composeAttachments.map(a => ({
            name: a.name,
            url: a.url,
            size: a.size,
            fileType: a.fileType
          }))
        })
      });

      if (response.ok) {
        setComposing(false);
        setNewMail({ to: '', subject: '', message: '' });
        setComposeAttachments([]);
        fetchMails();
      }
    } catch (err) {
      console.error('Failed to send mail:', err);
    } finally {
      setSending(false);
    }
  };

  const updateMail = async (id, updates) => {
    try {
      let url = `${API_URL}/mail/${id}`;
      let method = 'PUT';
      let body = null;
      let headers = { 'Authorization': `Bearer ${token}` };

      if (updates.isRead !== undefined) {
        url += '/read';
      } else if (updates.isStarred !== undefined) {
        url += '/star';
      } else if (updates.isDeleted !== undefined) {
        url += '/move';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ folder: updates.isDeleted ? 'trash' : 'inbox' });
      }

      const response = await fetch(url, { method, headers, body });
      if (response.ok) {
        fetchMails();
        if (selected?._id === id) {
          setSelected({ ...selected, ...updates });
        }
      }
    } catch (err) {
      console.error('Failed to update mail:', err);
    }
  };

  const folders = [
    { icon: <MailIcon size={14} />, label: 'Inbox', count: threads.filter(t => t.recipient === currentUserEmail && !t.isRead && !t.isDeleted).length },
    { icon: <Star size={14} />, label: 'Starred' },
    { icon: <Send size={14} />, label: 'Sent' },
    { icon: <FileText size={14} />, label: 'Drafts', count: threads.filter(t => t.senderEmail === currentUserEmail && t.isDraft && !t.isDeleted).length },
    { icon: <Trash2 size={14} />, label: 'Trash' },
  ];

  return (
    <div className="flex h-screen gap-0 overflow-hidden bg-white text-[#191C1E] font-sans">
      {/* Sidebar */}
      <div className={`w-52 shrink-0 flex flex-col border-r border-[#C3C6D6]/50 bg-[#F8F9FB] p-4 gap-1.5 ${selected ? 'hidden md:flex' : 'flex'}`}>
        <button onClick={() => { setComposing(true); setComposeAttachments([]); }} className="w-full flex items-center justify-center gap-2 bg-[#003D9B] hover:bg-[#002f7a] text-white py-3 rounded-2xl font-bold text-xs tracking-wide shadow-md shadow-[#003D9B]/20 mb-4 transition-all">
          <Plus size={16} /> Compose Mail
        </button>
        {folders.map(({ icon, label, count }) => (
          <button
            key={label}
            onClick={() => { setFolder(label); setSelected(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              folder === label 
                ? 'bg-[#D4E0F8] text-[#003D9B]' 
                : 'text-[#576377] hover:bg-[#E7E8EA] hover:text-[#191C1E]'
            }`}
          >
            {icon}
            <span className="flex-1 text-left">{label}</span>
            {count > 0 && <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-[#003D9B] text-white">{count}</span>}
          </button>
        ))}
      </div>

      {/* Thread List */}
      <div className={`w-full md:w-80 shrink-0 flex flex-col overflow-hidden border-r border-[#C3C6D6]/50 bg-white ${selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-[#C3C6D6]/50 bg-[#F8F9FB]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737685]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${folder}...`}
              className="w-full bg-white border border-[#C3C6D6] rounded-xl pl-9 pr-4 py-2 text-xs text-[#191C1E] placeholder-[#737685] focus:outline-none focus:border-[#003D9B] focus:ring-1 focus:ring-[#003D9B] transition-all shadow-sm"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-[#F3F4F6]">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#576377] flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-[#003D9B]" size={18} />
              <span>Loading messages...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#576377]">No messages in {folder}</div>
          ) : (
            filtered.map(thread => (
              <div
                key={thread._id}
                onClick={() => {
                  setSelected(thread);
                  if (!thread.isRead && thread.recipient === currentUserEmail) {
                    updateMail(thread._id, { isRead: true });
                  }
                }}
                className={`px-5 py-4 cursor-pointer transition-colors border-b border-[#F3F4F6] hover:bg-[#F8F9FB] ${
                  selected?._id === thread._id ? 'bg-[#D4E0F8]/40 border-l-4 border-l-[#003D9B]' : 'transparent border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs ${!thread.isRead && thread.recipient === currentUserEmail ? 'font-black text-[#191C1E]' : 'font-bold text-[#434654]'}`}>
                    {folder === 'Sent' || folder === 'Drafts' ? `To: ${thread.recipient}` : thread.sender}
                  </span>
                  <span className="text-[10px] text-[#737685] font-medium">{new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs mb-1 font-bold text-[#191C1E] truncate flex-1">{thread.subject || '(No Subject)'}</p>
                  {thread.attachments?.length > 0 && (
                    <Paperclip size={12} className="text-[#737685] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#576377] truncate leading-relaxed">{thread.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reading Pane - Inbox Layout Requested */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-[#F8F9FB] md:bg-[#F8F9FB] relative min-w-[390px] h-full overflow-y-auto">
          {/* TopAppBar */}
          <div className="flex justify-between items-center px-4 h-16 shrink-0 bg-[#F8F9FB] sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full hover:bg-[#E7E8EA] flex items-center justify-center transition-colors">
                <ArrowLeft size={16} className="text-[#003D9B]" />
              </button>
              <h1 className="text-xl font-bold text-[#003D9B] tracking-[-0.2px] leading-7">Inbox</h1>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => updateMail(selected._id, { isStarred: !selected.isStarred })} className="w-[34px] h-[34px] rounded-full hover:bg-[#E7E8EA] flex items-center justify-center transition-colors">
                <Star size={18} className={selected.isStarred ? "text-[#fbbf24] fill-current" : "text-[#434654]"} />
              </button>
              <button onClick={() => updateMail(selected._id, { isDeleted: !selected.isDeleted })} className="w-[34px] h-[34px] rounded-full hover:bg-[#E7E8EA] flex items-center justify-center transition-colors">
                <Trash2 size={18} className="text-[#434654]" />
              </button>
              <button className="w-[32px] h-[34px] rounded-full hover:bg-[#E7E8EA] flex items-center justify-center transition-colors">
                <MoreVertical size={18} className="text-[#434654]" />
              </button>
            </div>
          </div>

          {/* Main Content Canvas */}
          <div className="flex flex-col px-4 pt-6 pb-8 gap-6 w-full max-w-[896px] mx-auto min-h-max bg-gradient-to-b from-[#F8F9FB] to-[#FFFFFF] flex-1 relative">
            
            {/* Subject Line */}
            <div className="flex justify-between items-start w-full gap-4">
              <h2 className="text-2xl font-semibold text-[#191C1E] leading-[30px] tracking-[-0.6px] flex-1">
                {selected.subject || '(No Subject)'}
              </h2>
              <div className="flex items-center gap-1 mt-1 shrink-0">
                <div className="bg-[#D4E0F8] rounded-[2px] px-2 py-0.5">
                  <span className="text-[11px] font-bold text-[#576377] tracking-[0.55px] leading-4">Inbox</span>
                </div>
                <button className="w-5 h-[19px] flex items-center justify-center rounded-full hover:bg-[#E7E8EA]">
                  <Tag size={12} className="text-[#737685]" />
                </button>
              </div>
            </div>

            {/* Thread Container -> Article */}
            <article className="flex flex-col bg-white border border-[#C3C6D6]/30 shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-xl p-4 gap-6 w-full">
              
              {/* Sender Header */}
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#D4E0F8] rounded-full flex items-center justify-center text-[#003D9B] font-bold text-lg shadow-sm">
                    {selected.sender?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col justify-center h-full gap-0.5">
                    <span className="text-base font-bold text-[#191C1E] leading-[24px]">{selected.sender}</span>
                    <span className="text-xs font-normal text-[#737685] leading-none">
                      {folder === 'Sent' || folder === 'Drafts' ? `To: ${selected.recipient}` : selected.senderEmail}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-[#737685] tracking-[0.24px]">
                    {new Date(selected.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button className="w-5 h-5 rounded-full hover:bg-[#E7E8EA] flex items-center justify-center">
                    <MoreHorizontal size={14} className="text-[#737685]" />
                  </button>
                </div>
              </div>

              {/* Message Body */}
              <div className="flex flex-col text-sm text-[#191C1E] leading-[23px] whitespace-pre-wrap gap-4 font-normal">
                {selected.content}
              </div>

              {/* Attachment Chip */}
              {selected.attachments?.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  {selected.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center p-3 gap-3 bg-[#F3F4F6] border border-[#C3C6D6] rounded-lg w-fit pr-6 hover:bg-[#E7E8EA] transition-colors group"
                    >
                      <div className="w-5 h-5 flex items-center justify-center text-[#BA1A1A]">
                        <FileText size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-[#191C1E] tracking-[0.24px] group-hover:text-[#0052CC] transition-colors">{att.name || 'Attachment'}</span>
                        <span className="text-[10px] font-bold text-[#737685] uppercase leading-[15px]">{formatFileSize(att.size)}</span>
                      </div>
                      <Download size={16} className="text-[#737685] ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <button 
                  onClick={() => { setComposing(true); setNewMail({ ...newMail, to: selected.senderEmail, subject: `Re: ${selected.subject}`}); }} 
                  className="flex items-center justify-center gap-2 bg-[#0052CC] hover:bg-[#003D9B] text-[#C4D2FF] rounded-xl px-6 py-3 font-bold text-base transition-colors h-12 shadow-sm"
                >
                  <Reply size={18} />
                  Reply
                </button>
                <button 
                  onClick={() => { setComposing(true); setNewMail({ ...newMail, to: selected.senderEmail, subject: `Re: ${selected.subject}`}); }} 
                  className="flex items-center justify-center gap-2 bg-[#E7E8EA] hover:bg-[#D4D6DB] text-[#576377] rounded-xl px-6 py-3 font-bold text-base transition-colors h-12 shadow-sm"
                >
                  <Reply size={18} className="transform -scale-x-100" />
                  Reply All
                </button>
                <button 
                  onClick={() => { setComposing(true); setNewMail({ ...newMail, subject: `Fwd: ${selected.subject}`, message: `\n\n--- Forwarded Message ---\n${selected.content}`}); }} 
                  className="flex items-center justify-center gap-2 bg-[#E7E8EA] hover:bg-[#D4D6DB] text-[#576377] rounded-xl px-6 py-3 font-bold text-base transition-colors h-12 shadow-sm"
                >
                  <Forward size={18} />
                  Forward
                </button>
              </div>

            </article>

            {/* Bottom Padding for FAB */}
            <div className="h-16 shrink-0"></div>

          </div>

          {/* Quick Reply Floating Action Interaction */}
          <button 
            onClick={() => { setComposing(true); setNewMail({ ...newMail, to: selected.senderEmail, subject: `Re: ${selected.subject}`}); }}
            className="absolute bottom-6 right-6 w-14 h-14 bg-[#003D9B] rounded-full shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] flex items-center justify-center hover:bg-[#002f7a] transition-all transform hover:scale-105 z-30"
          >
            <Edit2 size={20} className="text-white" />
          </button>
          
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#F8F9FB] md:bg-[#F8F9FB] text-[#576377] opacity-80 min-w-[390px] hidden md:flex">
          <div className="w-20 h-20 bg-[#D4E0F8] rounded-full flex items-center justify-center">
            <MailIcon size={36} strokeWidth={1.5} className="text-[#003D9B]" />
          </div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#434654]">Select a message to view</p>
        </div>
      )}

      {/* Compose Modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#191C1E]/60 backdrop-blur-sm" onClick={() => setComposing(false)} />
          <div className="relative w-full max-w-lg bg-white border border-[#C3C6D6] p-6 rounded-[28px] shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#F3F4F6]">
              <h3 className="text-sm font-extrabold text-[#191C1E] uppercase tracking-wider">New Message</h3>
              <button onClick={() => setComposing(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F3F4F6] text-[#576377] transition-colors"><X size={16} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[#F3F4F6] pb-2">
                <span className="text-xs font-bold text-[#737685] w-12">TO</span>
                <input
                  type="email"
                  value={newMail.to}
                  onChange={e => setNewMail({...newMail, to: e.target.value})}
                  className="bg-transparent border-none outline-none text-sm text-[#191C1E] flex-1 placeholder-[#C3C6D6]"
                  placeholder="recipient@workspace.com"
                />
              </div>
              <div className="flex items-center gap-3 border-b border-[#F3F4F6] pb-2">
                <span className="text-xs font-bold text-[#737685] w-12">SUBJECT</span>
                <input
                  type="text"
                  value={newMail.subject}
                  onChange={e => setNewMail({...newMail, subject: e.target.value})}
                  className="bg-transparent border-none outline-none text-sm text-[#191C1E] flex-1 placeholder-[#C3C6D6]"
                  placeholder="Workspace Review"
                />
              </div>
              <textarea 
                className="w-full bg-[#F8F9FB] border border-[#C3C6D6] rounded-2xl p-4 text-sm text-[#191C1E] placeholder-[#737685] focus:outline-none focus:border-[#003D9B] focus:ring-1 focus:ring-[#003D9B] transition-all resize-none" 
                rows={8} 
                placeholder="Write your email content here..."
                value={newMail.message}
                onChange={e => setNewMail({...newMail, message: e.target.value})}
              />

              {/* Attachment chips */}
              {composeAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {composeAttachments.map((att, i) => (
                    <ComposeAttachmentChip
                      key={i}
                      att={att}
                      onRemove={() => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
              )}

              {/* Upload progress */}
              {uploadingAttachment && (
                <div className="flex items-center gap-2 text-[#003D9B]">
                  <Loader2 className="animate-spin" size={14} />
                  <span className="text-[11px] font-bold">Uploading attachment...</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6]">
                {/* Attach file button */}
                <div>
                  <input
                    ref={composeFileRef}
                    type="file"
                    onChange={handleComposeFileUpload}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                  />
                  <button
                    type="button"
                    onClick={() => composeFileRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="flex items-center gap-2 text-[#576377] hover:text-[#003D9B] transition-colors disabled:opacity-40 font-bold"
                    title="Attach file"
                  >
                    <Paperclip size={16} />
                    <span className="text-[11px] uppercase tracking-wider">Attach</span>
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending || uploadingAttachment}
                  className="bg-[#003D9B] hover:bg-[#002f7a] text-white px-8 py-3 rounded-xl text-xs font-bold shadow-md shadow-[#003D9B]/20 transition-all disabled:opacity-40"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
