import React, { useState, useEffect, useRef } from 'react';
import { Mail, Video, MessageSquare, LogOut, Zap, LayoutDashboard, User, Grid, Shield, RefreshCw } from 'lucide-react';

const GATEWAY_URL = 'http://localhost:3001';

const APPS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, color: '#3b82f6', desc: 'Command Center' },
  { id: 'mail', label: 'Mail App', icon: Mail, color: '#8b5cf6', port: 3010, desc: 'Secure Email MFE' },
  { id: 'meet', label: 'Meetings App', icon: Video, color: '#10b981', port: 3020, desc: 'Video Huddles MFE' },
  { id: 'chat', label: 'Kural Chat', icon: MessageSquare, color: '#00c17e', port: 3030, desc: 'Team Messenger MFE' }
];

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('auth') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [activeApp, setActiveApp] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const iframeRefs = {
    mail: useRef(null),
    meet: useRef(null),
    chat: useRef(null)
  };

  // Handle postMessage synchronization from MFE sub-apps
  useEffect(() => {
    const handleMfeMessage = (event) => {
      const { type, action } = event.data || {};
      
      if (type === 'MFE_READY' || action === 'request_auth') {
        const sourceMfeId = event.data.mfeId;
        console.log(`[Shell MFE] Received ready event from child MFE: ${sourceMfeId}`);
        
        // Sync credentials down to the child MFE
        if (sourceMfeId && iframeRefs[sourceMfeId]?.current) {
          const iframeWin = iframeRefs[sourceMfeId].current.contentWindow;
          iframeWin.postMessage({
            type: 'AUTH_INIT',
            token,
            auth
          }, '*');
          console.log(`[Shell MFE] Successfully synced JWT and session with: ${sourceMfeId}`);
        }
      }
    };

    window.addEventListener('message', handleMfeMessage);
    return () => window.removeEventListener('message', handleMfeMessage);
  }, [token, auth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${GATEWAY_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      const userAuth = {
        user: data.user.name,
        email: data.user.email,
        workspaceId: data.user.workspaceId,
        role: data.user.role,
        avatarUrl: data.user.avatarUrl
      };

      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('auth', JSON.stringify(userAuth));

      setToken(data.accessToken);
      setAuth(userAuth);
      setActiveApp('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth');
    setToken('');
    setAuth(null);
    setActiveApp('dashboard');
  };

  if (!auth) {
    return (
      <div className="min-h-screen flex bg-[#090d16] font-sans text-zinc-100 relative overflow-hidden">
        {/* Decorative subtle background gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[150px]" />

        {/* Left Panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 w-[440px] shrink-0 border-r border-zinc-800 bg-[#0c1220]/75 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-600 shadow-lg shadow-blue-500/30">
              <Zap size={20} className="text-white" strokeWidth={3} />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Forge Nexus Platform</span>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500 mb-2 block">Enterprise MFE Engine</span>
            <h2 className="text-3xl font-black mb-4 tracking-tight leading-tight">Micro Frontend Command Center.</h2>
            <p className="text-sm leading-relaxed text-zinc-400 mb-8">
              Experience the absolute isolation of isolated multi-process Micro Frontends and backend Microservices, running seamlessly under a centralized secure runtime.
            </p>
            <div className="space-y-4">
              {[
                'Strict MFE sandboxing via dynamic iframes',
                'Secure Cross-Origin postMessage Auth Handshake',
                'Decoupled REST & WS downstream Microservices',
                'Premium modern glassmorphism design tokens'
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-xs text-zinc-300">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-blue-500/15 text-blue-400">
                    ✓
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-600">© 2026 Forge India Connect Pvt Ltd</p>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
          <div className="w-full max-w-sm card bg-[#0f172a]/60 border border-zinc-800 p-8 rounded-[32px] shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600">
                <Zap size={16} className="text-white" />
              </div>
              <span className="font-bold text-base">Forge Nexus</span>
            </div>

            <h3 className="text-2xl font-black mb-1">Welcome back</h3>
            <p className="text-xs text-zinc-400 mb-6">Access your isolated organization workspace</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1e293b]/55 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400">PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1e293b]/55 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="text-xs p-3 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign In to Workspace'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[#080c14] font-sans text-zinc-100 overflow-hidden">
      {/* ─── Persistent Left Sidebar ─── */}
      <aside className="w-64 bg-[#0c1220] border-r border-zinc-800 flex flex-col justify-between p-6 shrink-0 relative z-20">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600 shadow-md shadow-blue-500/15">
              <Zap size={18} className="text-white" strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-white leading-none">NEXUS HOST</span>
              <span className="text-[8px] font-bold text-zinc-500 tracking-[0.2em] mt-1">SHELL PORT: 3000</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {APPS.map((app) => {
              const Icon = app.icon;
              const isActive = activeApp === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => setActiveApp(app.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-white shadow-inner'
                      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: isActive ? `${app.color}20` : 'transparent', color: isActive ? app.color : 'currentColor' }}
                  >
                    <Icon size={16} />
                  </div>
                  <span>{app.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Details */}
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl flex items-center gap-3">
            <img src={auth.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full bg-zinc-800 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-none mb-1">{auth.user}</p>
              <p className="text-[9px] font-bold text-zinc-500 truncate uppercase">{auth.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/20 border border-red-500/10 text-red-400 hover:bg-red-950/40 rounded-2xl text-xs font-bold tracking-wide transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content Canvas ─── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#090d16]">
        {/* Header */}
        <header className="h-20 border-b border-zinc-800/80 px-8 flex items-center justify-between shrink-0 bg-[#0c1220]/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-black tracking-tight uppercase">
              {activeApp === 'dashboard' ? 'Workspace Console' : `${activeApp.toUpperCase()} MICRO FRONTEND`}
            </h1>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>

          <div className="flex items-center gap-3 bg-zinc-900/60 px-4 py-2 rounded-xl border border-zinc-800/60 text-[10px] font-bold text-zinc-400">
            <span>DOMAIN:</span>
            <span className="text-white font-mono">{auth.workspaceId}.nexus.com</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative">
          {activeApp === 'dashboard' && (
            <div className="p-8 max-w-5xl mx-auto space-y-8 overflow-y-auto h-full">
              {/* Welcome banner */}
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1.5">OVERVIEW DASHBOARD</p>
                <h2 className="text-3xl font-black tracking-tight leading-none text-white">Your Workspace Command Center</h2>
                <p className="text-sm text-zinc-400 mt-2">Centralized portal routing and isolated app launchpad</p>
              </div>

              {/* MFE Port Launchers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {APPS.filter(app => app.id !== 'dashboard').map((app) => {
                  const Icon = app.icon;
                  return (
                    <div
                      key={app.id}
                      onClick={() => setActiveApp(app.id)}
                      className="bg-[#0f172a]/65 border border-zinc-800/80 p-6 rounded-[28px] hover:shadow-2xl hover:border-zinc-700/60 cursor-pointer group transition-all hover:-translate-y-1"
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-all shadow-md"
                        style={{ background: `${app.color}15`, color: app.color }}
                      >
                        <Icon size={24} />
                      </div>
                      <h3 className="text-base font-extrabold mb-1 text-white group-hover:text-blue-400 transition-colors">{app.label}</h3>
                      <p className="text-xs text-zinc-400 mb-4">{app.desc}</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">LOCAL PORT</span>
                        <span className="text-xs font-black font-mono text-white bg-zinc-800/50 px-2 py-0.5 rounded-lg border border-zinc-700/30">{app.port}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Section */}
              <div className="bg-[#0c1220]/60 border border-zinc-800 p-6 rounded-[28px] space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider">Distributed Architecture Metrics</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'API Gateway', val: 'Port 3001', color: 'text-green-400' },
                    { label: 'Auth Service', val: 'Port 3101', color: 'text-green-400' },
                    { label: 'Mail Service', val: 'Port 3102', color: 'text-green-400' },
                    { label: 'Meetings Service', val: 'Port 3103', color: 'text-green-400' }
                  ].map(stat => (
                    <div key={stat.label} className="p-4 bg-zinc-900/30 rounded-2xl border border-zinc-850">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase">{stat.label}</p>
                      <p className={`text-xs font-black mt-1 ${stat.color}`}>{stat.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Render individual isolated MFEs inside iframe wrappers */}
          {APPS.filter(app => app.id !== 'dashboard').map((app) => {
            const isTarget = activeApp === app.id;
            return (
              <div
                key={app.id}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isTarget ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
              >
                <iframe
                  ref={iframeRefs[app.id]}
                  src={`http://localhost:${app.port}`}
                  title={app.label}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
