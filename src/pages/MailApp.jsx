import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { Mail as MailIcon, Send, Star, FileText, Trash2, Plus, Paperclip, Search, X, MoreHorizontal, Reply, Forward, Archive, Loader2, Home } from 'lucide-react';

const MailApp = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const workspaceId = auth.workspaceId || 'demo';
  const currentUserEmail = auth.email || 'guest@example.com';
  const navigate = useNavigate();
  
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('Inbox');
  const [newMail, setNewMail] = useState({ to: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const API_URL = '/api';

  const fetchMails = async () => {
    try {
      const token = localStorage.getItem('token');
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
  }, [workspaceId, currentUserEmail]);

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

  const handleSend = async () => {
    if (!newMail.to || !newMail.subject) return;
    setSending(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/mail/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: newMail.to.split(',').map(e => e.trim()),
          subject: newMail.subject,
          body: newMail.message
        })
      });

      if (response.ok) {
        setComposing(false);
        setNewMail({ to: '', subject: '', message: '' });
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
      const token = localStorage.getItem('token');
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
    { icon: <MailIcon size={15} />, label: 'Inbox', count: threads.filter(t => t.recipient === currentUserEmail && !t.isRead && !t.isDeleted).length },
    { icon: <Star size={15} />, label: 'Starred' },
    { icon: <Send size={15} />, label: 'Sent' },
    { icon: <FileText size={15} />, label: 'Drafts', count: threads.filter(t => t.senderEmail === currentUserEmail && t.isDraft && !t.isDeleted).length },
    { icon: <Trash2 size={15} />, label: 'Trash' },
  ];

  return (
    <AppLayout appName="Mail" appIcon={MailIcon} appColor="#7C3AED">
      <div className="flex h-full gap-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-44 shrink-0 flex flex-col border-r px-3 py-4 gap-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={() => navigate(`/w/${workspaceId}/dashboard`)} className="sidebar-item mb-1" style={{ color: 'var(--text-2)' }}>
            <Home size={15} /> Home
          </button>
          <button onClick={() => setComposing(true)} className="btn btn-primary w-full mb-4">
            <Plus size={15} /> Compose
          </button>
          {folders.map(({ icon, label, count }) => (
            <button key={label} onClick={() => { setFolder(label); setSelected(null); }}
              className="sidebar-item"
              style={{ background: folder === label ? 'var(--accent-muted)' : 'transparent', color: folder === label ? 'var(--accent)' : 'var(--text-2)' }}
            >
              {icon}
              <span className="flex-1 text-left">{label}</span>
              {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: 'white' }}>{count}</span>}
            </button>
          ))}
        </div>

        {/* Thread List */}
        <div className="w-80 shrink-0 flex flex-col overflow-hidden border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${folder}...`} className="input pl-8 py-2 text-xs" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-12 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-2" /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-xs opacity-40">No messages in {folder}</div>
            ) : (
              filtered.map(thread => (
                <div key={thread._id} onClick={() => {
                  setSelected(thread);
                  if (!thread.isRead && thread.recipient === currentUserEmail) {
                    updateMail(thread._id, { isRead: true });
                  }
                }}
                  className="px-4 py-3.5 cursor-pointer border-b transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  style={{
                    borderColor: 'var(--border)',
                    background: selected?._id === thread._id ? 'var(--accent-muted)' : 'transparent'
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {!thread.isRead && thread.recipient === currentUserEmail && <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-indigo-500" />}
                      <span className={`text-xs ${!thread.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {folder === 'Sent' || folder === 'Drafts' ? `To: ${thread.recipient}` : thread.sender}
                      </span>
                    </div>
                    <span className="text-[10px] opacity-40">{new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs mb-0.5 truncate font-medium">{thread.subject}</p>
                  <p className="text-[11px] truncate opacity-60">{thread.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reading Pane */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
          {selected ? (
            <>
              <div className="px-6 py-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="font-bold text-lg mb-1">{selected.subject}</h2>
                  <p className="text-xs opacity-60">
                    {folder === 'Sent' || folder === 'Drafts' ? `To: ${selected.recipient}` : `From: ${selected.sender} <${selected.senderEmail}>`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateMail(selected._id, { isStarred: !selected.isStarred })} className="btn btn-ghost btn-icon btn-sm">
                    <Star size={15} fill={selected.isStarred ? 'var(--warning)' : 'none'} color={selected.isStarred ? 'var(--warning)' : 'currentColor'} />
                  </button>
                  <button onClick={() => updateMail(selected._id, { isDeleted: !selected.isDeleted })} className="btn btn-ghost btn-icon btn-sm"><Trash2 size={15} /></button>
                  <button onClick={() => setSelected(null)} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
                </div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-3xl">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.content}</p>
                  <div className="mt-12 pt-6 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs opacity-40 italic">Sent via Forge India Connect Pvt Ltd Workspace Secure Mail</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
              <MailIcon size={48} strokeWidth={1} />
              <p className="text-sm font-medium">Select an email to read</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setComposing(false)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl border border-gray-200 rounded-xl animate-up overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 text-gray-900">
              <span className="text-sm font-bold">New Message</span>
              <button onClick={() => setComposing(false)} className="p-1 hover:bg-gray-200 rounded-lg transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                <span className="text-xs font-bold text-gray-500 w-12">To</span>
                <input type="email" value={newMail.to} onChange={e => setNewMail({...newMail, to: e.target.value})} className="bg-transparent border-none outline-none text-sm flex-1 text-gray-900" placeholder="recipient@workspace.com" />
              </div>
              <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                <span className="text-xs font-bold text-gray-500 w-12">Subject</span>
                <input type="text" value={newMail.subject} onChange={e => setNewMail({...newMail, subject: e.target.value})} className="bg-transparent border-none outline-none text-sm flex-1 text-gray-900" placeholder="Meeting Sync" />
              </div>
              <textarea 
                className="w-full bg-transparent border-none outline-none text-sm resize-none text-gray-900" 
                rows={8} 
                placeholder="Write your message here..."
                value={newMail.message}
                onChange={e => setNewMail({...newMail, message: e.target.value})}
              />
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-500"><Paperclip size={18} /></button>
                <button onClick={handleSend} disabled={sending} className="btn bg-blue-600 text-white hover:bg-blue-700 hover:shadow-none px-8 rounded-xl py-2">
                  {sending ? 'Sending...' : 'Send Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default MailApp;
