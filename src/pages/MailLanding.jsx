import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, Shield, Zap, Inbox, Send, 
  Search, Archive, Clock, ChevronRight, 
  CheckCircle2, Lock, Star, Sparkles
} from 'lucide-react';

const MailLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <Mail size={22} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Forge India <span className="text-blue-600">Mail</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <NavLink label="Features" />
          <NavLink label="Security" />
          <NavLink label="Enterprise" />
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/login?app=mail')}
            className="px-6 py-2.5 font-bold text-sm hover:text-blue-600 transition-colors"
          >
            Login
          </button>

        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest border border-blue-200/50">
               <Sparkles size={14} /> AI-Powered Communication
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.9] text-zinc-900 dark:text-white">
              E-mail that <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">thinks for you.</span>
            </h1>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-lg leading-relaxed">
              Experience the next generation of business email. Secure, intelligent, and designed to help you focus on what matters most.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">

              <button className="px-10 py-5 border-2 border-zinc-200 dark:border-white/10 rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-zinc-50 dark:hover:bg-white/5 transition-all">
                View Demo
              </button>
            </div>
            <div className="flex items-center gap-6 pt-8 text-zinc-400">
               <div className="flex items-center gap-2 font-bold text-sm"><CheckCircle2 size={18} className="text-emerald-500" /> End-to-end Encrypted</div>
               <div className="flex items-center gap-2 font-bold text-sm"><CheckCircle2 size={18} className="text-emerald-500" /> 50GB Free Storage</div>
            </div>
          </div>

          {/* Interactive UI Mockup */}
          <div className="relative animate-in fade-in slide-in-from-right duration-1000 delay-300">
             <div className="relative bg-white dark:bg-zinc-900 rounded-[48px] p-4 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border border-zinc-200 dark:border-white/5">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-[40px] p-8 space-y-6">
                   <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                         <div className="w-3 h-3 rounded-full bg-rose-400" />
                         <div className="w-3 h-3 rounded-full bg-amber-400" />
                         <div className="w-3 h-3 rounded-full bg-emerald-400" />
                      </div>
                      <div className="w-48 h-8 bg-zinc-200/50 dark:bg-white/5 rounded-full" />
                   </div>
                   <div className="space-y-4">
                      <MockEmail active />
                      <MockEmail />
                      <MockEmail />
                   </div>
                </div>
                {/* Floating Element */}
                <div className="absolute -bottom-10 -left-10 bg-blue-600 text-white p-6 rounded-[32px] shadow-2xl animate-bounce-slow">
                   <Shield size={32} />
                   <div className="mt-4">
                      <p className="text-xs font-black uppercase tracking-widest opacity-60">Security Level</p>
                      <p className="text-xl font-black">Military Grade</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </main>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-8 py-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Lock} 
            title="Privacy First" 
            desc="Your data is yours. We never scan your emails for ads or tracking." 
            color="bg-blue-500"
          />
          <FeatureCard 
            icon={Inbox} 
            title="Smart Inbox" 
            desc="AI automatically categorizes your mail so you stay organized effortlessly." 
            color="bg-indigo-500"
          />
          <FeatureCard 
            icon={Star} 
            title="Pro Experience" 
            desc="Custom domains, shared mailboxes, and advanced admin controls." 
            color="bg-purple-500"
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-zinc-900 py-32 px-8 relative overflow-hidden">
         <div className="absolute inset-0 bg-blue-600/5" />
         <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 text-center relative z-10">
            <Stat label="Active Users" value="2.5M+" />
            <Stat label="Uptime" value="99.99%" />
            <Stat label="Storage" value="50GB+" />
            <Stat label="Security" value="AES-256" />
         </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-100 dark:border-white/5 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:row items-center justify-between gap-8 text-zinc-500 text-sm font-bold">
          <div>© 2026 Forge India Mail. All rights reserved.</div>
          <div className="flex gap-8">
            <button className="hover:text-blue-600">Privacy Policy</button>
            <button className="hover:text-blue-600">Terms of Service</button>
            <button className="hover:text-blue-600">Contact Us</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const NavLink = ({ label }) => (
  <button className="text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
    {label}
  </button>
);

const FeatureCard = ({ icon: Icon, title, desc, color }) => (
  <div className="p-10 bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-white/5 hover:border-blue-500/30 transition-all group">
    <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform`}>
      <Icon size={28} />
    </div>
    <h3 className="text-2xl font-black mb-4">{title}</h3>
    <p className="text-zinc-500 font-medium leading-relaxed">{desc}</p>
  </div>
);

const MockEmail = ({ active }) => (
  <div className={`p-4 rounded-2xl border ${active ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' : 'bg-white dark:bg-white/5 border-zinc-100 dark:border-white/5'} flex items-center gap-4`}>
    <div className={`w-10 h-10 rounded-full ${active ? 'bg-blue-500' : 'bg-zinc-200 dark:bg-zinc-800'} shrink-0`} />
    <div className="flex-1 space-y-2">
       <div className={`h-2 rounded-full ${active ? 'bg-blue-300' : 'bg-zinc-200 dark:bg-zinc-700'} w-24`} />
       <div className={`h-2 rounded-full ${active ? 'bg-blue-200' : 'bg-zinc-100 dark:bg-zinc-800'} w-40`} />
    </div>
    <div className={`w-4 h-4 rounded-full ${active ? 'bg-blue-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
  </div>
);

const Stat = ({ label, value }) => (
  <div className="space-y-2">
    <div className="text-3xl md:text-5xl font-black text-white">{value}</div>
    <div className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</div>
  </div>
);

export default MailLanding;
