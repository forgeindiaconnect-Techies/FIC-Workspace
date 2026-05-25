import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MeetingLayout from '../components/MeetingLayout';
import { 
  ChevronDown, BarChart2, Calendar, 
  Users, Clock, Video, TrendingUp, Search, Filter, ArrowRight, CheckCircle2, AlertTriangle, FileText
} from 'lucide-react';

export const MeetingAnalytics = () => {
  const { workspaceId } = useParams();
  const [activeSubTab, setActiveSubTab] = useState('Session History');
  const [activeMainTab, setActiveMainTab] = useState('Meeting');
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  useEffect(() => {
    fetch(`/api/meetings?workspaceId=${workspaceId}`)
      .then(res => res.json())
      .then(data => {
        setMeetings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch meetings:", err);
        setLoading(false);
      });
  }, [workspaceId]);

  const totalDuration = meetings.reduce((acc, m) => acc + (m.duration || 0), 0);

  const stats = [
    { label: 'Total Sessions', value: meetings.length, icon: Video },
    { label: 'Live Now', value: meetings.filter(m => m.status === 'Live').length, icon: Calendar },
    { label: 'Total Minutes', value: totalDuration, icon: Clock },
    { label: 'Transcribed', value: meetings.filter(m => m.transcript).length, icon: FileText },
  ];

  return (
    <MeetingLayout>
      <div className="h-full bg-white dark:bg-zinc-950 flex flex-col font-sans">
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
           </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
           <aside className="w-64 border-r border-zinc-100 dark:border-white/5 p-4 shrink-0 bg-white dark:bg-zinc-950">
              <div className="space-y-1">
                 {['Session History', 'Insights', 'Usage Statistics'].map(item => (
                   <button 
                     key={item}
                     onClick={() => setActiveSubTab(item)}
                     className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all
                        ${activeSubTab === item ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5'}
                     `}
                   >
                     {item}
                   </button>
                 ))}
              </div>
           </aside>

           <main className="flex-1 overflow-y-auto p-8 bg-[#f8fafc] dark:bg-zinc-900/20">
              <div className="max-w-6xl mx-auto space-y-8">
                 <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-100">{activeSubTab}</h2>
                    <div className="flex items-center gap-3">
                       <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          Last 30 days <ChevronDown size={14} />
                       </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                      <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-[32px] border border-zinc-100 dark:border-white/5 shadow-sm transition-all flex flex-col items-center text-center">
                         <span className="text-2xl font-black text-blue-600 mb-1">{stat.value}</span>
                         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{stat.label}</span>
                      </div>
                    ))}
                 </div>

                 {activeSubTab === 'Session History' && (
                    <div className="space-y-4">
                        {loading ? (
                           <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
                        ) : meetings.length === 0 ? (
                           <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-white/5">
                              <p className="text-zinc-400 font-bold">No meeting history found.</p>
                           </div>
                        ) : (
                           meetings.map(meeting => (
                              <div key={meeting._id} className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all group">
                                 <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                       <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600">
                                          <Video size={24} />
                                       </div>
                                       <div>
                                          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">{meeting.title}</h3>
                                          <div className="flex items-center gap-4 mt-1">
                                             <span className="text-xs text-zinc-400 font-bold flex items-center gap-1"><Clock size={12}/> {new Date(meeting.startTime).toLocaleDateString()}</span>
                                             <span className="text-xs text-zinc-400 font-bold flex items-center gap-1"><Users size={12}/> Host: {meeting.host}</span>
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       {meeting.summary ? (
                                          <button 
                                            onClick={() => setSelectedMeeting(meeting)}
                                            className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-wider rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                                          >
                                             <CheckCircle2 size={12} /> AI Summary Ready
                                          </button>
                                       ) : meeting.status === 'Ended' ? (
                                          <span className="px-4 py-2 bg-zinc-50 dark:bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-full">No Summary</span>
                                       ) : (
                                          <span className="px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-full animate-pulse">Meeting Live</span>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           ))
                        )}
                    </div>
                 )}

                 {/* AI Summary Modal */}
                 {selectedMeeting && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                       <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setSelectedMeeting(null)} />
                       <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 rounded-[40px] shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
                          <div className="p-8 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between shrink-0">
                             <div>
                                <h2 className="text-2xl font-black tracking-tight text-zinc-800 dark:text-zinc-100">{selectedMeeting.summary.meetingTitle}</h2>
                                <p className="text-xs text-zinc-400 font-bold mt-1">AI-Generated Intelligence Report • {new Date(selectedMeeting.startTime).toLocaleString()}</p>
                             </div>
                             <button onClick={() => setSelectedMeeting(null)} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-all"><X size={20}/></button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12">
                             <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600"><FileText size={16}/></div>
                                   <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Executive Summary</h4>
                                </div>
                                <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">{selectedMeeting.summary.summary}</p>
                             </section>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <section className="space-y-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600"><CheckCircle2 size={16}/></div>
                                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Key Points</h4>
                                   </div>
                                   <ul className="space-y-3">
                                      {selectedMeeting.summary.keyPoints.map((p, i) => (
                                         <li key={i} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> {p}
                                         </li>
                                      ))}
                                   </ul>
                                </section>
                                <section className="space-y-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600"><TrendingUp size={16}/></div>
                                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Decisions Made</h4>
                                   </div>
                                   <ul className="space-y-3">
                                      {selectedMeeting.summary.decisions.map((d, i) => (
                                         <li key={i} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" /> {d}
                                         </li>
                                      ))}
                                   </ul>
                                </section>
                             </div>

                             <section className="space-y-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600"><AlertTriangle size={16}/></div>
                                   <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Action Items</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {selectedMeeting.summary.actionItems.map((item, i) => (
                                      <div key={i} className="bg-zinc-50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-100 dark:border-white/5">
                                         <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{item.task}</p>
                                         <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Owner: {item.owner || 'TBD'}</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">{item.deadline || 'No Date'}</span>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </section>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </main>
        </div>
      </div>
    </MeetingLayout>
  );
};

const Loader2 = ({ className, size }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const X = ({ className, size }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
