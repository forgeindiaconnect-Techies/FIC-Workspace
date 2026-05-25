import React from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Code2, GitBranch, Bug, Terminal, ArrowRight, 
  GitPullRequest, CheckCircle2, Clock, Play
} from 'lucide-react';

const DeveloperDashboard = () => {
  const { workspaceId } = useParams();

  const stats = [
    { label: 'Active Tasks', value: '12', trend: '+2', icon: CheckCircle2, color: '#2563EB' },
    { label: 'Pending PRs', value: '4', trend: '-1', icon: GitPullRequest, color: '#7C3AED' },
    { label: 'Assigned Bugs', value: '7', trend: '+3', icon: Bug, color: '#DC2626' },
    { label: 'Build Status', value: 'Success', trend: 'STABLE', icon: Terminal, color: '#10B981' },
  ];

  const tasks = [
    { id: 'NEX-101', title: 'Implement Auth Flow', priority: 'High', status: 'In Progress' },
    { id: 'NEX-104', title: 'Fix Header Alignment', priority: 'Medium', status: 'In Review' },
    { id: 'NEX-109', title: 'API Integration for Stats', priority: 'High', status: 'To Do' },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Developer Console</h1>
          <p className="text-sm text-zinc-500">Welcome back! You have 3 high priority tasks for today.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm flex items-center gap-2">
            <GitBranch size={16} /> New Branch
          </button>
          <button className="btn btn-primary btn-sm flex items-center gap-2 shadow-lg shadow-blue-500/20">
            <Play size={16} /> Start Sprint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, trend, icon: Icon, color }) => (
          <div key={label} className="card p-6 border-b-4" style={{ borderBottomColor: color }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
                <Icon size={20} />
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-100 text-green-600' : trend === 'STABLE' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                {trend}
              </span>
            </div>
            <p className="text-3xl font-black">{value}</p>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400">My Sprint Tasks</h2>
            <Link to={`/w/${workspaceId}/tasks`} className="text-xs font-bold text-blue-500 hover:underline">View Kanban</Link>
          </div>
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${task.priority === 'High' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-sm font-bold">{task.title}</p>
                    <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{task.id} • {task.status}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-zinc-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 bg-zinc-900 text-white">
            <h2 className="text-xs font-black uppercase tracking-widest opacity-60 mb-4">Environment Status</h2>
            <div className="space-y-4">
              <EnvItem label="Production" status="Healthy" color="#10B981" />
              <EnvItem label="Staging" status="Deploying..." color="#3b82f6" />
              <EnvItem label="Dev-API" status="Healthy" color="#10B981" />
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Recent Commits</h2>
            <div className="space-y-4">
              <CommitItem user="Dhanush" msg="fix: header mobile layout" time="2m ago" />
              <CommitItem user="Sarah" msg="feat: added docs ribbon" time="15m ago" />
              <CommitItem user="Mark" msg="docs: updated api spec" time="1h ago" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const EnvItem = ({ label, status, color }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium opacity-80">{label}</span>
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{status}</span>
    </div>
  </div>
);

const CommitItem = ({ user, msg, time }) => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
      {user[0]}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold truncate">{msg}</p>
      <p className="text-[9px] text-zinc-400 uppercase font-black mt-0.5">{user} • {time}</p>
    </div>
  </div>
);

export default DeveloperDashboard;
