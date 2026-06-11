import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Inbox, Star, Clock, Send, File, ShieldAlert, Trash2, 
  ChevronLeft, Search, Settings, HelpCircle, HardDrive, Zap,
  Menu, Square, Tag, LogOut
} from 'lucide-react';
import { useMailStore } from '../store';
import LogoImage from '../../../assets/landing-logo.png';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDroppable } from '@dnd-kit/core';
import { AppSwitcher } from '../../../components/AppLayout';

const cn = (...inputs) => twMerge(clsx(inputs));

const Sidebar = () => {
  const { 
    folder, setFolder, 
    isSidebarCollapsed, toggleSidebar, 
    setComposeOpen, setSearchOpen,
    setSettingsOpen, getAuth, setMobileMenuOpen
  } = useMailStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const NAV_ITEMS = [
    { id: 'Inbox', icon: Inbox, label: 'Inbox' },
    { id: 'Starred', icon: Star, label: 'Starred' },
    { id: 'Sent', icon: Send, label: 'Sent' },
    { id: 'Drafts', icon: File, label: 'Drafts' },
    { id: 'Spam', icon: ShieldAlert, label: 'Spam' },
    { id: 'Trash', icon: Trash2, label: 'Trash' },
  ];

  const LABELS = [
    { id: 'Work', color: '#3B82F6', label: 'Work' },
    { id: 'Client', color: '#8B5CF6', label: 'Client' },
    { id: 'Finance', color: '#F59E0B', label: 'Finance' },
    { id: 'Personal', color: '#10B981', label: 'Personal' },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isSidebarCollapsed ? 72 : 240 }}
      className="h-full flex flex-col bg-[var(--surface-1)] border-r border-[var(--border)] relative z-40"
    >
      {/* Header & Logo */}
      <div className="h-16 flex items-center px-6 shrink-0 gap-3">
        <img src={LogoImage} alt="Forge India" className="h-8 w-auto object-contain" />
        {!isSidebarCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-black tracking-tight text-lg text-[var(--text-primary)]"
          >
            FORGE <span className="text-[var(--brand-primary)]">INDIA</span>
          </motion.span>
        )}
      </div>

      {/* Compose Button */}
      <div className="px-4 py-2">
        <button
          onClick={() => setComposeOpen(true)}
          className={cn(
            "btn btn-primary w-full shadow-lg shadow-blue-500/20 transition-all",
            isSidebarCollapsed ? "h-12 w-12 p-0 rounded-2xl" : "h-12 px-6 rounded-2xl justify-start"
          )}
        >
          <Plus size={20} strokeWidth={3} />
          {!isSidebarCollapsed && <span className="ml-3 font-bold text-sm">Compose</span>}
        </button>
      </div>

      {/* Search Trigger */}
      <div className="px-4 py-2">
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-0)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all",
            isSidebarCollapsed && "justify-center px-0 w-12 h-12"
          )}
        >
          <Search size={16} />
          {!isSidebarCollapsed && <span className="text-xs font-medium">Search emails...</span>}
          {!isSidebarCollapsed && <span className="ml-auto text-[10px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">/</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem 
            key={item.id} 
            item={item} 
            isActive={folder === item.id} 
            onClick={() => { setFolder(item.id); setMobileMenuOpen(false); }} 
            collapsed={isSidebarCollapsed} 
          />
        ))}

        <div className="h-px bg-[var(--border)] my-6 mx-2" />

        {/* Labels Section */}
        {!isSidebarCollapsed && (
          <div className="px-2 mb-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Labels</span>
            <button className="p-1 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)]">
              <Plus size={14} />
            </button>
          </div>
        )}

        {LABELS.map((label) => (
          <SidebarNavItem 
            key={label.id} 
            item={{ ...label, icon: Tag }} 
            isActive={folder === label.id} 
            onClick={() => { setFolder(label.id); setMobileMenuOpen(false); }} 
            collapsed={isSidebarCollapsed}
            iconStyle={{ color: label.color }}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)] space-y-4">
        {/* Storage Bar */}
        {!isSidebarCollapsed && (
          <div className="space-y-2 px-1">
            <div className="flex justify-between text-[10px] font-bold text-[var(--text-secondary)]">
              <span className="flex items-center gap-1"><HardDrive size={10} /> 2.1 GB / 15 GB</span>
              <span>14%</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--surface-2)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--brand-primary)] w-[14%]" />
            </div>
          </div>
        )}

        <div className="mb-4">
           {!isSidebarCollapsed ? (
             <AppSwitcher workspaceId={getAuth().workspaceId || 'demo'} />
           ) : (
             <button onClick={() => navigate(`/w/${getAuth().workspaceId || 'demo'}/chat`)} className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-all mx-auto">
               <Zap size={18} strokeWidth={2.5} />
             </button>
           )}
        </div>

        <div className={cn("flex items-center gap-3", isSidebarCollapsed && "flex-col")}>
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-xl hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-secondary)] transition-all"
            title="Settings"
          >
            <Settings size={20} />
          </button>

          <button 
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl hover:bg-rose-50 flex items-center justify-center text-rose-500 transition-all"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
          
          <div className="relative">
            {getAuth()?.avatarUrl ? (
              <img 
                src={getAuth().avatarUrl} 
                className="w-10 h-10 rounded-full border-2 border-[var(--surface-0)] shadow-sm cursor-pointer hover:scale-105 transition-transform object-cover"
                alt="User"
              />
            ) : (
              <div className="w-10 h-10 rounded-full border-2 border-[var(--surface-0)] shadow-sm bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-primary)] font-bold text-lg cursor-pointer hover:scale-105 transition-transform">
                {(getAuth()?.name || getAuth()?.user || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[var(--surface-1)] rounded-full" />
          </div>

          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate text-[var(--text-primary)]">{getAuth()?.name || getAuth()?.user || 'Account'}</p>
              <p className="text-[10px] font-medium truncate text-[var(--text-secondary)]">{getAuth()?.email || 'user@example.com'}</p>
            </div>
          )}

          <button 
            onClick={toggleSidebar}
            className={cn(
              "w-10 h-10 rounded-xl hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-secondary)] transition-all ml-auto",
              isSidebarCollapsed && "ml-0"
            )}
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

const SidebarNavItem = ({ item, isActive, onClick, collapsed, iconStyle }) => {
  const { setNodeRef, isOver } = useDroppable({ id: item.id });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "w-full flex items-center rounded-xl transition-all group relative",
        isActive 
          ? "bg-[var(--brand-light)] text-[var(--brand-primary)]" 
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
        isOver && "ring-2 ring-[var(--brand-primary)] scale-105 bg-[var(--brand-light)] z-10",
        collapsed ? "h-11 w-11 justify-center p-0" : "h-11 px-4"
      )}
    >
      <item.icon 
        size={isActive ? 20 : 18} 
        style={iconStyle}
        className={cn(isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]")} 
      />
      {!collapsed && (
        <>
          <span className={cn("ml-3 text-sm font-semibold", isActive && "font-bold")}>{item.label}</span>
          {item.unread && (
            <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[var(--brand-primary)] text-white">
              {item.unread}
            </span>
          )}
        </>
      )}
      {collapsed && item.unread && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-[var(--brand-primary)] rounded-full border-2 border-[var(--surface-1)]" />
      )}
    </button>
  );
};

export default Sidebar;
