import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-primary" size={32} />
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Verifying Workspace Session...</p>
        </div>
      </div>
    );
  }

  return <MailClient auth={auth} token={token} />;
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

  // Upload attachment for compose
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

  const getUnreadCount = (f) => {
    if (f === 'Inbox') return threads.filter(t => t.recipient === currentUserEmail && !t.isRead && !t.isDeleted).length;
    if (f === 'Drafts') return threads.filter(t => t.senderEmail === currentUserEmail && t.isDraft && !t.isDeleted).length;
    return 0;
  };

  const folders = [
    { icon: 'inbox', label: 'Inbox' },
    { icon: 'star', label: 'Starred' },
    { icon: 'send', label: 'Sent' },
    { icon: 'draft', label: 'Drafts' },
  ];

  const bottomFolders = [
    { icon: 'delete', label: 'Trash' },
  ];

  return (
    <div className="bg-background text-on-surface h-screen w-full overflow-hidden">
      {/* TopNavBar */}
      <header className="flex justify-between items-center px-[24px] h-16 w-full fixed top-0 z-50 bg-surface-container-lowest border-b border-outline-variant">
        <div className="flex items-center gap-6">
          <span className="text-headline-md text-primary">CorporateMail</span>
          <div className="hidden md:flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant w-96">
            <span className="material-symbols-outlined text-on-surface-variant mr-2" style={{fontSize: '20px'}}>search</span>
            <input 
              className="bg-transparent border-none outline-none focus:ring-0 text-body-md w-full p-0 text-on-surface" 
              placeholder="Search mail" 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => window.parent.postMessage({ type: 'NAVIGATE_HOME' }, '*')} className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer" title="Home">home</button>
          <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer">help</button>
          <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer">apps</button>
          <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer">settings</button>
          <div className="h-8 w-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs ml-2 cursor-pointer shadow-sm">
            {currentUserEmail[0].toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex pt-16 h-screen w-full">
        {/* SideNavBar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-[260px] flex flex-col p-[16px] bg-surface-container-low shrink-0 z-40">
          <div className="mb-6">
            <button 
              onClick={() => { setComposing(true); setNewMail({ to: '', subject: '', message: '' }); setComposeAttachments([]); }}
              className="flex items-center justify-center gap-2 bg-[#1A2B3C] text-white w-full py-3 rounded-xl font-semibold shadow-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">edit</span>
              <span className="text-label-sm">Compose</span>
            </button>
          </div>
          <nav className="flex-1 space-y-1">
            {folders.map(({ icon, label }) => {
              const count = getUnreadCount(label);
              const isActive = folder === label;
              return (
                <div 
                  key={label}
                  onClick={() => { setFolder(label); setSelected(null); }}
                  className={`flex items-center gap-[8px] font-semibold rounded-xl px-4 py-2 cursor-pointer transition-all active:scale-95 ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  <span className="material-symbols-outlined">{icon}</span>
                  <span className="text-label-sm">{label}</span>
                  {count > 0 && <span className="ml-auto text-xs opacity-80">{count}</span>}
                </div>
              )
            })}
          </nav>
          
          <div className="mt-auto border-t border-outline-variant pt-4 space-y-1">
            {bottomFolders.map(({ icon, label }) => {
              const isActive = folder === label;
              return (
                <div 
                  key={label}
                  onClick={() => { setFolder(label); setSelected(null); }}
                  className={`flex items-center gap-[8px] font-semibold rounded-xl px-4 py-2 cursor-pointer transition-all active:scale-95 ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                  <span className="material-symbols-outlined">{icon}</span>
                  <span className="text-label-sm">{label}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-6 px-4">
            <div className="text-xs text-on-surface-variant opacity-60">Mailbox</div>
            <div className="text-xs font-semibold text-primary truncate" title={currentUserEmail}>{currentUserEmail}</div>
          </div>
        </aside>

        {/* Main Content Area: Split Pane */}
        <main className="ml-[260px] flex flex-1 overflow-hidden h-full w-full">
          {/* Message List */}
          <section className="w-1/3 min-w-[320px] bg-white border-r border-outline-variant flex flex-col h-full shrink-0">
            {/* Filter Bar */}
            <div className="h-12 flex items-center px-4 border-b border-outline-variant justify-between bg-white sticky top-0 z-10 shrink-0">
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-surface-container-high rounded text-label-sm text-primary">All</button>
                <button className="px-3 py-1 hover:bg-surface-container text-label-sm text-on-surface-variant">Unread</button>
                <button className="px-3 py-1 hover:bg-surface-container text-label-sm text-on-surface-variant">Flagged</button>
              </div>
              <button className="material-symbols-outlined text-on-surface-variant text-sm">filter_list</button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {loading ? (
                <div className="p-12 text-center text-xs text-on-surface-variant flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={18} />
                  <span>Loading messages...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-xs text-on-surface-variant">No messages in {folder}</div>
              ) : (
                filtered.map(thread => {
                  const isUnread = !thread.isRead && thread.recipient === currentUserEmail;
                  const isActive = selected?._id === thread._id;
                  
                  return (
                    <div 
                      key={thread._id}
                      onClick={() => {
                        setSelected(thread);
                        if (!thread.isRead && thread.recipient === currentUserEmail) {
                          updateMail(thread._id, { isRead: true });
                        }
                      }}
                      className={`message-item p-4 border-b border-outline-variant relative cursor-pointer group ${isActive ? 'active' : ''}`}
                    >
                      {isUnread && <div className="unread-indicator"></div>}
                      <div className="flex justify-between items-start mb-1">
                        <span className={`${isUnread ? 'font-bold text-primary' : 'font-medium text-on-surface-variant'} text-body-md truncate mr-2`}>
                          {folder === 'Sent' || folder === 'Drafts' ? `To: ${thread.recipient}` : thread.sender}
                        </span>
                        <span className="text-label-xs text-on-surface-variant shrink-0">{new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-label-sm font-semibold text-on-surface truncate mb-1">
                        {thread.subject || '(No Subject)'}
                      </div>
                      <div className="text-label-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                        {thread.content}
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-4 bg-white/80 backdrop-blur-sm p-1 rounded">
                        <span onClick={(e) => { e.stopPropagation(); updateMail(thread._id, { isStarred: !thread.isStarred }); }} className="material-symbols-outlined text-sm text-on-surface-variant hover:text-primary" title="Star">star</span>
                        <span onClick={(e) => { e.stopPropagation(); updateMail(thread._id, { isDeleted: !thread.isDeleted }); }} className="material-symbols-outlined text-sm text-on-surface-variant hover:text-error" title="Delete">delete</span>
                        <span onClick={(e) => { e.stopPropagation(); updateMail(thread._id, { isRead: !thread.isRead }); }} className="material-symbols-outlined text-sm text-on-surface-variant hover:text-primary" title="Mark unread">mark_as_unread</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Reading Pane */}
          {selected ? (
            <section className="flex-1 bg-white flex flex-col h-full overflow-hidden w-full">
              {/* Action Toolbar */}
              <div className="h-12 flex items-center px-6 border-b border-outline-variant justify-between bg-white sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => updateMail(selected._id, { isStarred: !selected.isStarred })} className={`material-symbols-outlined hover:bg-surface-container-low p-1.5 rounded transition-colors ${selected.isStarred ? 'text-tertiary-container' : 'text-on-surface-variant'}`} title="Star">star</button>
                  <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded transition-colors" title="Report">report</button>
                  <button onClick={() => { updateMail(selected._id, { isDeleted: !selected.isDeleted }); setSelected(null); }} className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded transition-colors text-error" title="Delete">delete</button>
                  <div className="w-[1px] h-4 bg-outline-variant"></div>
                  <button onClick={() => { updateMail(selected._id, { isRead: false }); setSelected(null); }} className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded transition-colors" title="Mark as unread">mail</button>
                  <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded transition-colors">schedule</button>
                  <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded transition-colors">add_task</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label-xs text-on-surface-variant">Selected</span>
                  <button onClick={() => setSelected(null)} className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-1.5 rounded transition-colors" title="Close">close</button>
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-10 max-w-5xl mx-auto w-full custom-scrollbar">
                <h1 className="text-display-lg text-primary mb-8">{selected.subject || '(No Subject)'}</h1>
                
                <div className="flex items-center mb-8">
                  <div className="h-10 w-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-body-md mr-4 shrink-0">
                    {selected.sender?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-body-md text-primary">
                        {selected.sender} <span className="font-normal text-on-surface-variant ml-2">&lt;{selected.senderEmail}&gt;</span>
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {new Date(selected.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-label-sm text-on-surface-variant flex items-center">
                      To: {selected.recipient || currentUserEmail}
                      <span className="material-symbols-outlined text-xs ml-1 cursor-pointer">expand_more</span>
                    </div>
                  </div>
                </div>

                <div className="text-body-lg text-on-surface-variant space-y-4 whitespace-pre-wrap leading-relaxed max-w-none">
                  {selected.content}
                </div>

                {/* Attachments */}
                {selected.attachments?.length > 0 && (
                  <div className="mt-12 pt-6 border-t border-outline-variant">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-sm">attachment</span>
                      <span className="text-label-sm font-semibold">{selected.attachments.length} Attachments</span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {selected.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="w-48 bg-surface-container-low border border-outline-variant p-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer group no-underline">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-tertiary-container">draft</span>
                            <span className="text-label-sm font-medium truncate text-primary">{att.name || 'File'}</span>
                          </div>
                          <div className="flex justify-between items-center text-label-xs text-on-surface-variant">
                            <span>{formatFileSize(att.size)}</span>
                            <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Reply */}
                <div className="mt-12 flex flex-wrap gap-4">
                  <button 
                    onClick={() => { setComposing(true); setNewMail({ ...newMail, to: selected.senderEmail, subject: `Re: ${selected.subject}`}); }} 
                    className="flex items-center gap-2 border border-outline-variant px-6 py-2 rounded-full text-label-sm font-semibold hover:bg-surface-container-low transition-colors text-primary"
                  >
                    <span className="material-symbols-outlined">reply</span> Reply
                  </button>
                  <button 
                    onClick={() => { setComposing(true); setNewMail({ ...newMail, to: selected.senderEmail, subject: `Re: ${selected.subject}`}); }} 
                    className="flex items-center gap-2 border border-outline-variant px-6 py-2 rounded-full text-label-sm font-semibold hover:bg-surface-container-low transition-colors text-primary"
                  >
                    <span className="material-symbols-outlined">reply_all</span> Reply all
                  </button>
                  <button 
                    onClick={() => { setComposing(true); setNewMail({ ...newMail, subject: `Fwd: ${selected.subject}`, message: `\n\n--- Forwarded Message ---\n${selected.content}`}); }} 
                    className="flex items-center gap-2 border border-outline-variant px-6 py-2 rounded-full text-label-sm font-semibold hover:bg-surface-container-low transition-colors text-primary"
                  >
                    <span className="material-symbols-outlined">forward</span> Forward
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="flex-1 bg-white flex flex-col h-full overflow-hidden items-center justify-center opacity-80">
               <div className="w-20 h-20 bg-secondary-container rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-tertiary-container" style={{fontSize: '36px'}}>mail</span>
               </div>
               <p className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">Select a message to view</p>
            </section>
          )}
        </main>
      </div>

      {/* Compose Modal */}
      {composing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#181C1E]/60 backdrop-blur-sm" onClick={() => setComposing(false)} />
          <div className="relative w-full max-w-2xl bg-white border border-outline-variant rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface-container-low border-b border-outline-variant">
              <h3 className="text-body-md font-semibold text-primary">New Message</h3>
              <div className="flex items-center gap-2">
                <button className="text-on-surface-variant hover:bg-surface-container-highest p-1 rounded transition-colors"><span className="material-symbols-outlined text-sm">minimize</span></button>
                <button className="text-on-surface-variant hover:bg-surface-container-highest p-1 rounded transition-colors"><span className="material-symbols-outlined text-sm">open_in_full</span></button>
                <button onClick={() => setComposing(false)} className="text-on-surface-variant hover:bg-surface-container-highest p-1 rounded transition-colors"><span className="material-symbols-outlined text-sm">close</span></button>
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-outline-variant px-6 py-2">
                <span className="text-label-sm text-on-surface-variant w-12">To</span>
                <input
                  type="email"
                  value={newMail.to}
                  onChange={e => setNewMail({...newMail, to: e.target.value})}
                  className="bg-transparent border-none outline-none text-body-md text-primary flex-1 placeholder-outline-variant focus:ring-0"
                  placeholder="recipient@workspace.com"
                />
              </div>
              <div className="flex items-center gap-3 border-b border-outline-variant px-6 py-2">
                <span className="text-label-sm text-on-surface-variant w-12">Subject</span>
                <input
                  type="text"
                  value={newMail.subject}
                  onChange={e => setNewMail({...newMail, subject: e.target.value})}
                  className="bg-transparent border-none outline-none text-body-md text-primary flex-1 placeholder-outline-variant focus:ring-0"
                  placeholder="Subject"
                />
              </div>
              
              <div className="p-6">
                <textarea 
                  className="w-full bg-transparent border-none outline-none text-body-md text-primary placeholder-outline-variant focus:ring-0 resize-none min-h-[300px]" 
                  placeholder="Write your email content here..."
                  value={newMail.message}
                  onChange={e => setNewMail({...newMail, message: e.target.value})}
                />
                
                {/* Attachment chips */}
                {composeAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 border-t border-outline-variant pt-4">
                    {composeAttachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 bg-secondary-container rounded px-3 py-1.5">
                        <span className="material-symbols-outlined text-[16px] text-tertiary-container">attachment</span>
                        <span className="text-label-xs font-semibold text-on-secondary-container truncate max-w-[150px]">{att.name}</span>
                        <button onClick={() => setComposeAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-on-secondary-container hover:text-error ml-1">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadingAttachment && (
                  <div className="flex items-center gap-2 text-primary mt-4">
                    <Loader2 className="animate-spin" size={14} />
                    <span className="text-label-xs font-semibold">Uploading attachment...</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between px-6 py-4 bg-surface-container-low border-t border-outline-variant">
                <div className="flex items-center gap-2">
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
                    className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded transition-colors disabled:opacity-40"
                    title="Attach file"
                  >
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded transition-colors"><span className="material-symbols-outlined">link</span></button>
                  <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded transition-colors"><span className="material-symbols-outlined">mood</span></button>
                  <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded transition-colors"><span className="material-symbols-outlined">insert_photo</span></button>
                </div>
                
                <div className="flex items-center gap-3">
                  <button onClick={() => setComposing(false)} className="px-4 py-2 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-highest rounded transition-colors">Discard</button>
                  <button
                    onClick={handleSend}
                    disabled={sending || uploadingAttachment}
                    className="bg-primary hover:bg-tertiary-container text-on-primary px-6 py-2.5 rounded-full text-label-sm font-semibold transition-all disabled:opacity-40 flex items-center gap-2 shadow-sm"
                  >
                    {sending ? 'Sending...' : 'Send'}
                    {!sending && <span className="material-symbols-outlined text-[16px]">send</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
