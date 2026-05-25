import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, ArrowRight, ChevronLeft, 
  Mail, Lock, Briefcase, Sparkles,
  Users, Globe, CheckCircle2
} from 'lucide-react';
import { getApiUrl } from '../api';

const ChatSignup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const workspaceId = name.toLowerCase().replace(/\s+/g, '-');
      const domain = `${workspaceId}.com`;

      const response = await fetch(getApiUrl('/api/auth/register-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, workspaceId, domain, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setStep(2); // Success step
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-inter selection:bg-emerald-500/30">
      {/* Left Panel - Value Prop */}
      <div className="hidden lg:flex flex-col justify-between p-16 w-[480px] bg-emerald-500 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/chat/welcome')}
          >
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-xl shadow-black/10 group-hover:rotate-6 transition-all p-1">
               <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-lg" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase text-white">Kural <span className="text-emerald-900/30">Messenger</span></span>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div className="space-y-6">
            <h2 className="text-6xl font-black text-white tracking-tighter leading-[0.9]">
              Build your <br />
              <span className="text-emerald-900/40">dream team.</span>
            </h2>
            <p className="text-emerald-50 text-xl font-medium leading-relaxed opacity-90">
              Set up your professional workspace in seconds and start collaborating with your team like never before.
            </p>
          </div>

          <div className="space-y-6">
            {[
              { icon: Globe, title: 'Dedicated Domain', desc: 'Your own workspace URL' },
              { icon: Users, title: 'Unlimited Members', desc: 'Invite your entire organization' },
              { icon: Zap, title: 'Instant Setup', desc: 'No complex configuration needed' }
            ].map((item, i) => (
              <div key={i} className="flex gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 shrink-0">
                  <item.icon size={22} />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">{item.title}</h4>
                  <p className="text-emerald-100 text-xs font-semibold opacity-80">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] font-black text-emerald-900/40 uppercase tracking-widest">© 2026 Kural Messenger Labs</p>
        </div>
      </div>

      {/* Right Panel - Signup Form / Success State */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white relative">
        <button
          onClick={() => navigate('/chat/welcome')}
          className="absolute top-8 left-8 flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={3} /> Back to Home
        </button>

        <div className="w-full max-w-sm">
          {step === 1 ? (
            <div className="space-y-10">
              <div className="text-center lg:text-left">
                <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-2">Get Started</h1>
                <p className="text-sm font-medium text-gray-400">Create a dedicated workspace for your team.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Organization Name</label>
                    <div className="relative group">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                        placeholder="e.g. Acme Corp"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Password</label>
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
                  className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-emerald-100 hover:bg-emerald-600 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3 group"
                >
                  {loading ? 'Creating Workspace...' : (
                    <>
                      Create Workspace <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-6 text-center">
                <p className="text-xs font-bold text-gray-400">
                  Already have an account?{' '}
                  <button 
                    onClick={() => navigate('/chat/login')}
                    className="text-emerald-500 hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-500 mx-auto shadow-xl shadow-emerald-500/10 border border-emerald-100">
                <CheckCircle2 size={48} strokeWidth={2.5} />
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tighter text-gray-900">Workspace Ready!</h1>
                <p className="text-sm font-medium text-gray-400 max-w-[280px] mx-auto">
                  Your team environment for <span className="text-gray-900 font-bold">{name}</span> has been successfully created.
                </p>
              </div>
              <button
                onClick={() => navigate('/chat/login')}
                className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-gray-200 hover:bg-emerald-500 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 group"
              >
                Sign In to Your Workspace <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSignup;
