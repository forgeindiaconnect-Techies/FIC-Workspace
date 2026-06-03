import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
  Bell, Check, Globe, Lock, Mail, Monitor, Palette, Save, Shield, User
} from 'lucide-react';

const WorkspaceSettings = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const [settings, setSettings] = useState({
    desktopAlerts: true,
    emailSummary: true,
    compactMode: false,
    privatePresence: false,
  });

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AppLayout appName="Settings" appIcon={Shield} appColor="#6366F1">
      <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-8">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] lg:text-sm font-bold text-indigo-500 uppercase tracking-widest mb-2">Workspace Preferences</p>
            <h1 className="text-2xl lg:text-4xl font-black tracking-tight leading-tight">General Settings</h1>
            <p className="mt-3 text-sm font-medium text-slate-400 max-w-2xl">
              Manage account, workspace, display, and notification preferences for the home dashboard.
            </p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-colors">
            <Save size={16} /> Save Changes
          </button>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="space-y-3">
            {[
              { icon: User, label: 'Profile', active: true },
              { icon: Bell, label: 'Notifications' },
              { icon: Palette, label: 'Appearance' },
              { icon: Lock, label: 'Security' },
            ].map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-colors ${
                  item.active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </aside>

          <main className="space-y-6">
            <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-3xl overflow-hidden bg-slate-900 text-white flex items-center justify-center text-2xl font-black shrink-0">
                  {auth.avatarUrl || auth.profilePicture ? (
                    <img src={auth.avatarUrl || auth.profilePicture} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(auth.user || auth.name || 'A').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-900 truncate">{auth.user || auth.name || 'Workspace User'}</h2>
                  <p className="text-sm font-bold text-slate-400 truncate">{auth.email || auth.mobile || 'Signed in account'}</p>
                  <div className="flex items-center gap-2 mt-3 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    <Check size={14} /> Session active
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">General</h3>
              <SettingRow icon={Globe} title="Workspace Region" description="Default regional context for home dashboard tools." value="India" />
              <SettingRow icon={Mail} title="Email Summary" description="Send a daily digest for workspace activity." enabled={settings.emailSummary} onToggle={() => toggleSetting('emailSummary')} />
              <SettingRow icon={Bell} title="Desktop Alerts" description="Show browser notifications for important updates." enabled={settings.desktopAlerts} onToggle={() => toggleSetting('desktopAlerts')} />
              <SettingRow icon={Monitor} title="Compact Dashboard" description="Use tighter spacing on dashboard widgets." enabled={settings.compactMode} onToggle={() => toggleSetting('compactMode')} />
              <SettingRow icon={Shield} title="Private Presence" description="Hide your active status outside chat and meetings." enabled={settings.privatePresence} onToggle={() => toggleSetting('privatePresence')} />
            </section>
          </main>
        </section>
      </div>
    </AppLayout>
  );
};

const SettingRow = ({ icon: Icon, title, description, enabled, onToggle, value }) => (
  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
    <div className="flex items-center gap-4 min-w-0">
      <div className="w-11 h-11 rounded-2xl bg-white text-indigo-500 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        <p className="text-xs font-medium text-slate-400 truncate">{description}</p>
      </div>
    </div>
    {value ? (
      <span className="text-xs font-black text-slate-500">{value}</span>
    ) : (
      <button
        type="button"
        onClick={onToggle}
        className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
        aria-pressed={enabled}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
      </button>
    )}
  </div>
);

export default WorkspaceSettings;
