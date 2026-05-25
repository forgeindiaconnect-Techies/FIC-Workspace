import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mail, Settings, User, Trash2, Archive, Send, Terminal, Sparkles, MessageSquare } from 'lucide-react';
import { useMailStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const CommandPalette = () => {
  const { isComposeOpen, setComposeOpen, setFolder, setSearchOpen, setSettingsOpen } = useMailStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const commands = [
    { id: 'compose', label: 'Compose New Email', icon: Mail, shortcut: 'C', action: () => setComposeOpen(true) },
    { id: 'inbox', label: 'Go to Inbox', icon: Archive, shortcut: 'G I', action: () => setFolder('Inbox') },
    { id: 'sent', label: 'Go to Sent', icon: Send, shortcut: 'G S', action: () => setFolder('Sent') },
    { id: 'search', label: 'Search Workspace', icon: Search, shortcut: '/', action: () => setSearchOpen(true) },
    { id: 'settings', label: 'Open Settings', icon: Settings, shortcut: ',', action: () => setSettingsOpen(true) },
    { id: 'ai', label: 'Ask Antigravity AI', icon: Sparkles, shortcut: 'A', action: () => {} },
  ].filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center pt-[15vh] px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-[640px] bg-[var(--surface-0)] rounded-[24px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-[var(--border)] overflow-hidden relative"
      >
        <div className="flex items-center px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-1)]">
          <Terminal size={18} className="text-[var(--brand-primary)] mr-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands (e.g. 'compose', 'inbox')..."
            className="flex-1 bg-transparent border-none outline-none text-base font-bold placeholder:opacity-30"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {commands.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { c.action(); setIsOpen(false); }}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--brand-light)] hover:text-[var(--brand-primary)] rounded-xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[var(--surface-1)] rounded-lg group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
                  <c.icon size={18} />
                </div>
                <span className="font-bold text-sm">{c.label}</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2 py-1 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] group-hover:border-transparent">
                {c.shortcut}
              </span>
            </button>
          ))}
          {commands.length === 0 && (
            <div className="p-8 text-center opacity-30">
              <Search size={32} className="mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">No commands matched</p>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-[var(--surface-1)] border-t border-[var(--border)] flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">
           <div className="flex gap-4">
             <span>↑↓ Navigate</span>
             <span>Enter to select</span>
           </div>
           <span>Esc to close</span>
        </div>
      </motion.div>
    </div>
  );
};

export default CommandPalette;
