import React, { useEffect, useState } from 'react';
import { Sparkles, Send, ShieldAlert, Bot } from 'lucide-react';

const ChatAIAnimation = () => {
  const [phase, setPhase] = useState(0); 

  useEffect(() => {
    let timer;
    if (phase === 0) {
      timer = setTimeout(() => setPhase(1), 500); 
    } else if (phase === 1) {
      timer = setTimeout(() => setPhase(2), 1500); 
    } else if (phase === 2) {
      timer = setTimeout(() => setPhase(3), 2000); 
    } else if (phase === 3) {
      timer = setTimeout(() => setPhase(0), 4000); 
    }
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="w-64 h-48 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col text-left border border-slate-200 pointer-events-none relative">
      {/* Header */}
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center gap-2 justify-between">
        <div className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-teal-400"></div> Team General
        </div>
        <div className="bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded text-[8px] font-bold flex items-center gap-1">
          <Sparkles size={10} /> Auto-Mod ON
        </div>
      </div>
      
      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative bg-slate-50">
        
        {/* Msg 1 */}
        <div className={`flex gap-2 transition-all duration-500 ${phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="w-6 h-6 rounded-full bg-blue-200 shrink-0"></div>
          <div className="bg-white border border-slate-200 p-2 rounded-xl rounded-tl-none text-[9px] text-slate-600 shadow-sm">
            Guys, the new deployment just broke production.
          </div>
        </div>

        {/* Msg 2 */}
        <div className={`flex gap-2 transition-all duration-500 z-10 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="w-6 h-6 rounded-full bg-red-200 shrink-0"></div>
          <div className="bg-white border border-red-200 p-2 rounded-xl rounded-tl-none text-[9px] text-slate-600 shadow-sm relative w-full">
            <span className={`transition-all duration-500 ${phase === 3 ? 'blur-[2px] text-slate-400' : ''}`}>
              Who wrote this trash code? You are all idiots!
            </span>
            
            {/* AI Moderation overlay */}
            <div className={`absolute -bottom-6 left-0 bg-red-50 border border-red-200 text-red-600 px-2 py-1 rounded shadow-md text-[8px] font-bold flex items-center gap-1 whitespace-nowrap transition-all duration-300 ${phase === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
              <ShieldAlert size={10} /> Message hidden: Toxicity detected
            </div>
          </div>
        </div>

      </div>

      {/* Input */}
      <div className="p-2 border-t border-slate-200 bg-white flex items-center gap-2 z-20">
        <div className="flex-1 bg-slate-100 h-6 rounded-full px-3 flex items-center text-[9px] text-slate-400">
          Type a message...
        </div>
        <div className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center shrink-0">
          <Send size={10} className="ml-0.5" />
        </div>
      </div>
    </div>
  );
};

export default ChatAIAnimation;
