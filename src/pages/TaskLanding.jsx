import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, ListTodo, Calendar, Clock, 
  BarChart3, Target, Layers, Repeat, ChevronRight, 
  CheckCircle2, Sparkles, LayoutGrid, Timer
} from 'lucide-react';

const TaskLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-amber-500/30 overflow-x-hidden">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-xl shadow-amber-500/20 group-hover:scale-110 transition-transform">
            <CheckSquare size={22} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">WorkSphere <span className="text-amber-500">Tasks</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <NavLink label="Boards" />
          <NavLink label="Analytics" />
          <NavLink label="Integrations" />
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/login?app=tasks')}
            className="px-6 py-2.5 font-bold text-sm hover:text-amber-600 transition-colors"
          >
            Login
          </button>
          <button 
            onClick={() => navigate('/login?app=tasks')}
            className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
             Optimize Productivity
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 rounded-full text-xs font-black uppercase tracking-widest border border-amber-200/50">
               <Sparkles size={14} /> Peak Productivity Tool
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.9] text-zinc-900 dark:text-white">
              Get things <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">done faster.</span>
            </h1>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-lg leading-relaxed">
              Stay organized, track your progress, and hit every deadline with the world's most intuitive task management platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                onClick={() => navigate('/login?app=tasks')}
                className="px-10 py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-[24px] font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-amber-500/30 hover:-translate-y-1 active:scale-95"
              >
                Create Your Board
              </button>
              <button className="px-10 py-5 border-2 border-zinc-200 dark:border-white/10 rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
                Watch Workflow
              </button>
            </div>
            <div className="flex items-center gap-6 pt-8 text-zinc-400">
               <div className="flex items-center gap-2 font-bold text-sm"><CheckCircle2 size={18} className="text-emerald-500" /> Kanban & Lists</div>
               <div className="flex items-center gap-2 font-bold text-sm"><CheckCircle2 size={18} className="text-emerald-500" /> Smart Reminders</div>
            </div>
          </div>

          {/* Productivity Mockup */}
          <div className="relative animate-in fade-in slide-in-from-right duration-1000 delay-300">
             <div className="relative bg-white dark:bg-zinc-900 rounded-[48px] p-6 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border border-zinc-200 dark:border-white/5">
                <div className="space-y-6">
                   <div className="flex items-center justify-between mb-8">
                      <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                      <div className="flex gap-2">
                         <div className="w-8 h-8 rounded-lg bg-amber-500/10" />
                         <div className="w-8 h-8 rounded-lg bg-amber-500/10" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <TaskItem title="Design System" progress={80} color="bg-amber-500" />
                      <TaskItem title="Client Meeting" progress={30} color="bg-blue-500" />
                      <TaskItem title="Final Review" progress={0} color="bg-zinc-200" />
                      <TaskItem title="Launch Day" progress={10} color="bg-emerald-500" />
                   </div>
                </div>
                {/* Floating Stats */}
                <div className="absolute -bottom-10 right-0 bg-white dark:bg-zinc-800 p-6 rounded-[32px] shadow-2xl border border-zinc-100 dark:border-white/5 animate-bounce-slow">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                         <BarChart3 size={24} />
                      </div>
                      <div>
                         <p className="text-2xl font-black text-zinc-900 dark:text-white">92%</p>
                         <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Completion Rate</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Grid of Perks */}
      <section className="max-w-7xl mx-auto px-8 py-32 grid grid-cols-1 md:grid-cols-3 gap-12">
         <Perk icon={LayoutGrid} title="Visual Workflow" desc="Switch between Board, List, and Timeline views in a single click." />
         <Perk icon={Timer} title="Time Tracking" desc="Monitor how much time you spend on each task with built-in timers." />
         <Perk icon={Repeat} title="Recurring Tasks" desc="Automate repetitive work with powerful recurring task schedules." />
      </section>

      {/* Final CTA */}
      <section className="bg-amber-500 py-32 px-8 text-center space-y-10">
         <h2 className="text-5xl md:text-6xl font-black text-zinc-900 tracking-tighter">Your productivity <br /> has a new home.</h2>
         <button 
           onClick={() => navigate('/login?app=tasks')}
           className="px-12 py-6 bg-zinc-900 text-white rounded-full font-black uppercase tracking-widest text-sm hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-black/30"
         >
           Create Your First Task
         </button>
      </section>
    </div>
  );
};

const NavLink = ({ label }) => (
  <button className="text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
    {label}
  </button>
);

const TaskItem = ({ title, progress, color }) => (
  <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-[24px] space-y-4">
     <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-400">{title}</span>
        <CheckCircle2 size={14} className={progress === 100 ? 'text-emerald-500' : 'text-zinc-300'} />
     </div>
     <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${progress}%` }} />
     </div>
  </div>
);

const Perk = ({ icon: Icon, title, desc }) => (
  <div className="space-y-6">
     <div className="w-16 h-16 bg-amber-500 text-white rounded-[24px] flex items-center justify-center shadow-xl shadow-amber-500/20">
        <Icon size={32} />
     </div>
     <h3 className="text-2xl font-black tracking-tight">{title}</h3>
     <p className="text-zinc-500 font-medium leading-relaxed">{desc}</p>
  </div>
);

export default TaskLanding;
