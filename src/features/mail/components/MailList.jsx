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
    <div className="w-full md:w-[400px] h-full flex flex-col bg-white border-r border-slate-200 shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 -ml-1 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
            <Menu size={20} />
          </button>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {folder}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowUpDown size={18} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 bg-white">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap border",
              activeFilter === f 
                ? "bg-slate-100 text-slate-800 border-slate-300" 
                : "bg-white text-slate-500 hover:bg-slate-50 border-transparent"
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
        "group relative flex items-start gap-3 px-5 py-4 border-b border-slate-100 cursor-default transition-all duration-200",
        !mail.isRead ? "bg-white" : "bg-[#F8FAFC]/50",
        isSelected && "bg-blue-50/50 shadow-[inset_4px_0_0_0_#2563EB]",
        isBulkSelected && "bg-blue-50/50"
      )}
    >
      {/* Unread Indicator */}
      {!mail.isRead && !isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
      )}

      {/* Avatar / Checkbox */}
      <div className="relative w-9 h-9 shrink-0 mt-0.5" onClick={(e) => { e.stopPropagation(); onBulkToggle(); }}>
        <AnimatePresence mode="wait">
          {isHovered || isBulkSelected ? (
            <motion.div
              key="checkbox"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center border transition-colors cursor-pointer",
                isBulkSelected ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
              )}
            >
              {isBulkSelected && <CheckCircle size={16} className="text-white" strokeWidth={3} />}
            </motion.div>
          ) : (
            <motion.div
              key="avatar"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
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
          <span className={cn("text-[14px] truncate", !mail.isRead ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
            {mail.sender}
          </span>
          <span className={cn("text-[11px] whitespace-nowrap ml-2", !mail.isRead ? "font-bold text-blue-600" : "font-medium text-slate-400")}>
            {new Date(mail.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
           {mail.priority === 'high' && <Zap size={14} className="text-red-500 fill-red-500" />}
           <h3 className={cn("text-[14px] truncate", !mail.isRead ? "font-bold text-slate-900" : "font-medium text-slate-600")}>
             {mail.subject}
           </h3>
        </div>
        <p className="text-[13px] text-slate-500 line-clamp-2 leading-snug pr-6 font-normal">
          {mail.snippet}
        </p>
      </div>

      {/* Hover Actions */}
      {isHovered && !isBulkSelected && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-lg z-10 animate-in fade-in zoom-in-95 duration-100">
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Archive">
            <Archive size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors" title="Delete">
            <Trash2 size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Snooze">
            <Clock size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Star">
            <Star size={16} className={cn(mail.isStarred && "text-amber-400 fill-amber-400")} />
          </button>
        </div>
      )}

      {/* Attachments Indicator */}
      {mail.hasAttachments && !isHovered && (
        <Paperclip size={14} className="absolute right-3 bottom-3 text-slate-400" />
      )}
    </div>
  );
};

const MailSkeleton = () => (
  <div className="px-4 py-3 border-b border-slate-200 animate-pulse flex items-start gap-3">
    <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
    <div className="flex-1 min-w-0 space-y-2 py-1">
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-slate-200 rounded" />
        <div className="h-3 w-10 bg-slate-200 rounded" />
      </div>
      <div className="h-3 w-3/4 bg-slate-200 rounded" />
      <div className="h-3 w-full bg-slate-100 rounded" />
    </div>
  </div>
);

export default MailList;
