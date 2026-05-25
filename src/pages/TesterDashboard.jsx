import React from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
  ShieldCheck, AlertCircle, CheckCircle2, FlaskConical, 
  ArrowRight, Bug, FileText, Activity, Layers
} from 'lucide-react';

const TesterDashboard = () => {
  const { workspaceId } = useParams();

  const stats = [
    { label: 'Pending Tests', value: '45', trend: 'UP', icon: Layers, color: '#F59E0B' },
    { label: 'Bugs Reported', value: '18', trend: '+4', icon: Bug, color: '#DC2626' },
    { label: 'Pass Rate', value: '94%', trend: '+2%', icon: CheckCircle2, color: '#10B981' },
    { label: 'Test Coverage', value: '82%', trend: 'STABLE', icon: Activity, color: '#3b82f6' },
  ];

  const regressions = [
    { id: 'BUG-402', title: 'Login failing on Safari', severity: 'Critical', module: 'Auth' },
    { id: 'BUG-405', title: 'Table row overlap in Docs', severity: 'High', module: 'Editor' },
    { id: 'BUG-412', title: 'Search debounce delay', severity: 'Medium', module: 'Search' },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Quality Assurance</h1>
          <p className="text-sm text-zinc-500">System health is stable. 4 regression tests need attention.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm flex items-center gap-2">
            <FileText size={16} /> New Test Case
          </button>
          <button className="btn btn-primary btn-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
            <FlaskConical size={16} /> Run Suite
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, trend, icon: Icon, color }) => (
          <div key={label} className="card p-6 border-l-4" style={{ borderLeftColor: color }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
                <Icon size={20} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest text-zinc-400`}>
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
            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-400">Open Regressions</h2>
            <Link to={`/w/${workspaceId}/tasks`} className="text-xs font-bold text-red-500 hover:underline">View All Bugs</Link>
          </div>
          <div className="space-y-4">
            {regressions.map(bug => (
              <div key={bug.id} className="flex items-center justify-between p-4 bg-red-50/30 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 hover:border-red-500 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${bug.severity === 'Critical' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{bug.title}</p>
                    <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{bug.id} • {bug.module} • {bug.severity}</p>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest text-red-500">Re-test</button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Device Matrix</h2>
            <div className="space-y-4">
              <MatrixItem device="Chrome (Mac)" status="Passing" color="#10B981" />
              <MatrixItem device="Safari (iOS)" status="2 Failures" color="#DC2626" />
              <MatrixItem device="Firefox (Win)" status="Passing" color="#10B981" />
              <MatrixItem device="Edge (Win)" status="Passing" color="#10B981" />
            </div>
          </div>

          <div className="card p-6 bg-emerald-900 text-white shadow-xl shadow-emerald-500/10">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} />
              <h2 className="text-xs font-black uppercase tracking-widest opacity-80">QA Certification</h2>
            </div>
            <p className="text-xs opacity-70 leading-relaxed mb-4">
              V2.4.0 is ready for deployment. All critical and high severity bugs have been resolved.
            </p>
            <button className="w-full btn btn-sm bg-white text-emerald-900 font-black text-[10px] uppercase tracking-widest">
              Sign Off Release
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const MatrixItem = ({ device, status, color }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium">{device}</span>
    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{status}</span>
  </div>
);

export default TesterDashboard;
