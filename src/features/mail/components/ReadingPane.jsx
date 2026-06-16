import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Reply, Forward, Archive, Trash2, Clock, 
  MoreVertical, Star, Paperclip, Download,
  Zap, ChevronRight, MessageSquare, Sparkles,
  ArrowLeft, Maximize2, ExternalLink
} from 'lucide-react';
import { useMailStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LogoImage from '../../../assets/landing-logo.png';

const cn = (...inputs) => twMerge(clsx(inputs));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ReadingPane = () => {
  const { selectedId, setSelectedId, getAuth, openCompose } = useMailStore();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const queryClient = useQueryClient();
  const auth = getAuth();

  const [inlineReplyText, setInlineReplyText] = useState('');
  const [inlineAttachments, setInlineAttachments] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const inlineFileRef = React.useRef(null);

  const { data: mail, isLoading: isMailLoading } = useQuery({
    queryKey: ['mail', selectedId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/mail?folder=all`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const mails = Array.isArray(data) ? data : [];
      let selected = mails.find(m => m._id === selectedId);
      
      if (selected) {
        selected = {
          ...selected,
          recipient: selected.recipientEmails?.[0] || '',
          sender: selected.senderName || selected.senderEmail || 'Unknown',
          content: selected.body || '',
          timestamp: selected.sentAt || new Date().toISOString(),
          hasAttachments: selected.attachments?.length > 0
        };
        // Auto-mark as read
        if (!selected.isRead) {
          fetch(getApiUrl(`/api/mail/${selected._id}/read`), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(() => queryClient.invalidateQueries(['mails']));
        }
      }
      return selected;
    },
    enabled: !!selectedId
  });

  // AI Summary Mutation
  const summaryMutation = useMutation({
    mutationFn: async (content) => {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/mail/summarize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content })
      });
      return res.json();
    }
  });

  // AI Smart Reply Mutation
  const smartReplyMutation = useMutation({
    mutationFn: async ({ content, sender }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/mail/smart-reply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content, sender })
      });
      return res.json();
    }
  });

  // Mail Update Mutation
  const updateMailMutation = useMutation({
    mutationFn: async (updates) => {
      const token = localStorage.getItem('token');
      let url = getApiUrl(`/api/mail/${selectedId}`);
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
      } else if (updates.label === 'Archive') {
        url += '/move';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ folder: 'archive' });
      } else if (updates.newLabel !== undefined) {
        url += '/label';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ label: updates.newLabel === 'None' ? null : updates.newLabel });
      }

      const res = await fetch(url, { method, headers, body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mail', selectedId]);
      queryClient.invalidateQueries(['mails']);
    }
  });

  // Permanent Delete Mutation
  const deleteMailMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/mail/${selectedId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete mail');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mails']);
      setSelectedId(null);
    }
  });

  const handleToggleStar = () => {
    updateMailMutation.mutate({ isStarred: !mail.isStarred });
  };

  const handleDelete = () => {
    if (mail.folder === 'trash') {
      deleteMailMutation.mutate();
    } else {
      updateMailMutation.mutate({ isDeleted: true });
      setSelectedId(null);
    }
  };

  const handleArchive = () => {
    updateMailMutation.mutate({ label: 'Archive' });
    setSelectedId(null);
  };

  const handleNextLabel = () => {
    const labels = ['Work', 'Client', 'Finance', 'Personal', 'None'];
    const currentIndex = mail.label ? labels.indexOf(mail.label) : 4;
    const nextIndex = (currentIndex + 1) % labels.length;
    updateMailMutation.mutate({ newLabel: labels[nextIndex] });
  };

  const handleReply = () => {
    openCompose({
      to: mail.senderEmail,
      subject: mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`,
      body: `<br><br><br><blockquote><p>On ${new Date(mail.timestamp).toLocaleString()}, ${mail.sender} wrote:</p>${mail.content}</blockquote>`
    });
  };

  const handleForward = () => {
    openCompose({
      to: '',
      subject: mail.subject.startsWith('Fwd:') ? mail.subject : `Fwd: ${mail.subject}`,
      body: `<br><br><br><blockquote><p>---------- Forwarded message ---------</p><p>From: ${mail.sender} &lt;${mail.senderEmail}&gt;</p><p>Date: ${new Date(mail.timestamp).toLocaleString()}</p><p>Subject: ${mail.subject}</p><br>${mail.content}</blockquote>`
    });
  };

  // Reply Mutation
  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('token');
      const body = {
        to: [mail.senderEmail],
        subject: mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`,
        body: inlineReplyText,
        attachments: inlineAttachments.map(a => ({ name: a.name, url: a.url, size: a.size })),
        isDraft: false,
        threadId: mail.threadId || mail._id
      };
      const res = await fetch(getApiUrl('/api/mail/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to send reply');
      return res.json();
    },
    onSuccess: () => {
      setInlineReplyText('');
      setInlineAttachments([]);
      queryClient.invalidateQueries(['mails']);
      queryClient.invalidateQueries(['mail', selectedId]);
    }
  });

  const handleInlineAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        const token = localStorage.getItem('token');
        const res = await fetch(getApiUrl('/api/mail/upload-attachment'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            fileBase64: base64Data,
            fileName: file.name,
            mimeType: file.type
          })
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setInlineAttachments(prev => [...prev, { name: file.name, url: data.url, size: file.size }]);
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
        setIsUploadingAttachment(false);
        if (inlineFileRef.current) inlineFileRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Upload failed');
      setIsUploadingAttachment(false);
      if (inlineFileRef.current) inlineFileRef.current.value = '';
    }
  };

  useEffect(() => {
    if (showAIPanel && mail) {
      summaryMutation.mutate(mail.content);
      smartReplyMutation.mutate({ content: mail.content, sender: mail.sender });
    }
  }, [showAIPanel, selectedId]);

  if (!selectedId) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[var(--surface-0)] gap-6 opacity-30">
        <div className="flex items-center justify-center">
          <img src={LogoImage} alt="Forge India Logo" className="h-20 w-auto object-contain opacity-60" />
        </div>
        <div className="text-center mt-2">
           <p className="text-sm font-medium">Select a conversation to read</p>
        </div>
      </div>
    );
  }

  if (isMailLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[var(--surface-0)] gap-4 opacity-30">
        <Zap className="animate-pulse text-[var(--brand-primary)]" size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest">Opening thread...</p>
      </div>
    );
  }

  if (!mail) return null;

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-[var(--surface-0)]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedId(null)}
              className="lg:hidden p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)]"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              <ToolbarButton icon={Reply} label="Reply" onClick={handleReply} />
              <ToolbarButton icon={Forward} label="Forward" onClick={handleForward} />
              <div className="w-px h-6 bg-[var(--border)] mx-2" />
              <ToolbarButton icon={Archive} label="Archive" onClick={handleArchive} />
              <ToolbarButton icon={Trash2} label="Delete" onClick={handleDelete} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={cn(
                "btn h-9 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                showAIPanel 
                  ? "bg-[var(--brand-primary)] text-white shadow-lg shadow-blue-500/20" 
                  : "bg-[var(--brand-light)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white"
              )}
            >
              <Sparkles size={14} /> Antigravity AI
            </button>
            <ToolbarButton icon={Star} label="Star" active={mail.isStarred} onClick={handleToggleStar} />
            <ToolbarButton icon={MoreVertical} label="More" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12">
          <div className="max-w-[720px] mx-auto space-y-10">
            {/* Subject */}
            <div className="flex items-start justify-between gap-6">
              <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] leading-tight">
                {mail.subject}
              </h1>
              <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={handleNextLabel} title="Click to change label">
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all hover:opacity-80",
                  mail.label === 'Work' ? "bg-blue-50 text-blue-600 border-blue-100" :
                  mail.label === 'Client' ? "bg-purple-50 text-purple-600 border-purple-100" :
                  mail.label === 'Finance' ? "bg-amber-50 text-amber-600 border-amber-100" :
                  mail.label === 'Personal' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]"
                )}>
                  {mail.label || 'Add Label'}
                </span>
              </div>
            </div>

            {/* Sender Card */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs font-black text-[var(--text-primary)] border border-[var(--border)]">
                  {mail.sender.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[var(--text-primary)]">{mail.sender}</span>
                    <span className="text-xs font-medium text-[var(--text-secondary)] opacity-60">&lt;{mail.senderEmail}&gt;</span>
                  </div>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">To: {mail.recipient}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  {new Date(mail.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 font-mono mt-0.5">
                  {new Date(mail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Body */}
            <div 
              className="text-[var(--text-primary)] leading-[1.8] text-[15px] font-medium font-sans mail-content"
              dangerouslySetInnerHTML={{ __html: mail.content }}
            />

            {/* Attachments */}
            {mail.hasAttachments && (
              <div className="pt-10 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 mb-4">
                  <Paperclip size={14} className="text-[var(--text-secondary)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    {selected.attachments.length} Attachment{selected.attachments.length !== 1 && 's'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selected.attachments.map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                      <AttachmentCard 
                        name={att.name} 
                        size={att.size ? (att.size / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown'} 
                        type={att.name.split('.').pop().toUpperCase()} 
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Smart Replies */}
            <div className="pt-10 border-t border-[var(--border)] space-y-4">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles size={14} className="text-[var(--brand-primary)]" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-primary)]">AI Smart Replies</span>
               </div>
               <div className="flex flex-wrap gap-2">
                 {smartReplyMutation.isPending ? (
                   <p className="text-[10px] font-bold text-[var(--text-secondary)] animate-pulse">Thinking...</p>
                 ) : smartReplyMutation.data?.replies?.map((reply, i) => (
                   <button key={i} onClick={() => setInlineReplyText(prev => prev ? prev + '\n' + reply : reply)} className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--brand-light)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all">
                     {reply}
                   </button>
                 ))}
               </div>
            </div>

            {/* Inline Reply Box */}
            <div className="pt-10 pb-20">
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[24px] p-6 focus-within:ring-4 focus-within:ring-purple-500/5 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-[10px] font-black text-white">A</div>
                  <span className="text-xs font-bold text-[var(--text-secondary)]">Reply to <span className="text-[var(--text-primary)] font-black">{mail.sender}</span></span>
                </div>
                <textarea 
                  value={inlineReplyText}
                  onChange={(e) => setInlineReplyText(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm font-medium resize-none min-h-[120px]"
                  placeholder="Write your response..."
                />
                {inlineAttachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-4 border-t border-[var(--border)] pt-4">
                    {inlineAttachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs font-medium">
                        <Paperclip size={12} className="text-[var(--text-secondary)]" />
                        <span className="truncate max-w-[150px] text-[var(--text-primary)]">{file.name}</span>
                        <button onClick={() => setInlineAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-rose-500 ml-1 font-bold">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {isUploadingAttachment && (
                  <div className="text-xs text-[var(--brand-primary)] font-bold mb-4">Uploading attachment...</div>
                )}
                <div className="flex items-center justify-between mt-4">
                   <div className="flex items-center gap-2">
                     <input 
                       type="file" 
                       ref={inlineFileRef} 
                       onChange={handleInlineAttachmentUpload} 
                       style={{ display: 'none' }} 
                     />
                     <button className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all"><Maximize2 size={16} /></button>
                     <button onClick={() => inlineFileRef.current?.click()} className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all"><Paperclip size={16} /></button>
                   </div>
                   <button 
                     onClick={() => sendReplyMutation.mutate()} 
                     disabled={sendReplyMutation.isPending || isUploadingAttachment || (!inlineReplyText.trim() && inlineAttachments.length === 0)}
                     className="btn btn-primary h-10 px-6 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                   >
                     {sendReplyMutation.isPending ? 'Sending...' : 'Send Reply'}
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Side Panel */}
      <AnimatePresence>
        {showAIPanel && (
          <motion.div
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-[380px] h-full border-l border-[var(--border)] bg-[var(--surface-1)] flex flex-col shrink-0"
          >
            <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)]">
               <div className="flex items-center gap-2">
                 <Sparkles size={18} className="text-[var(--brand-primary)]" />
                 <h2 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Antigravity AI</h2>
               </div>
               <button onClick={() => setShowAIPanel(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)]">
                 <XIcon size={18} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
               {/* Summary Card */}
               <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-[24px] p-6 shadow-xl shadow-black/5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                      <Zap size={16} fill="currentColor" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">AI Summary</span>
                  </div>
                  {summaryMutation.isPending ? (
                    <p className="text-xs font-bold text-[var(--text-secondary)] animate-pulse">Summarizing email thread...</p>
                  ) : (
                    <ul className="space-y-3">
                      {summaryMutation.data?.summary?.map((point, i) => (
                        <li key={i} className="flex gap-3 text-xs font-medium leading-relaxed text-[var(--text-primary)]">
                           <ChevronRight size={14} className="shrink-0 text-[var(--brand-primary)] mt-0.5" />
                           {point.replace(/^[\s•*-]+/, '')}
                        </li>
                      ))}
                    </ul>
                  )}
               </div>

               {/* Action Suggestions */}
               <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] px-2">Recommended Actions</p>
                 <div className="space-y-2">
                    <AIActionItem label="Approve Timeline" icon={CheckCircle} />
                    <AIActionItem label="Schedule QA Sync" icon={Clock} />
                    <AIActionItem label="Share with Stakeholders" icon={ExternalLink} />
                 </div>
               </div>

               {/* Priority Insight */}
               <div className="bg-gradient-to-br from-[var(--brand-primary)] to-indigo-600 rounded-[24px] p-6 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Priority Insight</span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed opacity-90">
                    This thread is marked as <span className="font-black underline decoration-2 underline-offset-4">High Priority</span> because it contains critical project delivery updates.
                  </p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ToolbarButton = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={cn(
      "p-2.5 rounded-xl transition-all flex items-center gap-2 group",
      active 
        ? "text-amber-500 bg-amber-50" 
        : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
    )}
    title={label}
  >
    <Icon size={18} className={cn(active && "fill-amber-500")} />
  </button>
);

const AttachmentCard = ({ name, size, type }) => (
  <div className="flex items-center gap-3 p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl hover:border-[var(--brand-primary)] transition-all cursor-pointer group">
    <div className="w-10 h-10 rounded-xl bg-[var(--surface-0)] flex items-center justify-center text-[10px] font-black text-[var(--text-secondary)] border border-[var(--border)]">
      {type}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold truncate text-[var(--text-primary)]">{name}</p>
      <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">{size}</p>
    </div>
    <button className="p-2 hover:bg-[var(--surface-0)] rounded-lg text-[var(--text-secondary)] transition-all opacity-0 group-hover:opacity-100">
      <Download size={14} />
    </button>
  </div>
);

const AIActionItem = ({ label, icon: Icon }) => (
  <button className="w-full flex items-center justify-between p-4 bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl hover:bg-[var(--brand-light)] hover:border-[var(--brand-primary)] transition-all group">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--surface-1)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--brand-primary)]">
        <Icon size={16} />
      </div>
      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]">{label}</span>
    </div>
    <ChevronRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--brand-primary)] group-hover:translate-x-1 transition-all" />
  </button>
);

const XIcon = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const CheckCircle = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default ReadingPane;
