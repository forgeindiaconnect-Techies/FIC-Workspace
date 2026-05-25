import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { Plus, MoreHorizontal, X, Globe, Building2, CreditCard, Zap, Search, Loader2 } from 'lucide-react';

const SuperAdmin = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [newCompany, setNewCompany] = useState({ 
    name: '', workspaceId: '', domain: '', plan: 'Pro', adminEmail: '', password: '' 
  });
  const [deploying, setDeploying] = useState(false);

  // API Base URL - Managed by global config

  const fetchTenants = async () => {
    try {
      const response = await fetch(getApiUrl('/api/tenants'));
      const data = await response.json();
      if (response.ok) setCompanies(data);
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleDeploy = async (e) => {
    e.preventDefault();
    setDeploying(true);
    try {
      const response = await fetch(getApiUrl('/api/auth/register-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchTenants();
      }
    } catch (err) {
      console.error('Failed to deploy tenant:', err);
    } finally {
      setDeploying(false);
    }
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Fleet Monitor</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>Manage all deployed tenant workspaces</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={16} /> Deploy tenant
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tenants" value={companies.length} icon={<Building2 size={18} />} color="var(--accent)" />
        <StatCard label="Total Users" value={companies.reduce((s, c) => s + (c.users || 0), 0)} icon={<Zap size={18} />} color="#10B981" />
        <StatCard label="Monthly Revenue" value={`$${companies.reduce((s, c) => s + (c.mrr || 0), 0).toLocaleString()}`} icon={<CreditCard size={18} />} color="#8B5CF6" />
        <StatCard label="Active Domains" value={companies.filter(c => c.status === 'Active').length} icon={<Globe size={18} />} color="#F59E0B" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold">Deployed Tenants</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants..."
              className="input pl-8"
              style={{ width: '220px', padding: '7px 14px 7px 32px', fontSize: '13px' }}
            />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['Organization', 'Domain', 'Plan', 'Users', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-12 text-center opacity-40"><Loader2 className="animate-spin mx-auto mb-2" /> Loading tenants...</td></tr>
            ) : filtered.map((company) => (
              <tr key={company._id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900/50" style={{ borderColor: 'var(--border)' }}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl text-white text-xs font-bold flex items-center justify-center" style={{ background: 'var(--accent)' }}>{company.name[0]}</div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-[11px] opacity-40">{company.workspaceId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-indigo-500 font-medium">{company.domain}</td>
                <td className="px-5 py-3"><span className="status status-blue">{company.plan}</span></td>
                <td className="px-5 py-3">{company.users || 0}</td>
                <td className="px-5 py-3">
                   <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-xs">{company.status}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right"><MoreHorizontal size={15} className="opacity-40" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border shadow-2xl p-6">
            <h2 className="text-lg font-bold mb-6">Deploy New Tenant</h2>
            <form onSubmit={handleDeploy} className="space-y-4">
              <div>
                <label className="label">Organization Name</label>
                <input type="text" value={newCompany.name} onChange={e => {
                  const name = e.target.value;
                  const id = name.toLowerCase().replace(/\s+/g, '-');
                  setNewCompany({...newCompany, name, workspaceId: id, domain: `${id}.com`});
                }} className="input" placeholder="Umbrella Corp" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Workspace ID</label>
                  <input type="text" value={newCompany.workspaceId} className="input opacity-60" readOnly />
                </div>
                <div>
                  <label className="label">Admin Email</label>
                  <input type="email" value={newCompany.adminEmail} onChange={e => setNewCompany({...newCompany, adminEmail: e.target.value})} className="input" placeholder="admin@umbrella.com" required />
                </div>
              </div>
              <div>
                <label className="label">Admin Password</label>
                <input type="password" value={newCompany.password} onChange={e => setNewCompany({...newCompany, password: e.target.value})} className="input" placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={deploying} className="btn btn-primary w-full btn-lg mt-4">
                {deploying ? 'Deploying...' : 'Deploy Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

const StatCard = ({ label, value, icon, color }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
    <p className="text-xs mt-1 opacity-60">{label}</p>
  </div>
);

export default SuperAdmin;
