import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Minus, Maximize2, Send, Paperclip, 
  Trash2, MoreHorizontal, Image, Smile, 
  Type, Link, List, Bold, Italic, Underline,
  ChevronDown, Clock, Wand2, Loader2
} from 'lucide-react';
import { useMailStore } from '../store';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

import { useMutation, useQueryClient } from '@tanstack/react-query';

const ComposeModal = () => {
  const { isComposeOpen, setComposeOpen, getAuth } = useMailStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [draftId, setDraftId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  
  const queryClient = useQueryClient();
  const auth = getAuth();

  const handleAIGenerate = async () => {
    const subject = document.getElementById('compose-subject')?.value;
    if (!subject) return alert("Please enter a subject first!");
    
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/mail/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subject })
      });
      const data = await res.json();
      if (res.ok && data.content) {
        editor.commands.setContent(data.content);
        triggerAutoSave();
      } else {
        alert(data.error || 'Failed to generate content');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: 'Write your message...' }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      if (text.length > 5 && text.endsWith(' ')) {
        fetchSmartCompose(text);
      } else {
        setSuggestion('');
      }
      triggerAutoSave();
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === 'Tab' && suggestion) {
          editor.commands.insertContent(suggestion);
          setSuggestion('');
          return true;
        }
        return false;
      },
    },
  });

  const fetchSmartCompose = async (currentText) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/mail/smart-compose'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentText, context: 'Professional email' })
      });
      const data = await res.json();
      setSuggestion(data.suggestion);
    } catch (e) {}
  };

  const triggerAutoSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(handleAutoSave, 3000);
  };

  const handleAutoSave = async () => {
    const to = document.getElementById('compose-to')?.value || '';
    const subject = document.getElementById('compose-subject')?.value || '';
    const content = editor?.getHTML() || '';

    if (!content && !subject && !to) return;

    const draftData = {
      to: to.split(',').map(e => e.trim()),
      subject: subject || '(No Subject)',
      body: content,
      isDraft: true,
    };

    try {
      const token = localStorage.getItem('token');
      if (draftId) {
        await fetch(getApiUrl(`/api/mail/${draftId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(draftData)
        });
      } else {
        const res = await fetch(getApiUrl('/api/mail/draft'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(draftData)
        });
        const data = await res.json();
        if (data._id) setDraftId(data._id);
      }
      queryClient.invalidateQueries(['mails']);
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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
          setAttachments(prev => [...prev, { name: file.name, url: data.url, size: file.size }]);
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File upload error:', err);
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const composeData = useMailStore(state => state.composeData);

  useEffect(() => {
    if (isComposeOpen && composeData) {
      if (composeData.to) {
        const toInput = document.getElementById('compose-to');
        if (toInput) toInput.value = composeData.to;
      }
      if (composeData.subject) {
        const subjectInput = document.getElementById('compose-subject');
        if (subjectInput) subjectInput.value = composeData.subject;
      }
      if (composeData.body && editor) {
        editor.commands.setContent(composeData.body);
      }
    } else if (isComposeOpen && !composeData) {
      // Clear fields if opened without data
      const toInput = document.getElementById('compose-to');
      if (toInput) toInput.value = '';
      const subjectInput = document.getElementById('compose-subject');
      if (subjectInput) subjectInput.value = '';
      if (editor) editor.commands.setContent('');
      setAttachments([]);
    }
  }, [isComposeOpen, composeData, editor]);

  const sendMutation = useMutation({
    mutationFn: async (mailData) => {
      const token = localStorage.getItem('token');
      const endpoint = draftId ? getApiUrl(`/api/mail/${draftId}`) : getApiUrl('/api/mail/send');
      const method = draftId ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(mailData)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['mails']);
      setComposeOpen(false);
      setAttachments([]);
    }
  });

  const handleSend = () => {
    const to = document.getElementById('compose-to').value;
    const subject = document.getElementById('compose-subject').value;
    const content = editor.getHTML();

    sendMutation.mutate({
      to: to.split(',').map(e => e.trim()),
      subject,
      body: content,
      attachments: attachments.map(a => ({ name: a.name, url: a.url, size: a.size })),
      isDraft: false,
    });
  };

  return (
    <AnimatePresence>
      {isComposeOpen && (
        <motion.div
          drag={!isMaximized}
          dragMomentum={false}
          initial={{ y: 500, opacity: 0 }}
          animate={{ 
            y: isMinimized ? 460 : 0, 
            opacity: 1,
            width: isMaximized || window.innerWidth < 768 ? '100vw' : 520,
            height: isMinimized ? 48 : (isMaximized || window.innerWidth < 768 ? '100vh' : 580),
            bottom: isMaximized || window.innerWidth < 768 ? 0 : 0,
            right: isMaximized || window.innerWidth < 768 ? 0 : 40,
            borderRadius: isMaximized || window.innerWidth < 768 ? 0 : 16
          }}
          exit={{ y: 500, opacity: 0 }}
          className={cn(
            "fixed z-[100] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden",
            isMaximized || window.innerWidth < 768 ? "top-0 left-0" : "border border-slate-200/60"
          )}
        >
          {/* Header */}
          <div className="h-12 bg-[#0F172A] text-white flex items-center justify-between px-5 cursor-grab active:cursor-grabbing shrink-0">
            <span className="text-[14px] font-bold tracking-wide">New Message</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors"><Minus size={16} /></button>
              <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors"><Maximize2 size={14} /></button>
              <button onClick={() => setComposeOpen(false)} className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors"><X size={16} /></button>
            </div>
          </div>

          {/* Fields */}
          {!isMinimized && (
            <>
              <div className="px-6 py-1 border-b border-slate-100">
                <div className="flex items-center gap-4 py-2.5">
                  <span className="text-[13px] font-bold text-slate-400 w-12">To</span>
                  <input id="compose-to" type="text" className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-300" placeholder="recipients@example.com" />
                  <button className="text-[13px] font-bold text-slate-400 hover:text-blue-600 transition-colors">Cc/Bcc</button>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <div className="flex items-center gap-4 py-2.5">
                  <span className="text-[13px] font-bold text-slate-400 w-12">Subject</span>
                  <input id="compose-subject" type="text" className="flex-1 bg-transparent border-none outline-none text-[14px] font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-300" placeholder="Enter subject" />
                </div>
              </div>
              
              {attachments.length > 0 && (
                <div className="px-5 py-2 border-b border-slate-200 flex gap-2 flex-wrap bg-slate-50">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded text-xs font-medium text-slate-700 shadow-sm">
                      <Paperclip size={12} className="text-slate-400" />
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-[200px] relative bg-white">
                <EditorContent editor={editor} className="prose prose-sm max-w-none focus:outline-none min-h-full text-slate-800" />
                {suggestion && (
                  <div className="absolute left-5 bottom-5 pointer-events-none opacity-50 text-sm italic text-slate-500">
                    Press Tab to accept: "{suggestion}"
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-white shrink-0 rounded-b-xl">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 rounded-lg flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    <span className="text-[14px] font-bold tracking-wide">{sendMutation.isPending ? 'Sending...' : 'Send'}</span>
                    <div className="w-px h-4 bg-white/30 mx-1" />
                    <ChevronDown size={16} />
                  </button>
                  <div className="flex items-center gap-1">
                    <EditorAction icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
                    <EditorAction icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
                    <EditorAction icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                    <EditorAction icon={Link} onClick={() => {}} />
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button 
                    onClick={handleAIGenerate} 
                    disabled={isGenerating}
                    className="p-2 hover:bg-blue-100 rounded text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-semibold mr-2"
                  >
                    {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    <span className="hidden sm:inline">{isGenerating ? 'Writing...' : 'AI Assist'}</span>
                  </button>
                  <div className="w-px h-5 bg-slate-300 mx-1" />
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  {isUploading ? (
                    <div className="p-1.5 text-slate-400"><Loader2 size={16} className="animate-spin" /></div>
                  ) : (
                    <EditorAction icon={Paperclip} onClick={() => fileInputRef.current?.click()} />
                  )}
                  <EditorAction icon={Image} onClick={() => fileInputRef.current?.click()} />
                  <EditorAction icon={Smile} />
                  <div className="w-px h-5 bg-slate-300 mx-1" />
                  <EditorAction icon={Trash2} />
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const EditorAction = ({ icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
  >
    <Icon size={18} />
  </button>
);

export default ComposeModal;
