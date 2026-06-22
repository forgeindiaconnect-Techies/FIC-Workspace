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
      animate={{ width: isSidebarCollapsed ? 72 : 260 }}
      className="h-full flex flex-col bg-[#F8FAFC] border-r border-slate-200 relative z-40"
    >
      <div className="h-16 flex items-center px-4 shrink-0 gap-3">
        <img src={LogoImage} alt="Forge India" className="h-7 w-auto object-contain" />
        {!isSidebarCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-black text-lg text-slate-900 tracking-tight"
          >
            Mail
          </motion.span>
        )}
      </div>

      <div className="px-4 py-5">
        <button
          onClick={() => setComposeOpen(true)}
          className={cn(
            "w-full flex items-center bg-[#0F172A] hover:bg-slate-800 text-white transition-all shadow-md hover:shadow-lg rounded-xl",
            isSidebarCollapsed ? "h-12 w-12 p-0 justify-center mx-auto" : "h-12 px-5 justify-start"
          )}
        >
          <Plus size={20} className={isSidebarCollapsed ? "" : "text-blue-400"} />
          {!isSidebarCollapsed && <span className="ml-3 font-bold text-[15px]">New Message</span>}
        </button>
      </div>

      {/* Search Trigger */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm",
            isSidebarCollapsed && "justify-center px-0 w-10 h-10 mx-auto"
          )}
        >
          <Search size={16} />
          {!isSidebarCollapsed && <span className="text-sm font-medium flex-1 text-left">Search</span>}
          {!isSidebarCollapsed && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">/</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem 
            key={item.id} 
            item={item} 
            isActive={folder === item.id} 
            onClick={() => { setFolder(item.id); setMobileMenuOpen(false); }} 
            collapsed={isSidebarCollapsed} 
          />
        ))}

        <div className="h-px bg-slate-200 my-4 mx-2" />

        {/* Labels Section */}
        {!isSidebarCollapsed && (
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Labels</span>
            <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
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
      <div className="p-3 border-t border-slate-200 space-y-3 bg-slate-50">
        {/* Storage Bar */}
        {!isSidebarCollapsed && (
          <div className="space-y-1.5 px-2">
            <div className="flex justify-between text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><HardDrive size={12} /> 2.1 GB / 15 GB</span>
              <span>14%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[14%]" />
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

        <div className={cn("flex items-center gap-2", isSidebarCollapsed && "flex-col")}>
          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>

          <button 
            onClick={handleLogout}
            className="w-8 h-8 rounded-md hover:bg-red-50 flex items-center justify-center text-red-600 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
          
          <div className="relative">
            {getAuth()?.avatarUrl ? (
              <img 
                src={getAuth().avatarUrl} 
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                alt="User"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                {(getAuth()?.name || getAuth()?.user || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
          </div>

          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0 ml-1 text-left">
              <p className="text-sm font-semibold truncate text-slate-900">{getAuth()?.name || getAuth()?.user || 'Account'}</p>
              <p className="text-xs text-slate-500 truncate">{getAuth()?.email || 'user@example.com'}</p>
            </div>
          )}

          <button 
            onClick={toggleSidebar}
            className={cn(
              "w-8 h-8 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors ml-auto",
              isSidebarCollapsed && "ml-0"
            )}
          >
            {isSidebarCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
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
        "w-full flex items-center rounded-lg transition-all duration-200 group relative my-0.5",
        isActive 
          ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50" 
          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900",
        isOver && "ring-2 ring-blue-500 bg-blue-50 z-10",
        collapsed ? "h-11 w-11 justify-center p-0 mx-auto" : "h-10 px-3 mx-2"
      )}
    >
      <item.icon 
        size={18} 
        style={iconStyle}
        className={cn(isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600 transition-colors")} 
      />
      {!collapsed && (
        <>
          <span className={cn("ml-3 text-sm font-medium", isActive && "font-semibold")}>{item.label}</span>
          {item.unread && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {item.unread}
            </span>
          )}
        </>
      )}
      {collapsed && item.unread && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
      )}
    </button>
  );
};

export default Sidebar;
