import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../../../api';
import { 
  Reply, Forward, Archive, Trash2, 
  MoreVertical, Star, Paperclip, Download,
  Sparkles, ArrowLeft, Maximize2
} from 'lucide-react';
import { useMailStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LogoImage from '../../../assets/landing-logo.png';

const cn = (...inputs) => twMerge(clsx(inputs));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ReadingPane = () => {
  const { selectedId, setSelectedId, getAuth, openCompose } = useMailStore();

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

  // Auto-trigger smart replies when a mail is selected
  useEffect(() => {
    if (mail) {
      smartReplyMutation.mutate({ content: mail.content, sender: mail.sender });
    }
  }, [selectedId]);

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
            <div className="pt-4 pb-6">
              <div className="bg-white border border-slate-200 rounded-lg p-3 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">A</div>
                  <span className="text-xs text-slate-500">Reply to <span className="font-semibold text-slate-800">{mail.sender}</span></span>
                </div>
                <textarea 
                  value={inlineReplyText}
                  onChange={(e) => setInlineReplyText(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-900 resize-y min-h-[60px]"
                  placeholder="Write your response..."
                />
                {inlineAttachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2 border-t border-slate-100 pt-2">
                    {inlineAttachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs font-medium text-slate-700">
                        <Paperclip size={11} className="text-slate-400" />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button onClick={() => setInlineAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {isUploadingAttachment && (
                  <div className="text-[11px] text-blue-600 font-medium mb-2 animate-pulse">Uploading attachment...</div>
                )}
                <div className="flex items-center justify-between mt-2 border-t border-slate-100/60 pt-2">
                   <div className="flex items-center gap-0.5">
                     <input 
                       type="file" 
                       ref={inlineFileRef} 
                       onChange={handleInlineAttachmentUpload} 
                       style={{ display: 'none' }} 
                     />
                     <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors" title="Pop out reply"><Maximize2 size={14} /></button>
                     <button onClick={() => inlineFileRef.current?.click()} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors" title="Attach file"><Paperclip size={14} /></button>
                   </div>
                   <button 
                     onClick={() => sendReplyMutation.mutate()} 
                     disabled={sendReplyMutation.isPending || isUploadingAttachment || (!inlineReplyText.trim() && inlineAttachments.length === 0)}
                     className="bg-blue-600 hover:bg-blue-700 text-white h-7.5 px-3 rounded text-xs font-medium transition-colors disabled:opacity-50"
                   >
                     {sendReplyMutation.isPending ? 'Sending...' : 'Send'}
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


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



export default ReadingPane;
