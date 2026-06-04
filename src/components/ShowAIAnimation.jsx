import React, { useEffect, useState } from 'react';
import { Sparkles, Layout } from 'lucide-react';

const ShowAIAnimation = () => {
  const [phase, setPhase] = useState(0); 

  useEffect(() => {
    let timer;
    if (phase === 0) {
      timer = setTimeout(() => setPhase(1), 500);
    } else if (phase === 1) {
      timer = setTimeout(() => setPhase(2), 2000); 
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
      <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 flex items-center justify-between">
        <div className="text-[10px] font-bold text-orange-600 flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-500 rounded-sm text-white flex items-center justify-center text-[8px]">P</span> Presentation
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative bg-slate-50">
        
        {/* AI Prompt Box */}
        <div className="bg-white rounded border border-slate-200 p-2 shadow-sm relative">
          <div className="text-[9px] text-slate-400 mb-1 flex items-center gap-1">
             <Sparkles size={10} className="text-orange-500"/> Generate Slides
          </div>
          <div className="text-[11px] text-slate-700 font-medium">
            <span className={`inline-block overflow-hidden whitespace-nowrap transition-all duration-[1500ms] ease-linear ${phase >= 1 ? 'w-[125px]' : 'w-0'}`}>
              Quarterly Sales Pitch
            </span>
            <span className={`inline-block w-px h-3 bg-orange-500 ml-0.5 animate-pulse ${phase >= 2 ? 'hidden' : ''}`}></span>
          </div>
          
          <div className={`absolute right-2 bottom-2 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded transition-all duration-300
            ${phase === 2 ? 'scale-90 bg-orange-600' : ''}`}>
            Create
          </div>
        </div>

        {/* Slides Area */}
        <div className="flex-1 flex gap-2 mt-1">
           {/* Sidebar thumbnails */}
           <div className="w-12 border-r border-slate-200 pr-2 flex flex-col gap-1">
              <div className={`w-full aspect-[4/3] rounded bg-white shadow-sm border ${phase === 3 ? 'border-orange-400 animate-[fadeIn_0.3s_ease-out]' : 'border-slate-200 opacity-50'}`}></div>
              <div className={`w-full aspect-[4/3] rounded bg-white shadow-sm border ${phase === 3 ? 'border-slate-200 animate-[fadeIn_0.6s_ease-out]' : 'border-slate-200 opacity-50'}`}></div>
              <div className={`w-full aspect-[4/3] rounded bg-white shadow-sm border ${phase === 3 ? 'border-slate-200 animate-[fadeIn_0.9s_ease-out]' : 'border-slate-200 opacity-50'}`}></div>
           </div>

           {/* Main Slide Preview */}
           <div className="flex-1 bg-white border border-slate-200 rounded relative shadow-md overflow-hidden flex flex-col items-center justify-center p-2 text-center">
             {phase === 3 ? (
               <>
                 <div className="animate-[fadeIn_0.5s_ease-out]">
                   <Layout size={24} className="text-orange-400 mb-1 mx-auto" />
                   <div className="font-extrabold text-[12px] text-slate-800 mb-1 leading-tight">Quarterly Sales<br/>Performance</div>
                   <div className="text-[7px] text-slate-500 uppercase tracking-wider">Q3 2026 Review</div>
                 </div>
                 {/* Generating Shimmer */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-100/50 to-transparent -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite]"></div>
               </>
             ) : (
               <div className="text-[9px] text-slate-300 italic">Waiting for prompt...</div>
             )}
           </div>
        </div>

        {/* Cursor Animation */}
        <div className={`absolute w-4 h-4 z-50 transition-all duration-1000 ease-in-out
          ${phase === 0 ? 'top-[90px] left-[50px] opacity-0' : ''}
          ${phase === 1 ? 'top-[45px] left-[130px] opacity-0' : ''}
          ${phase === 2 ? 'top-[50px] left-[210px] opacity-100' : ''}
          ${phase === 3 ? 'top-[90px] left-[120px] opacity-0' : ''}
        `}>
          <svg viewBox="0 0 24 24" fill="black" stroke="white" strokeWidth="2" className="w-4 h-4 shadow-xl">
            <polygon points="5.5 3 19 12 11.5 13.5 14 20.5 11.5 21.5 9 14.5 4 17" />
          </svg>
        </div>

      </div>
    </div>
  );
};

export default ShowAIAnimation;
