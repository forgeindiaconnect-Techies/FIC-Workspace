import React, { useState } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Settings,
  LogOut, Bell, ChevronDown, Search, Sun, Moon,
  Zap, Users, Shield, Globe, Menu, X, Command, Grid
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { AppSwitcher } from './AppLayout';

const DashboardLayout = ({ children, isAdmin = false }) => {
  const { workspaceId } = useParams();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [activeToast, setActiveToast] = useState(null);

  React.useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => setActiveToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  React.useEffect(() => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    const email = auth.email || auth.user?.email || '';
    const token = auth.token || auth.user?.token || localStorage.getItem('token');
    if (!email) return;

    // Request desktop notification permission on load
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    const showDesktopNotification = (title, body) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/logo.png' });
        } catch (e) {
          console.warn('Failed to display desktop notification:', e);
        }
      }
    };

    let ws;
    import('../api').then(({ getSocketUrl }) => {
      const wsUrl = getSocketUrl().replace('http', 'ws') + `/ws/mail?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token || '')}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence-update') {
            setOnlineCount(data.onlineEmails?.length || 1);
          } else if (data.type === 'NEW_MESSAGE') {
            showDesktopNotification(
              `New Message from ${data.message.senderName || 'Workspace'}`,
              data.message.content || 'Sent a file.'
            );
            setActiveToast({
              title: `New Message from ${data.message.senderName || 'Workspace'}`,
              body: data.message.content || 'Sent a file.',
              type: 'message'
            });
          } else if (data.type === 'NEW_MAIL') {
            showDesktopNotification(
              `New Email: ${data.mail.subject || '(No Subject)'}`,
              `From: ${data.mail.senderName || data.mail.senderEmail}\n${data.mail.body?.substring(0, 60) || ''}`
            );
            setActiveToast({
              title: `New Email: ${data.mail.subject || '(No Subject)'}`,
              body: `From: ${data.mail.senderName || data.mail.senderEmail}`,
              type: 'mail'
            });
          }
        } catch (e) {}
      };
    }).catch(() => {});
    
    return () => { if (ws) ws.close(); };
  }, []);

  const basePath = workspaceId ? `/w/${workspaceId}` : '';

  const workspaceNav = [];

  const adminNav = [
    { to: `${basePath}/admin`, icon: Shield, label: 'Admin Hub' },
  ];

  const superNav = [
    { to: `/super-admin`, icon: Globe, label: 'Fleet Monitor' },
    { to: `/super-admin/billing`, icon: Users, label: 'Tenants' },
  ];

  const navItems = !workspaceId ? superNav : isAdmin ? adminNav : workspaceNav;

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r transition-all duration-300 shrink-0 z-20"
        style={{
          width: sidebarOpen ? '220px' : '60px',
          background: 'var(--surface)',
          borderColor: 'var(--border)'
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border)', height: '57px' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
            <Zap size={14} color="white" strokeWidth={3} />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
              Forge India Connect Pvt Ltd
            </span>
          )}
        </div>

        {/* Workspace Chip */}
        {workspaceId && sidebarOpen && (
          <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg cursor-pointer group" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>
                  {workspaceId[0].toUpperCase()}
                </div>
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)', maxWidth: '110px' }}>
                  {workspaceId.replace('-', ' ')}
                </span>
              </div>
              <ChevronDown size={12} style={{ color: 'var(--text-3)' }} />
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto mt-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to.endsWith('dashboard') || to.endsWith('admin') || to === '/super-admin'}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}

          <div className="divider my-2" />

          {/* Settings option removed per request */}
        </nav>

        {/* Bottom User */}
        <div className="p-2 border-t flex flex-col gap-1" style={{ borderColor: 'var(--border)' }}>
          {/* App Switcher */}
          <div className="w-full">
            {sidebarOpen ? <AppSwitcher workspaceId={workspaceId} /> : (
              <div className="flex justify-center w-full mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 text-slate-400 cursor-pointer">
                  <Grid size={18} strokeWidth={2.5} />
                </div>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="sidebar-item w-full text-left">
            <LogOut size={16} strokeWidth={1.75} />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-5 border-b shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '57px' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn btn-ghost btn-icon"
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {/* Command Palette Trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-3)'
              }}
            >
              <Search size={13} />
              <span>Search or jump to...</span>
              <kbd className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Presence */}
            <div className="hidden lg:flex items-center gap-1 mr-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{onlineCount} online</span>
            </div>

            <button className="btn btn-ghost btn-icon relative">
              <Bell size={16} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
            </button>

            <button onClick={toggleTheme} className="btn btn-ghost btn-icon">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative group">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ml-1 text-white cursor-pointer hover:opacity-90 transition-opacity" style={{ background: 'var(--accent)' }}>
                A
              </div>
              {/* Profile dropdown */}
              <div className="absolute right-0 top-8 pt-2 w-48 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
                <div
                  className="w-full rounded-xl border shadow-xl overflow-hidden"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold">Workspace User</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{workspaceId || 'Admin'}</p>
                </div>
                <div className="p-1">
                  {/* Settings button removed per request */}
                  <button onClick={handleLogout} className="sidebar-item w-full text-xs" style={{ color: '#EF4444' }}><LogOut size={14} /> Sign out</button>
                </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <div className="p-6 max-w-7xl mx-auto animate-up">
            {children}
          </div>
        </main>
      </div>

      {/* Command Palette */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setCmdOpen(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-up"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <Command size={16} style={{ color: 'var(--text-3)' }} />
              <input
                autoFocus
                type="text"
                placeholder="Search or jump to..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{ color: 'var(--text)' }}
              />
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>ESC</kbd>
            </div>
            <div className="p-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Quick Actions</p>
              {['New Compose', 'Start Meeting', 'Invite Member'].map(item => (
                <button key={item} className="sidebar-item w-full" onClick={() => setCmdOpen(false)}>
                  <span>{item}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-App Visual Toast Notification Popup */}
      {activeToast && (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm w-80 rounded-xl border shadow-2xl p-4 flex gap-3 cursor-pointer transform transition-all duration-300 hover:scale-102 animate-up"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
          onClick={() => {
            const targetPath = activeToast.type === 'message'
              ? `/w/${workspaceId || 'forge-india-connect'}/chat`
              : `/w/${workspaceId || 'forge-india-connect'}/mail`;
            navigate(targetPath);
            setActiveToast(null);
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
                {activeToast.type === 'message' ? '💬 New Chat Message' : '✉️ New Email'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveToast(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                style={{ color: 'var(--text-3)' }}
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {activeToast.title}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
              {activeToast.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
