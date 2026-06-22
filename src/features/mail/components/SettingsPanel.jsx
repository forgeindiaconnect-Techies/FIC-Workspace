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
  const [activeTab, setActiveTab] = useState('General');

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
    { id: 'general', icon: Settings, label: 'General' },
    { id: 'inbox', icon: Mail, label: 'Inbox' },
    { id: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'security', icon: Shield, label: 'Security' },
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
          transition={{ type: 'tween', duration: 0.2 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col pointer-events-auto"
        >
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-slate-50 shrink-0">
             <div className="flex items-center gap-2">
               <Settings size={18} className="text-slate-600" />
               <h2 className="text-sm font-semibold text-slate-800">Settings</h2>
             </div>
             <button onClick={() => setSettingsOpen(false)} className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition-colors">
               <X size={16} />
             </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-16 border-r border-slate-200 bg-slate-50 flex flex-col items-center py-4 gap-2">
               {sections.map((s) => (
                 <button 
                  key={s.id}
                  onClick={() => setActiveTab(s.label)}
                  className={cn(
                    "p-2.5 rounded transition-colors",
                    activeTab === s.label ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  )}
                  title={s.label}
                 >
                   <s.icon size={18} />
                 </button>
               ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
               {activeTab === 'General' && (
                 <>
                   <div className="space-y-4">
                     <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Profile Configuration</h3>
                     <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded shadow-sm">
                        <img src={avatarPreview} className="w-14 h-14 rounded-full border border-slate-200 object-cover" alt={userName} />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{userName}</p>
                          <p className="text-xs text-slate-500 mb-2">{userEmail}</p>
                          <button onClick={handleAvatarChange} className="text-xs font-medium text-blue-600 hover:underline">Change Avatar</button>
                        </div>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">General Preferences</h3>
                     <div className="space-y-2">
                        <ToggleItem label="Smart Compose (AI)" active={prefs.smartCompose} onClick={() => togglePref('smartCompose')} />
                        <ToggleItem label="Offline Access" active={prefs.offlineAccess} onClick={() => togglePref('offlineAccess')} />
                     </div>
                   </div>
                 </>
               )}

               {activeTab === 'Inbox' && (
                 <div className="space-y-4">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inbox Settings</h3>
                   <div className="space-y-2">
                      <ToggleItem label="Priority Inbox" active={prefs.priorityInbox} onClick={() => togglePref('priorityInbox')} />
                      <ToggleItem label="Group Emails by Conversation" active={true} onClick={() => {}} />
                      <ToggleItem label="Show Email Snippets" active={true} onClick={() => {}} />
                   </div>
                 </div>
               )}

               {activeTab === 'Shortcuts' && (
                 <div className="space-y-4">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace Shortcuts</h3>
                   <div className="space-y-1">
                      <ShortcutItem keyCombo="/" action="Open Search" />
                      <ShortcutItem keyCombo="C" action="Compose New Mail" />
                      <ShortcutItem keyCombo="E" action="Archive Selected" />
                      <ShortcutItem keyCombo="S" action="Star Conversation" />
                      <ShortcutItem keyCombo="Meta+K" action="Command Palette" />
                   </div>
                 </div>
               )}

               {activeTab === 'Notifications' && (
                 <div className="space-y-4">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notification Settings</h3>
                   <div className="space-y-2">
                      <ToggleItem label="Desktop Notifications" active={prefs.desktopNotifications} onClick={() => togglePref('desktopNotifications')} />
                      <ToggleItem label="Email Summaries (Weekly)" active={false} onClick={() => {}} />
                      <ToggleItem label="Sound on New Mail" active={true} onClick={() => {}} />
                   </div>
                 </div>
               )}

               {activeTab === 'Security' && (
                 <div className="space-y-4">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Security & Privacy</h3>
                   <div className="space-y-2">
                      <ToggleItem label="Two-Factor Authentication" active={true} onClick={() => {}} />
                      <ToggleItem label="Warn on External Senders" active={true} onClick={() => {}} />
                      <ToggleItem label="Block Tracking Pixels" active={true} onClick={() => {}} />
                   </div>
                 </div>
               )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ToggleItem = ({ label, active, onClick }) => (
  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded shadow-sm cursor-pointer" onClick={onClick}>
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <button className={cn(
      "w-9 h-5 rounded-full relative transition-colors",
      active ? "bg-blue-600" : "bg-slate-300"
    )}>
      <div className={cn(
        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow",
        active ? "right-1" : "left-1"
      )} />
    </button>
  </div>
);

const ShortcutItem = ({ keyCombo, action }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
    <span className="text-sm text-slate-600">{action}</span>
    <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono font-medium text-slate-700">
      {keyCombo}
    </span>
  </div>
);

export default SettingsPanel;
