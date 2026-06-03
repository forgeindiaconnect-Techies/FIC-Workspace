import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, ArrowRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const isRegistering = false;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('app') === 'chat') {
      navigate('/chat/login');
      return;
    }

    const savedAuth = JSON.parse(localStorage.getItem('auth') || 'null');
    const savedToken = localStorage.getItem('token');
    if (savedAuth && savedToken) {
      if (savedAuth.role === 'super-admin') {
        navigate('/super-admin', { replace: true });
      } else {
        navigate(`/w/${savedAuth.workspaceId || 'demo'}/dashboard`, { replace: true });
      }
    }
  }, [location, navigate]);

  const [name, setName] = useState('');

  // API Base URL - Managed by Vite proxy in development
  // API Base URL - Managed by global config

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isRegistering ? '/api/auth/register-tenant' : '/api/auth/login';
      const body = isRegistering 
        ? { name, workspaceId: name.toLowerCase().replace(/\s+/g, '-'), domain: `${name.toLowerCase().replace(/\s+/g, '-')}.com`, email, password }
        : { email, password };

      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isRegistering) {
        // After registration, auto-login or redirect to login
        setIsRegistering(false);
        setError('Workspace created! Please sign in.');
      } else {
        const normalizedAuthData = {
          token: data.accessToken || data.token,
          role: data.user?.role || data.role,
          user: data.user?.name || data.user,
          email: data.user?.email || data.email,
          workspaceId: data.user?.workspaceId || data.workspaceId
        };

        localStorage.setItem('token', normalizedAuthData.token);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('auth', JSON.stringify({
          role: normalizedAuthData.role,
          user: normalizedAuthData.user,
          email: normalizedAuthData.email,
          workspaceId: normalizedAuthData.workspaceId,
          avatarUrl: data.user?.avatarUrl
        }));

        const params = new URLSearchParams(location.search);
        const targetApp = params.get('app') || 'dashboard';

        if (normalizedAuthData.role === 'super-admin') {
          navigate('/super-admin');
        } else if (normalizedAuthData.role === 'company-admin') {
          navigate(`/w/${normalizedAuthData.workspaceId}/dashboard`);
        } else {
          // Role-specific redirection
          if (email.includes('dev')) navigate(`/w/${normalizedAuthData.workspaceId}/dashboard/dev`);
          else if (email.includes('test')) navigate(`/w/${normalizedAuthData.workspaceId}/dashboard/test`);
          else if (email.includes('manager')) navigate(`/w/${normalizedAuthData.workspaceId}/dashboard/mgr`);
          else if (email.includes('lead')) navigate(`/w/${normalizedAuthData.workspaceId}/dashboard`);
          else navigate(targetApp === 'dashboard' ? `/w/${normalizedAuthData.workspaceId}/dashboard` : `/w/${normalizedAuthData.workspaceId}/${targetApp}`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 w-[420px] shrink-0 border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Zap size={16} color="white" strokeWidth={3} />
          </div>
          <span className="font-bold text-base tracking-tight">Forge India Connect Pvt Ltd</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3 tracking-tight">The workspace OS for modern teams.</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-2)' }}>
            Deploy isolated workspaces, manage your team, and collaborate across mail and meetings — all in one place. Now powered by MongoDB.
          </p>
          <div className="space-y-3">
            {['Persistent MongoDB storage', 'JWT Secure Authentication', 'Unified mail & video meetings', 'Role-based access control'].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ color: 'var(--text-2)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-3)' }}>© 2026 Forge India Connect Pvt Ltd</p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-icon absolute top-6 right-6"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Zap size={14} color="white" strokeWidth={3} />
            </div>
            <span className="font-bold">Forge India Connect Pvt Ltd</span>
          </div>

          <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>Sign in to your workspace account.</p>

          <form onSubmit={handleAuth} className="space-y-4">

            <div className="flex flex-col gap-1.5">
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="label !mb-0">Password</label>
                {!isRegistering && <a href="#" className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Forgot?</a>}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-xs p-3 rounded-xl border" style={{ 
                background: error.includes('created') ? 'var(--accent-muted)' : 'color-mix(in srgb, var(--danger) 8%, transparent)', 
                color: error.includes('created') ? 'var(--accent)' : 'var(--danger)', 
                borderColor: error.includes('created') ? 'var(--accent)' : 'color-mix(in srgb, var(--danger) 20%, transparent)' 
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight size={16} />}
            </button>
            

          </form>


        </div>
      </div>
    </div>
  );
};

export default LoginPage;
