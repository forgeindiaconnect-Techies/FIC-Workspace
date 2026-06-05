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
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
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

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

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
            "fixed z-[100] bg-[var(--surface-0)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden",
            isMaximized || window.innerWidth < 768 ? "top-0 left-0" : ""
          )}
        >
          {/* Header */}
          <div className="h-12 bg-[var(--text-primary)] text-white flex items-center justify-between px-4 cursor-grab active:cursor-grabbing shrink-0">
            <span className="text-xs font-black uppercase tracking-widest">New Message</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded-lg"><Minus size={14} /></button>
              <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:bg-white/10 rounded-lg"><Maximize2 size={14} /></button>
              <button onClick={() => setComposeOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X size={14} /></button>
            </div>
          </div>

          {/* Fields */}
          {!isMinimized && (
            <>
              <div className="px-6 py-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-3 py-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] w-12">To</span>
                  <input id="compose-to" type="text" className="flex-1 bg-transparent border-none outline-none text-sm font-semibold" placeholder="recipients@forgeindia.com" />
                  <button className="text-[10px] font-black text-[var(--text-secondary)] hover:text-[var(--brand-primary)]">Cc/Bcc</button>
                </div>
                <div className="h-px bg-[var(--border)] w-full" />
                <div className="flex items-center gap-3 py-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] w-12">Subject</span>
                  <input id="compose-subject" type="text" className="flex-1 bg-transparent border-none outline-none text-sm font-semibold" placeholder="Meeting sync" />
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-[200px] relative">
                <EditorContent editor={editor} className="prose prose-sm max-w-none focus:outline-none min-h-full" />
                {suggestion && (
                  <div className="absolute left-6 bottom-6 pointer-events-none opacity-40 text-sm font-medium italic text-[var(--text-secondary)]">
                    Press Tab to accept: "{suggestion}"
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface-1)]">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                    className="btn btn-primary h-10 px-6 rounded-xl flex items-center gap-3 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    <span className="text-xs font-bold">{sendMutation.isPending ? 'Sending...' : 'Send'}</span>
                    <div className="w-px h-4 bg-white/20" />
                    <ChevronDown size={14} />
                  </button>
                  <div className="flex items-center gap-1">
                    <EditorAction icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} />
                    <EditorAction icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
                    <EditorAction icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                    <EditorAction icon={Link} onClick={() => {}} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleAIGenerate} 
                    disabled={isGenerating}
                    className="p-2 hover:bg-purple-500/10 rounded-lg text-purple-500 transition-all flex items-center gap-2 font-bold text-xs"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    <span className="hidden sm:inline">{isGenerating ? 'Writing...' : 'Write with AI'}</span>
                  </button>
                  <div className="w-px h-6 bg-[var(--border)] mx-1" />
                  <EditorAction icon={Paperclip} />
                  <EditorAction icon={Image} />
                  <EditorAction icon={Smile} />
                  <div className="w-px h-6 bg-[var(--border)] mx-1" />
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
    className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all"
  >
    <Icon size={16} />
  </button>
);

export default ComposeModal;
