import React, { useState } from 'react';
import { Mail, Video, MessageSquare, FileText, FileSpreadsheet, Presentation, Sparkles } from 'lucide-react';
import LogoImage from '../assets/landing-logo.png';
import MailAIAnimation from './MailAIAnimation';
import DocsAIAnimation from './DocsAIAnimation';
import ShowAIAnimation from './ShowAIAnimation';
import MeetAIAnimation from './MeetAIAnimation';
import ChatAIAnimation from './ChatAIAnimation';
import SheetsAIAnimation from './SheetsAIAnimation';

const AIEcosystemCircle = () => {
  const [hoveredApp, setHoveredApp] = useState(null);

  const apps = [
    { id: 'mail', name: 'Mail', icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100', feature: 'AI Generating Mail Feature', angle: 0 },
    { id: 'meet', name: 'Meet', icon: Video, color: 'text-green-600', bg: 'bg-green-100', feature: 'AI Meeting Summaries', angle: 60 },
    { id: 'chat', name: 'Chat', icon: MessageSquare, color: 'text-teal-600', bg: 'bg-teal-100', feature: 'AI Chat Moderation', angle: 120 },
    { id: 'docs', name: 'Docs', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100', feature: 'AI Content Generation', angle: 180 },
    { id: 'sheets', name: 'Sheets', icon: FileSpreadsheet, color: 'text-emerald-600', bg: 'bg-emerald-100', feature: 'AI Data Analysis', angle: 240 },
    { id: 'show', name: 'Show', icon: Presentation, color: 'text-orange-600', bg: 'bg-orange-100', feature: 'AI Slide Creation', angle: 300 },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square flex items-center justify-center p-8">
      {/* Central Core */}
      <div className="relative z-20 flex flex-col items-center justify-center w-52 h-52 bg-white rounded-full shadow-2xl border-4 border-blue-50/50">
        <img src={LogoImage} alt="Forge India" className="h-10 w-auto mb-3 object-contain" />
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap">
          <Sparkles size={12} className="flex-shrink-0" />
          Forge India Connect AI
        </div>
        
        {/* Pulsing rings */}
        <div className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-20 animate-ping" style={{ animationDuration: '3s' }}></div>
      </div>

      {/* Central Animation Overlay */}
      <div className={`absolute z-40 transition-all duration-500 transform
        ${['mail', 'docs', 'show', 'meet', 'chat', 'sheets'].includes(hoveredApp) ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        {hoveredApp === 'mail' && <MailAIAnimation />}
        {hoveredApp === 'docs' && <DocsAIAnimation />}
        {hoveredApp === 'show' && <ShowAIAnimation />}
        {hoveredApp === 'meet' && <MeetAIAnimation />}
        {hoveredApp === 'chat' && <ChatAIAnimation />}
        {hoveredApp === 'sheets' && <SheetsAIAnimation />}
      </div>

      {/* Connection Lines (Dashed SVG Circle) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <svg className="w-[85%] h-[85%] animate-[spin_60s_linear_infinite]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2 2" />
        </svg>
      </div>

      {/* Orbiting Apps */}
      {apps.map((app) => {
        // Calculate position based on angle
        const radius = 42; // Percentage of container
        const radian = (app.angle - 90) * (Math.PI / 180);
        const left = `calc(50% + ${radius * Math.cos(radian)}%)`;
        const top = `calc(50% + ${radius * Math.sin(radian)}%)`;

        const isHovered = hoveredApp === app.id;

        return (
          <div
            key={app.id}
            className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left, top }}
            onMouseEnter={() => setHoveredApp(app.id)}
            onMouseLeave={() => setHoveredApp(null)}
          >
            {/* Tooltip */}
            <div className={`absolute bottom-full mb-3 bg-slate-900 rounded-xl shadow-2xl transition-all duration-300 pointer-events-none flex flex-col items-center px-3 py-1.5 whitespace-nowrap text-white text-xs font-semibold
              ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            >
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="text-blue-400" />
                {app.feature}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
            </div>

            {/* Icon Circle */}
            <div className={`w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center cursor-pointer border-2 transition-all duration-300
              ${isHovered ? `border-blue-400 scale-110 shadow-blue-200` : 'border-slate-100 hover:scale-105'}`}
            >
              <div className={`w-12 h-12 rounded-xl ${app.bg} ${app.color} flex items-center justify-center`}>
                <app.icon size={24} strokeWidth={2.5} />
              </div>
            </div>
            
            {/* Label */}
            <div className="mt-2 text-sm font-bold text-slate-700 bg-white/80 px-2 rounded-md backdrop-blur-sm">
              {app.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AIEcosystemCircle;
