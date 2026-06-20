import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Video, MessageSquare, FileText, FileSpreadsheet, Presentation, Shield, Zap, Server, BarChart2, Layout, Users, ChevronRight, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import LogoImage from '../assets/landing-logo.png';
import AIEcosystemCircle from '../components/AIEcosystemCircle';
import { getApiUrl } from '../api';

const LandingPage = () => {
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  const startDemoAccount = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/auth/demo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start demo');

      localStorage.setItem('token', data.accessToken || data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('auth', JSON.stringify({
        role: data.user?.role || data.role,
        user: data.user?.name || data.user,
        email: data.user?.email || data.email,
        workspaceId: data.user?.workspaceId || data.workspaceId,
        avatarUrl: data.user?.avatarUrl
      }));
      
      navigate(`/w/${data.user?.workspaceId || data.workspaceId || 'demo-workspace'}/mail`);
    } catch (err) {
      console.error('Demo account error:', err);
      alert('Unable to start demo account right now. Please try again later.');
    } finally {
      setDemoLoading(false);
    }
  };
  return (
    <div className="min-h-screen w-full bg-slate-50 font-['Inter',sans-serif] text-slate-900">
      
      {/* Standard Header */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/">
              <img src={LogoImage} alt="Forge Logo" className="h-7 w-auto object-contain" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#products" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Products</a>
              <a href="#solutions" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Solutions</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#resources" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Resources</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <Link to="/login" className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-white border-b border-slate-200 pt-20 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
            The Complete Workspace for <span className="text-blue-600">Enterprise Teams</span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            Unify your communication, collaboration, and document management in a single, secure platform designed for scale and reliability.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={startDemoAccount} disabled={demoLoading} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-base shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
              {demoLoading ? <Loader2 size={18} className="animate-spin" /> : 'Start Free Trial'} {!demoLoading && <ChevronRight size={18} />}
            </button>
            <button className="w-full sm:w-auto bg-white text-slate-700 border border-slate-300 px-8 py-3.5 rounded-lg font-semibold hover:bg-slate-50 transition-colors text-base shadow-sm">
              Contact Sales
            </button>
          </div>
          <p className="mt-6 text-sm text-slate-500 font-medium">No credit card required. Free 14-day trial.</p>
        </div>
      </section>

      {/* Products Grid */}
      <section id="products" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Integrated Suite of Applications</h2>
            <p className="text-lg text-slate-600">Everything your organization needs to stay productive, seamlessly connected under one roof.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ProductCard 
              icon={Mail} 
              color="bg-blue-100 text-blue-700" 
              title="Mail" 
              description="Enterprise-grade email with advanced organization, security, and smart threading."
              link="/login?app=mail"
            />
            <ProductCard 
              icon={Video} 
              color="bg-green-100 text-green-700" 
              title="Meet" 
              description="Reliable, high-definition video conferencing for teams of any size."
              link="/login?app=meet"
            />
            <ProductCard 
              icon={MessageSquare} 
              color="bg-teal-100 text-teal-700" 
              title="Kural Chat" 
              description="Organized team messaging with channels, direct messages, and secure file sharing."
              link="/login?app=chat"
            />
            <ProductCard 
              icon={FileText} 
              color="bg-indigo-100 text-indigo-700" 
              title="Docs" 
              description="Real-time collaborative document editing with rich formatting options."
              link="/login?app=docs"
            />
            <ProductCard 
              icon={FileSpreadsheet} 
              color="bg-emerald-100 text-emerald-700" 
              title="Sheets" 
              description="Powerful spreadsheets for complex data analysis, financial modeling, and tracking."
              link="/login?app=sheets"
            />
            <ProductCard 
              icon={Presentation} 
              color="bg-orange-100 text-orange-700" 
              title="Slides" 
              description="Professional presentation builder with corporate templates and seamless sharing."
              link="/login?app=show"
            />
          </div>
        </div>
      </section>

      {/* AI Ecosystem Section */}
      <section className="py-24 lg:py-32 bg-white text-slate-900 border-t border-slate-200 relative overflow-hidden">
        {/* Soft Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-blue-50/50 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            
            {/* Text Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-semibold text-sm mb-6 shadow-sm">
                <Sparkles size={16} /> Forge India Connect AI Engine
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight text-slate-900">
                Omnipresent AI across your entire workspace
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Our proprietary AI isn't just a chatbot—it's deeply embedded into Mail, Meet, Docs, and Sheets. It contextually understands your projects, summarizes long email threads, generates draft replies, and instantly answers questions based on your entire organization's knowledge base.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link to="/login" className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3.5 rounded-lg font-bold hover:bg-blue-700 transition-colors text-base shadow-sm">
                  Experience Forge India Connect AI <ChevronRight size={18} />
                </Link>
              </div>
            </div>

            {/* Visuals */}
            <div className="flex-1 relative w-full pt-10 md:pt-0">
               <div className="relative z-10 w-full h-[500px] flex items-center justify-center">
                 <AIEcosystemCircle />
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-20 lg:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Built for the Enterprise</h2>
            <p className="text-lg text-slate-600">Security, compliance, and administration controls designed for large-scale deployments.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureBlock 
              icon={Shield} 
              title="Advanced Security" 
              description="End-to-end encryption, SSO integration, and comprehensive access controls."
            />
            <FeatureBlock 
              icon={Server} 
              title="99.99% Uptime SLA" 
              description="Highly available infrastructure with global data centers for maximum reliability."
            />
            <FeatureBlock 
              icon={Users} 
              title="Centralized Admin" 
              description="Manage users, devices, and security policies from a single intuitive dashboard."
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-center text-sm font-semibold text-slate-500 uppercase tracking-wider mb-8">Trusted by forward-thinking companies</h3>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60 grayscale">
            {/* Standard company logo placeholders text */}
            <div className="text-xl font-bold text-slate-800">Acme Corp</div>
            <div className="text-xl font-bold text-slate-800">GlobalTech</div>
            <div className="text-xl font-bold text-slate-800">Forge Industries</div>
            <div className="text-xl font-bold text-slate-800">Stark Dynamics</div>
            <div className="text-xl font-bold text-slate-800">Wayne Enterprises</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 bg-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to upgrade your workspace?</h2>
          <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto">
            Join thousands of organizations that rely on Forge to power their daily operations. Get started today or contact our sales team for a custom deployment plan.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={startDemoAccount} disabled={demoLoading} className="w-full sm:w-auto bg-white text-blue-700 px-8 py-3.5 rounded-lg font-bold hover:bg-blue-50 transition-colors text-base shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {demoLoading ? <Loader2 size={18} className="animate-spin" /> : 'Start Your Free Trial'}
            </button>
            <button className="w-full sm:w-auto bg-blue-600 border border-blue-500 text-white px-8 py-3.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors text-base shadow-sm">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <img src={LogoImage} alt="Forge Logo" className="h-8 w-auto object-contain mb-6 brightness-0 invert" />
              <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
                Forge provides enterprise-grade collaboration and productivity tools for modern organizations worldwide.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <p>© {new Date().getFullYear()} Forge Connect Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Helper Components
const ProductCard = ({ icon: Icon, color, title, description, link }) => (
  <Link to={link} className="group bg-white p-8 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 flex flex-col h-full block">
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 ${color}`}>
      <Icon size={24} />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">{title}</h3>
    <p className="text-slate-600 leading-relaxed mb-6 flex-grow">{description}</p>
    <div className="text-blue-600 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
      Learn more <ChevronRight size={16} />
    </div>
  </Link>
);

const FeatureBlock = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center text-center">
    <div className="w-16 h-16 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mb-6">
      <Icon size={32} strokeWidth={1.5} />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
