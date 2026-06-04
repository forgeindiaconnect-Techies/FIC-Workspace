import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import LogoImage from '../assets/landing-logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If we're already logged in, redirect
    const savedAuth = JSON.parse(localStorage.getItem('auth') || 'null');
    const savedToken = localStorage.getItem('token');
    if (savedAuth && savedToken) {
      if (savedAuth.role === 'super-admin') {
        navigate('/super-admin', { replace: true });
      } else {
        navigate(`/w/${savedAuth.workspaceId || 'demo'}/mail`, { replace: true });
      }
    }
  }, [location, navigate]);

  const handleAuth = async (e) => {
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
      const targetApp = params.get('app') || 'mail';

      if (normalizedAuthData.role === 'super-admin') {
        navigate('/super-admin');
      } else if (normalizedAuthData.role === 'company-admin') {
        navigate(`/w/${normalizedAuthData.workspaceId}/mail`);
      } else {
        // Role-specific redirection
        if (email.includes('dev')) navigate(`/w/${normalizedAuthData.workspaceId}/mail`);
        else if (email.includes('test')) navigate(`/w/${normalizedAuthData.workspaceId}/mail`);
        else if (email.includes('manager')) navigate(`/w/${normalizedAuthData.workspaceId}/mail`);
        else if (email.includes('lead')) navigate(`/w/${normalizedAuthData.workspaceId}/mail`);
        else navigate(targetApp === 'mail' ? `/w/${normalizedAuthData.workspaceId}/mail` : `/w/${normalizedAuthData.workspaceId}/${targetApp}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center font-['Hanken_Grotesk',sans-serif]">
      {/* Background with Blur Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-[#191C1E]/45 backdrop-blur-[2px]"></div>
      </div>

      {/* Back to Landing Page Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-white/70 hover:text-white text-sm font-semibold transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md"
      >
        <ChevronLeft size={18} /> Return to Landing Page
      </button>

      {/* Main Login Container */}
      <div className="relative z-10 w-[448px] bg-white rounded-lg shadow-[0px_4px_12px_rgba(24,36,66,0.05)] px-12 py-12 flex flex-col items-center">
        
        {/* Monogram Logo */}
        <div className="mb-6">
          <img src={LogoImage} alt="Forge Logo" className="h-[40px] w-auto object-contain" />
        </div>

        {/* Heading */}
        <div className="text-center mb-8 w-full">
          <h1 className="text-[#182442] font-semibold text-[32px] leading-[40px] tracking-[-0.32px] mb-1">
            Welcome back
          </h1>
          <p className="text-[#45464E] font-normal text-[16px] leading-[24px]">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleAuth} className="w-full flex flex-col gap-6">
          
          {/* Email Input */}
          <div className="flex flex-col gap-2">
            <label className="text-[#505F76] font-semibold text-[12px] leading-[16px] tracking-[0.6px] uppercase">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full h-[42px] bg-white border border-[#C6C6CE] rounded-[4px] px-4 text-[#6B7280] font-normal text-[16px] focus:outline-none focus:border-[#182442] transition-colors"
            />
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-[#505F76] font-semibold text-[12px] leading-[16px] tracking-[0.6px] uppercase">
                Password
              </label>
              <a href="#" className="text-[#182442] font-semibold text-[12px] leading-[16px] tracking-[0.6px]">
                Forgot?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-[42px] bg-white border border-[#C6C6CE] rounded-[4px] px-4 text-[#6B7280] font-normal text-[16px] focus:outline-none focus:border-[#182442] transition-colors"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[60px] bg-[#182442] text-white rounded-[8px] font-semibold text-[20px] leading-[28px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#25365e] transition-colors mt-2 flex items-center justify-center"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center my-8">
          <div className="flex-1 h-[1px] bg-[#C6C6CE]"></div>
          <span className="px-4 text-[#75777E] font-semibold text-[12px] leading-[16px] tracking-[0.6px]">
            OR
          </span>
          <div className="flex-1 h-[1px] bg-[#C6C6CE]"></div>
        </div>

        {/* Footer Link */}
        <div className="text-[#45464E] font-normal text-[14px] leading-[20px]">
          Don't have an account? <a href="#" className="font-semibold text-[#182442] hover:underline">Sign Up</a>
        </div>
      </div>

      {/* Page Footer Branding */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center opacity-75">
        <span className="text-[#3A4666] font-semibold text-[12px] leading-[16px] tracking-[0.6px]">
          © 2026 Forge Connect Inc. All rights reserved.
        </span>
      </div>
    </div>
  );
};

export default LoginPage;
