import React from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Mail, Video, CheckSquare, ArrowRight, TrendingUp, Users, Zap, MessageSquare, Clock } from 'lucide-react';

const UserDashboard = () => {
  const { workspaceId } = useParams();

  const stats = [
    { label: 'Unread Messages', value: '0', trend: '---', icon: Mail, color: 'var(--accent)' },
    { label: 'Active Meetings', value: '0', trend: '---', icon: Video, color: '#8B5CF6' },
    { label: 'Open Tasks', value: '0', trend: '---', icon: CheckSquare, color: '#F59E0B' },
    { label: 'Team Members', value: '1', trend: '---', icon: Users, color: '#10B981' },
  ];

  const activity = [];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Good morning ☀️</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            Here's what's happening in <span className="font-medium" style={{ color: 'var(--text)' }}>{workspaceId?.replace('-', ' ')}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link to={`/w/${workspaceId}/mail`} className="btn btn-secondary btn-sm">Open Mail</Link>
          <Link to={`/w/${workspaceId}/meet`} className="btn btn-primary btn-sm">New Meeting</Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, trend, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{trend}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">Activity Feed</h2>
            <button className="btn btn-ghost btn-sm text-xs" style={{ color: 'var(--accent)' }}>View all</button>
          </div>
          <div className="space-y-4">
            {activity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>
                  {item.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{item.user}</span>
                    <span className="ml-1" style={{ color: 'var(--text-2)' }}>{item.action}</span>
                  </p>
                  <p className="text-xs mt-0.5 truncate-1" style={{ color: 'var(--text-3)' }}>"{item.subject}"</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-3)' }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions + Schedule */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link to={`/w/${workspaceId}/mail`} className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all hover:border-[var(--accent)]" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <Mail size={15} style={{ color: 'var(--accent)' }} />
                  <span className="font-medium">New Email</span>
                </div>
                <ArrowRight size={13} style={{ color: 'var(--text-3)' }} />
              </Link>
              <Link to={`/w/${workspaceId}/meet`} className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all hover:border-[var(--accent)]" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <Video size={15} style={{ color: '#8B5CF6' }} />
                  <span className="font-medium">Start Meeting</span>
                </div>
                <ArrowRight size={13} style={{ color: 'var(--text-3)' }} />
              </Link>
              <Link to={`/w/${workspaceId}/tasks`} className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all hover:border-[var(--accent)]" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <CheckSquare size={15} style={{ color: '#F59E0B' }} />
                  <span className="font-medium">Create Task</span>
                </div>
                <ArrowRight size={13} style={{ color: 'var(--text-3)' }} />
              </Link>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-4">Today's Schedule</h2>
            <div className="space-y-3">
              <ScheduleItem time="14:00" title="Design Sync" members="Sarah, Mark" />
              <ScheduleItem time="16:30" title="Client Review" members="Alex, You" />
              <ScheduleItem time="18:00" title="Sprint Planning" members="All team" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const ScheduleItem = ({ time, title, members }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
    <div className="flex flex-col items-center text-center w-10 shrink-0">
      <Clock size={12} style={{ color: 'var(--text-3)' }} />
      <span className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--text-2)' }}>{time}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold truncate">{title}</p>
      <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{members}</p>
    </div>
    <button className="btn btn-primary btn-sm text-[10px] px-2 py-1">Join</button>
  </div>
);

export default UserDashboard;
