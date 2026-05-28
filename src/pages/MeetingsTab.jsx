import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiUrl } from '../api';
import MeetingLayout from '../components/MeetingLayout';
import { 
  Search, ChevronDown, Video, Plus, 
  MoreVertical, Clock, Calendar, 
  Play, Users, Sun, Mic, Check
} from 'lucide-react';

const MeetingsTab = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Upcoming');

  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const startInstantMeeting = async (type = 'video') => {
    const passcode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const res = await fetch(getApiUrl('/api/meetings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title: `${auth.user || 'User'}'s ${type === 'audio' ? 'Audio' : 'Video'} Meeting`,
          passcode,
        }),
      });
      const meeting = await res.json();
      if (!res.ok) {
        throw new Error(meeting.error || 'Failed to create meeting.');
      }
      navigate(`/w/${workspaceId}/meet/room/${meeting.joinCode}?pwd=${passcode}&intent=join`);
    } catch (err) {
      console.error('Failed to create meeting:', err);
      alert(err.message || 'Failed to create meeting. Please try again.');
    }
  };
  const meetings = [
    { 
      id: 1, 
      title: `${auth.user || 'User'}'s Personal Meeting Room`, 
      time: "02:21 PM", 
      duration: "1 hr", 
      status: "Ended",
      host: auth.user || 'User',
      dept: "My Department",
      date: "TODAY"
    }
  ];

  return (
    <MeetingLayout>
      <div className="h-full bg-[#f8fafc] dark:bg-zinc-950 flex flex-col">
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-6xl mx-auto space-y-8 h-full">
            
            {activeTab === 'Upcoming' && (
              <>
                {/* Section Header */}
                <div className="flex items-center gap-2 animate-fade">
                   <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">TODAY</span>
                   <span className="w-5 h-5 bg-zinc-200 dark:bg-white/5 rounded-full flex items-center justify-center text-[10px] font-black text-zinc-500">1</span>
                </div>

                {/* Meeting Cards List */}
                 <div className="space-y-4 animate-up">
                    {meetings.map((mtg) => (
                      <div key={mtg.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all flex items-center group">
                         
                         <div className="flex items-start gap-4 min-w-[140px]">
                            <div className="mt-1 text-amber-500">
                               <Sun size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                               <span className="text-sm font-bold text-zinc-900 dark:text-white">{mtg.time} <span className="mx-1 opacity-20">·</span> {mtg.duration}</span>
                               <span className="mt-1 inline-block w-fit px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-[9px] font-black uppercase tracking-widest text-rose-500">
                                  {mtg.status}
                               </span>
                            </div>
                         </div>

                         <div className="flex-1 px-8">
                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 transition-colors cursor-pointer">
                               {mtg.title}
                            </h3>
                         </div>

                         <div className="flex items-center gap-4 px-8 min-w-[200px]">
                            <div className="flex items-center -space-x-2">
                               <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold">SM</div>
                               <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold">MT</div>
                            </div>
                            <div className="flex flex-col">
                               <span className="text-xs font-bold text-zinc-900 dark:text-white">{mtg.host}</span>
                               <span className="text-[10px] font-medium text-zinc-400">{mtg.dept}</span>
                            </div>
                         </div>

                         <div className="flex items-center gap-3 ml-auto">
                            <button 
                              onClick={() => {
                                if (mtg.status.toLowerCase() === 'ended') {
                                  navigate(`/w/${workspaceId}/meet/summarize/${mtg.id}`);
                                } else {
                                  navigate(`/w/${workspaceId}/meet/room/${mtg.id}`);
                                }
                              }} 
                              className={`
                                px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95
                                ${mtg.status.toLowerCase() === 'ended' 
                                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-105' 
                                  : 'border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'}
                              `}
                            >
                               {mtg.status.toLowerCase() === 'ended' ? 'Summarize' : 'Start'}
                            </button>
                            <button className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-colors"><MoreVertical size={18} /></button>
                         </div>
                      </div>
                    ))}
                 </div>
              </>
            )}

            {activeTab === 'Past' && (
              <div className="h-full flex flex-col items-center justify-center text-center animate-fade py-20">
                 <div className="relative mb-10">
                    <div className="w-40 h-48 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm flex flex-col overflow-hidden">
                       <div className="h-8 bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5 flex items-center px-4 gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                       </div>
                       <div className="flex-1 p-4 grid grid-cols-3 gap-2 opacity-20">
                          {[1,2,3,4,5,6,7,8,9].map(i => <div key={i} className="h-4 bg-zinc-200 dark:bg-white/5 rounded-sm" />)}
                       </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-zinc-100 dark:border-white/10 flex items-center justify-center text-zinc-400">
                       <Clock size={24} />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-300">
                       <Check size={64} strokeWidth={1} />
                    </div>
                 </div>

                 <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">No Past Meetings</h3>
                 <p className="text-sm text-zinc-400 mb-10 max-w-sm">You can either start an instant meeting or schedule a meeting</p>
                 
                 <div className="flex items-center gap-3">
                    <div className="relative group">
                       <button className="px-8 py-2.5 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full font-bold text-sm transition-all flex items-center gap-2">
                          Meet Now <ChevronDown size={14} />
                       </button>
                       <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-20 overflow-hidden">
                          <button onClick={() => startInstantMeeting('audio')} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-zinc-50 dark:hover:bg-white/5 flex items-center gap-3">
                             <Mic size={14} /> Audio Conferencing
                          </button>
                          <button onClick={() => startInstantMeeting('video')} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-zinc-50 dark:hover:bg-white/5 flex items-center gap-3">
                             <Video size={14} /> Video Conferencing
                          </button>
                       </div>
                    </div>
                    <button className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-blue-500/20">
                       Schedule
                    </button>
                 </div>
              </div>
            )}

            {activeTab === 'Personal Room' && (
              <div className="animate-fade space-y-12 pb-20">
                 <div className="max-w-4xl">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                       A personal meeting room provides a perfect setting for exclusive meetings with colleagues, friends, and family members. It's permanently reserved for you and accessible with your Personal Meeting ID or personal invite link. The room is fully equipped with all the necessary features of an online meeting, enabling real-time collaboration with guests. <button className="text-blue-500 font-bold hover:underline">Learn More</button>
                    </p>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                    <div className="lg:col-span-3 space-y-10">
                       <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-200">Room Details</h3>
                       
                       <div className="space-y-8">
                          <DetailRow label="Title" value={`${auth.user || 'User'}'s Personal Meeting Room`} />
                          <DetailRow label="Meeting ID" value="138761349215" isBold />
                          
                          <div className="flex items-start">
                             <div className="w-40 shrink-0 text-sm font-medium text-zinc-500">Security</div>
                             <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                   <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center">
                                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                                   </div>
                                   <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Always locked</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer opacity-40">
                                   <div className="w-4 h-4 rounded-full border-2 border-zinc-300" />
                                   <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Password protected</span>
                                </label>
                             </div>
                          </div>

                          <DetailRow label="Meeting Access" value="Allow everyone" />
                          
                          <div className="flex items-start">
                             <div className="w-40 shrink-0 text-sm font-medium text-zinc-500">Invite link</div>
                             <div className="space-y-4 flex-1">
                                <span className="text-sm font-bold text-blue-600 break-all">https://meet.worksphere.io/gvez-tka-kzp</span>
                                <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest text-blue-500">
                                   <button className="hover:underline">Copy link</button>
                                   <div className="w-px h-3 bg-zinc-200 dark:bg-white/10" />
                                   <button className="hover:underline">View invitation</button>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="pt-6">
                          <button 
                            onClick={() => startInstantMeeting('video')}
                            className="px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-blue-500/20"
                          >
                             Start Meeting
                          </button>
                       </div>
                    </div>

                    <div className="lg:col-span-2">
                       <div className="bg-blue-50/50 dark:bg-white/5 rounded-[40px] p-10 space-y-10 border border-blue-100/50 dark:border-white/5">
                          <div className="aspect-video bg-white dark:bg-zinc-800 rounded-[32px] border border-blue-100 dark:border-white/5 flex items-center justify-center overflow-hidden shadow-sm relative">
                             <div className="flex items-end gap-2 opacity-20">
                                <div className="w-8 h-16 bg-blue-500 rounded-t-lg" />
                                <div className="w-8 h-24 bg-blue-400 rounded-t-lg" />
                                <div className="w-8 h-12 bg-blue-600 rounded-t-lg" />
                             </div>
                             <Users className="absolute opacity-10" size={80} />
                          </div>

                          <div className="space-y-6">
                             <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">Note:</h4>
                             <ul className="space-y-4">
                                <NoteItem text="Participants can be invited once you start the meeting." />
                                <NoteItem text="The meeting title can be edited once the session has been started." />
                                <NoteItem text="Co-hosts can be assigned after they join the meeting." />
                                <NoteItem text="Personal meeting room can either be locked or password protected." />
                             </ul>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MeetingLayout>
  );
};

const DetailRow = ({ label, value, isBold }) => (
  <div className="flex items-start">
    <div className="w-40 shrink-0 text-sm font-medium text-zinc-500">{label}</div>
    <div className={`text-sm font-bold ${isBold ? 'text-lg font-black tracking-tight' : 'text-zinc-700 dark:text-zinc-300'}`}>
       {value}
    </div>
  </div>
);

const NoteItem = ({ text }) => (
  <li className="flex items-start gap-3">
     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
     <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">{text}</p>
  </li>
);

export default MeetingsTab;
