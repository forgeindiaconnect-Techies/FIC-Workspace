import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Video, Shield, Zap, Users, 
  ChevronRight, Play, CheckCircle, 
  ArrowRight, Globe, Lock, Cpu
} from 'lucide-react';

const MeetingLanding = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  const features = [
    {
      icon: Video,
      title: "Crystal Clear HD Video",
      desc: "Experience lifelike video quality with low latency, optimized for any bandwidth."
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      desc: "End-to-end encryption ensures your private conversations stay private."
    },
    {
      icon: Zap,
      title: "One-Click Join",
      desc: "No downloads required. Join instantly from your browser with a single link."
    }
  ];

  const stats = [
    { label: "Daily Meetings", value: "50k+" },
    { label: "Active Users", value: "2M+" },
    { label: "Uptime", value: "99.99%" },
    { label: "Countries", value: "120+" }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-100 dark:border-white/5 px-8 h-20 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
               <Video size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">Meeting</span>
         </div>
         
         <div className="hidden md:flex items-center gap-10">
            {['Features', 'Pricing', 'Security', 'Resources'].map(item => (
              <a key={item} href="#" className="text-sm font-black uppercase tracking-widest text-zinc-500 hover:text-blue-600 transition-colors">{item}</a>
            ))}
         </div>

         <div className="flex items-center gap-4">
            <button 
               onClick={() => navigate('/login?app=meet')}
               className="text-sm font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors px-4 py-2"
            >
               Login
            </button>

         </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 md:pt-44 pb-20 md:pb-32 px-6 md:px-8 overflow-hidden">
         {/* Animated Background Gradients */}
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
         </div>

         <div className="max-w-7xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-white/5 rounded-full mb-6 md:mb-8 border border-zinc-200 dark:border-white/10">
               <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Trusted by 10,000+ Enterprises</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-[1] md:leading-[0.9] mb-6 md:mb-8 bg-gradient-to-b from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-600 bg-clip-text text-transparent">
               Meetings that <br /> feel like reality.
            </h1>
            
            <p className="max-w-2xl mx-auto text-base md:text-xl text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mb-8 md:mb-12">
               Connect, collaborate, and celebrate from anywhere with high-fidelity video conferencing. Built for teams that demand excellence.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">

               <button className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 border-2 border-zinc-200 dark:border-white/10 rounded-[20px] md:rounded-[24px] font-black text-xs md:text-sm uppercase tracking-widest transition-all hover:bg-zinc-50 dark:hover:bg-white/5 flex items-center justify-center gap-3">
                  <Play size={16} fill="currentColor" /> Watch Demo
               </button>
            </div>
         </div>

         {/* Product Preview Mockup */}
         <div className="max-w-6xl mx-auto mt-16 md:mt-24 relative px-4 md:px-0">
            <div className="relative rounded-[24px] md:rounded-[40px] border-4 md:border-8 border-zinc-900/5 dark:border-white/5 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] md:shadow-[0_64px_128px_-16px_rgba(0,0,0,0.15)]">
               <img 
                  src="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&q=80&w=2000" 
                  alt="Meeting Platform Preview" 
                  className="w-full h-auto"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent" />
            </div>
            
            {/* Floating UI Elements - Hidden on small mobile */}
            <div className="absolute -left-6 md:-left-12 top-1/4 hidden sm:block animate-bounce shadow-2xl" style={{ animationDuration: '4s' }}>
               <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-zinc-100 dark:border-white/10 flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-500">
                     <CheckCircle size={20} />
                  </div>
                  <div>
                     <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Security</p>
                     <p className="text-xs md:text-sm font-black">E2E Encrypted</p>
                  </div>
               </div>
            </div>

            <div className="absolute -right-6 md:-right-12 bottom-1/4 hidden sm:block animate-bounce shadow-2xl" style={{ animationDuration: '6s' }}>
               <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-zinc-100 dark:border-white/10 flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-blue-500">
                     <Users size={20} />
                  </div>
                  <div>
                     <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Collaboration</p>
                     <p className="text-xs md:text-sm font-black">100+ Participants</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-8 bg-zinc-50/50 dark:bg-white/[0.02]">
         <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
               {features.map((feature, idx) => (
                 <div key={idx} className="space-y-6 group">
                    <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 border border-zinc-100 dark:border-white/5">
                       <feature.icon size={28} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight">{feature.title}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">{feature.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Trust Stats */}
      <section className="py-32 px-8 border-y border-zinc-100 dark:border-white/5">
         <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
               {stats.map((stat, idx) => (
                 <div key={idx} className="text-center space-y-2">
                    <p className="text-5xl font-black tracking-tighter text-blue-600">{stat.value}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">{stat.label}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Global Connectivity Section */}
      <section className="py-40 px-8 relative overflow-hidden">
         <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-10">
               <h2 className="text-5xl font-black tracking-tighter leading-[1.1]">Built for the modern <br /> borderless workforce.</h2>
               <div className="space-y-8">
                  <BenefitItem 
                    icon={Globe} 
                    title="Global Network" 
                    desc="Dedicated server nodes across 6 continents for minimum latency." 
                  />
                  <BenefitItem 
                    icon={Cpu} 
                    title="AI Noise Suppression" 
                    desc="Background noise is automatically filtered out for crystal clear audio." 
                  />
                  <BenefitItem 
                    icon={Lock} 
                    title="Privacy First" 
                    desc="We never sell your data. Your meetings are yours and yours alone." 
                  />
               </div>
            </div>
            <div className="relative">
               <div className="aspect-square bg-zinc-100 dark:bg-zinc-900 rounded-[64px] border border-zinc-200 dark:border-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center opacity-50 group-hover:scale-110 transition-transform duration-[2s]" />
                  <div className="absolute inset-0 bg-blue-600/10 mix-blend-overlay" />
               </div>
               {/* Floating UI */}
               <div className="absolute -top-10 -right-10 bg-white dark:bg-zinc-900 p-8 rounded-[40px] shadow-2xl border border-zinc-100 dark:border-white/10 hidden xl:block">
                  <p className="text-4xl font-black tracking-tighter text-blue-600 mb-1">99.9%</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Average Uptime</p>
               </div>
            </div>
         </div>
      </section>

      {/* Footer CTA */}
      <section className="py-40 px-8">
         <div className="max-w-4xl mx-auto bg-zinc-900 dark:bg-white rounded-[64px] p-16 md:p-24 text-center space-y-12 shadow-[0_64px_128px_-16px_rgba(0,0,0,0.3)] dark:shadow-blue-500/10">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white dark:text-zinc-900 leading-[1.1]">Ready to elevate <br /> your meetings?</h2>
            <button 
               onClick={() => navigate(`/w/${workspaceId}/meet`)}
               className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-500/20"
            >
               Join Forge India Meeting Now
            </button>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold">No credit card required. Cancel anytime.</p>
         </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-12 px-8 border-t border-zinc-100 dark:border-white/5">
         <div className="max-w-7xl mx-auto flex flex-col md:row items-center justify-between gap-8">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-zinc-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-zinc-500">
                  <Video size={18} />
               </div>
               <span className="font-black tracking-tighter uppercase italic text-sm">Meeting</span>
            </div>
            <p className="text-xs font-bold text-zinc-400">© 2026 Forge India Connect Pvt Ltd. All rights reserved.</p>
            <div className="flex items-center gap-6">
               {['Twitter', 'LinkedIn', 'Support', 'Privacy'].map(item => (
                 <a key={item} href="#" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-blue-600 transition-colors">{item}</a>
               ))}
            </div>
         </div>
      </footer>
    </div>
  );
};

const BenefitItem = ({ icon: Icon, title, desc }) => (
  <div className="flex gap-6 group">
     <div className="w-14 h-14 rounded-2xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shrink-0 border border-zinc-100 dark:border-white/5">
        <Icon size={24} />
     </div>
     <div className="space-y-1">
        <h4 className="text-lg font-black tracking-tight">{title}</h4>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed">{desc}</p>
     </div>
  </div>
);

export default MeetingLanding;
