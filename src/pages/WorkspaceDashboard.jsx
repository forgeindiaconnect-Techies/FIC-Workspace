import React from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { 
  Video, MessageSquare, Users, FileText, 
  Calendar, Clock, Zap, ArrowUpRight, Plus,
  Shield, CheckCircle2, TrendingUp, MoreHorizontal
} from 'lucide-react';

const WorkspaceDashboard = () => {
  const { workspaceId } = useParams();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');

  return (
    <AppLayout appName="Dashboard" appIcon={Zap} appColor="#2563EB">
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Welcome Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] lg:text-sm font-bold text-blue-500 uppercase tracking-widest mb-2">Good Morning, {auth.user || 'Admin'}</p>
            <h1 className="text-2xl lg:text-4xl font-black tracking-tight leading-tight">Your Workspace Command Center.</h1>
          </div>
          <div className="flex gap-3">
             <Link to={`/w/${workspaceId}/meet`} className="btn btn-primary flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl shadow-xl shadow-blue-500/20">
                <Plus size={20} />
                <span>New Meeting</span>
             </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
           <StatCard icon={Video} label="Upcoming" value="3" subValue="Today" color="#059669" />
           <StatCard icon={MessageSquare} label="Messages" value="12" subValue="Unread" color="#D97706" />
           <StatCard icon={Users} label="Active" value="8" subValue="Online" color="#7C3AED" />
           <StatCard icon={FileText} label="Storage" value="84%" subValue="4.2 GB" color="#64748B" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Main Activity Feed */}
           <div className="lg:col-span-2 space-y-6">
              <section className="bg-[var(--surface)] border rounded-[32px] p-8 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black">Recent Activity</h2>
                    <button className="p-2 hover:bg-[var(--surface-2)] rounded-full transition-colors"><MoreHorizontal size={20} /></button>
                 </div>
                 <div className="space-y-6">
                    <ActivityItem 
                      icon={Video} 
                      title="Q2 Strategy Meeting" 
                      time="2 hours ago" 
                      description="Meeting recording and transcript are now available."
                      badge="Meeting"
                    />
                    <ActivityItem 
                      icon={MessageSquare} 
                      title="General Channel" 
                      time="45 mins ago" 
                      description="Sarah uploaded 'Project_Final_v2.pdf' to the workspace."
                      badge="Chat"
                    />
                    <ActivityItem 
                      icon={Plus} 
                      title="New Member Joined" 
                      time="Yesterday" 
                      description="David Chen was added to the engineering team."
                      badge="Team"
                    />
                 </div>
              </section>
           </div>

           {/* Sidebar Widgets */}
           <div className="space-y-8">
              {/* Quick Join Card */}
              <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden group">
                 <div className="relative z-10">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Happening Now</p>
                    <h3 className="text-xl font-black mb-4">Daily Standup</h3>
                    <div className="flex items-center gap-2 text-sm opacity-80 mb-6">
                       <Clock size={16} />
                       <span>Ends in 12 mins</span>
                    </div>
                    <Link to={`/w/${workspaceId}/meet?id=STANDUP`} className="w-full bg-white text-indigo-600 py-3 rounded-2xl font-bold text-sm block text-center transition-transform group-hover:scale-[1.02]">
                       Join Now
                    </Link>
                 </div>
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
                    <Video size={120} />
                 </div>
              </section>

               {/* Role Dashboards Selection */}
               <section className="bg-[var(--surface)] border rounded-[32px] p-8 shadow-sm">
                  <h2 className="text-lg font-black mb-6">Role Dashboards</h2>
                  <div className="space-y-3">
                     <RoleLink 
                        to={`/w/${workspaceId}/dashboard/dev`} 
                        label="Developer Dashboard" 
                        icon={Zap} 
                        color="#3b82f6" 
                     />
                     <RoleLink 
                        to={`/w/${workspaceId}/dashboard/test`} 
                        label="Tester Dashboard" 
                        icon={Shield} 
                        color="#10B981" 
                     />
                     <RoleLink 
                        to={`/w/${workspaceId}/dashboard/mgr`} 
                        label="Manager Dashboard" 
                        icon={TrendingUp} 
                        color="#8B5CF6" 
                     />
                  </div>
               </section>

              {/* Team Status */}
              <section className="bg-[var(--surface)] border rounded-[32px] p-8 shadow-sm">
                 <h2 className="text-lg font-black mb-6">Team Status</h2>
                 <div className="space-y-4">
                    {[
                      { name: "Sarah Miller", status: "In a meeting", online: true },
                      { name: "David Chen", status: "Available", online: true },
                      { name: "Alex Rivera", status: "Offline", online: false },
                      { name: "Jessica Jung", status: "Available", online: true }
                    ].filter(u => u.name !== (auth.user || auth.name)).map(u => (
                      <TeamStatus key={u.name} name={u.name} status={u.status} online={u.online} />
                    ))}
                 </div>
              </section>
           </div>
        </div>
      </div>
    </AppLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, subValue, color }) => (
  <div className="bg-[var(--surface)] border rounded-[24px] lg:rounded-[32px] p-4 lg:p-8 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
     <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center mb-4 lg:mb-6" style={{ background: `${color}18`, color }}>
        <Icon size={20} className="lg:hidden" />
        <Icon size={24} className="hidden lg:block" />
     </div>
     <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">{label}</p>
     <h3 className="text-xl lg:text-3xl font-black mb-1 lg:mb-2">{value}</h3>
     <p className="text-[9px] lg:text-xs opacity-40">{subValue}</p>
  </div>
);

const ActivityItem = ({ icon: Icon, title, time, description, badge }) => (
  <div className="flex gap-5 group cursor-pointer">
     <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
        <Icon size={20} />
     </div>
     <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
           <h4 className="text-sm font-bold">{title}</h4>
           <span className="text-[10px] opacity-30">{time}</span>
        </div>
        <p className="text-xs opacity-50 line-clamp-1">{description}</p>
        <div className="inline-block px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500">{badge}</div>
     </div>
  </div>
);

const TeamStatus = ({ name, status, online }) => (
  <div className="flex items-center gap-3">
     <div className="relative">
        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold border-2 border-[var(--surface)]">
           {name[0]}
        </div>
        {online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--surface)]" />}
     </div>
     <div>
        <h4 className="text-xs font-bold">{name}</h4>
        <p className="text-[10px] opacity-40">{status}</p>
     </div>
  </div>
);

const RoleLink = ({ to, label, icon: Icon, color }) => (
  <Link to={to} className="flex items-center justify-between p-4 rounded-[20px] bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] transition-all group">
     <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
           <Icon size={16} />
        </div>
        <span className="text-xs font-bold">{label}</span>
     </div>
     <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
  </Link>
);

export default WorkspaceDashboard;
