import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Video, MessageSquare, CheckSquare, Shield, Globe,
  Users, BarChart3, FileText, Settings, Zap, ArrowRight,
  Sun, Moon, ChevronRight, Sparkles, Star, FileSpreadsheet, Presentation, Sliders
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const APPS = [
  {
    icon: <Mail size={22} />,
    name: 'Mail',
    desc: 'Secure workspace email for your entire team.',
    color: '#2563EB',
    bg: '#EFF6FF',
    href: '/mail/welcome',
  },
  {
    icon: <Video size={22} />,
    name: 'Meet',
    desc: 'Encrypted video meetings and collaboration.',
    color: '#7C3AED',
    bg: '#F5F3FF',
    href: '/meet/welcome',
  },
  {
    icon: <MessageSquare size={22} />,
    name: 'Chat',
    desc: 'Real-time messaging and team channels.',
    color: '#059669',
    bg: '#ECFDF5',
    href: '/chat/welcome',
    badge: 'New',
  },
  {
    icon: <Sliders size={22} />,
    name: 'Forge India PM',
    desc: 'Enterprise-grade project management system.',
    color: '#6366F1',
    bg: '#EEF2FF',
    href: 'https://workspace-blue-theta-87.vercel.app',
  },
  {
    icon: <Shield size={22} />,
    name: 'Admin',
    desc: 'User management and access control.',
    color: '#DC2626',
    bg: '#FEF2F2',
    href: '/login',
  },
  {
    icon: <Presentation size={22} />,
    name: 'Show',
    desc: 'Beautiful presentations and slide decks.',
    color: '#F59E0B',
    bg: '#FEF3C7',
    href: '/login?app=show',
  },
  {
    icon: <FileText size={22} />,
    name: 'Docs',
    desc: 'Create and collaborate on premium documents.',
    color: '#3B82F6',
    bg: '#EFF6FF',
    href: '/login?app=docs',
  },
  {
    icon: <FileSpreadsheet size={22} />,
    name: 'Sheets',
    desc: 'Manage data and complex calculations.',
    color: '#10B981',
    bg: '#ECFDF5',
    href: '/login?app=sheets',
  },
  {
    icon: <Globe size={22} />,
    name: 'Sites',
    desc: 'Build and host public-facing pages.',
    color: '#0D9488',
    bg: '#F0FDFA',
    href: '/login',
  },
];

const LandingPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('All');
  const tabs = ['All', 'Productivity', 'Collaboration', 'Admin'];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Topbar */}
      <nav
        className="flex items-center justify-between px-8 py-3 border-b sticky top-0 z-50"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Zap size={16} color="white" strokeWidth={3} />
          </div>
          <span className="font-bold text-base tracking-tight">Forge India Connect Pvt Ltd</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: 'var(--text-2)' }}>
          <a href="#apps" className="hover:text-[var(--text)] transition-colors">Products</a>
          <a href="#" className="hover:text-[var(--text)] transition-colors">Solutions</a>
          <a href="#" className="hover:text-[var(--text)] transition-colors">Pricing</a>
          <a href="#" className="hover:text-[var(--text)] transition-colors">Docs</a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-bold px-4 py-2 hover:bg-[var(--surface-2)] rounded-full transition-colors">Login</Link>
          <button onClick={toggleTheme} className="btn btn-ghost btn-icon">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/login" className="btn btn-secondary btn-sm">Sign in</Link>

        </div>
      </nav>

      {/* Hero Strip */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-8 py-14 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 border"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' }}
            >
              <Sparkles size={12} /> Multi-tenant SaaS platform — v3.0
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
              One workspace.<br />
              Every tool your team needs.
            </h1>
            <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-2)' }}>
              Mail, meetings, chat, and project management — all connected in isolated workspaces
              for every team. Deploy in seconds, scale without limits.
            </p>
            <div className="flex gap-3">

              <Link to="/login" className="btn btn-secondary btn-lg">View demo</Link>
            </div>
          </div>

          {/* Featured Banner */}
          <div
            className="w-full md:w-80 rounded-2xl p-6 text-white flex flex-col gap-4 shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%, -30%)' }} />
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl backdrop-blur-sm">
              <MessageSquare size={28} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Now Available</div>
              <h3 className="text-xl font-bold mb-2">Introducing<br />Chat Space</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                Real-time team messaging with channels, threads, and file sharing. Built for deep focus.
              </p>
            </div>
            <Link to="/chat/welcome" className="inline-flex items-center gap-2 text-sm font-semibold mt-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2 w-fit">
              Explore Chat <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* App Grid */}
      <div id="apps" className="max-w-7xl mx-auto px-8 py-12 w-full">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Featured Apps</p>
            <h2 className="text-lg font-bold">All Products</h2>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? 'white' : 'var(--text-2)'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {APPS.map((app) => {
            const isExternal = app.href.startsWith('http');
            const Component = isExternal ? 'a' : Link;
            const props = isExternal ? { href: app.href, target: "_blank", rel: "noopener noreferrer" } : { to: app.href };

            return (
              <Component 
                key={app.name} 
                {...props}
                className="card p-5 flex items-start gap-4 group relative"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: isDark ? `${app.color}20` : app.bg, color: app.color }}
                >
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">{app.name}</span>
                    {app.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: '#059669' }}>{app.badge}</span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{app.desc}</p>
                </div>
                <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: 'var(--text-3)' }} />
              </Component>
            );
          })}
        </div>

        {/* Explore all */}
        <div className="mt-6 text-center">
          <button className="btn btn-ghost text-sm" style={{ color: 'var(--accent)' }}>
            Explore all products <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Trusted by */}
      <div className="border-t py-10" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: 'var(--text-3)' }}>Trusted by teams worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            {[].map(name => (
              <span key={name} className="text-sm font-bold" style={{ color: 'var(--text-3)' }}>{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 px-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Zap size={12} color="white" strokeWidth={3} />
            </div>
            <span className="text-sm font-bold">Forge India Connect Pvt Ltd</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>© 2026 Forge India Connect Pvt Ltd · All rights reserved.</p>
          <div className="flex gap-6">
            {['Privacy', 'Terms', 'Status', 'Support'].map(item => (
              <a key={item} href="#" className="text-xs transition-colors hover:text-[var(--text)]" style={{ color: 'var(--text-3)' }}>{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
