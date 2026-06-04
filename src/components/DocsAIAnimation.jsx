import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const DocsAIAnimation = () => {
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
      <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-100 flex items-center justify-between">
        <div className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
          <span className="w-3 h-3 bg-indigo-500 rounded-sm text-white flex items-center justify-center text-[8px]">W</span> Document
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
             <Sparkles size={10} className="text-indigo-500"/> AI Prompt
          </div>
          <div className="text-[11px] text-slate-700 font-medium">
            <span className={`inline-block overflow-hidden whitespace-nowrap transition-all duration-[1500ms] ease-linear ${phase >= 1 ? 'w-[110px]' : 'w-0'}`}>
              Q3 Project Proposal
            </span>
            <span className={`inline-block w-px h-3 bg-indigo-500 ml-0.5 animate-pulse ${phase >= 2 ? 'hidden' : ''}`}></span>
          </div>
          
          <div className={`absolute right-2 bottom-2 bg-indigo-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded transition-all duration-300
            ${phase === 2 ? 'scale-90 bg-indigo-600' : ''}`}>
            Generate
          </div>
        </div>

        {/* Document Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded mt-1 p-2 relative shadow-inner">
           {phase === 3 ? (
             <div className="text-[9px] text-slate-700 leading-relaxed">
                <div className="font-bold text-[11px] mb-1 animate-[fadeIn_0.3s_ease-out]">Q3 Project Proposal</div>
                <div className="animate-[fadeIn_0.7s_ease-out]">
                  <strong>1. Executive Summary</strong><br/>
                  This project aims to increase user engagement by 20% through the new AI features.
                </div>
                <div className="animate-[fadeIn_1.2s_ease-out] mt-1">
                  <strong>2. Objectives</strong><br/>
                  - Implement Mail AI<br/>
                  - Implement Docs AI
                </div>
             </div>
           ) : (
             <div className="text-[10px] text-slate-300 italic flex items-center justify-center h-full">Document is empty</div>
           )}

           {/* Generating Shimmer */}
           {phase === 3 && (
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite]"></div>
           )}
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

export default DocsAIAnimation;
