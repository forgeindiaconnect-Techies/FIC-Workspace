import React, { useState } from 'react';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Settings, User, Video, Mic, 
  Bell, Shield, Globe, Monitor,
  Check, ChevronRight, Save, Camera,
  Volume2, Sliders, Lock
} from 'lucide-react';

const SettingsTab = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const profileAvatar = auth.avatarUrl || auth.profilePicture;
  const profileName = auth.user || auth.name || 'User';
  const profileInitial = profileName.charAt(0).toUpperCase();

  const [activeTab, setActiveTab] = useState('Meeting');
  const [settings, setSettings] = useState({
    autoRecord: false,
    muteOnEntry: true,
    cameraOnEntry: false,
    showParticipantName: true,
    entryExitTone: true,
    allowChat: true,
    hdVideo: true
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tabs = [
    { id: 'General', icon: Globe, label: 'General' },
    { id: 'Meeting', icon: Video, label: 'Meeting' },
    { id: 'Audio/Video', icon: Mic, label: 'Audio & Video' },
  ];

  return (
    <MeetingLayout>
      <div className="h-full bg-[#f8fafc] dark:bg-zinc-950 flex flex-col font-sans overflow-hidden">
        {/* Header */}
        <div className="h-16 px-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-zinc-900 shrink-0">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-zinc-500">
                 <Settings size={22} />
              </div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Settings</h1>
           </div>
           <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-blue-500/20">
              <Save size={16} /> Save Changes
           </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* Sidebar Navigation */}
           <aside className="w-72 border-r border-zinc-100 dark:border-white/5 bg-white dark:bg-zinc-900/50 p-6 shrink-0 flex flex-col">
              <div className="space-y-1">
                 {tabs.map(tab => (
                   <button 
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id)}
                     className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all
                        ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5'}
                     `}
                   >
                      <div className="flex items-center gap-3">
                         <tab.icon size={18} />
                         {tab.label}
                      </div>
                      <ChevronRight size={14} className={activeTab === tab.id ? 'opacity-100' : 'opacity-0'} />
                   </button>
                 ))}
              </div>

              <div className="mt-auto pt-10 border-t border-zinc-100 dark:border-white/5">
                 <div className="bg-zinc-50 dark:bg-white/5 rounded-[24px] p-5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Subscription</p>
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-black">Free Plan</span>
                       <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Upgrade</button>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full w-1/3 bg-blue-500 rounded-full" />
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 leading-relaxed">You are using 30% of your meeting minutes this month.</p>
                 </div>
              </div>
           </aside>

           {/* Main Content */}
           <main className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="max-w-3xl">
                 <header className="mb-10">
                    <h2 className="text-2xl font-black mb-2">{activeTab} Settings</h2>
                    <p className="text-zinc-400 text-sm">Configure how your meetings behave and manage participant permissions.</p>
                 </header>

                 {activeTab === 'General' && (
                    <div className="space-y-10 animate-fade">
                       <section className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Profile Information</h3>
                          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-zinc-100 dark:border-white/5 shadow-sm flex items-center gap-8">
                             <div className="relative group cursor-pointer">
                                <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl font-black text-zinc-400 overflow-hidden border-4 border-white dark:border-zinc-800 shadow-xl">
                                   {profileAvatar ? (
                                     <img src={profileAvatar} alt={profileName} className="w-full h-full object-cover" />
                                   ) : (
                                     profileInitial
                                   )}
                                </div>
                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                   <Camera size={24} />
                                </div>
                             </div>
                             <div className="space-y-2">
                                <h4 className="text-sm font-black">Profile Picture</h4>
                                <p className="text-xs text-zinc-400 max-w-xs">Upload a professional photo to help participants identify you in meetings.</p>
                                <div className="flex items-center gap-3 mt-2">
                                   <button className="px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Upload New</button>
                                   <button className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all">Remove</button>
                                </div>
                             </div>
                          </div>
                       </section>

                       <section className="space-y-6 pt-10 border-t border-zinc-100 dark:border-white/5">
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Security & Password</h3>
                          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-zinc-100 dark:border-white/5 shadow-sm space-y-6">
                             <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Current Password</label>
                                   <div className="relative">
                                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                      <input 
                                        type="password" 
                                        placeholder="••••••••"
                                        className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-blue-500 transition-all font-bold text-sm"
                                      />
                                   </div>
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">New Password</label>
                                   <input 
                                     type="password" 
                                     placeholder="Minimum 8 characters"
                                     className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all font-bold text-sm"
                                   />
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">Confirm New Password</label>
                                   <input 
                                     type="password" 
                                     placeholder="Repeat new password"
                                     className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all font-bold text-sm"
                                   />
                                </div>
                             </div>
                             <div className="pt-4">
                                <button className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95">
                                   Update Password
                                </button>
                             </div>
                          </div>
                       </section>
                    </div>
                 )}

                 {activeTab === 'Meeting' && (
                    <div className="space-y-8">
                       <section className="space-y-4">
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6">General Meeting Behavior</h3>
                          
                          <SettingToggle 
                            icon={Save} 
                            title="Auto-record meetings" 
                            description="Automatically start recording as soon as the first participant joins."
                            enabled={settings.autoRecord}
                            onToggle={() => toggleSetting('autoRecord')}
                          />

                          <SettingToggle 
                            icon={Mic} 
                            title="Mute participants on entry" 
                            description="Keep participants muted by default when they join the meeting."
                            enabled={settings.muteOnEntry}
                            onToggle={() => toggleSetting('muteOnEntry')}
                          />

                          <SettingToggle 
                            icon={Camera} 
                            title="Camera off on entry" 
                            description="Cameras will be disabled by default for all participants joining."
                            enabled={settings.cameraOnEntry}
                            onToggle={() => toggleSetting('cameraOnEntry')}
                          />
                       </section>

                       <section className="space-y-4 pt-8 border-t border-zinc-100 dark:border-white/5">
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6">In-Meeting Experience</h3>
                          
                          <SettingToggle 
                            icon={User} 
                            title="Show participant names" 
                            description="Display names on participant video feeds during the session."
                            enabled={settings.showParticipantName}
                            onToggle={() => toggleSetting('showParticipantName')}
                          />

                          <SettingToggle 
                            icon={Bell} 
                            title="Entry/Exit notifications" 
                            description="Play a sound when participants join or leave the meeting."
                            enabled={settings.entryExitTone}
                            onToggle={() => toggleSetting('entryExitTone')}
                          />

                          <SettingToggle 
                            icon={Lock} 
                            title="Lock meeting" 
                            description="Prevent new participants from joining once the meeting has started."
                            enabled={false}
                            onToggle={() => {}}
                          />
                       </section>
                    </div>
                 )}

                 {activeTab === 'Audio/Video' && (
                    <div className="space-y-10">
                       <section className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Video Settings</h3>
                          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-zinc-100 dark:border-white/5 shadow-sm">
                             <div className="aspect-video bg-zinc-100 dark:bg-black rounded-[24px] mb-6 flex items-center justify-center overflow-hidden relative group">
                                <Video size={48} className="text-zinc-300 dark:text-zinc-800" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <button className="px-4 py-2 bg-white text-zinc-900 rounded-full font-bold text-xs uppercase tracking-widest">Test Camera</button>
                                </div>
                             </div>
                             <div className="space-y-4">
                                <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Camera Device</label>
                                <select className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all font-bold text-sm appearance-none">
                                   <option>Integrated Webcam (1920x1080)</option>
                                   <option>OBS Virtual Camera</option>
                                </select>
                             </div>
                          </div>
                       </section>

                       <section className="space-y-6">
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Audio Settings</h3>
                          <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 border border-zinc-100 dark:border-white/5 shadow-sm space-y-8">
                             <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                   <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Microphone Input</label>
                                   <span className="text-[10px] font-black text-emerald-500 uppercase">Live</span>
                                </div>
                                <select className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all font-bold text-sm appearance-none">
                                   <option>Built-in Microphone</option>
                                   <option>External USB Mic</option>
                                </select>
                                <div className="h-2 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                                   {Array.from({ length: 40 }).map((_, i) => (
                                     <div key={i} className={`flex-1 h-full rounded-sm ${i < 15 ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-white/10'}`} />
                                   ))}
                                </div>
                             </div>

                             <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                   <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Speaker Output</label>
                                   <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Test Sound</button>
                                </div>
                                <div className="flex items-center gap-4">
                                   <Volume2 size={20} className="text-zinc-400" />
                                   <input type="range" className="flex-1 accent-blue-600" />
                                </div>
                             </div>
                          </div>
                       </section>
                    </div>
                 )}
              </div>
           </main>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
      `}} />
    </MeetingLayout>
  );
};

const SettingToggle = ({ icon: Icon, title, description, enabled, onToggle }) => (
  <div className="flex items-start justify-between p-6 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
     <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-zinc-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 transition-all">
           <Icon size={24} />
        </div>
        <div className="space-y-1">
           <h4 className="text-sm font-black text-zinc-800 dark:text-white">{title}</h4>
           <p className="text-xs text-zinc-400 max-w-md leading-relaxed">{description}</p>
        </div>
     </div>
     <button 
       onClick={onToggle}
       className={`w-14 h-8 rounded-full relative transition-all duration-300 ${enabled ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
     >
        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${enabled ? 'left-7' : 'left-1'}`} />
     </button>
  </div>
);

export default SettingsTab;
