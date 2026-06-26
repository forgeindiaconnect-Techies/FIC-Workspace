import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
  Bell, Check, Globe, Lock, MessageSquare, User,
  ArrowLeft, Camera, Circle, Shield, Trash2, Moon, Smartphone, Upload
} from 'lucide-react';

const ChatSettings = () => {
  const navigate = useNavigate();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const workspaceId = auth.workspaceId || 'independent';
  const profileName = auth.user || auth.name || 'Account';
  const profileEmail = auth.email || auth.mobile || 'Kural user';
  const profileUsername = auth.username || profileName.toLowerCase().replace(/\s+/, '_');
  const profileAvatar = auth.profilePicture || auth.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileName}`;
  const profileInitial = profileName.charAt(0).toUpperCase();

  const [settings, setSettings] = useState({
    activeStatus: true,
    readReceipts: true,
    lastSeen: true,
    messageAlerts: true,
    groupNotifications: true,
    cloudBackup: false,
    darkMode: false,
  });

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    try {
      const { unregisterWebPush } = await import('../utils/webPushHelper');
      await unregisterWebPush();
    } catch (e) {
      console.warn('[ChatSettings] Push unregistration failed:', e);
    }
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    navigate('/');
  };

  return (
    <AppLayout appName="Kural" appIcon={MessageSquare} appColor="#00A884">
      <div className="flex h-full w-full bg-[#f0f2f5] overflow-hidden font-sans">
        {/* Dark sidebar */}
        <div className="w-[64px] shrink-0 flex flex-col items-center py-6 bg-[#111b21] z-50">
          <div className="w-12 h-12 bg-[#00A884] rounded-2xl flex items-center justify-center p-1.5 shadow-2xl mb-8">
            <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-xl" />
          </div>
          <div className="flex-1 space-y-6">
            <button
              onClick={() => navigate(`/w/${workspaceId}/chat`)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <MessageSquare size={20} />
            </button>
            <button className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white shadow-sm transition-all">
              <User size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Main settings content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-[64px] px-6 bg-[#f0f2f5] border-b border-[#E9EDEF] flex items-center gap-4 z-30">
            <button
              onClick={() => navigate(`/w/${workspaceId}/chat`)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#54656f] hover:bg-black/5 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="font-bold text-[#111b21] text-lg">Settings</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-8">
              {/* Profile Section */}
              <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center text-lg font-black shrink-0 border-2 border-white shadow-lg">
                      <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#00A884] rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
                      <Camera size={12} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-900 truncate">{profileName}</h2>
                    <p className="text-sm font-bold text-slate-400 truncate">{profileEmail}</p>
                    <p className="text-xs font-bold text-emerald-500 mt-1">@{profileUsername}</p>
                  </div>
                </div>
              </section>

              {/* Notifications */}
              <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Bell size={16} className="text-emerald-500" /> Notifications
                </h3>
                <SettingRow icon={Bell} title="Message Alerts" description="Play sound for incoming messages." enabled={settings.messageAlerts} onToggle={() => toggleSetting('messageAlerts')} />
                <SettingRow icon={Globe} title="Group Notifications" description="Notify on group activity." enabled={settings.groupNotifications} onToggle={() => toggleSetting('groupNotifications')} />
                <SettingRow icon={Smartphone} title="Push to Mobile" description="Receive push notifications on your phone." enabled={true} />
              </section>

              {/* Privacy */}
              <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Shield size={16} className="text-emerald-500" /> Privacy
                </h3>
                <SettingRow icon={Circle} title="Active Status" description="Show when you are online." enabled={settings.activeStatus} onToggle={() => toggleSetting('activeStatus')} />
                <SettingRow icon={Check} title="Read Receipts" description="Let others know you have read their messages." enabled={settings.readReceipts} onToggle={() => toggleSetting('readReceipts')} />
                <SettingRow icon={Lock} title="Last Seen" description="Show your last active timestamp." enabled={settings.lastSeen} onToggle={() => toggleSetting('lastSeen')} />
              </section>

              {/* Data & Storage */}
              <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Upload size={16} className="text-emerald-500" /> Data & Storage
                </h3>
                <SettingRow icon={Globe} title="Cloud Backup" description="Auto-sync your messages and media to the cloud." enabled={settings.cloudBackup} onToggle={() => toggleSetting('cloudBackup')} />
                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white text-indigo-500 flex items-center justify-center shrink-0">
                      <Trash2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900">Clear Cache</h4>
                      <p className="text-xs font-medium text-slate-400">Free up temporary storage space.</p>
                    </div>
                  </div>
                  <button className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-rose-500 transition-colors shrink-0 px-3 py-2 rounded-xl hover:bg-rose-50">
                    Clear
                  </button>
                </div>
              </section>

              {/* Account */}
              <section className="bg-white border border-slate-100 rounded-[2rem] p-6 lg:p-8 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <User size={16} className="text-emerald-500" /> Account
                </h3>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 ml-2 mb-3">Signed in as {profileEmail}</p>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-black text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 size={18} /> Log Out Account
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const SettingRow = ({ icon: Icon, title, description, enabled, onToggle, value }) => (
  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
    <div className="flex items-center gap-4 min-w-0">
      <div className="w-11 h-11 rounded-2xl bg-white text-emerald-500 flex items-center justify-center shrink-0">
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
        className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${enabled ? 'bg-[#00A884]' : 'bg-slate-200'}`}
        aria-pressed={enabled}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
      </button>
    )}
  </div>
);

export default ChatSettings;
