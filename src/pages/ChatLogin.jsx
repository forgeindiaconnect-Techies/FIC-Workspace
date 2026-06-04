import React, { useState } from 'react';
import { getApiUrl } from '../api';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, ArrowRight, Sun, Moon, 
  MessageCircle, Lock, Mail, Sparkles,
  ChevronLeft, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ChatLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('auth', JSON.stringify({
        role: data.role,
        user: data.user,
        email: data.email,
        workspaceId: data.workspaceId
      }));

      // Redirect to the chat app
      navigate(`/w/${data.workspaceId}/chat`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-inter selection:bg-emerald-500/30">
      {/* Left Panel - Hero Visual */}
      <div className="hidden lg:flex flex-col justify-between p-16 w-[480px] bg-gray-900 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-emerald-500/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/20 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full" />
        
        <div className="relative z-10">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/chat/welcome')}
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 group-hover:rotate-6 transition-all p-1">
               <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-lg" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase text-white">Kural <span className="text-emerald-500">Messenger</span></span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tighter leading-tight">
              Welcome back to the <span className="text-emerald-500">convo.</span>
            </h2>
            <p className="text-gray-400 text-lg font-medium leading-relaxed">
              Your team is waiting. Sign in to catch up on what you missed in your channels and DMs.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: MessageCircle, text: 'Real-time synchronization' },
              { icon: ShieldCheck, text: 'End-to-end encrypted' },
              { icon: Sparkles, text: 'AI-powered summaries' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 text-gray-300">
                <div className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center text-emerald-500 border border-gray-700">
                  <item.icon size={16} />
                </div>
                <span className="text-sm font-bold tracking-tight uppercase">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">© 2026 Kural Messenger Labs</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white relative">
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={3} /> Return to Landing Page
        </button>

        <div className="w-full max-w-sm space-y-10">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-2">Sign In</h1>
            <p className="text-sm font-medium text-gray-400">Enter your credentials to access your workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</label>
                  <a href="#" className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline">Forgot?</a>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-shake">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0">
                  <Zap size={12} fill="currentColor" />
                </div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-gray-200 hover:bg-emerald-500 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3 group"
            >
              {loading ? 'Authenticating...' : (
                <>
                  Sign In to Kural <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="pt-6 text-center">
            <p className="text-xs font-bold text-gray-400">
              Don't have a workspace?{' '}
              <button 
                onClick={() => navigate('/chat/signup')}
                className="text-emerald-500 hover:underline"
              >
                Create one now
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatLogin;
