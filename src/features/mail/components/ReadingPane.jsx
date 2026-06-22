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
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50 gap-4 opacity-50">
        <div className="flex items-center justify-center">
          <img src={LogoImage} alt="Forge India Logo" className="h-12 w-auto object-contain opacity-40 grayscale" />
        </div>
        <div className="text-center mt-2">
           <p className="text-sm font-medium text-slate-500">Select a message to read</p>
        </div>
      </div>
    );
  }

  if (isMailLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading...</p>
      </div>
    );
  }

  if (!mail) return null;

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-white">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedId(null)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded text-slate-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              <ToolbarButton icon={Reply} label="Reply" onClick={handleReply} />
              <ToolbarButton icon={Forward} label="Forward" onClick={handleForward} />
              <div className="w-px h-6 bg-slate-200 mx-2" />
              <ToolbarButton icon={Archive} label="Archive" onClick={handleArchive} />
              <ToolbarButton icon={Trash2} label="Delete" onClick={handleDelete} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={cn(
                "btn h-8 px-3 rounded flex items-center gap-2 text-xs font-semibold transition-colors border",
                showAIPanel 
                  ? "bg-blue-600 text-white border-blue-600" 
                  : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
              )}
            >
              <Sparkles size={14} /> AI Insights
            </button>
            <ToolbarButton icon={Star} label="Star" active={mail.isStarred} onClick={handleToggleStar} />
            <ToolbarButton icon={MoreVertical} label="More" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Subject */}
            <div className="flex items-start justify-between gap-6">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                {mail.subject}
              </h1>
              <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={handleNextLabel} title="Click to change label">
                <span className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider border transition-colors",
                  mail.label === 'Work' ? "bg-blue-50 text-blue-700 border-blue-200" :
                  mail.label === 'Client' ? "bg-purple-50 text-purple-700 border-purple-200" :
                  mail.label === 'Finance' ? "bg-amber-50 text-amber-700 border-amber-200" :
                  mail.label === 'Personal' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  "bg-[#F8FAFC] text-slate-600 border-slate-200 hover:bg-slate-100"
                )}>
                  {mail.label || 'Add Label'}
                </span>
              </div>
            </div>

            {/* Sender Card */}
            <div className="flex items-center justify-between group p-4 rounded-xl border border-slate-100 bg-[#F8FAFC]/50 hover:bg-[#F8FAFC] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-[15px] font-bold text-white shadow-sm ring-2 ring-white">
                  {mail.sender.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-slate-900">{mail.sender}</span>
                    <span className="text-[13px] text-slate-500 font-medium">&lt;{mail.senderEmail}&gt;</span>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-0.5 font-medium">To: {mail.recipient}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-slate-700">
                  {new Date(mail.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5 font-medium">
                  {new Date(mail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Body */}
            <div 
              className="text-slate-800 leading-relaxed text-[15px] font-sans mail-content px-2"
              dangerouslySetInnerHTML={{ __html: mail.content }}
            />

            {/* Attachments */}
            {mail.hasAttachments && (
              <div className="pt-8 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Paperclip size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    {selected.attachments.length} Attachment{selected.attachments.length !== 1 && 's'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="pt-8 border-t border-slate-200 space-y-3">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles size={14} className="text-blue-600" />
                 <span className="text-xs font-semibold text-blue-600">AI Smart Replies</span>
               </div>
               <div className="flex flex-wrap gap-2">
                 {smartReplyMutation.isPending ? (
                   <p className="text-xs font-medium text-slate-500 animate-pulse">Thinking...</p>
                 ) : smartReplyMutation.data?.replies?.map((reply, i) => (
                   <button key={i} onClick={() => setInlineReplyText(prev => prev ? prev + '\n' + reply : reply)} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                     {reply}
                   </button>
                 ))}
               </div>
            </div>

            {/* Inline Reply Box */}
            <div className="pt-8 pb-16">
              <div className="bg-white border border-slate-200 rounded-lg p-4 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">A</div>
                  <span className="text-sm text-slate-600">Reply to <span className="font-semibold text-slate-900">{mail.sender}</span></span>
                </div>
                <textarea 
                  value={inlineReplyText}
                  onChange={(e) => setInlineReplyText(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-900 resize-y min-h-[100px]"
                  placeholder="Write your response..."
                />
                {inlineAttachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3 border-t border-slate-100 pt-3">
                    {inlineAttachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-xs font-medium text-slate-700">
                        <Paperclip size={12} className="text-slate-400" />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button onClick={() => setInlineAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {isUploadingAttachment && (
                  <div className="text-xs text-blue-600 font-medium mb-3">Uploading attachment...</div>
                )}
                <div className="flex items-center justify-between mt-3">
                   <div className="flex items-center gap-1">
                     <input 
                       type="file" 
                       ref={inlineFileRef} 
                       onChange={handleInlineAttachmentUpload} 
                       style={{ display: 'none' }} 
                     />
                     <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors" title="Pop out reply"><Maximize2 size={16} /></button>
                     <button onClick={() => inlineFileRef.current?.click()} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors" title="Attach file"><Paperclip size={16} /></button>
                   </div>
                   <button 
                     onClick={() => sendReplyMutation.mutate()} 
                     disabled={sendReplyMutation.isPending || isUploadingAttachment || (!inlineReplyText.trim() && inlineAttachments.length === 0)}
                     className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 rounded text-sm font-medium transition-colors disabled:opacity-50"
                   >
                     {sendReplyMutation.isPending ? 'Sending...' : 'Send'}
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
            transition={{ type: 'tween', duration: 0.2 }}
            className="w-[320px] lg:w-[380px] h-full border-l border-slate-200 bg-slate-50 flex flex-col shrink-0"
          >
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 bg-white">
               <div className="flex items-center gap-2">
                 <Sparkles size={16} className="text-blue-600" />
                 <h2 className="text-sm font-semibold text-slate-800">Antigravity AI</h2>
               </div>
               <button onClick={() => setShowAIPanel(false)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition-colors">
                 <XIcon size={16} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
               {/* Summary Card */}
               <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600">
                      <Zap size={14} fill="currentColor" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">AI Summary</span>
                  </div>
                  {summaryMutation.isPending ? (
                    <p className="text-sm text-slate-500 animate-pulse">Summarizing email thread...</p>
                  ) : (
                    <ul className="space-y-2">
                      {summaryMutation.data?.summary?.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                           <ChevronRight size={14} className="shrink-0 text-blue-600 mt-1" />
                           {point.replace(/^[\s•*-]+/, '')}
                        </li>
                      ))}
                    </ul>
                  )}
               </div>

               {/* Action Suggestions */}
               <div className="space-y-3">
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Recommended Actions</p>
                 <div className="space-y-1.5">
                    <AIActionItem label="Approve Timeline" icon={CheckCircle} />
                    <AIActionItem label="Schedule QA Sync" icon={Clock} />
                    <AIActionItem label="Share with Stakeholders" icon={ExternalLink} />
                 </div>
               </div>

               {/* Priority Insight */}
               <div className="bg-slate-800 rounded-lg p-5 text-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-blue-300" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">Priority Insight</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">
                    This thread is marked as <span className="font-semibold text-white">High Priority</span> because it contains critical project delivery updates.
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
      "p-1.5 rounded transition-colors flex items-center gap-2 group",
      active 
        ? "text-amber-500 bg-amber-50" 
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    )}
    title={label}
  >
    <Icon size={16} className={cn(active && "fill-amber-500")} />
  </button>
);

const AttachmentCard = ({ name, size, type }) => (
  <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer group shadow-sm">
    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
      {type}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate text-slate-800">{name}</p>
      <p className="text-xs text-slate-500">{size}</p>
    </div>
    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors opacity-0 group-hover:opacity-100">
      <Download size={14} />
    </button>
  </div>
);

const AIActionItem = ({ label, icon: Icon }) => (
  <button className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-300 transition-colors group shadow-sm">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600">
        <Icon size={14} />
      </div>
      <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{label}</span>
    </div>
    <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
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
