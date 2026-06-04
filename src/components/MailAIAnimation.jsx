import React, { useEffect, useState } from 'react';
import { Sparkles, Send, Type } from 'lucide-react';

const MailAIAnimation = () => {
  const [phase, setPhase] = useState(0); // 0: reset, 1: typing subject, 2: clicking AI, 3: generating body

  useEffect(() => {
    let timer;
    if (phase === 0) {
      timer = setTimeout(() => setPhase(1), 500);
    } else if (phase === 1) {
      timer = setTimeout(() => setPhase(2), 2000); // 2 seconds to type subject
    } else if (phase === 2) {
      timer = setTimeout(() => setPhase(3), 1500); // 1.5 seconds for cursor move and click
    } else if (phase === 3) {
      timer = setTimeout(() => setPhase(0), 4000); // 4 seconds reading generated text, then loop
    }
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="w-64 h-48 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col text-left border border-slate-200 pointer-events-none relative">
      {/* Header */}
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
        </div>
        <div className="text-[10px] font-medium text-slate-500 ml-2">New Message</div>
      </div>
      
      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative">
        <div className="flex border-b border-slate-100 pb-1 items-center">
          <span className="text-[10px] text-slate-400 w-8">To:</span>
          <div className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded">manager@forge.com</div>
        </div>
        
        <div className="flex border-b border-slate-100 pb-1 items-center relative">
          <span className="text-[10px] text-slate-400 w-8">Sub:</span>
          <span className="text-[11px] text-slate-700 font-medium relative">
            <span className={`inline-block overflow-hidden whitespace-nowrap transition-all duration-[1500ms] ease-linear ${phase >= 1 ? 'w-[75px]' : 'w-0'}`}>
              Leave request
            </span>
            <span className={`inline-block w-px h-3 bg-blue-500 ml-0.5 animate-pulse ${phase >= 2 ? 'hidden' : ''}`}></span>
          </span>
          
          {/* Write with AI Button */}
          <div className={`absolute right-0 flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded transition-all duration-300
            ${phase === 2 ? 'bg-blue-100 text-blue-600 scale-95 shadow-inner' : 'bg-blue-50 text-blue-500 shadow-sm'}`}>
            <Sparkles size={10} /> Write with AI
          </div>
        </div>

        {/* Text Area */}
        <div className="flex-1 relative mt-1">
           {phase === 3 ? (
             <div className="text-[9px] text-slate-600 leading-relaxed">
                <span className="animate-[fadeIn_0.5s_ease-out]">Hi Manager,</span><br/>
                <span className="animate-[fadeIn_1s_ease-out]">I am writing to formally request a leave of absence starting tomorrow due to a family emergency. I have updated the team on pending tasks.</span><br/>
                <span className="animate-[fadeIn_1.5s_ease-out]">Thanks.</span>
             </div>
           ) : (
             <div className="text-[10px] text-slate-300 italic">Type your message here...</div>
           )}

           {/* Generating Shimmer */}
           {phase === 3 && (
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/50 to-transparent -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite]"></div>
           )}
        </div>

        {/* Cursor Animation */}
        <div className={`absolute w-4 h-4 z-50 transition-all duration-1000 ease-in-out
          ${phase === 0 ? 'top-[80px] left-[50px] opacity-0' : ''}
          ${phase === 1 ? 'top-[45px] left-[110px] opacity-0' : ''}
          ${phase === 2 ? 'top-[35px] left-[210px] opacity-100' : ''}
          ${phase === 3 ? 'top-[60px] left-[120px] opacity-0' : ''}
        `}>
          <svg viewBox="0 0 24 24" fill="black" stroke="white" strokeWidth="2" className="w-4 h-4 shadow-xl">
            <polygon points="5.5 3 19 12 11.5 13.5 14 20.5 11.5 21.5 9 14.5 4 17" />
          </svg>
        </div>

      </div>
    </div>
  );
};

export default MailAIAnimation;
