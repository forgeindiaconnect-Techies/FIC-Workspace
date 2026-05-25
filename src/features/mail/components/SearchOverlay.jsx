import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, User, FileText, Tag, Clock, 
  ArrowRight, Mail, Paperclip, Calendar
} from 'lucide-react';
import { useMailStore, MOCK_EMAILS } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const SearchOverlay = () => {
  const { isSearchOpen, setSearchOpen, searchQuery, setSearchQuery, setSelectedId } = useMailStore();
  const inputRef = useRef(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !isSearchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const results = searchQuery.length > 0 ? MOCK_EMAILS.filter(m => 
    m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.sender.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  if (!isSearchOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl flex flex-col items-center pt-[10vh] px-6"
      >
        <div className="w-full max-w-3xl flex flex-col gap-8">
          {/* Search Input Area */}
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]" size={24} strokeWidth={3} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--surface-0)] border-2 border-[var(--border)] group-focus-within:border-[var(--brand-primary)] rounded-[32px] py-6 pl-16 pr-20 text-xl font-bold placeholder:text-[var(--text-secondary)] placeholder:opacity-30 focus:outline-none shadow-2xl transition-all"
              placeholder="Search people, subjects, or attachments..."
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40 px-2 py-1 bg-[var(--surface-2)] rounded-lg">ESC to close</span>
              <button onClick={() => setSearchOpen(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 px-4">
             <FilterChip icon={User} label="From" />
             <FilterChip icon={Mail} label="To" />
             <FilterChip icon={Paperclip} label="Has Attachment" />
             <FilterChip icon={Calendar} label="Date Range" />
             <FilterChip icon={Tag} label="Label" />
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] no-scrollbar px-2 space-y-8">
            {searchQuery.length > 0 ? (
              <div className="grid grid-cols-1 gap-1">
                {results.length > 0 ? (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-2 px-4">Matching Conversations</p>
                    {results.map((res) => (
                      <SearchResultItem 
                        key={res.id} 
                        res={res} 
                        onClick={() => {
                          setSelectedId(res.id);
                          setSearchOpen(false);
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <div className="text-center py-20 opacity-30">
                    <Search size={48} className="mx-auto mb-4" strokeWidth={1} />
                    <p className="text-sm font-bold uppercase tracking-widest">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10">
                <RecentSection title="Recent Searches" items={['Q3 Roadmap', 'Indigo Group', 'Invoice #2026']} />
                <RecentSection title="Frequent Contacts" items={['Rahul Sharma', 'Anjali Verma', 'HR Team']} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const FilterChip = ({ icon: Icon, label }) => (
  <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface-0)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--brand-light)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all">
    <Icon size={14} />
    {label}
  </button>
);

const SearchResultItem = ({ res, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 hover:bg-[var(--surface-2)] rounded-2xl transition-all group text-left"
  >
    <div className="w-10 h-10 rounded-xl bg-[var(--surface-0)] border border-[var(--border)] flex items-center justify-center text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-all">
      <Mail size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-black text-[var(--text-primary)]">{res.sender}</span>
        <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">• {res.label}</span>
      </div>
      <p className="text-xs font-semibold text-[var(--text-secondary)] truncate">{res.subject}</p>
    </div>
    <ArrowRight size={16} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
  </button>
);

const RecentSection = ({ title, items }) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] px-4">{title}</h3>
    <div className="space-y-1">
      {items.map(item => (
        <button key={item} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] rounded-xl transition-all text-sm font-semibold text-[var(--text-primary)]">
          <Clock size={14} className="text-[var(--text-secondary)]" />
          {item}
        </button>
      ))}
    </div>
  </div>
);

export default SearchOverlay;
