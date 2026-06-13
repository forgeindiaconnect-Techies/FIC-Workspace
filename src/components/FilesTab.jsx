import React, { useState, useEffect, useRef } from 'react';
import {
  FolderGit2, GitBranch, Globe, FileText, Workflow, KeyRound, Plus, X, Search,
  ExternalLink, Trash2, ChevronRight, ArrowLeft, MoreHorizontal, Copy, Eye, EyeOff,
  Check, Loader2, Tag, Clock, User, AlertCircle, Rocket, BookOpen, Settings2, Archive
} from 'lucide-react';
import { getApiUrl } from '../api';

const ICONS = ['📁','🚀','💻','🎨','🔧','📊','🎯','⚡','🌐','📱','🛡️','🧪','📦','🤖','💡','🔑'];
const COLORS = ['#2170E4','#6C5CE7','#00B894','#E17055','#FDCB6E','#0984E3','#D63031','#6D6D6D','#00CEC9','#E84393'];
const STATUS_BADGES = {
  active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  on_hold: { label: 'On Hold', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  archived: { label: 'Archived', bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
};
const ENV_BADGES = {
  production: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  staging: { bg: 'bg-amber-100', text: 'text-amber-800' },
  development: { bg: 'bg-sky-100', text: 'text-sky-800' },
  preview: { bg: 'bg-violet-100', text: 'text-violet-800' },
  shared: { bg: 'bg-gray-100', text: 'text-gray-700' },
};
const GIT_PROVIDERS = {
  github: { label: 'GitHub', color: '#24292E' },
  gitlab: { label: 'GitLab', color: '#FC6D26' },
  bitbucket: { label: 'Bitbucket', color: '#0052CC' },
  other: { label: 'Other', color: '#6B7280' },
};

// ─── Modal Component ───
const Modal = ({ isOpen, onClose, title, children, width = 'max-w-lg' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-gray-100 w-full ${width} mx-4 max-h-[85vh] flex flex-col animate-in`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-[17px] font-bold text-[#0B1C30]">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// ─── Inline Input Group ───
const InputGroup = ({ label, value, onChange, placeholder, type = 'text', required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[13px] font-semibold text-gray-600">{label} {required && <span className="text-red-400">*</span>}</label>
    {children || <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#2170E4] focus:ring-2 focus:ring-[#2170E4]/10 transition-all" />}
  </div>
);

// ─── Select Component ───
const SelectGroup = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[13px] font-semibold text-gray-600">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#2170E4] bg-white">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const FilesTab = ({ workspaceId, currentUserEmail, currentUserName }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailProject, setDetailProject] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(null); // 'gitRepos' | 'deployments' | ...
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState(null);
  const [revealedCreds, setRevealedCreds] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openStatusMenu, setOpenStatusMenu] = useState(null);

  // Create project form
  const [newProject, setNewProject] = useState({ name: '', description: '', icon: '📁', color: '#2170E4', tags: '' });

  // Sub-resource forms
  const [newGitRepo, setNewGitRepo] = useState({ name: '', url: '', branch: 'main', provider: 'github' });
  const [newDeployment, setNewDeployment] = useState({ name: '', url: '', environment: 'production', provider: '' });
  const [newDoc, setNewDoc] = useState({ title: '', url: '', type: 'link' });
  const [newWorkflow, setNewWorkflow] = useState({ name: '', description: '', steps: '' });
  const [newCredential, setNewCredential] = useState({ label: '', username: '', value: '', environment: 'shared', notes: '' });

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { if (workspaceId) fetchProjects(); }, [workspaceId]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/projects/${workspaceId}?status=${statusFilter}`), { headers });
      if (res.ok) setProjects(await res.json());
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally { setIsLoading(false); }
  };

  const fetchProjectDetail = async (id) => {
    try {
      const res = await fetch(getApiUrl(`/api/projects/${workspaceId}/${id}`), { headers });
      if (res.ok) { const data = await res.json(); setDetailProject(data); setSelectedProject(data); }
    } catch (err) { console.error('Failed to fetch project detail:', err); }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/projects/create'), {
        method: 'POST', headers,
        body: JSON.stringify({ workspaceId, ...newProject, tags: newProject.tags ? newProject.tags.split(',').map(t => t.trim()).filter(Boolean) : [] })
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewProject({ name: '', description: '', icon: '📁', color: '#2170E4', tags: '' });
        fetchProjects();
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteProject = async (id) => {
    if (!confirm('Delete this project and all its resources?')) return;
    try {
      await fetch(getApiUrl(`/api/projects/${id}`), { method: 'DELETE', headers });
      setSelectedProject(null);
      setDetailProject(null);
      fetchProjects();
    } catch (err) { console.error(err); }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await fetch(getApiUrl(`/api/projects/${id}`), { method: 'PUT', headers, body: JSON.stringify({ status }) });
      if (detailProject && detailProject._id === id) fetchProjectDetail(id);
      fetchProjects();
      setOpenStatusMenu(null);
    } catch (err) { console.error(err); }
  };

  const handleAddSubResource = async (resource) => {
    setIsSubmitting(true);
    let body;
    switch (resource) {
      case 'gitRepos': body = newGitRepo; break;
      case 'deployments': body = newDeployment; break;
      case 'documentation': body = newDoc; break;
      case 'workflows': body = { ...newWorkflow, steps: newWorkflow.steps ? newWorkflow.steps.split('\n').filter(Boolean) : [] }; break;
      case 'credentials': body = newCredential; break;
      default: return;
    }
    try {
      const res = await fetch(getApiUrl(`/api/projects/${detailProject._id}/${resource}`), { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) {
        setShowAddModal(null);
        resetSubForms();
        fetchProjectDetail(detailProject._id);
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleRemoveSubResource = async (resource, itemId) => {
    if (!confirm('Remove this item?')) return;
    try {
      await fetch(getApiUrl(`/api/projects/${detailProject._id}/${resource}/${itemId}`), { method: 'DELETE', headers });
      fetchProjectDetail(detailProject._id);
    } catch (err) { console.error(err); }
  };

  const resetSubForms = () => {
    setNewGitRepo({ name: '', url: '', branch: 'main', provider: 'github' });
    setNewDeployment({ name: '', url: '', environment: 'production', provider: '' });
    setNewDoc({ title: '', url: '', type: 'link' });
    setNewWorkflow({ name: '', description: '', steps: '' });
    setNewCredential({ label: '', username: '', value: '', environment: 'shared', notes: '' });
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => { fetchProjects(); }, [statusFilter]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ─── PROJECT DETAIL VIEW ───
  if (detailProject) {
    const tabs = [
      { id: 'overview', label: 'Overview', icon: FolderGit2 },
      { id: 'gitRepos', label: 'Git Repos', icon: GitBranch, count: detailProject.gitRepos?.length },
      { id: 'deployments', label: 'Deployments', icon: Rocket, count: detailProject.deployments?.length },
      { id: 'documentation', label: 'Docs', icon: BookOpen, count: detailProject.documentation?.length },
      { id: 'workflows', label: 'Workflows', icon: Workflow, count: detailProject.workflows?.length },
      { id: 'credentials', label: 'Credentials', icon: KeyRound, count: detailProject.credentials?.length },
    ];

    return (
      <div className="flex-1 bg-[#F5F7FB] flex flex-col overflow-y-auto custom-scrollbar">
        {/* Detail Header */}
        <div className="bg-white border-b border-gray-200 px-8 pt-6 pb-0 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => { setDetailProject(null); setSelectedProject(null); setActiveDetailTab('overview'); }} className="text-gray-400 hover:text-[#0B1C30] p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[22px] shadow-sm" style={{ background: `${detailProject.color}15` }}>
              {detailProject.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[20px] font-bold text-[#0B1C30] truncate">{detailProject.name}</h2>
              <p className="text-[13px] text-gray-500 truncate">{detailProject.description || 'No description'}</p>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(STATUS_BADGES).map(([key, val]) => (
                <button key={key} onClick={() => handleUpdateStatus(detailProject._id, key)}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all ${detailProject.status === key ? `${val.bg} ${val.text} ring-2 ring-offset-1 ring-current/20` : 'text-gray-400 hover:bg-gray-50'}`}>
                  {val.label}
                </button>
              ))}
              <button onClick={() => handleDeleteProject(detailProject._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveDetailTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold border-b-[3px] transition-all ${
                  activeDetailTab === tab.id
                    ? 'text-[#2170E4] border-[#2170E4] bg-[#F0F4FF]'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                } rounded-t-lg`}>
                <tab.icon size={16} />
                {tab.label}
                {tab.count > 0 && <span className="ml-1 bg-gray-200 text-gray-600 text-[11px] font-bold px-1.5 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 px-8 py-6">
          {activeDetailTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                { key: 'gitRepos', icon: GitBranch, label: 'Git Repositories', color: '#24292E', items: detailProject.gitRepos },
                { key: 'deployments', icon: Rocket, label: 'Deployments', color: '#00B894', items: detailProject.deployments },
                { key: 'documentation', icon: BookOpen, label: 'Documentation', color: '#6C5CE7', items: detailProject.documentation },
                { key: 'workflows', icon: Workflow, label: 'Workflows', color: '#E17055', items: detailProject.workflows },
                { key: 'credentials', icon: KeyRound, label: 'Credentials', color: '#0984E3', items: detailProject.credentials },
              ].map(section => (
                <button key={section.key} onClick={() => setActiveDetailTab(section.key)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 text-left hover:shadow-lg hover:border-gray-200 transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${section.color}15`, color: section.color }}>
                      <section.icon size={20} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-[#0B1C30]">{section.label}</h4>
                      <p className="text-[13px] text-gray-400">{section.items?.length || 0} items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-[#2170E4] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    View all <ChevronRight size={14} />
                  </div>
                </button>
              ))}
              {/* Project Info Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h4 className="text-[14px] font-bold text-gray-500 mb-3 flex items-center gap-2"><Settings2 size={16} /> Project Info</h4>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-gray-400">Created by</span><span className="font-medium text-[#0B1C30]">{detailProject.createdByName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Created</span><span className="font-medium text-[#0B1C30]">{formatDate(detailProject.createdAt)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Last updated</span><span className="font-medium text-[#0B1C30]">{formatDate(detailProject.updatedAt)}</span></div>
                  {detailProject.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {detailProject.tags.map(t => <span key={t} className="bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 py-1 rounded-full">#{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Git Repos Tab */}
          {activeDetailTab === 'gitRepos' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-bold text-[#0B1C30]">Git Repositories</h3>
                <button onClick={() => setShowAddModal('gitRepos')} className="bg-[#2170E4] hover:bg-[#1A5BB8] text-white px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Add Repository
                </button>
              </div>
              {detailProject.gitRepos?.length === 0 ? (
                <EmptyState icon={GitBranch} label="No repositories added yet" />
              ) : (
                <div className="space-y-3">
                  {detailProject.gitRepos.map(repo => (
                    <div key={repo._id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-all group">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-[14px]" style={{ background: GIT_PROVIDERS[repo.provider]?.color || '#6B7280' }}>
                        <GitBranch size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-bold text-[#0B1C30] truncate">{repo.name}</h4>
                        <div className="flex items-center gap-3 text-[12px] text-gray-400 mt-0.5">
                          <span className="font-semibold" style={{ color: GIT_PROVIDERS[repo.provider]?.color }}>{GIT_PROVIDERS[repo.provider]?.label}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><GitBranch size={12} /> {repo.branch}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => copyToClipboard(repo.url, repo._id)} className="p-2 text-gray-400 hover:text-[#2170E4] hover:bg-blue-50 rounded-lg transition-colors">
                          {copied === repo._id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                        <a href={repo.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-[#2170E4] hover:bg-blue-50 rounded-lg transition-colors">
                          <ExternalLink size={16} />
                        </a>
                        <button onClick={() => handleRemoveSubResource('gitRepos', repo._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deployments Tab */}
          {activeDetailTab === 'deployments' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-bold text-[#0B1C30]">Deployment Links</h3>
                <button onClick={() => setShowAddModal('deployments')} className="bg-[#00B894] hover:bg-[#00A884] text-white px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Add Deployment
                </button>
              </div>
              {detailProject.deployments?.length === 0 ? (
                <EmptyState icon={Rocket} label="No deployments added yet" />
              ) : (
                <div className="space-y-3">
                  {detailProject.deployments.map(dep => {
                    const env = ENV_BADGES[dep.environment] || ENV_BADGES.shared;
                    return (
                      <div key={dep._id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-all group">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Globe size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[15px] font-bold text-[#0B1C30] truncate">{dep.name}</h4>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${env.bg} ${env.text}`}>{dep.environment}</span>
                          </div>
                          <p className="text-[13px] text-gray-400 truncate mt-0.5">{dep.url}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={dep.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><ExternalLink size={16} /></a>
                          <button onClick={() => handleRemoveSubResource('deployments', dep._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Documentation Tab */}
          {activeDetailTab === 'documentation' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-bold text-[#0B1C30]">Documentation</h3>
                <button onClick={() => setShowAddModal('documentation')} className="bg-[#6C5CE7] hover:bg-[#5A4BD1] text-white px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Add Documentation
                </button>
              </div>
              {detailProject.documentation?.length === 0 ? (
                <EmptyState icon={BookOpen} label="No documentation added yet" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detailProject.documentation.map(doc => (
                    <div key={doc._id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all group">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[15px] font-bold text-[#0B1C30] truncate">{doc.title}</h4>
                          <span className="text-[12px] text-gray-400 capitalize">{doc.type}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><ExternalLink size={14} /></a>}
                          <button onClick={() => handleRemoveSubResource('documentation', doc._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Workflows Tab */}
          {activeDetailTab === 'workflows' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-bold text-[#0B1C30]">Workflows</h3>
                <button onClick={() => setShowAddModal('workflows')} className="bg-[#E17055] hover:bg-[#D15E44] text-white px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Add Workflow
                </button>
              </div>
              {detailProject.workflows?.length === 0 ? (
                <EmptyState icon={Workflow} label="No workflows added yet" />
              ) : (
                <div className="space-y-3">
                  {detailProject.workflows.map(wf => (
                    <div key={wf._id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><Workflow size={18} /></div>
                          <div>
                            <h4 className="text-[15px] font-bold text-[#0B1C30]">{wf.name}</h4>
                            {wf.description && <p className="text-[13px] text-gray-400 mt-0.5">{wf.description}</p>}
                          </div>
                        </div>
                        <button onClick={() => handleRemoveSubResource('workflows', wf._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      </div>
                      {wf.steps?.length > 0 && (
                        <div className="ml-[52px] space-y-1.5">
                          {wf.steps.map((step, i) => (
                            <div key={i} className="flex items-center gap-3 text-[13px]">
                              <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-[11px] shrink-0">{i + 1}</div>
                              <span className="text-gray-600">{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Credentials Tab */}
          {activeDetailTab === 'credentials' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-bold text-[#0B1C30]">Credentials & Secrets</h3>
                <button onClick={() => setShowAddModal('credentials')} className="bg-[#0984E3] hover:bg-[#0873C7] text-white px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Add Credential
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-center gap-3 text-[13px] text-amber-700">
                <AlertCircle size={18} className="shrink-0" />
                <span>Credentials are stored securely. Only workspace members can view them.</span>
              </div>
              {detailProject.credentials?.length === 0 ? (
                <EmptyState icon={KeyRound} label="No credentials stored yet" />
              ) : (
                <div className="space-y-3">
                  {detailProject.credentials.map(cred => {
                    const env = ENV_BADGES[cred.environment] || ENV_BADGES.shared;
                    const isRevealed = revealedCreds[cred._id];
                    return (
                      <div key={cred._id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0"><KeyRound size={20} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-[15px] font-bold text-[#0B1C30]">{cred.label}</h4>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${env.bg} ${env.text}`}>{cred.environment}</span>
                            </div>
                            {cred.username && <p className="text-[13px] text-gray-500 mb-1">Username: <span className="font-mono font-semibold text-[#0B1C30]">{cred.username}</span></p>}
                            <div className="flex items-center gap-2 mt-2 bg-gray-50 rounded-lg px-3 py-2">
                              <code className="text-[13px] font-mono flex-1 truncate text-gray-600">{isRevealed ? cred.value : '•'.repeat(20)}</code>
                              <button onClick={() => setRevealedCreds(prev => ({ ...prev, [cred._id]: !prev[cred._id] }))} className="p-1 text-gray-400 hover:text-[#0B1C30] rounded transition-colors">
                                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button onClick={() => copyToClipboard(cred.value, cred._id)} className="p-1 text-gray-400 hover:text-[#2170E4] rounded transition-colors">
                                {copied === cred._id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                            {cred.notes && <p className="text-[12px] text-gray-400 mt-2 italic">{cred.notes}</p>}
                          </div>
                          <button onClick={() => handleRemoveSubResource('credentials', cred._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Sub-Resource Modals */}
        <Modal isOpen={showAddModal === 'gitRepos'} onClose={() => setShowAddModal(null)} title="Add Git Repository">
          <div className="space-y-4">
            <InputGroup label="Repository Name" value={newGitRepo.name} onChange={v => setNewGitRepo(p => ({ ...p, name: v }))} placeholder="e.g. frontend-app" required />
            <InputGroup label="Repository URL" value={newGitRepo.url} onChange={v => setNewGitRepo(p => ({ ...p, url: v }))} placeholder="https://github.com/org/repo" required />
            <div className="grid grid-cols-2 gap-4">
              <SelectGroup label="Provider" value={newGitRepo.provider} onChange={v => setNewGitRepo(p => ({ ...p, provider: v }))} options={Object.entries(GIT_PROVIDERS).map(([k, v]) => ({ value: k, label: v.label }))} />
              <InputGroup label="Branch" value={newGitRepo.branch} onChange={v => setNewGitRepo(p => ({ ...p, branch: v }))} placeholder="main" />
            </div>
            <button onClick={() => handleAddSubResource('gitRepos')} disabled={!newGitRepo.name || !newGitRepo.url || isSubmitting} className="w-full bg-[#24292E] hover:bg-[#1B1F23] disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><GitBranch size={18} /> Add Repository</>}
            </button>
          </div>
        </Modal>

        <Modal isOpen={showAddModal === 'deployments'} onClose={() => setShowAddModal(null)} title="Add Deployment Link">
          <div className="space-y-4">
            <InputGroup label="Deployment Name" value={newDeployment.name} onChange={v => setNewDeployment(p => ({ ...p, name: v }))} placeholder="e.g. Production App" required />
            <InputGroup label="URL" value={newDeployment.url} onChange={v => setNewDeployment(p => ({ ...p, url: v }))} placeholder="https://app.example.com" required />
            <div className="grid grid-cols-2 gap-4">
              <SelectGroup label="Environment" value={newDeployment.environment} onChange={v => setNewDeployment(p => ({ ...p, environment: v }))} options={[{ value: 'production', label: 'Production' }, { value: 'staging', label: 'Staging' }, { value: 'development', label: 'Development' }, { value: 'preview', label: 'Preview' }]} />
              <InputGroup label="Provider" value={newDeployment.provider} onChange={v => setNewDeployment(p => ({ ...p, provider: v }))} placeholder="Vercel, AWS, etc." />
            </div>
            <button onClick={() => handleAddSubResource('deployments')} disabled={!newDeployment.name || !newDeployment.url || isSubmitting} className="w-full bg-[#00B894] hover:bg-[#00A884] disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Rocket size={18} /> Add Deployment</>}
            </button>
          </div>
        </Modal>

        <Modal isOpen={showAddModal === 'documentation'} onClose={() => setShowAddModal(null)} title="Add Documentation">
          <div className="space-y-4">
            <InputGroup label="Title" value={newDoc.title} onChange={v => setNewDoc(p => ({ ...p, title: v }))} placeholder="e.g. API Documentation" required />
            <InputGroup label="URL" value={newDoc.url} onChange={v => setNewDoc(p => ({ ...p, url: v }))} placeholder="https://docs.example.com" />
            <SelectGroup label="Type" value={newDoc.type} onChange={v => setNewDoc(p => ({ ...p, type: v }))} options={[{ value: 'link', label: 'External Link' }, { value: 'markdown', label: 'Markdown' }, { value: 'file', label: 'Uploaded File' }]} />
            <button onClick={() => handleAddSubResource('documentation')} disabled={!newDoc.title || isSubmitting} className="w-full bg-[#6C5CE7] hover:bg-[#5A4BD1] disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><BookOpen size={18} /> Add Documentation</>}
            </button>
          </div>
        </Modal>

        <Modal isOpen={showAddModal === 'workflows'} onClose={() => setShowAddModal(null)} title="Add Workflow">
          <div className="space-y-4">
            <InputGroup label="Workflow Name" value={newWorkflow.name} onChange={v => setNewWorkflow(p => ({ ...p, name: v }))} placeholder="e.g. Deploy to Production" required />
            <InputGroup label="Description" value={newWorkflow.description} onChange={v => setNewWorkflow(p => ({ ...p, description: v }))} placeholder="Brief description" />
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-gray-600">Steps (one per line)</label>
              <textarea value={newWorkflow.steps} onChange={e => setNewWorkflow(p => ({ ...p, steps: e.target.value }))} placeholder={"Pull latest changes\nRun tests\nBuild production\nDeploy to server"} rows={5} className="border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#E17055] focus:ring-2 focus:ring-[#E17055]/10 resize-none transition-all" />
            </div>
            <button onClick={() => handleAddSubResource('workflows')} disabled={!newWorkflow.name || isSubmitting} className="w-full bg-[#E17055] hover:bg-[#D15E44] disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Workflow size={18} /> Add Workflow</>}
            </button>
          </div>
        </Modal>

        <Modal isOpen={showAddModal === 'credentials'} onClose={() => setShowAddModal(null)} title="Add Credential">
          <div className="space-y-4">
            <InputGroup label="Label" value={newCredential.label} onChange={v => setNewCredential(p => ({ ...p, label: v }))} placeholder="e.g. Database Password" required />
            <InputGroup label="Username (optional)" value={newCredential.username} onChange={v => setNewCredential(p => ({ ...p, username: v }))} placeholder="admin" />
            <InputGroup label="Value / Secret" value={newCredential.value} onChange={v => setNewCredential(p => ({ ...p, value: v }))} placeholder="Enter secret value" required type="password" />
            <div className="grid grid-cols-2 gap-4">
              <SelectGroup label="Environment" value={newCredential.environment} onChange={v => setNewCredential(p => ({ ...p, environment: v }))} options={[{ value: 'production', label: 'Production' }, { value: 'staging', label: 'Staging' }, { value: 'development', label: 'Development' }, { value: 'shared', label: 'Shared' }]} />
            </div>
            <InputGroup label="Notes (optional)" value={newCredential.notes} onChange={v => setNewCredential(p => ({ ...p, notes: v }))} placeholder="Any additional notes" />
            <button onClick={() => handleAddSubResource('credentials')} disabled={!newCredential.label || !newCredential.value || isSubmitting} className="w-full bg-[#0984E3] hover:bg-[#0873C7] disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-[14px] transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><KeyRound size={18} /> Add Credential</>}
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // ─── PROJECT LIST VIEW ───
  return (
    <div className="flex-1 bg-[#F5F7FB] flex flex-col overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl w-full mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-[#0B1C30]">Project Hub</h1>
            <p className="text-[15px] text-gray-500 mt-1">Manage projects, repos, deployments, docs, and credentials in one place.</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="bg-[#2170E4] hover:bg-[#1A5BB8] text-white px-5 py-2.5 rounded-xl text-[14px] font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md">
            <Plus size={18} /> New Project
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search projects..." className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-[14px] outline-none focus:border-[#2170E4] focus:ring-2 focus:ring-[#2170E4]/10 transition-all" />
          </div>
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {['all', 'active', 'completed', 'on_hold', 'archived'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-3 text-[13px] font-semibold transition-colors capitalize ${statusFilter === s ? 'bg-[#2170E4] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Project Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 bg-gray-100 rounded-xl"></div><div className="flex-1"><div className="h-4 bg-gray-100 rounded w-2/3 mb-2"></div><div className="h-3 bg-gray-50 rounded w-1/2"></div></div></div>
                <div className="h-3 bg-gray-50 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-50 rounded w-4/5"></div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-50 to-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[40px]">📁</div>
            <h3 className="text-[20px] font-bold text-[#0B1C30] mb-2">{searchQuery ? 'No projects found' : 'No projects yet'}</h3>
            <p className="text-gray-500 text-[15px] mb-6 max-w-sm mx-auto">{searchQuery ? 'Try a different search term.' : 'Create your first project to organize repos, docs, and deployments.'}</p>
            {!searchQuery && (
              <button onClick={() => setShowCreateModal(true)} className="bg-[#2170E4] hover:bg-[#1A5BB8] text-white px-6 py-3 rounded-xl text-[14px] font-bold inline-flex items-center gap-2 transition-colors">
                <Plus size={18} /> Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => {
              const badge = STATUS_BADGES[project.status] || STATUS_BADGES.active;
              const totalItems = (project.gitRepos?.length || 0) + (project.deployments?.length || 0) + (project.documentation?.length || 0) + (project.workflows?.length || 0) + (project.credentials?.length || 0);
              return (
                <div key={project._id} className="bg-white rounded-2xl border border-gray-100 p-6 text-left hover:shadow-lg hover:border-gray-200 transition-all group relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => fetchProjectDetail(project._id)}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[24px] shadow-sm transition-transform group-hover:scale-105" style={{ background: `${project.color}12` }}>
                        {project.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold text-[#0B1C30] truncate group-hover:text-[#2170E4] transition-colors">{project.name}</h3>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${badge.text}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></div>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    {/* Status Menu Button */}
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenStatusMenu(openStatusMenu === project._id ? null : project._id); }}
                        className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal size={18} />
                      </button>
                      {openStatusMenu === project._id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setOpenStatusMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-44 animate-in">
                            <p className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Set Status</p>
                            {Object.entries(STATUS_BADGES).map(([key, val]) => (
                              <button key={key} onClick={(e) => { e.stopPropagation(); handleUpdateStatus(project._id, key); }}
                                className={`w-full text-left px-3 py-2 text-[13px] font-medium flex items-center gap-2.5 transition-colors ${project.status === key ? `${val.bg} ${val.text}` : 'text-gray-600 hover:bg-gray-50'}`}>
                                <div className={`w-2 h-2 rounded-full ${val.dot}`}></div>
                                {val.label}
                                {project.status === key && <Check size={14} className="ml-auto" />}
                              </button>
                            ))}
                            <div className="border-t border-gray-100 mt-1 pt-1">
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project._id); setOpenStatusMenu(null); }}
                                className="w-full text-left px-3 py-2 text-[13px] font-medium text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors">
                                <Trash2 size={14} /> Delete Project
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="cursor-pointer" onClick={() => fetchProjectDetail(project._id)}>
                    {project.description && <p className="text-[13px] text-gray-500 line-clamp-2 mb-4">{project.description}</p>}

                    {/* Resource Counts */}
                    <div className="flex items-center gap-3 text-[12px] text-gray-400 pt-3 border-t border-gray-50">
                      {project.gitRepos?.length > 0 && <span className="flex items-center gap-1"><GitBranch size={13} />{project.gitRepos.length}</span>}
                      {project.deployments?.length > 0 && <span className="flex items-center gap-1"><Globe size={13} />{project.deployments.length}</span>}
                      {project.documentation?.length > 0 && <span className="flex items-center gap-1"><FileText size={13} />{project.documentation.length}</span>}
                      {project.workflows?.length > 0 && <span className="flex items-center gap-1"><Workflow size={13} />{project.workflows.length}</span>}
                      {project.credentials?.length > 0 && <span className="flex items-center gap-1"><KeyRound size={13} />{project.credentials.length}</span>}
                      {totalItems === 0 && <span className="italic">No resources yet</span>}
                      <span className="ml-auto flex items-center gap-1 text-[#2170E4] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ChevronRight size={14} />
                      </span>
                    </div>

                    {/* Tags */}
                    {project.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {project.tags.slice(0, 3).map(t => <span key={t} className="bg-gray-50 text-gray-500 text-[11px] font-semibold px-2 py-0.5 rounded-full">#{t}</span>)}
                        {project.tags.length > 3 && <span className="text-[11px] text-gray-400 font-semibold">+{project.tags.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Project" width="max-w-xl">
        <div className="space-y-5">
          <InputGroup label="Project Name" value={newProject.name} onChange={v => setNewProject(p => ({ ...p, name: v }))} placeholder="e.g. WorkspacePro Frontend" required />
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-gray-600">Description</label>
            <textarea value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} placeholder="What is this project about?" rows={3} className="border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#2170E4] focus:ring-2 focus:ring-[#2170E4]/10 resize-none transition-all" />
          </div>

          {/* Icon Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-gray-600">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(icon => (
                <button key={icon} onClick={() => setNewProject(p => ({ ...p, icon }))}
                  className={`w-10 h-10 rounded-xl text-[20px] flex items-center justify-center transition-all ${newProject.icon === icon ? 'ring-2 ring-[#2170E4] bg-blue-50 scale-110' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-gray-600">Color</label>
            <div className="flex gap-2">
              {COLORS.map(color => (
                <button key={color} onClick={() => setNewProject(p => ({ ...p, color }))}
                  className={`w-8 h-8 rounded-full transition-all ${newProject.color === color ? 'ring-2 ring-offset-2 ring-current scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }}>
                </button>
              ))}
            </div>
          </div>

          <InputGroup label="Tags (comma-separated)" value={newProject.tags} onChange={v => setNewProject(p => ({ ...p, tags: v }))} placeholder="frontend, react, v2" />

          <button onClick={handleCreateProject} disabled={!newProject.name.trim() || isSubmitting}
            className="w-full bg-[#2170E4] hover:bg-[#1A5BB8] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-[15px] transition-colors flex items-center justify-center gap-2 mt-2">
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <><FolderGit2 size={20} /> Create Project</>}
          </button>
        </div>
      </Modal>
    </div>
  );
};

// ─── Empty State ───
const EmptyState = ({ icon: Icon, label }) => (
  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
      <Icon size={28} />
    </div>
    <p className="text-[15px] text-gray-400 font-medium">{label}</p>
  </div>
);

export default FilesTab;
