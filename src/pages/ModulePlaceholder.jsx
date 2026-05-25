import React from 'react';
import MeetingLayout from '../components/MeetingLayout';
import { Ghost } from 'lucide-react';

const ModulePlaceholder = ({ name }) => {
  return (
    <MeetingLayout>
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#0f172a] text-white">
        <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 border border-blue-500/20">
          <Ghost size={48} className="animate-pulse" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">{name}</h1>
        <p className="text-zinc-500 font-medium">This module is currently being synchronized with your workspace.</p>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
           {[1, 2, 3].map(i => (
             <div key={i} className="h-48 bg-white/5 border border-white/5 rounded-3xl animate-pulse" />
           ))}
        </div>
      </div>
    </MeetingLayout>
  );
};

export default ModulePlaceholder;
