import React, { useEffect, useState } from 'react';
import { Sparkles, Video, Mic, Mail } from 'lucide-react';

const MeetAIAnimation = () => {
  const [phase, setPhase] = useState(0); 

  useEffect(() => {
    let timer;
    if (phase === 0) {
      timer = setTimeout(() => setPhase(1), 500); // Start meeting
    } else if (phase === 1) {
      timer = setTimeout(() => setPhase(2), 2000); // AI listening, then switch
    } else if (phase === 2) {
      timer = setTimeout(() => setPhase(3), 1500); // Generating summary
    } else if (phase === 3) {
      timer = setTimeout(() => setPhase(0), 4000); // Show email, then loop
    }
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="w-64 h-48 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col text-left border border-slate-200 pointer-events-none relative">
      {/* Header */}
      <div className="bg-green-50 px-3 py-2 border-b border-green-100 flex items-center justify-between">
        <div className="text-[10px] font-bold text-green-600 flex items-center gap-1">
          <Video size={12} className="text-green-500"/> Video Meeting
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-3 flex-1 flex flex-col relative bg-slate-50 overflow-hidden">
        
        {/* Phase 1 & 2: Meeting UI */}
        <div className={`absolute inset-0 p-3 transition-all duration-500 flex flex-col gap-2
          ${phase >= 2 ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
           
           {/* Video Grid */}
           <div className="flex gap-2 h-20">
             <div className="flex-1 bg-slate-200 rounded-lg flex items-center justify-center relative overflow-hidden shadow-inner">
               <div className="w-6 h-6 rounded-full bg-blue-300"></div>
               {/* Audio Waves */}
               <div className="absolute bottom-1 right-1 flex items-end gap-0.5 h-3">
                 <div className={`w-0.5 bg-blue-500 rounded-t ${phase === 1 ? 'animate-[ping_0.5s_infinite]' : 'h-1'}`}></div>
                 <div className={`w-0.5 bg-blue-500 rounded-t ${phase === 1 ? 'animate-[ping_0.7s_infinite]' : 'h-2'}`}></div>
                 <div className={`w-0.5 bg-blue-500 rounded-t ${phase === 1 ? 'animate-[ping_0.4s_infinite]' : 'h-1'}`}></div>
               </div>
             </div>
             <div className="flex-1 bg-slate-200 rounded-lg flex items-center justify-center relative shadow-inner">
               <div className="w-6 h-6 rounded-full bg-purple-300"></div>
             </div>
           </div>

           {/* AI Listening Indicator */}
           <div className="mt-auto bg-white border border-green-200 rounded p-1.5 flex items-center justify-center gap-2 shadow-sm">
             <div className="relative flex items-center justify-center w-4 h-4">
               <Sparkles size={12} className="text-green-500 relative z-10" />
               {phase === 1 && <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-50"></div>}
             </div>
             <span className="text-[9px] font-bold text-green-600">AI Note Taker Active</span>
           </div>
        </div>

        {/* Phase 3 & 4: Email Summary */}
        <div className={`absolute inset-0 p-2 transition-all duration-700 bg-white
          ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
           
           <div className="border border-slate-200 rounded h-full flex flex-col shadow-sm">
             <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex gap-2 items-center">
               <Mail size={12} className="text-blue-500" />
               <div>
                 <div className="text-[8px] font-bold text-slate-700">Meeting Summary & Action Items</div>
                 <div className="text-[7px] text-slate-400">To: All Participants</div>
               </div>
             </div>
             <div className="p-2 flex-1 relative">
                {phase >= 3 ? (
                  <div className="text-[8px] text-slate-600 leading-relaxed">
                    <strong className="animate-[fadeIn_0.3s_ease-out]">Key Decisions:</strong><br/>
                    <span className="animate-[fadeIn_0.6s_ease-out]">- Launch moved to Q4.</span><br/>
                    <span className="animate-[fadeIn_0.9s_ease-out]">- Budget approved for marketing.</span><br/>
                    <br/>
                    <strong className="animate-[fadeIn_1.2s_ease-out]">Action Items:</strong><br/>
                    <span className="animate-[fadeIn_1.5s_ease-out] text-blue-500 font-medium">@sarah - Update timeline</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Sparkles size={16} className="text-blue-400 animate-spin" />
                    <span className="text-[8px] text-slate-400 font-bold">Drafting Summary...</span>
                  </div>
                )}
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default MeetAIAnimation;
