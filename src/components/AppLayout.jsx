import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useParams, useNavigate, Link } from 'react-router-dom';
import {
  Zap, Bell, Sun, Moon, User, LogOut,
  LayoutDashboard, Mail, Video, MessageSquare, CheckSquare,
  Shield, Settings, Grid, FileText, FileSpreadsheet, Presentation, Sliders, ChevronDown, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const APPS = [
  { icon: LayoutDashboard, label: 'Overview', path: 'dashboard', color: '#2563EB', desc: 'Control center' },
  { icon: Mail,            label: 'Mail',     path: 'mail',      color: '#7C3AED', desc: 'Secure email' },
  { icon: Video,           label: 'Meet',     path: 'meet',      color: '#059669', desc: 'Video huddles' },
  { icon: MessageSquare,   label: 'Kural',    path: 'chat',      color: '#00C17E', desc: 'Team chat' },
  { icon: Presentation,    label: 'Show',     path: 'show',      color: '#F59E0B', desc: 'Slide decks' },
  { icon: Settings,        label: 'Settings', path: 'settings',  color: '#6366F1', desc: 'Workspace preferences' },
  { icon: FileSpreadsheet, label: 'Sheets',   path: 'sheets',    color: '#10B981', desc: 'Data grids' },
  { icon: Shield,          label: 'Admin',    path: 'admin',     color: '#EF4444', desc: 'User management' },
];

/* ─── Premium App Switcher ─────────────────────────── */
const AppSwitcher = ({ workspaceId }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 px-4 py-2 rounded-2xl transition-all cursor-pointer ${open ? 'bg-emerald-50 text-emerald-600 shadow-inner' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600'}`}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${open ? 'bg-emerald-500 text-white rotate-90 shadow-lg' : 'bg-slate-100'}`}>
          <Grid size={18} strokeWidth={2.5} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden lg:block">Launchpad</span>
        <ChevronDown size={14} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-14 w-[380px] rounded-[2.5rem] border border-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.2)] z-[100] p-6 bg-white/95 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2">
                 <Sparkles size={16} className="text-emerald-500" />
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Applications</p>
              </div>
              <div className="flex gap-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {APPS.map(({ icon: Icon, label, path, color, desc }) => (
                <Link
                  key={path}
                  to={`/w/${workspaceId}/${path}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-4 p-4 rounded-3xl transition-all hover:bg-slate-50 group border border-transparent hover:border-slate-100"
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm"
                    style={{ background: `${color}10`, color }}
                  >
                    <Icon size={24} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{label}</div>
                    <div className="text-[10px] font-bold text-slate-400 truncate">{desc}</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50">
               <button className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500 transition-all">
                  Manage Subscriptions
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Standalone App Layout ─────────────────────────── */
const AppLayout = ({ children, appName, appIcon: AppIcon, appColor = '#00C17E' }) => {
  const { workspaceId } = useParams();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const profileName = auth.user || auth.name || 'Account';
  const profileEmail = auth.email || auth.mobile || (workspaceId === 'independent' ? 'Kural user' : 'Workspace member');
  const profileAvatar = auth.avatarUrl || auth.profilePicture;
  const profileInitial = profileName?.charAt(0)?.toUpperCase() || 'A';
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setAvatarOpen(false);
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-white font-inter text-slate-900 print:h-auto print:w-auto print:overflow-visible">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible">
        {/* SaaS Premium Topbar */}
        <header
          className="flex items-center justify-between px-10 border-b shrink-0 bg-white/80 backdrop-blur-xl z-[90] print:hidden"
          style={{ borderColor: 'rgba(241, 245, 249, 0.5)', height: '80px' }}
        >
          <div className="flex items-center gap-8">
            <Link to="/" className="group flex items-center gap-4">
               {appName === 'Kural' ? (
                 <>
                   <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center p-1.5 shadow-2xl shadow-emerald-500/20 group-hover:rotate-6 transition-all">
                      <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-xl" />
                   </div>
                   <div className="flex flex-col">
                      <span className="font-black text-xl tracking-tighter text-slate-900 leading-none">KURAL</span>
                      <span className="text-[9px] font-black tracking-[0.3em] text-emerald-500 opacity-80 mt-1 uppercase">Messenger</span>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center p-1.5 shadow-2xl shadow-slate-900/20 group-hover:scale-105 transition-all">
                      <Zap size={24} className="text-emerald-400" strokeWidth={3} />
                   </div>
                   <div className="flex flex-col">
                      <span className="font-black text-xl tracking-tighter text-slate-900 leading-none">FORGE</span>
                      <span className="text-[9px] font-black tracking-[0.3em] text-slate-400 mt-1 uppercase">Independent</span>
                   </div>
                 </>
               )}
            </Link>
            
            <div className="h-8 w-px bg-slate-100 hidden lg:block" />
            
            <div className="hidden lg:flex items-center gap-3 bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">{appName}</span>
               <span className="text-[10px] font-bold text-slate-300">/</span>
               <span className="text-[10px] font-black tracking-[0.2em] text-slate-900 uppercase">{workspaceId || 'Default'}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2">
               <button className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-50 text-slate-400 transition-all relative">
                  <Bell size={20} />
                  <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
               </button>
               <button onClick={toggleTheme} className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-slate-50 text-slate-400 transition-all">
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
               </button>
            </div>
            
            <div className="w-px h-8 bg-slate-100 hidden md:block" />
            
            <div ref={avatarRef} className="relative flex items-center gap-4 pl-2">
               <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[11px] font-black text-slate-900 leading-none uppercase">{profileName}</span>
                  <span className="text-[9px] font-bold text-slate-400 mt-1">{profileEmail}</span>
               </div>
               <button
                 type="button"
                 onClick={() => setAvatarOpen(!avatarOpen)}
                 className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 text-white flex items-center justify-center font-black shadow-xl shadow-slate-200 hover:scale-105 transition-all"
                 aria-label="Open account menu"
               >
                 {profileAvatar ? (
                   <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                   <span>{profileInitial}</span>
                 )}
               </button>
               <AnimatePresence>
                 {avatarOpen && (
                   <motion.div
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     className="absolute right-0 top-12 pt-3 w-64 z-[120]"
                   >
                     <div className="rounded-3xl border border-slate-100 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] p-3">
                       <div className="flex items-center gap-3 p-3 border-b border-slate-100">
                         <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-900 text-white flex items-center justify-center text-sm font-black shrink-0">
                           {profileAvatar ? (
                             <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                           ) : (
                             <span>{profileInitial}</span>
                           )}
                         </div>
                         <div className="min-w-0">
                           <p className="text-xs font-black text-slate-900 truncate">{profileName}</p>
                           <p className="text-[10px] font-bold text-slate-400 truncate">{profileEmail}</p>
                         </div>
                       </div>
                       <div className="p-1 pt-3 space-y-1">
                         <button
                           type="button"
                           onClick={() => { setAvatarOpen(false); navigate(`/w/${workspaceId}/settings`); }}
                           className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-colors"
                         >
                           <Settings size={16} /> Settings
                         </button>
                         <button
                           type="button"
                           onClick={handleLogout}
                           className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black text-rose-500 hover:bg-rose-50 transition-colors"
                         >
                           <LogOut size={16} /> Logout
                         </button>
                       </div>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </header>

        {/* App Content */}
        <main className="flex-1 overflow-auto relative pb-20 lg:pb-0 scrollbar-hide bg-[#FDFDFD] print:overflow-visible print:bg-white">
          {children}
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav 
        className="lg:hidden fixed bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-2xl rounded-[2.5rem] border border-white flex items-center justify-around px-4 z-[100] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] print:hidden"
      >
        <MobileNavItem icon={LayoutDashboard} path="dashboard" workspaceId={workspaceId} />
        <MobileNavItem icon={Mail} path="mail" workspaceId={workspaceId} />
        <div 
          onClick={() => navigate(`/w/${workspaceId}/chat`)}
          className="w-14 h-14 bg-emerald-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-200 -mt-10 border-4 border-white cursor-pointer"
        >
           <MessageSquare size={24} strokeWidth={2.5} />
        </div>
        <MobileNavItem icon={Video} path="meet" workspaceId={workspaceId} />
        <MobileNavItem icon={Settings} path="settings" workspaceId={workspaceId} />
      </nav>
    </div>
  );
};

const MobileNavItem = ({ icon: Icon, path, workspaceId }) => (
  <NavLink
    to={`/w/${workspaceId}/${path}`}
    className={({ isActive }) => `
      flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all
      ${isActive ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-300 hover:text-slate-900'}
    `}
    style={{ textDecoration: 'none' }}
  >
    <Icon size={22} strokeWidth={2.5} />
  </NavLink>
);

export default AppLayout;
