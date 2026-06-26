import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import { Routes, Route, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Users, Shield, TrendingUp, Mail, Plus, X, MoreHorizontal, Search, Loader2 } from 'lucide-react';

const AdminDashboard = () => {
  return (
    <DashboardLayout isAdmin={true}>
      <Routes>
        <Route path="/*" element={<AdminOverview />} />
      </Routes>
    </DashboardLayout>
  );
};

const AdminOverview = () => {
  const { workspaceId } = useParams();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newUser, setNewUser] = useState({ name: '', emailPrefix: '', password: '', mobile: '', personalEmail: '', role: 'Member' });
  const [adding, setAdding] = useState(false);

  const [activeDomain, setActiveDomain] = useState((workspaceId === 'forge-india-connect') ? 'FIC.hq.com' : `${workspaceId}.com`);
  // API Base URL - Managed by global config

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/members/${workspaceId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setUsers(data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [workspaceId]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/members/add'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          name: newUser.name,
          email: `${newUser.emailPrefix}@${activeDomain}`,
          password: newUser.password,
          role: newUser.role,
          mobile: newUser.mobile,
          personalEmail: newUser.personalEmail
        })
      });

      if (response.ok) {
        setIsModalOpen(false);
        setNewUser({ name: '', emailPrefix: '', password: '', mobile: '', personalEmail: '', role: 'Member' });
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setAdding(false);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Members', value: users.length, icon: Users, color: 'var(--accent)' },
    { label: 'Active Users', value: users.filter(u => u.status === 'Active').length, icon: TrendingUp, color: '#10B981' },
    { label: 'Workspace Domain', value: activeDomain, icon: Mail, color: '#8B5CF6', small: true },
    { label: 'Access Role', value: 'Admin', icon: Shield, color: '#F59E0B' },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Admin Hub</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>Manage members and workspace settings for <span className="font-medium" style={{ color: 'var(--text)' }}>{activeDomain}</span></p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={16} /> Add member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, small }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                <Icon size={18} strokeWidth={1.75} />
              </div>
            </div>
            <p className={`font-bold ${small ? 'text-sm' : 'text-2xl'} truncate`}>{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Members Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold">Members</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="input pl-8"
                style={{ width: '220px', padding: '7px 14px 7px 32px', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Role', 'Status', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-xs font-medium">Loading members...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-12 text-center text-sm" style={{ color: 'var(--text-3)' }}>No members found.</td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user._id} className="border-b transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
                        {user.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="status status-blue">{user.role}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: user.status === 'Active' ? 'var(--success)' : 'var(--text-3)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{user.status}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-3)' }}>{new Date(user.joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="btn btn-ghost btn-icon btn-sm">
                      <MoreHorizontal size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border shadow-2xl animate-up overflow-y-auto max-h-[90vh]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <h2 className="font-semibold">Add new member</h2>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="input" placeholder="John Doe" required />
              </div>
              <div>
                <label className="label">Workspace Email</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={newUser.emailPrefix} onChange={e => setNewUser({...newUser, emailPrefix: e.target.value.toLowerCase().replace(/\s/g, '.')})} className="input flex-1" placeholder="john.doe" required />
                  <span className="text-sm shrink-0 font-medium" style={{ color: 'var(--text-3)' }}>@{activeDomain}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Password</label>
                  <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="input" placeholder="••••••••" required />
                </div>
                <div>
                  <label className="label">Mobile</label>
                  <input type="tel" value={newUser.mobile} onChange={e => setNewUser({...newUser, mobile: e.target.value})} className="input" placeholder="+91 98765" required />
                </div>
              </div>
              <div>
                <label className="label">Personal Email</label>
                <input type="email" value={newUser.personalEmail} onChange={e => setNewUser({...newUser, personalEmail: e.target.value})} className="input" placeholder="john@gmail.com" required />
              </div>
              <div>
                <label className="label">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="input">
                  <option>Member</option>
                  <option>Admin</option>
                  <option>Developer</option>
                  <option>Designer</option>
                  <option>Manager</option>
                </select>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={adding} className="btn btn-primary flex-1">
                  {adding ? 'Adding...' : 'Add member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
