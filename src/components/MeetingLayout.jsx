import React, { useState } from 'react';
import { NavLink, useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Home, Video, Presentation, Calendar, 
  File, BarChart2, Users, Settings, 
  Search, Bell, Download, ChevronDown, Grid,
  Mail, MessageSquare, CheckSquare, FileText,
  X, ExternalLink, ArrowUpRight, LogOut
} from 'lucide-react';
import LogoImage from '../assets/landing-logo.png';

const MeetingLayout = ({ children }) => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { icon: Home, label: 'Home', path: 'meet' },
    { icon: Video, label: 'Meetings', path: 'meetings' },
    { icon: File, label: 'Files', path: 'files' },
    { icon: BarChart2, label: 'Analytics', path: 'analytics' },
  ];

  const apps = [
    { name: 'Mail', icon: Mail, color: 'text-red-500', path: 'mail' },
    { name: 'Chat', icon: MessageSquare, color: 'text-blue-500', path: 'chat' },
    { name: 'Tasks', icon: CheckSquare, color: 'text-amber-500', path: 'tasks' },
    { name: 'Docs', icon: FileText, color: 'text-emerald-500', path: 'docs' },
    { name: 'Meetings', icon: Video, color: 'text-blue-600', path: 'meetings' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/5 flex items-center px-6 shrink-0 z-[60]">
        <div className="flex items-center gap-3">
          <img src={LogoImage} alt="Forge India" className="h-8 w-auto object-contain" />
          <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">Forge India</span>
        </div>

        <div className="mx-auto flex items-center gap-2">
           {/* Trial info removed */}
        </div>

        <div className="flex items-center gap-4">
           {/* My Department dropdown removed */}
           
           <div className="flex items-center gap-1">
              <NavIcon icon={Download} />
              <NavIcon icon={Bell} />
           </div>

           <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1" />

           <div className="flex items-center gap-3 pl-2">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black">S</div>
              <button 
                onClick={() => setIsSwitcherOpen(true)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all text-zinc-500"
              >
                <Grid size={20} />
              </button>
           </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
        {/* Compact Vertical Sidebar - Hidden on Mobile */}
        <aside className="hidden md:flex w-[80px] h-full bg-[#111827] flex-col items-center py-6 border-r border-white/5 z-50 shrink-0">
          <div className="w-full flex flex-col items-center gap-2">
            {navItems.map((item) => (
              <SidebarLink 
                key={item.path} 
                {...item} 
                workspaceId={workspaceId} 
              />
            ))}
            <SidebarLink 
              icon={Settings} 
              label="Settings" 
              path="meet/settings"
              workspaceId={workspaceId} 
            />
          </div>

          <div className="mt-auto w-full flex flex-col items-center pb-2">
             <button 
               onClick={handleLogout}
               className="w-full py-4 flex flex-col items-center justify-center gap-1.5 transition-all relative group text-rose-400 hover:text-rose-500 hover:bg-rose-500/5"
             >
                <LogOut size={22} strokeWidth={2} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Logout</span>
             </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#111827] border-t border-white/5 flex items-center justify-around px-4 z-[100]">
           {navItems.map((item) => (
             <NavLink
               key={item.path}
               to={`/w/${workspaceId}/${item.path}`}
               className={({ isActive }) => `
                 flex flex-col items-center justify-center gap-1 transition-all
                 ${isActive ? 'text-blue-500' : 'text-zinc-500'}
               `}
             >
                <item.icon size={20} />
                <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
             </NavLink>
           ))}
           <NavLink
             to={`/w/${workspaceId}/meet/settings`}
             className={({ isActive }) => `
               flex flex-col items-center justify-center gap-1 transition-all
               ${isActive ? 'text-blue-500' : 'text-zinc-500'}
             `}
           >
              <Settings size={20} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Settings</span>
           </NavLink>
        </nav>
      </div>

      {/* App Switcher Drawer (Right Side) */}
      {isSwitcherOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
           <div 
             className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade" 
             onClick={() => setIsSwitcherOpen(false)}
           />
           <div className="w-[400px] h-full bg-white dark:bg-zinc-950 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] relative animate-in slide-in-from-right duration-500 flex flex-col">
              <div className="p-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                 <h2 className="text-xl font-black tracking-tight">Applications</h2>
                 <button onClick={() => setIsSwitcherOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-all">
                    <X size={20} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                 {/* Search bar */}
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search Applications" 
                      className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-6 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                    />
                 </div>

                 {/* Promo Card */}
                 <div className="bg-rose-50 dark:bg-rose-500/5 rounded-[32px] p-6 border border-rose-100 dark:border-rose-500/10 relative overflow-hidden group">
                    <div className="relative z-10 space-y-3">
                       <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Admin reports</p>
                       <h3 className="text-lg font-black leading-tight">A complete overview of dashboard and reporting features</h3>
                       <button className="text-xs font-black text-rose-600 hover:underline flex items-center gap-1 uppercase tracking-widest">Learn more <ArrowUpRight size={14}/></button>
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform">
                       <BarChart2 size={80} />
                    </div>
                 </div>

                 {/* App Groups */}
                 <div className="space-y-10">
                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Related Apps</h4>
                       <div className="grid grid-cols-3 gap-6">
                          <Link to={`/w/${workspaceId}/meet`} className="flex flex-col items-center gap-3 group">
                             <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                <img src={LogoImage} alt="Assist" className="w-8 h-8 object-contain" />
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-widest">Assist</span>
                          </Link>
                       </div>
                    </section>

                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">All WorkSphere Apps</h4>
                       <h5 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-white/5 pb-2">Sales & Marketing</h5>
                       <div className="grid grid-cols-2 gap-4">
                          {apps.map(app => (
                            <Link key={app.name} to={`/w/${workspaceId}/${app.path}`} className="flex items-center gap-4 p-3 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl transition-all">
                               <div className={`w-8 h-8 ${app.color} flex items-center justify-center`}>
                                  <app.icon size={20} />
                               </div>
                               <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{app.name}</span>
                            </Link>
                          ))}
                       </div>
                    </section>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const SidebarLink = ({ icon: Icon, label, path, workspaceId }) => (
  <NavLink
    to={`/w/${workspaceId}/${path}`}
    className={({ isActive }) => `
      w-full py-3 flex flex-col items-center justify-center gap-1.5 transition-all relative group
      ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
    `}
    style={{ textDecoration: 'none' }}
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full" />
        )}
        
        <div className={`
          w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300
          ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'group-hover:bg-white/5'}
        `}>
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        
        <span className={`
          text-[9px] font-black tracking-wider uppercase transition-all
          ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}
        `}>
          {label}
        </span>
      </>
    )}
  </NavLink>
);

const NavIcon = ({ icon: Icon }) => (
  <button className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all">
    <Icon size={18} />
  </button>
);

export default MeetingLayout;
