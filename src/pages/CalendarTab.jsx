import React, { useState } from 'react';
import MeetingLayout from '../components/MeetingLayout';
import { 
  ChevronLeft, ChevronRight, ChevronDown, 
  MoreVertical, Calendar as CalendarIcon,
  Clock, Plus, Search, Filter, Globe
} from 'lucide-react';

const CalendarTab = () => {
  const [view, setView] = useState('Week');
  
  const days = [
    { date: 26, day: 'Sun' },
    { date: 27, day: 'Mon', active: true },
    { date: 28, day: 'Tue' },
    { date: 29, day: 'Wed' },
    { date: 30, day: 'Thu' },
    { date: 1, day: 'Fri' },
    { date: 2, day: 'Sat' },
  ];

  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i-12}pm`;
    return hour;
  });

  return (
    <MeetingLayout>
      <div className="h-full bg-white dark:bg-zinc-950 flex flex-col font-sans">


        {/* Controls Bar */}
        <div className="h-14 px-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
           <div className="flex items-center gap-6">
              <button className="px-4 py-1.5 border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 transition-all">
                 Today
              </button>
              <div className="flex items-center gap-1 text-zinc-400">
                 <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-full transition-all"><ChevronLeft size={18} /></button>
                 <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/5 rounded-full transition-all"><ChevronRight size={18} /></button>
              </div>
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">26 Apr - 02 May 2026</span>
           </div>

           <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-lg shadow-blue-500/20">
                 <Plus size={14} strokeWidth={3} /> Schedule Meeting
              </button>
              <div className="flex items-center gap-2 px-4 py-1.5 border border-zinc-200 dark:border-white/10 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer hover:bg-white dark:hover:bg-zinc-800">
                 {view} <ChevronDown size={14} />
              </div>
              <button className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all">
                 <MoreVertical size={18} />
              </button>
           </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
           {/* Grid Header (Days) */}
           <div className="flex border-b border-zinc-100 dark:border-white/5 bg-white dark:bg-zinc-900 shrink-0">
              <div className="w-24 shrink-0 flex flex-col items-center justify-center border-r border-zinc-100 dark:border-white/5 py-4">
                 <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">GMT</span>
                 <span className="text-[9px] font-bold text-blue-500">+05:30</span>
              </div>
              <div className="flex-1 grid grid-cols-7">
                 {days.map((d, i) => (
                   <div key={i} className={`flex flex-col items-center justify-center py-4 border-r border-zinc-100 dark:border-white/5 last:border-r-0
                      ${d.active ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}
                   `}>
                      <div className="flex items-baseline gap-2">
                         <span className={`text-lg font-black ${d.active ? 'text-blue-600' : 'text-zinc-800 dark:text-zinc-200'}`}>{d.date}</span>
                         <span className={`text-[10px] font-black uppercase tracking-widest ${d.active ? 'text-blue-600' : 'text-zinc-400'}`}>{d.day}</span>
                      </div>
                      {d.active && <div className="mt-1 w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                   </div>
                 ))}
              </div>
           </div>

           {/* Grid Body (Hours) */}
           <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex min-h-full relative">
                 {/* Hour Markers */}
                 <div className="w-24 shrink-0 border-r border-zinc-100 dark:border-white/5 bg-white dark:bg-zinc-900">
                    {hours.map((h, i) => (
                      <div key={i} className="h-20 border-b border-zinc-50 dark:border-white/5 flex items-start justify-center pt-2">
                         <span className="text-[10px] font-bold text-zinc-400 uppercase">{h}</span>
                      </div>
                    ))}
                 </div>

                 {/* Grid Columns */}
                 <div className="flex-1 grid grid-cols-7 relative">
                    {/* Vertical Lines */}
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="h-full border-r border-zinc-100 dark:border-white/5 last:border-r-0" />
                    ))}

                    {/* Horizontal Lines (Hour Cells) */}
                    <div className="absolute inset-0 pointer-events-none">
                       {hours.map((_, i) => (
                         <div key={i} className="h-20 border-b border-zinc-100/50 dark:border-white/5" />
                       ))}
                    </div>

                    {/* Example Meeting Cards (Absolute positioned) */}
                    {/* Today at 10am - 11:30am */}
                    <div className="absolute top-[800px] left-[14.28%] w-[14.28%] p-1">
                       <div className="h-[120px] bg-blue-600/90 hover:bg-blue-600 rounded-xl p-3 shadow-lg shadow-blue-500/20 text-white transition-all cursor-pointer group overflow-hidden border border-white/20">
                          <div className="flex items-center gap-2 mb-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                             <span className="text-[9px] font-black uppercase tracking-widest opacity-80">10:00 AM - 11:30 AM</span>
                          </div>
                          <h4 className="text-xs font-black truncate leading-tight">Product Strategy Sync</h4>
                          <div className="mt-3 flex items-center -space-x-1.5">
                             <div className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-blue-600 flex items-center justify-center text-[8px] font-bold">JD</div>
                             <div className="w-5 h-5 rounded-full bg-rose-500 border-2 border-blue-600 flex items-center justify-center text-[8px] font-bold">AS</div>
                          </div>
                       </div>
                    </div>

                    {/* Tomorrow at 2pm - 3pm */}
                    <div className="absolute top-[1120px] left-[28.56%] w-[14.28%] p-1">
                       <div className="h-[80px] bg-emerald-500/90 hover:bg-emerald-500 rounded-xl p-3 shadow-lg shadow-emerald-500/20 text-white transition-all cursor-pointer group overflow-hidden border border-white/20">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-80">02:00 PM - 03:00 PM</span>
                          <h4 className="text-xs font-black truncate leading-tight">Client Handover</h4>
                       </div>
                    </div>
                 </div>

                 {/* Current Time Indicator */}
                 <div className="absolute left-0 right-0 border-t-2 border-rose-500 z-20 pointer-events-none flex items-center" style={{ top: '650px' }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.25" />
                    <div className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded uppercase">08:15 AM</div>
                 </div>
              </div>
           </div>
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

export default CalendarTab;
