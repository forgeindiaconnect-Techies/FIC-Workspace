import React from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
  BarChart3, Users, Calendar, TrendingUp, 
  ArrowRight, PieChart, Target, DollarSign, Briefcase
} from 'lucide-react';

const ManagerDashboard = () => {
  const { workspaceId } = useParams();

  const stats = [
    { label: 'Project Budget', value: '$84,200', trend: '82% USED', icon: DollarSign, color: '#059669' },
    { label: 'Team Capacity', value: '92%', trend: '+4%', icon: Users, color: '#7C3AED' },
    { label: 'Completion', value: '68%', trend: 'ON TRACK', icon: Target, color: '#3b82f6' },
    { label: 'Active Sprints', value: '3', trend: 'ACTIVE', icon: Briefcase, color: '#F59E0B' },
  ];

  const team = [
    { name: 'Sarah Chen', role: 'Dev Lead', status: 'In Meeting', load: '85%' },
    { name: 'Mark Wilson', role: 'Developer', status: 'Coding', load: '95%' },
    { name: 'Alex Rivera', role: 'Tester', status: 'Testing', load: '60%' },
  ].filter(u => u.name !== (JSON.parse(localStorage.getItem('auth') || '{}').user || ''));

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Project Oversight</h1>
          <p className="text-sm text-zinc-500">Q2 Milestone is 68% complete. Sprint 12 ends in 3 days.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm flex items-center gap-2">
            <Calendar size={16} /> Timeline
          </button>
          <button className="btn btn-primary btn-sm flex items-center gap-2 shadow-lg shadow-blue-500/20">
            <PieChart size={16} /> Reports
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, trend, icon: Icon, color }) => (
          <div key={label} className="card p-6 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: color, color: 'white' }}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">{label}</p>
                <p className="text-xl font-black">{value}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-800">
              <span className="text-[10px] font-black text-zinc-400">TREND</span>
              <span className="text-[10px] font-black" style={{ color }}>{trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400">Team Utilization</h2>
            <button className="text-xs font-bold text-blue-500 hover:underline">Manage Team</button>
          </div>
          <div className="space-y-4">
            {team.map(member => (
              <div key={member.name} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl transition-all hover:scale-[1.01]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-black text-xs">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{member.name}</p>
                    <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{member.role} • {member.status}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${parseInt(member.load) > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                      style={{ width: member.load }}
                    />
                  </div>
                  <span className="text-[10px] font-black mt-1 uppercase text-zinc-400">Load: {member.load}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-transparent flex flex-col items-center justify-center text-center py-10">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest mb-1">Weekly Velocity</h3>
            <p className="text-xs text-zinc-500 mb-4 px-6">Your team's velocity increased by 12% this week.</p>
            <button className="btn btn-primary btn-sm w-full">View Analytics</button>
          </div>

          <div className="card p-6 bg-zinc-900 text-white">
            <h2 className="text-xs font-black uppercase tracking-widest opacity-60 mb-6">Upcoming Milestones</h2>
            <div className="space-y-6 relative before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-white/10">
              <Milestone date="MAY 04" title="V2 Beta Launch" active />
              <Milestone date="MAY 15" title="User Onboarding" />
              <Milestone date="JUN 02" title="Market Release" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const Milestone = ({ date, title, active }) => (
  <div className="flex gap-4 relative">
    <div className={`w-4 h-4 rounded-full border-4 border-zinc-900 z-10 shrink-0 ${active ? 'bg-blue-500' : 'bg-zinc-700'}`} />
    <div>
      <p className="text-[9px] font-black text-blue-400 tracking-tighter">{date}</p>
      <p className="text-xs font-bold">{title}</p>
    </div>
  </div>
);

export default ManagerDashboard;
