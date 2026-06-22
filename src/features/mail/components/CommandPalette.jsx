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
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden relative"
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-slate-50">
          <Terminal size={18} className="text-blue-600 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands (e.g. 'compose', 'inbox')..."
            className="flex-1 bg-transparent border-none outline-none text-base text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {commands.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { c.action(); setIsOpen(false); }}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 hover:text-blue-700 rounded-lg transition-colors group text-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  <c.icon size={16} />
                </div>
                <span className="font-medium text-sm">{c.label}</span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 py-1 bg-slate-100 rounded border border-slate-200 group-hover:border-transparent transition-colors">
                {c.shortcut}
              </span>
            </button>
          ))}
          {commands.length === 0 && (
            <div className="p-8 text-center">
              <Search size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No commands matched</p>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-400">
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
