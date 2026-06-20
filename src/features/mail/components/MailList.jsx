import React, { useState, useMemo } from 'react';
import { getApiUrl } from '../../../api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, ArrowUpDown, Star, Archive, 
  Trash2, Clock, CheckCircle, MoreVertical, Paperclip,
  Zap, Mail, Inbox, Menu
} from 'lucide-react';
import { useMailStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

import { useQuery } from '@tanstack/react-query';
import { Virtuoso } from 'react-virtuoso';
import { useDraggable } from '@dnd-kit/core';

const MailList = () => {
  const { 
    folder, selectedId, setSelectedId, 
    selectedMails, toggleMailSelection, clearSelection,
    searchQuery, getAuth, setMobileMenuOpen
  } = useMailStore();

  const auth = getAuth();
  const workspaceId = auth.workspaceId || 'demo';
  const email = auth.email || '';

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['mails', workspaceId, email, searchQuery],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/mail?folder=all${searchQuery ? `&q=${searchQuery}` : ''}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return Array.isArray(data) ? data.map(m => ({
        ...m,
        recipient: m.recipientEmails?.[0] || '',
        sender: m.senderName || m.senderEmail || 'Unknown',
        content: m.body || '',
        timestamp: m.sentAt || new Date().toISOString(),
        isDeleted: m.folder === 'trash',
        isDraft: m.folder === 'drafts',
        hasAttachments: m.attachments?.length > 0
      })) : [];
    },
    // Keep previous data while fetching new search results for smoother UI
    placeholderData: (previousData) => previousData,
  });

  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');

  const filters = ['All', 'Unread', 'Starred', 'Attachments'];
  const sortOptions = ['Newest', 'Oldest', 'Sender', 'Size'];

  const filteredMails = useMemo(() => {
    let mails = emails.filter(m => {
      // Basic folder filtering
      if (['Work', 'Client', 'Finance', 'Personal'].includes(folder)) {
        return m.label === folder;
      }
      if (folder === 'Starred') return m.isStarred;
      if (folder === 'Sent') return m.folder === 'sent';
      if (folder === 'Drafts') return m.isDraft;
      if (folder === 'Trash') return m.isDeleted;
      
      // Default Inbox
      return m.folder === 'inbox';
    });

    // Tab filtering
    if (activeFilter === 'Unread') mails = mails.filter(m => !m.isRead);
    if (activeFilter === 'Starred') mails = mails.filter(m => m.isStarred);
    if (activeFilter === 'Attachments') mails = mails.filter(m => m.hasAttachments);

    // Sort
    return mails.sort((a, b) => {
      if (sortBy === 'Newest') return new Date(b.timestamp) - new Date(a.timestamp);
      if (sortBy === 'Oldest') return new Date(a.timestamp) - new Date(b.timestamp);
      if (sortBy === 'Sender') return a.sender.localeCompare(b.sender);
      return 0;
    });
  }, [emails, folder, activeFilter, sortBy, email]);

  return (
    <div className="w-full md:w-[380px] h-full flex flex-col bg-[var(--surface-1)] border-r border-[var(--border)] shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)]">
            <Menu size={20} />
          </button>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
            {folder}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all">
            <ArrowUpDown size={14} />
          </button>
          <button className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all">
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--border)]">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeFilter === f 
                ? "bg-[var(--brand-primary)] text-white shadow-md shadow-blue-500/20" 
                : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-0)] border border-[var(--border)]"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        {isLoading && emails.length === 0 ? (
          <div className="flex flex-col h-full overflow-y-auto">
            {[...Array(6)].map((_, i) => <MailSkeleton key={i} />)}
          </div>
        ) : filteredMails.length > 0 ? (
          <Virtuoso
            style={{ height: '100%' }}
            totalCount={filteredMails.length}
            itemContent={(index) => {
              const mail = filteredMails[index];
              return (
                <MailRow 
                  key={mail._id} 
                  mail={mail} 
                  isSelected={selectedId === mail._id}
                  isBulkSelected={selectedMails.includes(mail._id)}
                  onSelect={() => setSelectedId(mail._id)}
                  onBulkToggle={() => toggleMailSelection(mail._id)}
                />
              );
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-64 opacity-30 gap-4">
            <Inbox size={48} strokeWidth={1} />
            <p className="text-xs font-bold uppercase tracking-widest">No messages found</p>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedMails.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--text-primary)] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50"
          >
            <span className="text-xs font-black uppercase tracking-widest border-r border-white/20 pr-6">
              {selectedMails.length} selected
            </span>
            <div className="flex items-center gap-4">
              <button className="hover:text-[var(--brand-light)] transition-colors"><Archive size={16} /></button>
              <button className="hover:text-[var(--brand-light)] transition-colors"><Trash2 size={16} /></button>
              <button className="hover:text-[var(--brand-light)] transition-colors"><CheckCircle size={16} /></button>
              <button onClick={clearSelection} className="ml-4 text-[10px] font-black uppercase hover:underline opacity-60">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MailRow = ({ mail, isSelected, isBulkSelected, onSelect, onBulkToggle }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: mail._id,
    data: { mail }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  const initials = mail.sender.split(' ').map(n => n[0]).join('');
  const bgColors = ['#534AB7', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
  const avatarBg = bgColors[mail.sender.length % bgColors.length];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      className={cn(
        "group relative flex items-start gap-4 px-6 py-4 border-b border-[var(--border)] cursor-grab active:cursor-grabbing transition-all",
        !mail.isRead ? "bg-[var(--surface-0)]" : "bg-transparent",
        isSelected && "bg-[var(--brand-light)] border-l-4 border-l-[var(--brand-primary)]",
        isBulkSelected && "bg-[var(--brand-light)]"
      )}
    >
      {/* Unread Indicator */}
      {!mail.isRead && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />
      )}

      {/* Avatar / Checkbox */}
      <div className="relative w-10 h-10 shrink-0" onClick={(e) => { e.stopPropagation(); onBulkToggle(); }}>
        <AnimatePresence mode="wait">
          {isHovered || isBulkSelected ? (
            <motion.div
              key="checkbox"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                isBulkSelected ? "bg-[var(--brand-primary)] border-[var(--brand-primary)]" : "bg-white border-[var(--border)]"
              )}
            >
              {isBulkSelected && <CheckCircle size={16} className="text-white" strokeWidth={3} />}
            </motion.div>
          ) : (
            <motion.div
              key="avatar"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black"
              style={{ background: avatarBg }}
            >
              {initials}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("text-xs truncate", !mail.isRead ? "font-black text-[var(--text-primary)]" : "font-semibold text-[var(--text-secondary)]")}>
            {mail.sender}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 font-mono whitespace-nowrap">
            {new Date(mail.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(mail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
           {mail.priority === 'high' && <Zap size={10} className="text-[var(--brand-primary)] fill-[var(--brand-primary)]" />}
           <h3 className={cn("text-xs truncate", !mail.isRead ? "font-bold text-[var(--text-primary)]" : "font-medium text-[var(--text-secondary)]")}>
             {mail.subject}
           </h3>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1 opacity-70 leading-relaxed">
          {mail.snippet}
        </p>
      </div>

      {/* Hover Actions */}
      {isHovered && !isBulkSelected && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[var(--surface-0)] border border-[var(--border)] p-1 rounded-xl shadow-xl z-10 animate-fade">
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all">
            <Archive size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all">
            <Trash2 size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all">
            <Clock size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)] transition-all">
            <Star size={14} className={cn(mail.isStarred && "text-amber-400 fill-amber-400")} />
          </button>
        </div>
      )}

      {/* Attachments Indicator */}
      {mail.hasAttachments && !isHovered && (
        <Paperclip size={12} className="absolute right-6 bottom-4 text-[var(--text-secondary)] opacity-40" />
      )}
    </div>
  );
};

const MailSkeleton = () => (
  <div className="px-6 py-4 border-b border-[var(--border)] animate-pulse flex items-start gap-4">
    <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex justify-between">
        <div className="h-3 w-20 bg-[var(--surface-2)] rounded" />
        <div className="h-2 w-12 bg-[var(--surface-2)] rounded" />
      </div>
      <div className="h-3 w-40 bg-[var(--surface-2)] rounded" />
      <div className="h-2 w-full bg-[var(--surface-2)] rounded opacity-50" />
    </div>
  </div>
);

export default MailList;
