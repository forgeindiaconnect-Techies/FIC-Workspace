import React, { useState, useEffect } from 'react';
import { Megaphone, Rocket, PenTool, Terminal, FileText, File, Calendar, Video, MessageSquare } from 'lucide-react';
import { getApiUrl } from '../api';

const HomeTab = ({ members = [], workspaceId, onViewAllMembers, onStartChat, meetingUpdateTrigger }) => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const currentUserName = auth.user || auth.name || 'Alex';
  const firstName = currentUserName.split(' ')[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(getApiUrl(`/api/meetings/history`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.meetings) {
          const activeOrScheduled = data.meetings.filter(m => m.status === 'scheduled' || m.status === 'live');
          setMeetings(activeOrScheduled);
        }
      } catch (err) {
        console.error('Failed to fetch meetings:', err);
      }
    };
    fetchMeetings();
  }, [workspaceId, meetingUpdateTrigger]);

  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(getApiUrl(`/api/threads/${workspaceId}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          const threadActivities = data.map(post => ({
            id: post._id,
            type: 'post',
            user: post.authorName || 'Someone',
            userEmail: post.authorEmail,
            avatarUrl: post.authorAvatar,
            content: post.content,
            time: new Date(post.createdAt),
            likes: post.likes?.length || 0,
            comments: post.comments?.length || 0
          }));
          
          // Sort by latest and take top 5
          const sorted = threadActivities.sort((a, b) => b.time - a.time).slice(0, 5);
          setActivities(sorted);
        }
      } catch (err) {
        console.error('Failed to fetch activities:', err);
      } finally {
        setIsLoadingActivities(false);
      }
    };
    if (workspaceId) {
      fetchActivities();
    }
  }, [workspaceId]);

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
  };

  return (
    <div className="flex-grow p-6 flex gap-6 max-w-[1440px] mx-auto w-full overflow-y-auto bg-[#F8F9FF] text-[#0B1C30]">
      {/* Center Column */}
      <div className="flex-grow flex flex-col gap-6 max-w-[900px]">
        {/* Greeting Header */}
        <section className="mb-2">
          <h1 className="text-[36px] font-bold tracking-tight text-[#0B1C30] mb-2">{getGreeting()}, {firstName}</h1>
          <p className="text-[16px] font-normal text-[#45464D]">
            You have <span className="text-[#2170e4] font-bold">0 unread messages</span> and <span className="text-[#2170e4] font-bold">{meetings.length} meetings</span> today.
          </p>
        </section>

        {/* Catch Up (Bento Grid) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[24px] font-semibold tracking-tight text-[#0B1C30]">Catch Up</h2>
            {activities.length > 0 && <button className="text-[#2170e4] text-[13px] font-semibold hover:underline">Mark all as read</button>}
          </div>
          <div className={`bg-white border border-[#C6C6CD] rounded-xl overflow-hidden ${activities.length === 0 ? 'h-[420px] flex flex-col items-center justify-center' : ''}`}>
            {isLoadingActivities ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2170e4] mb-4"></div>
                <p>Loading activity...</p>
              </div>
            ) : activities.length === 0 ? (
              <>
                <MessageSquare size={48} className="text-[#C6C6CD] mb-4" />
                <p className="text-[16px] font-semibold text-[#0B1C30]">You're all caught up!</p>
                <p className="text-[13px] mt-1 text-[#45464D]">No new messages or mentions to review.</p>
              </>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100">
                {activities.map(activity => (
                  <div key={activity.id} className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#2170e4] text-white flex items-center justify-center font-bold shrink-0 overflow-hidden shadow-sm">
                      {activity.avatarUrl ? (
                        <img src={activity.avatarUrl} alt={activity.user} className="w-full h-full object-cover" />
                      ) : (
                        activity.user.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[14px] font-medium text-[#0B1C30]">
                          <span className="font-bold">{activity.user}</span> posted in Threads
                        </p>
                        <span className="text-[12px] text-gray-500 whitespace-nowrap">{formatTimeAgo(activity.time)}</span>
                      </div>
                      <p className="text-[14px] text-[#45464D] line-clamp-2 leading-relaxed mb-2">
                        {activity.content}
                      </p>
                      <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> {activity.likes} Likes</span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> {activity.comments} Comments</span>
                        <span className="ml-auto text-[#2170e4] hover:underline">View Post</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick Access */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[24px] font-semibold tracking-tight text-[#0B1C30]">Your Workspaces</h2>
          </div>
          <div className="bg-white border border-[#C6C6CD] rounded-xl p-8 flex flex-col items-center justify-center text-[#45464D]">
            <p className="text-[14px] font-medium">No workspaces joined yet.</p>
          </div>
        </section>

        {/* Recent Files */}
        <section>
          <h2 className="text-[24px] font-semibold tracking-tight text-[#0B1C30] mb-4">Recent Files</h2>
          <div className="bg-white border border-[#C6C6CD] rounded-xl overflow-hidden p-8 flex flex-col items-center justify-center text-[#45464D]">
            <File className="text-[#C6C6CD] mb-4" size={48} />
            <p className="text-[14px] font-medium">No recent files.</p>
          </div>
        </section>
      </div>

      {/* Right Sidebar Column */}
      <aside className="w-[320px] shrink-0 flex flex-col gap-6 hidden xl:flex">
        {/* Upcoming Schedule */}
        <section className="bg-[#eff4ff] border border-[#C6C6CD] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[20px] font-semibold text-[#0B1C30]">Today's Schedule</h2>
            <Calendar className="text-[#76777D]" size={20} />
          </div>
          <div className="flex flex-col py-2 text-[#45464D]">
            {meetings.length > 0 ? (
              meetings.slice(0, 3).map((meeting, i) => (
                <div key={i} className="flex flex-col mb-4 last:mb-0 border-b border-[#C6C6CD] pb-4 last:border-0 last:pb-0">
                   <span className="text-[14px] font-semibold text-[#0B1C30]">{meeting.title || 'Team Meeting'}</span>
                   <span className="text-[12px] text-gray-500">
                     {new Date(meeting.scheduledAt || meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     {' '}· {meeting.status === 'live' ? <span className="text-red-500 font-bold">Live</span> : 'Scheduled'}
                   </span>
                   <button 
                     onClick={() => window.open(`/w/${workspaceId}/meet/room/${meeting.joinCode}?intent=join`, '_blank')}
                     className="mt-2 text-white bg-[#2170e4] hover:bg-blue-700 text-xs py-1.5 px-3 rounded-md self-start font-medium transition-colors">
                     Join Now
                   </button>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-center w-full my-4">No upcoming meetings today.</p>
            )}
          </div>
        </section>

        {/* Team Status */}
        <section className="bg-[#eff4ff] border border-[#C6C6CD] rounded-xl p-6">
          <h2 className="text-[20px] font-semibold text-[#0B1C30] mb-6">Team Status</h2>
          <div className="flex flex-col gap-4 py-2 text-[#45464D] max-h-[300px] overflow-y-auto">
            {members && members.length > 0 ? (
              members.slice(0, 6).map((member, i) => (
                <div 
                  key={i} 
                  onClick={() => onStartChat && onStartChat(member)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-black/5 p-2 rounded-lg transition-colors -mx-2"
                >
                  <div className="w-8 h-8 rounded-full bg-[#2170e4] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[14px] font-medium text-[#0B1C30] truncate">{member.name || member.email}</span>
                    <span className="text-[12px] text-gray-500 truncate">{member.email}</span>
                  </div>
                  <div className={`ml-auto w-2 h-2 rounded-full shrink-0 ${member.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-center w-full my-4">No team members currently online.</p>
            )}
          </div>
          <button 
            onClick={onViewAllMembers}
            className="w-full mt-6 py-4 border border-[#C6C6CD] rounded-lg text-[13px] font-semibold text-[#45464D] hover:bg-[#dce9ff] transition-colors">
            View All Members
          </button>
        </section>
      </aside>
    </div>
  );
};

export default HomeTab;
