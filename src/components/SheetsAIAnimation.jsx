import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';

const SheetsAIAnimation = () => {
  const [phase, setPhase] = useState(0); 

  useEffect(() => {
    let timer;
    if (phase === 0) {
      timer = setTimeout(() => setPhase(1), 500); 
    } else if (phase === 1) {
      timer = setTimeout(() => setPhase(2), 1500); 
    } else if (phase === 2) {
      timer = setTimeout(() => setPhase(3), 1500); 
    } else if (phase === 3) {
      timer = setTimeout(() => setPhase(0), 4000); 
    }
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="w-64 h-48 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col text-left border border-slate-200 pointer-events-none relative">
      {/* Header */}
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-emerald-400"></div> Q3 Sales Data
        </div>
        
        {/* AI Button */}
        <div className={`flex items-center gap-1 text-[8px] font-bold px-2 py-1 rounded transition-all duration-300 z-20
          ${phase === 2 ? 'bg-emerald-100 text-emerald-600 scale-95 shadow-inner' : 'bg-emerald-50 text-emerald-500 shadow-sm'}`}>
          <Sparkles size={10} /> Analyze Data
        </div>
      </div>
      
      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative">
        
        {/* Mock Spreadsheet Grid */}
        <div className={`grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded overflow-hidden text-[8px] text-center transition-all duration-500 ${phase === 3 ? 'opacity-20' : 'opacity-100'}`}>
          <div className="bg-slate-100 font-bold p-1">Month</div>
          <div className="bg-slate-100 font-bold p-1">Revenue</div>
          <div className="bg-slate-100 font-bold p-1">Users</div>
          
          <div className="bg-white p-1 text-slate-600">Jul</div>
          <div className="bg-white p-1 text-slate-600">$12k</div>
          <div className="bg-white p-1 text-slate-600">450</div>
          
          <div className="bg-white p-1 text-slate-600">Aug</div>
          <div className="bg-white p-1 text-slate-600">$18k</div>
          <div className="bg-white p-1 text-slate-600">620</div>
          
          <div className="bg-white p-1 text-slate-600">Sep</div>
          <div className="bg-white p-1 text-slate-600">$24k</div>
          <div className="bg-white p-1 text-slate-600">890</div>
        </div>

        {/* AI Analysis Overlay */}
        <div className={`absolute inset-x-3 top-10 bottom-3 bg-white border border-emerald-200 rounded-lg shadow-lg p-2 flex flex-col gap-2 transition-all duration-500 transform z-10 ${phase === 3 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
           <div className="flex items-center gap-1 text-emerald-600 text-[9px] font-bold border-b border-emerald-100 pb-1">
             <TrendingUp size={12} /> AI Insight Generated
           </div>
           
           <div className="flex-1 flex items-end gap-2 px-4 pt-2">
             <div className="flex-1 bg-emerald-200 rounded-t h-[40%] animate-[growUp_1s_ease-out]"></div>
             <div className="flex-1 bg-emerald-400 rounded-t h-[70%] animate-[growUp_1s_ease-out_0.2s]"></div>
             <div className="flex-1 bg-emerald-500 rounded-t h-[100%] animate-[growUp_1s_ease-out_0.4s]"></div>
           </div>
           
           <div className="text-[8px] text-slate-600 leading-tight">
             Revenue grew by <span className="font-bold text-emerald-600">100%</span> over Q3. Strongest growth in September.
           </div>
        </div>

        {/* Cursor Animation */}
        <div className={`absolute w-4 h-4 z-50 transition-all duration-1000 ease-in-out
          ${phase === 0 ? 'top-[80px] left-[50px] opacity-0' : ''}
          ${phase === 1 ? 'top-[60px] left-[80px] opacity-0' : ''}
          ${phase === 2 ? 'top-[12px] left-[180px] opacity-100' : ''}
          ${phase === 3 ? 'top-[60px] left-[120px] opacity-0' : ''}
        `}>
          <svg viewBox="0 0 24 24" fill="black" stroke="white" strokeWidth="2" className="w-4 h-4 shadow-xl">
            <polygon points="5.5 3 19 12 11.5 13.5 14 20.5 11.5 21.5 9 14.5 4 17" />
          </svg>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes growUp {
          from { height: 0; opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  );
};

export default SheetsAIAnimation;
