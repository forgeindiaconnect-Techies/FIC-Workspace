import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, User, Bell, Palette, Keyboard, Shield, Mail } from 'lucide-react';
import { useMailStore } from '../store';
import { useTheme } from '../../../context/ThemeContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const SettingsPanel = () => {
  const { isSettingsOpen, setSettingsOpen } = useMailStore();
  const { isDark, setIsDark } = useTheme();

  const [prefs, setPrefs] = useState(() => {
    return JSON.parse(localStorage.getItem('mailPrefs') || '{"desktopNotifications":true,"smartCompose":true,"priorityInbox":true,"offlineAccess":false}');
  });

  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const userName = auth.user || auth.name || 'Admin Account';
  const userEmail = auth.email || 'admin@forgeindia.com';
  const [avatarPreview, setAvatarPreview] = useState(auth.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`);

  if (!isSettingsOpen) return null;

  const togglePref = (key) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    localStorage.setItem('mailPrefs', JSON.stringify(newPrefs));
  };

  const handleAvatarChange = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAvatarPreview(event.target.result);
          const updatedAuth = { ...auth, avatarUrl: event.target.result };
          localStorage.setItem('auth', JSON.stringify(updatedAuth));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const sections = [
    { icon: Settings, label: 'General', active: true },
    { icon: Mail, label: 'Inbox' },
    { icon: Palette, label: 'Theme' },
    { icon: Keyboard, label: 'Shortcuts' },
    { icon: Bell, label: 'Notifications' },
    { icon: Shield, label: 'Security' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSettingsOpen(false)}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
        />
        <motion.div
          initial={{ x: 480 }}
          animate={{ x: 0 }}
          exit={{ x: 480 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-[var(--surface-0)] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] flex flex-col pointer-events-auto"
        >
          <div className="h-16 flex items-center justify-between px-8 border-b border-[var(--border)] shrink-0">
             <div className="flex items-center gap-3">
               <Settings size={20} className="text-[var(--brand-primary)]" />
               <h2 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Settings</h2>
             </div>
             <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-[var(--surface-2)] rounded-lg text-[var(--text-secondary)]">
               <X size={20} />
             </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-16 border-r border-[var(--border)] bg-[var(--surface-1)] flex flex-col items-center py-6 gap-4">
               {sections.map((s, idx) => (
                 <button 
                  key={idx}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    s.active ? "bg-[var(--brand-primary)] text-white shadow-lg" : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  )}
                  title={s.label}
                 >
                   <s.icon size={20} />
                 </button>
               ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
               <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">Profile Configuration</h3>
                 <div className="flex items-center gap-6 p-6 bg-[var(--surface-1)] border border-[var(--border)] rounded-[24px]">
                    <img src={avatarPreview} className="w-16 h-16 rounded-full border-2 border-white shadow-xl object-cover" alt={userName} />
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)]">{userName}</p>
                      <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">{userEmail}</p>
                      <button onClick={handleAvatarChange} className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-primary)] hover:underline">Change Avatar</button>
                    </div>
                 </div>
               </div>


               <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">General Preferences</h3>
                 <div className="space-y-4">
                    <ToggleItem label="Desktop Notifications" active={prefs.desktopNotifications} onClick={() => togglePref('desktopNotifications')} />
                    <ToggleItem label="Smart Compose (AI)" active={prefs.smartCompose} onClick={() => togglePref('smartCompose')} />
                    <ToggleItem label="Priority Inbox" active={prefs.priorityInbox} onClick={() => togglePref('priorityInbox')} />
                    <ToggleItem label="Offline Access" active={prefs.offlineAccess} onClick={() => togglePref('offlineAccess')} />
                 </div>
               </div>

               <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)]">Workspace Shortcuts</h3>
                 <div className="space-y-2">
                    <ShortcutItem keyCombo="/" action="Open Search" />
                    <ShortcutItem keyCombo="C" action="Compose New Mail" />
                    <ShortcutItem keyCombo="E" action="Archive Selected" />
                    <ShortcutItem keyCombo="S" action="Star Conversation" />
                 </div>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ThemeCard = ({ label, active, onClick }) => (
  <button onClick={onClick} className={cn(
    "p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 text-left",
    active ? "bg-[var(--brand-light)] border-[var(--brand-primary)]" : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--text-secondary)]"
  )}>
    <div className={cn("w-full aspect-video rounded-lg", active ? "bg-white" : "bg-zinc-800")} />
    <span className={cn("text-[10px] font-black uppercase tracking-widest", active ? "text-[var(--brand-primary)]" : "text-[var(--text-secondary)]")}>{label}</span>
  </button>
);

const ToggleItem = ({ label, active, onClick }) => (
  <div className="flex items-center justify-between p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl cursor-pointer" onClick={onClick}>
    <span className="text-xs font-bold text-[var(--text-primary)]">{label}</span>
    <button className={cn(
      "w-10 h-5 rounded-full relative transition-all",
      active ? "bg-[var(--brand-primary)]" : "bg-zinc-300"
    )}>
      <div className={cn(
        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
        active ? "right-1" : "left-1"
      )} />
    </button>
  </div>
);

const ShortcutItem = ({ keyCombo, action }) => (
  <div className="flex items-center justify-between py-2 border-b border-[var(--border)] border-dashed">
    <span className="text-[11px] font-bold text-[var(--text-secondary)]">{action}</span>
    <span className="px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded text-[10px] font-mono font-black text-[var(--text-primary)]">
      {keyCombo}
    </span>
  </div>
);

export default SettingsPanel;
