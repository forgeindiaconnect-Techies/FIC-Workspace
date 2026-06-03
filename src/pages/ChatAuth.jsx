import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getApiUrl } from '../api';
import { 
  ArrowRight, Phone, ShieldCheck, User, 
  ChevronLeft, Camera, Check, Loader2,
  MessageCircle, Sparkles, Zap, Globe, Smartphone, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [step, setStep] = useState(1); // 1: Mobile, 2: OTP, 3: Profile Setup
  const [mode, setMode] = useState('login'); 
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoOtp, setDemoOtp] = useState(''); // For testing convenience
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  const otpRefs = useRef([]);

  useEffect(() => {
    if (location.pathname === '/chat/signup') {
      setMode('signup');
    } else {
      setMode('login');
    }
  }, [location.pathname]);

  // Handle Mobile Submit
  const handleMobileSubmit = async (e) => {
    e.preventDefault();
    if (mobile.length < 10) return setError('Please enter a valid mobile number');
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch(getApiUrl('/api/auth/chat/request-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (data.otp) setDemoOtp(data.otp);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('');
    if (otpValue.length < 6) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(getApiUrl('/api/auth/chat/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: otpValue, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('token', data.accessToken || data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('auth', JSON.stringify({
        ...data.chatUser,
        isIndependent: true,
        workspaceId: 'independent'
      }));

      if (data.isNew || !data.user || data.user === 'New User') {
        setStep(3);
      } else {
        navigate('/w/independent/chat');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (username.length > 2) {
        setCheckingUsername(true);
        try {
          const res = await fetch(getApiUrl('/api/auth/chat/check-username'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });
          const data = await res.json();
          setIsUsernameAvailable(data.available);
        } catch (err) {
          console.error(err);
        } finally {
          setCheckingUsername(false);
        }
      } else {
        setIsUsernameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleProfileSetup = async (e) => {
    e.preventDefault();
    if (!isUsernameAvailable) return setError('Username is already taken');

    setLoading(true);
    const formData = new FormData();
    formData.append('mobile', mobile);
    formData.append('name', name);
    formData.append('username', username);
    if (profilePic) formData.append('profilePicture', profilePic);

    try {
      const res = await fetch(getApiUrl('/api/auth/chat/setup-profile'), {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const auth = JSON.parse(localStorage.getItem('auth'));
      localStorage.setItem('auth', JSON.stringify({ ...auth, ...data.chatUser }));
      
      navigate('/w/independent/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-inter selection:bg-emerald-500/30 overflow-hidden">
      {/* SaaS Visual Panel */}
      <div className="hidden lg:flex flex-col justify-between p-16 w-[520px] bg-emerald-500 relative overflow-hidden shrink-0">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-emerald-400 blur-[100px] rounded-full opacity-50" 
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-emerald-600 blur-[100px] rounded-full opacity-50" 
        />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/chat/welcome')}>
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-2xl shadow-emerald-900/20 group-hover:scale-110 transition-all p-1.5">
               <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-xl" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase text-white">Kural <span className="text-emerald-900/20">Messenger</span></span>
          </div>
        </div>

        <div className="relative z-10 space-y-12">
          <div className="space-y-6">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-7xl font-black text-white tracking-tighter leading-[0.85] drop-shadow-sm"
            >
              Connect <br />
              <span className="text-emerald-900/30">Instantly.</span>
            </motion.h2>
            <p className="text-emerald-50 text-xl font-semibold leading-relaxed opacity-90 max-w-sm">
              The world's most secure independent messenger for the next generation of teams.
            </p>
          </div>

          <div className="space-y-6">
             {[
               { icon: Lock, title: 'End-to-End', desc: 'Secure encryption' },
               { icon: Smartphone, title: 'Mobile First', desc: 'Simple OTP login' },
               { icon: Globe, title: 'Global Sync', desc: 'Real-time updates' }
             ].map((item, i) => (
               <motion.div 
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: i * 0.1 }}
                 key={i} 
                 className="flex gap-5 items-center group"
               >
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 shrink-0 group-hover:bg-white group-hover:text-emerald-500 transition-all shadow-lg">
                    <item.icon size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-[11px] uppercase tracking-widest">{item.title}</h4>
                    <p className="text-emerald-100 text-[10px] font-bold opacity-60 tracking-tight">{item.desc}</p>
                  </div>
               </motion.div>
             ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between">
           <p className="text-[10px] font-black text-emerald-900/30 uppercase tracking-[0.2em]">© 2026 Kural Messenger</p>
           <div className="flex gap-4">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
           </div>
        </div>
      </div>

      {/* Main Auth Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FDFDFD] relative">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : navigate('/chat/welcome')}
          className="absolute top-12 left-12 flex items-center gap-3 text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-emerald-500 transition-all group"
        >
          <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
            <ChevronLeft size={16} strokeWidth={3} />
          </div>
          {step > 1 ? 'Go Back' : 'Exit to Home'}
        </button>

        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-12"
              >
                <div className="text-center lg:text-left space-y-4">
                  <h1 className="text-5xl font-black tracking-tighter text-gray-900 leading-tight">
                    {mode === 'login' ? 'Welcome' : 'Join the'} <br />
                    <span className="text-emerald-500">{mode === 'login' ? 'Back.' : 'Revolution.'}</span>
                  </h1>
                  <p className="text-[13px] font-bold text-gray-400 max-w-[280px]">Secure your workspace with your mobile identity. No passwords required.</p>
                </div>

                <form onSubmit={handleMobileSubmit} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Mobile Access</label>
                    <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-3 text-gray-400 font-black text-sm">
                         <Smartphone size={18} /> <span className="opacity-40">|</span> <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        autoFocus
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full pl-24 pr-6 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black tracking-widest focus:outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/20 focus:bg-white transition-all shadow-inner"
                        placeholder="000 000 0000"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl text-[11px] font-black uppercase tracking-wider text-center"
                    >
                      {error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || mobile.length < 10}
                    className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-emerald-100 hover:bg-emerald-600 hover:-translate-y-1 active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <>Request Secure OTP <ArrowRight size={20} strokeWidth={3} /></>}
                  </button>
                  
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => navigate(mode === 'login' ? '/chat/signup' : '/chat/login')}
                      className="text-[11px] font-black text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors"
                    >
                      {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : step === 2 ? (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-12"
              >
                <div className="text-center lg:text-left space-y-4">
                  <h1 className="text-5xl font-black tracking-tighter text-gray-900 leading-tight">Verify <br /><span className="text-emerald-500">Security.</span></h1>
                  <p className="text-[13px] font-bold text-gray-400">A verification code has been dispatched to <span className="text-gray-900 font-black">+91 {mobile}</span></p>
                </div>

                <div className="space-y-10">
                  <div className="flex justify-between gap-3">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => otpRefs.current[i] = el}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !digit && i > 0) otpRefs.current[i-1].focus();
                        }}
                        className="w-12 h-16 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black text-gray-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/20 focus:bg-white outline-none transition-all shadow-inner"
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl text-[11px] font-black uppercase tracking-wider text-center">
                      {error}
                    </div>
                  )}

                  {demoOtp && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl text-center shadow-lg shadow-emerald-100/20"
                    >
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-2">Internal Debug Key</p>
                      <p className="text-3xl font-black text-emerald-900 tracking-[0.6em]">{demoOtp}</p>
                    </motion.div>
                  )}

                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.join('').length < 6}
                    className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-gray-200 hover:bg-emerald-500 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Confirm Identity'}
                  </button>
                  
                  <div className="text-center">
                    <button className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors">Resend authentication code</button>
                  </div>
                </div>
              </motion.div>
            ) : step === 3 ? (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-12"
              >
                <div className="text-center lg:text-left space-y-4">
                  <h1 className="text-5xl font-black tracking-tighter text-gray-900 leading-tight">Personalize <br /><span className="text-emerald-500">Account.</span></h1>
                  <p className="text-[13px] font-bold text-gray-400">Establish your digital presence in the Kural workspace.</p>
                </div>

                <form onSubmit={handleProfileSetup} className="space-y-8">
                  <div className="flex justify-center mb-10">
                    <div className="relative group">
                      <div className="w-36 h-36 rounded-[3rem] bg-gray-50 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center text-gray-200 relative group-hover:scale-105 transition-transform duration-500">
                        {previewUrl ? (
                          <img src={previewUrl} className="w-full h-full object-cover" />
                        ) : (
                          <User size={64} strokeWidth={1} />
                        )}
                      </div>
                      <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all border-4 border-white">
                        <Camera size={20} strokeWidth={2.5} />
                        <input type="file" className="hidden" onChange={onFileChange} accept="image/*" />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Full Identity</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-[2rem] text-sm font-black tracking-tight outline-none transition-all shadow-inner"
                        placeholder="Alex Rivers"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Workspace Handle</label>
                      <div className="relative">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black">@</div>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className={`w-full pl-12 pr-12 py-5 bg-gray-50 border-2 rounded-[2rem] text-sm font-black tracking-tight outline-none transition-all shadow-inner ${
                            isUsernameAvailable === true ? 'border-emerald-500/20 bg-white' : 
                            isUsernameAvailable === false ? 'border-rose-500/20' : 'border-transparent'
                          }`}
                          placeholder="username"
                          required
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2">
                          {checkingUsername && <Loader2 size={18} className="animate-spin text-gray-300" />}
                          {isUsernameAvailable === true && <Check size={18} className="text-emerald-500" strokeWidth={3} />}
                        </div>
                      </div>
                      {isUsernameAvailable === false && <p className="text-[9px] font-black text-rose-500 px-6 uppercase tracking-widest">Handle already claimed</p>}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isUsernameAvailable}
                    className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-gray-200 hover:bg-emerald-500 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-20"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Launch Workspace'}
                  </button>
                </form>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ChatAuth;

