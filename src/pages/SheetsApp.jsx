import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import AppLayout from '../components/AppLayout';
import { FileSpreadsheet, Search, MoreVertical, Plus, Share2, Download, Printer, Bold, Italic, Underline, DollarSign, Percent, Trash2, Loader2, Save } from 'lucide-react';

const SheetsApp = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const workspaceId = auth.workspaceId || 'demo';
  const currentUserEmail = auth.email || 'guest@example.com';

  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSheet, setActiveSheet] = useState(null);
  const [saving, setSaving] = useState(false);

  // API Base URL - Managed by global config

  const fetchSheets = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/docs/${workspaceId}?type=Sheet`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) setSheets(data);
    } catch (err) {
      console.error('Failed to fetch sheets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, [workspaceId]);

  const handleCreate = async () => {
    try {
      const response = await fetch(getApiUrl('/api/docs/create'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          workspaceId,
          owner: auth.user || 'User',
          ownerEmail: currentUserEmail,
          title: 'Untitled Spreadsheet',
          type: 'Sheet',
          content: {}
        })
      });
      if (response.ok) {
        const newSheet = await response.json();
        setSheets([newSheet, ...sheets]);
        setActiveSheet(newSheet);
      }
    } catch (err) {
      console.error('Failed to create sheet:', err);
    }
  };

  const handleSave = async () => {
    if (!activeSheet) return;
    setSaving(true);
    try {
      const response = await fetch(getApiUrl(`/api/docs/${activeSheet._id}`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: activeSheet.content, title: activeSheet.title, lastModified: new Date() })
      });
      if (response.ok) {
        setSaving(false);
        fetchSheets();
      }
    } catch (err) {
      console.error('Failed to save sheet:', err);
    }
  };

  const updateCell = (cellId, value) => {
    setActiveSheet(prev => ({
      ...prev,
      content: {
        ...(prev.content || {}),
        [cellId]: value
      }
    }));
  };

  const renderEditor = () => {
    const cols = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i));
    const rows = Array.from({ length: 40 }, (_, i) => i + 1);

    return (
      <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-black overflow-hidden relative">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveSheet(null)} className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-all">← Back</button>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
            <input 
              type="text" 
              value={activeSheet.title} 
              onChange={e => setActiveSheet({...activeSheet, title: e.target.value})}
              className="font-bold text-sm bg-transparent border-none outline-none focus:ring-0 w-64"
            />
            {saving ? <Loader2 size={14} className="animate-spin opacity-40" /> : <Save size={14} className="text-emerald-500 opacity-40 cursor-pointer hover:opacity-100" onClick={handleSave} />}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary btn-sm px-4" onClick={handleSave}>Save Changes</button>
            <button className="btn btn-ghost btn-icon btn-sm"><Share2 size={16} /></button>
          </div>
        </div>

        {/* Formatting Bar */}
        <div className="h-10 border-b flex items-center gap-2 px-6 shrink-0 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <div className="w-16 h-6 flex items-center justify-center bg-zinc-200 dark:bg-zinc-800 rounded text-[10px] font-bold opacity-60">A1</div>
          <div className="flex-1 h-6 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-3 flex items-center gap-3">
             <span className="text-[10px] font-bold opacity-20 italic border-r pr-3 border-zinc-200 dark:border-zinc-800">fx</span>
             <input type="text" className="bg-transparent border-none outline-none text-xs flex-1" placeholder="Enter value..." />
          </div>
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-2" />
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg"><Bold size={14} /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg"><DollarSign size={14} /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg"><Percent size={14} /></button>
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto bg-white dark:bg-black">
           <div className="flex sticky top-0 z-20 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
              <div className="w-12 h-8 border-r border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-200/50 dark:bg-zinc-800/50" />
              {cols.map(c => (
                <div key={c} className="w-28 h-8 flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800 text-[10px] font-bold opacity-40 shrink-0">{c}</div>
              ))}
           </div>
           <div className="w-fit">
              {rows.map(r => (
                <div key={r} className="flex border-b border-zinc-100 dark:border-zinc-800/50">
                   <div className="w-12 h-6 flex items-center justify-center border-r border-zinc-200 dark:border-zinc-800 text-[9px] font-bold opacity-20 bg-zinc-50 dark:bg-zinc-900 sticky left-0 z-10 shrink-0">{r}</div>
                   {cols.map(c => {
                     const cellId = `${c}${r}`;
                     return (
                       <div key={cellId} className="w-28 h-6 border-r border-zinc-100 dark:border-zinc-800/50 px-2 flex items-center focus-within:ring-2 ring-emerald-500 ring-inset z-0 focus-within:z-10 shrink-0">
                          <input 
                            type="text" 
                            className="w-full h-full bg-transparent border-none outline-none text-[11px] font-medium" 
                            value={activeSheet.content?.[cellId] || ''}
                            onChange={(e) => updateCell(cellId, e.target.value)}
                          />
                       </div>
                     );
                   })}
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout appName="Sheets" appIcon={FileSpreadsheet} appColor="#10B981">
      {activeSheet ? renderEditor() : (
        <div className="flex h-full w-full">
          {/* Sidebar */}
          <div className="w-64 border-r shrink-0 flex flex-col bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
             <div className="p-6">
                <button onClick={handleCreate} className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold text-sm shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                   <Plus size={18} /> New Spreadsheet
                </button>
             </div>
             <div className="px-3 py-2 space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-4">Workspace Data</p>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl">
                   <FileSpreadsheet size={18} /> My Sheets
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-xl transition-all">
                   <Share2 size={18} /> Shared Sheets
                </button>
             </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-black">
             <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
                <h2 className="text-xl font-bold">Cloud Spreadsheets</h2>
                <div className="relative">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                   <input type="text" placeholder="Search data..." className="pl-10 pr-4 py-2 border dark:border-zinc-800 rounded-xl text-sm bg-zinc-50 dark:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
             </div>

             <div className="p-8 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-64 opacity-20"><Loader2 className="animate-spin" /></div>
                ) : sheets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale">
                     <FileSpreadsheet size={48} strokeWidth={1} className="mb-4" />
                     <p className="text-sm font-bold uppercase tracking-widest">No spreadsheets found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sheets.map(sheet => (
                      <div key={sheet._id} onClick={() => setActiveSheet(sheet)} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 hover:shadow-2xl hover:border-emerald-500/50 transition-all cursor-pointer flex flex-col">
                        <div className="flex items-start justify-between mb-8">
                           <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                              <FileSpreadsheet size={24} />
                           </div>
                           <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-500 transition-all"><Trash2 size={16} /></button>
                        </div>
                        <h3 className="font-bold text-sm truncate mb-2">{sheet.title}</h3>
                        <div className="flex items-center justify-between mt-auto text-[10px] font-bold uppercase tracking-widest opacity-40">
                           <span>{new Date(sheet.lastModified).toLocaleDateString()}</span>
                           <span>XLSX</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default SheetsApp;
