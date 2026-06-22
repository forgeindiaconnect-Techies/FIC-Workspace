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
        className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex flex-col items-center pt-[10vh] px-4"
      >
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {/* Search Input Area */}
          <div className="relative group bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none py-4 pl-12 pr-20 text-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              placeholder="Search emails, people, or attachments..."
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">ESC</span>
              <button onClick={() => setSearchOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
             <FilterChip icon={User} label="From" />
             <FilterChip icon={Mail} label="To" />
             <FilterChip icon={Paperclip} label="Has Attachment" />
             <FilterChip icon={Calendar} label="Date Range" />
             <FilterChip icon={Tag} label="Label" />
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar bg-white rounded-lg shadow-xl border border-slate-200">
            {searchQuery.length > 0 ? (
              <div className="py-2">
                {results.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-4 pt-2">Matching Conversations</p>
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
                  <div className="text-center py-16">
                    <Search size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
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
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
    <Icon size={14} className="text-slate-400" />
    {label}
  </button>
);

const SearchResultItem = ({ res, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group text-left"
  >
    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0">
      <Mail size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm font-semibold text-slate-900 truncate">{res.sender}</span>
        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{res.label}</span>
      </div>
      <p className="text-sm text-slate-600 truncate">{res.subject}</p>
    </div>
    <ArrowRight size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
  </button>
);

const RecentSection = ({ title, items }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-2">{title}</h3>
    <div className="space-y-1">
      {items.map(item => (
        <button key={item} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded transition-colors text-sm font-medium text-slate-700">
          <Clock size={14} className="text-slate-400" />
          {item}
        </button>
      ))}
    </div>
  </div>
);

export default SearchOverlay;
