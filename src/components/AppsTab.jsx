import React, { useState } from 'react';
import { 
  Search, ExternalLink, Mail, FileText, FileSpreadsheet, Presentation, 
  MonitorPlay, Sparkles, LayoutGrid
} from 'lucide-react';

const INTERNAL_APPS = [
  { id: 'meet', name: 'Meetings', desc: 'Secure video conferencing & screen sharing', icon: MonitorPlay, color: '#00A884', bg: 'bg-[#E6F6F2]', path: '/meet' },
  { id: 'mail', name: 'Mail', desc: 'Enterprise email and communications', icon: Mail, color: '#EA4335', bg: 'bg-[#FCECEB]', path: '/mail' },
  { id: 'docs', name: 'Docs', desc: 'Collaborative word processing', icon: FileText, color: '#4285F4', bg: 'bg-[#ECF3FE]', path: '/docs' },
  { id: 'sheets', name: 'Sheets', desc: 'Spreadsheets and data analysis', icon: FileSpreadsheet, color: '#0F9D58', bg: 'bg-[#E7F5ED]', path: '/sheets' },
  { id: 'show', name: 'Show', desc: 'Beautiful presentations & slide decks', icon: Presentation, color: '#F4B400', bg: 'bg-[#FEF8E6]', path: '/show' },
];

const AppsTab = ({ workspaceId }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleLaunchInternal = (path) => {
    // Open the internal app in a new tab for this workspace
    window.open(`/w/${workspaceId}${path}`, '_blank');
  };

  const filteredInternal = INTERNAL_APPS.filter(app => app.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex-1 bg-[#F5F7FB] flex flex-col overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl w-full mx-auto px-8 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-[#0B1C30] flex items-center gap-3">
              <LayoutGrid size={28} className="text-[#2170E4]" /> App Directory
            </h1>
            <p className="text-[15px] text-gray-500 mt-2">Discover and launch built-in workspace tools.</p>
          </div>
          <button className="bg-white border border-gray-200 text-[#0B1C30] hover:bg-gray-50 px-5 py-2.5 rounded-xl text-[14px] font-bold flex items-center gap-2 transition-all shadow-sm">
            <Sparkles size={18} className="text-amber-500" /> Suggest App
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              placeholder="Search apps..." 
              className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3.5 text-[14px] outline-none focus:border-[#2170E4] focus:ring-2 focus:ring-[#2170E4]/10 transition-all font-medium text-[#0B1C30]" 
            />
          </div>
        </div>

        {/* Workspace Tools Section */}
        {filteredInternal.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[16px] font-bold text-[#0B1C30] mb-4 flex items-center gap-2 uppercase tracking-wide">
              Built-in Workspace Tools <span className="bg-blue-100 text-[#2170E4] text-[11px] px-2 py-0.5 rounded-full">{filteredInternal.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInternal.map(app => (
                <button 
                  key={app.id}
                  onClick={() => handleLaunchInternal(app.path)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-[#2170E4] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${app.bg}`}>
                      <app.icon size={24} color={app.color} strokeWidth={2.5} />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#2170E4] group-hover:text-white transition-colors">
                      <ExternalLink size={16} />
                    </div>
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0B1C30] group-hover:text-[#2170E4] transition-colors">{app.name}</h3>
                  <p className="text-[13px] text-gray-500 mt-1 line-clamp-2">{app.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredInternal.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm mt-8">
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400">
              <Search size={32} />
            </div>
            <h3 className="text-[20px] font-bold text-[#0B1C30] mb-2">No apps found</h3>
            <p className="text-gray-500 text-[15px] mb-6 max-w-sm mx-auto">We couldn't find any apps matching "{searchQuery}".</p>
            <button onClick={() => setSearchQuery('')} className="bg-gray-100 hover:bg-gray-200 text-[#0B1C30] px-6 py-2.5 rounded-xl text-[14px] font-bold transition-colors">
              Clear Search
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AppsTab;
