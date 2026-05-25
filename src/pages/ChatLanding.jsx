import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Zap, Shield, Users, 
  Video, Hash, Image, Smile, ChevronRight, 
  CheckCircle2, Lock, Sparkles, MessageCircle, ArrowRight, Paperclip, Phone, Globe, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatLanding = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-inter selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -right-[10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], x: [0, -50, 0], y: [0, 50, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[10%] -left-[10%] w-[60%] h-[60%] bg-blue-500/5 blur-[120px] rounded-full" 
        />
      </div>

      {/* Premium Navbar */}
      <nav className="sticky top-0 z-[100] backdrop-blur-md bg-white/70 border-b border-slate-100/50">
        <div className="flex items-center justify-between px-10 py-5 max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 group cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-500/20 group-hover:rotate-6 transition-all p-1.5">
               <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-xl" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase text-slate-900">Kural <span className="text-emerald-500">Space</span></span>
          </motion.div>
          
          <div className="hidden md:flex items-center gap-10 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {['Product', 'Enterprise', 'Security', 'Pricing'].map(item => (
              <a key={item} href="#" className="hover:text-emerald-500 transition-colors relative group">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full" />
              </a>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <button 
              onClick={() => navigate('/chat/login')}
              className="text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500 transition-colors px-6 py-2"
            >
              Login
            </button>
            <button 
              onClick={() => navigate('/chat/signup')}
              className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-slate-200 hover:bg-emerald-500 hover:-translate-y-1 transition-all"
            >
              Get Started
            </button>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-24 pb-40 px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border border-emerald-100 shadow-sm"
            >
               <Sparkles size={16} className="text-emerald-500 animate-pulse" /> 
               Revolutionizing Team Presence
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-8xl md:text-9xl font-black tracking-tighter leading-[0.85] text-slate-900 drop-shadow-sm"
            >
              Speak in <br />
              <span className="text-emerald-500">Real-Time.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-400 font-semibold max-w-lg leading-relaxed"
            >
              The enterprise messenger built for high-performance teams. Experience the next generation of communication with Kural's lightning-fast infrastructure.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-5"
            >
              <button 
                onClick={() => navigate('/chat/signup')}
                className="px-12 py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-emerald-200 hover:bg-emerald-600 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-4"
              >
                Join Workspace <ArrowRight size={20} strokeWidth={3} />
              </button>
              <button className="px-12 py-6 bg-white border-2 border-slate-100 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-50 hover:border-slate-200 transition-all">
                Request Demo
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-10 pt-6"
            >
               <div className="flex -space-x-4">
                  {[1,2,3,4,5].map(i => (
                    <motion.img 
                      whileHover={{ scale: 1.2, zIndex: 10, y: -5 }}
                      key={i} 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i + 20}`} 
                      className="w-14 h-14 rounded-3xl border-4 border-white shadow-2xl bg-white" 
                      alt="User" 
                    />
                  ))}
               </div>
               <div className="space-y-1">
                  <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Trusted globally</p>
                  <p className="text-[11px] font-bold text-slate-300 tracking-tight">Active users in 120+ countries</p>
               </div>
            </motion.div>
          </div>

          {/* Dynamic Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative perspective-1000"
          >
             <div className="absolute -inset-20 bg-emerald-500/20 blur-[150px] rounded-full opacity-30 animate-pulse" />
             <div className="relative bg-white border border-slate-100 shadow-[0_80px_160px_-40px_rgba(0,0,0,0.15)] rounded-[4.5rem] p-5 overflow-hidden">
                {/* Mockup Header */}
                <div className="flex items-center justify-between px-10 py-10 border-b border-slate-50 bg-slate-50/30 backdrop-blur-xl">
                   <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-[2rem] bg-white p-1 shadow-2xl relative">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="rounded-[1.75rem]" alt="Mock" />
                         <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-lg" />
                      </div>
                      <div>
                         <div className="text-sm font-black text-slate-900 uppercase tracking-widest">Felix Arvid</div>
                         <div className="flex items-center gap-3 mt-1.5">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <div className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">Presence Verified • {formattedTime}</div>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors"><Video size={20} /></div>
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors"><Phone size={20} /></div>
                   </div>
                </div>

                {/* Mockup Content */}
                <div className="p-10 space-y-10 h-[450px] bg-gradient-to-b from-white to-slate-50/50">
                   {/* Incoming */}
                   <div className="flex gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex-shrink-0 shadow-inner" />
                      <div className="space-y-3 flex-1">
                         <div className="bg-white rounded-3xl rounded-tl-none p-6 w-3/4 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] border border-slate-100/50">
                            <p className="text-[15px] font-bold text-slate-700 leading-relaxed">Team, the Q3 roadmap is finalized! Pushing the updates to #core-dev now. ⚡️</p>
                            <div className="flex items-center gap-2 mt-4">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{formattedTime}</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Outgoing */}
                   <div className="flex flex-row-reverse gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex-shrink-0 flex items-center justify-center text-white font-black text-sm shadow-xl shadow-emerald-200">K</div>
                      <div className="space-y-3 flex-1 flex flex-col items-end">
                         <div className="bg-slate-900 rounded-3xl rounded-tr-none p-6 w-2/3 shadow-2xl text-white">
                            <p className="text-[15px] font-bold leading-relaxed">Brilliant work! I'll start reviewing the architecture changes immediately.</p>
                            <div className="flex items-center gap-2 mt-4 opacity-50">
                               <CheckCircle2 size={12} className="text-emerald-400" />
                               <span className="text-[9px] font-black uppercase tracking-widest">{formattedTime}</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Typing Indicator */}
                   <div className="flex gap-5 items-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex-shrink-0" />
                      <div className="flex gap-1.5 px-6 py-4 bg-slate-100/50 rounded-2xl">
                         <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                         <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                         <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      </div>
                   </div>
                </div>

                {/* Mockup Input */}
                <div className="p-8 pt-0">
                   <div className="h-20 bg-white rounded-[2.5rem] border-2 border-slate-100 flex items-center px-8 shadow-2xl gap-5 group/input">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover/input:text-emerald-500 transition-colors cursor-pointer"><Smile size={24} /></div>
                      <div className="flex-1 text-[15px] font-black text-slate-300">Message #general...</div>
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-12 h-12 rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-100 flex items-center justify-center text-white cursor-pointer"
                      >
                        <ArrowRight size={24} strokeWidth={3} />
                      </motion.div>
                   </div>
                </div>
             </div>
          </motion.div>
        </div>
      </main>

      {/* Feature Section */}
      <section className="bg-white py-40 px-10 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-slate-200 to-transparent" />
        <div className="max-w-7xl mx-auto">
           <div className="text-center mb-32 space-y-6">
              <motion.h2 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.5em]"
              >
                Engineered for Teams
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-6xl font-black text-slate-900 tracking-tighter leading-tight max-w-3xl mx-auto"
              >
                The standard for modern <br /> <span className="text-slate-300">workplace presence.</span>
              </motion.p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <FeatureCard 
                icon={Hash} 
                title="Sovereign Channels" 
                desc="Self-organizing channels with intelligent indexing and instant retrieval." 
                delay={0}
              />
              <FeatureCard 
                icon={Lock} 
                title="Identity Verification" 
                desc="Bank-grade security powered by mobile-first identity protocols." 
                delay={0.1}
              />
              <FeatureCard 
                icon={Zap} 
                title="Zero Latency" 
                desc="Synchronous communication powered by a global edge-messaging network." 
                delay={0.2}
              />
           </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-10">
           <div className="flex flex-wrap justify-between items-center gap-12 grayscale opacity-40">
              {['ACME CORP', 'GLOBAL TECH', 'NEXUS LABS', 'VERIDIAN', 'QUANTUM'].map(brand => (
                <span key={brand} className="text-2xl font-black tracking-widest">{brand}</span>
              ))}
           </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-10 py-40 bg-white">
         <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="max-w-6xl mx-auto bg-slate-900 rounded-[5rem] p-24 text-center space-y-12 relative overflow-hidden"
         >
            <div className="absolute inset-0 bg-emerald-500/10" />
            <motion.div 
              animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/20 blur-[150px] rounded-full translate-x-1/3 -translate-y-1/3" 
            />
            
            <h2 className="text-7xl md:text-8xl font-black text-white relative z-10 tracking-tighter leading-[0.9] max-w-4xl mx-auto">
              Reclaim your team's <br /> <span className="text-emerald-500">focus space.</span>
            </h2>
            
            <div className="relative z-10 flex flex-col items-center gap-8">
              <button 
                onClick={() => navigate('/chat/signup')}
                className="px-16 py-7 bg-white text-slate-900 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-emerald-500 hover:text-white transition-all transform hover:-translate-y-2"
              >
                Launch Kural Space
              </button>
              <div className="flex items-center gap-6 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                 <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Unlimited Users</div>
                 <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Enterprise SLA</div>
              </div>
            </div>
         </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-10 bg-[#FDFDFD] border-t border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-20">
           <div className="md:col-span-2 space-y-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center p-2 shadow-2xl shadow-emerald-500/20">
                    <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-xl" />
                 </div>
                 <span className="font-black text-2xl tracking-tighter uppercase text-slate-900">Kural Space</span>
              </div>
              <p className="text-slate-400 font-semibold text-sm max-w-xs leading-relaxed">
                The high-fidelity communication engine for modern organizations that value deep focus and instant clarity.
              </p>
           </div>
           
           <div className="space-y-8">
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Digital Presence</h4>
              <ul className="space-y-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Workspace</a></li>
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Mobile App</a></li>
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Desktop</a></li>
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">API Docs</a></li>
              </ul>
           </div>

           <div className="space-y-8">
              <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Legal & Security</h4>
              <ul className="space-y-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Compliance</a></li>
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Privacy</a></li>
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Terms</a></li>
                 <li><a href="#" className="hover:text-emerald-500 transition-colors">Security</a></li>
              </ul>
           </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-24 pt-10 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-8">
           <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">© 2026 Kural Labs. Designed for excellence.</p>
           <div className="flex gap-8">
              <Globe size={16} className="text-slate-300 hover:text-emerald-500 cursor-pointer" />
              <Smartphone size={16} className="text-slate-300 hover:text-emerald-500 cursor-pointer" />
              <Lock size={16} className="text-slate-300 hover:text-emerald-500 cursor-pointer" />
           </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    viewport={{ once: true }}
    className="p-14 bg-white rounded-[4rem] border border-slate-50 hover:shadow-[0_60px_120px_-30px_rgba(0,0,0,0.1)] transition-all group cursor-pointer"
  >
    <div className="w-20 h-20 bg-slate-50 text-slate-900 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-inner transition-all group-hover:bg-emerald-500 group-hover:text-white group-hover:scale-110 group-hover:rotate-6">
      <Icon size={32} strokeWidth={2.5} />
    </div>
    <h3 className="text-3xl font-black mb-6 tracking-tighter text-slate-900">{title}</h3>
    <p className="text-slate-400 text-[15px] font-semibold leading-relaxed">{desc}</p>
    <div className="mt-12 flex items-center gap-3 text-emerald-500 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
        Deep Dive <ArrowRight size={16} strokeWidth={3} />
    </div>
  </motion.div>
);

export default ChatLanding;
