import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Video, FileText, Search, Plus, 
  Filter, MoreVertical, Download, 
  Trash2, Share2, Camera, PlayCircle,
  HardDrive
} from 'lucide-react';

const FilesTab = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState('Recordings');
  const [activeMainTab, setActiveMainTab] = useState('Meeting');

  return (
    <MeetingLayout>
      <div className="h-full bg-white dark:bg-zinc-950 flex flex-col font-sans">
        {/* Top Header Tabs */}
        <div className="px-8 border-b border-zinc-100 dark:border-white/5 flex items-center h-14 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
           <div className="flex items-center gap-8 h-full">
              {['Meeting'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveMainTab(tab)}
                  className={`h-full px-1 text-sm font-bold transition-all relative
                    ${activeMainTab === tab ? 'text-blue-600' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}
                  `}
                >
                  {tab}
                  {activeMainTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />}
                </button>
              ))}
              {/* Webinar tab removed per previous preference */}
           </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* Left Sub-Navigation */}
           <aside className="w-64 border-r border-zinc-100 dark:border-white/5 p-4 shrink-0 bg-white dark:bg-zinc-950">
              <div className="space-y-1">
                 {[
                   { id: 'Recordings', icon: PlayCircle, label: 'Recordings' },
                   { id: 'Files', icon: HardDrive, label: 'Files' }
                 ].map(item => (
                   <button 
                     key={item.id}
                     onClick={() => setActiveSubTab(item.id)}
                     className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-3
                        ${activeSubTab === item.id ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5'}
                     `}
                   >
                     <item.icon size={18} />
                     {item.label}
                   </button>
                 ))}
              </div>
           </aside>

           {/* Main Content Area */}
           <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] dark:bg-zinc-900/20 flex flex-col">
              <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col items-center justify-center text-center">
                 
                 {/* Empty State Illustration */}
                 <div className="relative mb-8 animate-fade">
                    <div className="w-48 h-32 bg-white dark:bg-zinc-900 rounded-[32px] border-2 border-zinc-100 dark:border-white/5 shadow-xl flex items-center justify-center overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                       
                       {activeSubTab === 'Recordings' ? (
                          <div className="w-14 h-14 bg-white dark:bg-zinc-800 rounded-full shadow-2xl flex items-center justify-center text-zinc-300 dark:text-zinc-600 border border-zinc-100 dark:border-white/5">
                             <PlayCircle size={32} strokeWidth={1.5} />
                          </div>
                       ) : (
                          <div className="flex flex-col items-center gap-2">
                             <div className="w-12 h-16 bg-zinc-50 dark:bg-zinc-800 rounded border-2 border-zinc-100 dark:border-white/10 relative p-2 flex flex-col gap-1.5 shadow-lg">
                                <div className="w-full h-1 bg-zinc-200 dark:bg-white/10 rounded-full" />
                                <div className="w-3/4 h-1 bg-zinc-200 dark:bg-white/10 rounded-full" />
                                <div className="w-full h-1 bg-zinc-200 dark:bg-white/10 rounded-full" />
                                <div className="absolute -bottom-1 -right-3 w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                                   <FileText size={16} className="text-blue-500" />
                                </div>
                             </div>
                          </div>
                       )}
                    </div>
                    
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-40 h-4 bg-zinc-100 dark:bg-black/20 rounded-[100%] blur-md" />
                 </div>

                 <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">You don't have any {activeSubTab.toLowerCase()}</h3>
                 <p className="text-zinc-500 text-sm leading-relaxed">
                    {activeSubTab === 'Recordings' 
                      ? "Recording your meetings is a great way to keep track of discussions and share them with participants later."
                      : "Share important documents, presentations, and resources with your team members here."
                    }
                 </p>
                 
                 <div className="mt-10">
                    {activeSubTab === 'Files' && (
                      <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                         <Plus size={18} /> Upload Files
                      </button>
                    )}
                 </div>

              </div>

              {/* Bottom storage indicator */}
              <div className="max-w-6xl mx-auto w-full pt-8 border-t border-zinc-100 dark:border-white/5 mt-auto">
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                       <HardDrive size={14} className="text-zinc-400" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cloud Storage</span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500">0 MB / 1 GB used</span>
                 </div>
                 <div className="h-1.5 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-0.5 bg-blue-500 rounded-full" />
                 </div>
              </div>
           </main>
        </div>
      </div>
    </MeetingLayout>
  );
};

export default FilesTab;
