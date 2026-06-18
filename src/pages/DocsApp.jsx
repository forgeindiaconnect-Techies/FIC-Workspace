import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api';
import AppLayout, { SidebarProfile } from '../components/AppLayout';
import { 
  FileText, Plus, Search, MoreVertical, Upload, Share2, Download, Printer, 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Loader2, X, Type, Undo, Redo, 
  ChevronDown, Palette, Highlighter, Link2, ImageIcon, 
  Indent, Outdent, Eraser, Quote, Scissors, Copy, Clipboard,
  Strikethrough, Subscript, Superscript, CaseUpper, Grid,
  Maximize2, Minimize2, Table as TableIcon, Columns, 
  Settings2, HelpCircle, Save, FilePlus, Lock, Globe, Shield, Users
} from 'lucide-react';

const DocsApp = () => {
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const workspaceId = auth.workspaceId || 'demo';
  const currentUserEmail = auth.email || 'guest@example.com';

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showShapesPicker, setShowShapesPicker] = useState(false);
  const [showPicturePicker, setShowPicturePicker] = useState(false);
  const [hoveredGrid, setHoveredGrid] = useState({ r: 0, c: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [menuOpenForId, setMenuOpenForId] = useState(null);

  // Close menu when clicking outside
  useEffect(() => {
    const closeMenu = () => setMenuOpenForId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // API Base URL - Managed by global config

  const fetchDocs = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/docs/${workspaceId}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.filter(d => d.type === 'Doc'));
      }
    } catch (err) {
      console.error('Failed to fetch docs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePrivacy = async (doc) => {
    try {
      const newStatus = !doc.isPublic;
      const response = await fetch(getApiUrl(`/api/docs/${doc._id}`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPublic: newStatus })
      });
      if (response.ok) {
        setDocuments(documents.map(d => d._id === doc._id ? { ...d, isPublic: newStatus } : d));
      } else {
        alert('Failed to update privacy setting. You may not have permission.');
      }
    } catch (error) {
      console.error('Error toggling privacy:', error);
    }
  };

  useEffect(() => {
    fetchDocs();
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
          title: 'Untitled Document',
          type: 'Doc',
          content: { html: '<h1>Untitled Document</h1><p>Start typing...</p>' }
        })
      });
      if (response.ok) {
        const newDoc = await response.json();
        setDocuments([newDoc, ...documents]);
        setActiveDoc(newDoc);
      }
    } catch (err) {
      console.error('Failed to create doc:', err);
    }
  };

  const handleSave = async () => {
    if (!activeDoc) return;
    setSaving(true);
    try {
      const editor = document.getElementById('doc-editor');
      const html = editor.innerHTML;
      const response = await fetch(getApiUrl(`/api/docs/${activeDoc._id}`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: { html }, lastModified: new Date() })
      });
      if (response.ok) {
        setSaving(false);
        fetchDocs();
      }
    } catch (err) {
      console.error('Failed to save doc:', err);
    }
  };

  const syncContent = () => {
    const editor = document.getElementById('doc-editor');
    if (editor && activeDoc) {
      setActiveDoc(prev => ({
        ...prev,
        content: { ...prev.content, html: editor.innerHTML }
      }));
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await fetch(getApiUrl('/api/docs/generate'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      if (response.ok) {
        const data = await response.json();
        const editor = document.getElementById('doc-editor');
        if (editor) {
          editor.innerHTML = data.html;
          syncContent();
          setAiPrompt('');
        }
      }
    } catch (err) {
      console.error('Failed to generate document:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!activeDoc) return;
    const editor = document.getElementById('doc-editor');
    const htmlContent = editor.innerHTML;
    
    const fileContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${activeDoc.title || 'Document'}</title>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', fileContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDoc.title || 'Document'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const insertTable = (rows, cols) => {
    const editor = document.getElementById('doc-editor');
    if(editor) editor.focus();
    
    let html = '<table style="width:100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0;">';
    for(let i=0; i<rows; i++) {
      html += '<tr>';
      for(let j=0; j<cols; j++) {
        html += '<td style="padding: 12px; border: 1px solid #e2e8f0; min-height: 40px;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    syncContent();
    setShowTablePicker(false);
  };

  const insertShape = (type) => {
    const editor = document.getElementById('doc-editor');
    if(editor) editor.focus();

    let html = '';
    const style = "display: inline-block; margin: 10px; vertical-align: middle;";
    switch(type) {
      case 'line': html = `<hr style="border: none; border-top: 2px solid #334155; margin: 24px 0;" />`; break;
      case 'rect': html = `<div style="${style} width: 120px; height: 80px; border: 2px solid #3b82f6; background: #eff6ff;"></div>`; break;
      case 'circle': html = `<div style="${style} width: 100px; height: 100px; border-radius: 50%; border: 2px solid #3b82f6; background: #eff6ff;"></div>`; break;
      case 'triangle': html = `<div style="${style} width: 0; height: 0; border-left: 50px solid transparent; border-right: 50px solid transparent; border-bottom: 86px solid #3b82f6;"></div>`; break;
      case 'star': html = `<div style="${style} font-size: 80px; color: #f59e0b;">★</div>`; break;
      case 'heart': html = `<div style="${style} font-size: 80px; color: #ef4444;">❤</div>`; break;
      case 'arrow-right': html = `<div style="${style} font-size: 40px; color: #3b82f6;">➜</div>`; break;
      case 'arrow-left': html = `<div style="${style} font-size: 40px; color: #3b82f6;">⬅</div>`; break;
      default: break;
    }
    if(html) {
      document.execCommand('insertHTML', false, html);
      syncContent();
    }
    setShowShapesPicker(false);
  };

  const handleLocalImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const editor = document.getElementById('doc-editor');
        if(editor) editor.focus();
        document.execCommand('insertImage', false, event.target.result);
        syncContent();
      };
      reader.readAsDataURL(file);
    }
    setShowPicturePicker(false);
  };

  const renderEditor = () => (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-black overflow-hidden relative print:overflow-visible print:h-auto">
      {/* Ribbon Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 print:hidden">
        <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveDoc(null)} className="text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
              ← Close
            </button>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-500" />
              <input 
                type="text" 
                value={activeDoc.title} 
                onChange={e => setActiveDoc({...activeDoc, title: e.target.value})}
                className="font-bold text-sm bg-transparent border-none outline-none focus:ring-0 w-64"
              />
            </div>
            {saving ? (
              <span className="text-[10px] opacity-40 animate-pulse uppercase font-bold tracking-widest">Saving...</span>
            ) : (
              <span className="text-[10px] text-green-500 uppercase font-bold tracking-widest">Saved to Drive</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-bold transition-colors">
              <Upload size={14} /> Import
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {/* Ribbon Tabs */}
        <div className="flex items-center px-6 pt-1 gap-1">
          {['File', 'Home', 'Insert', 'Design', 'Layout', 'References', 'Review', 'View'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all relative ${
                activeTab === tab 
                ? 'text-zinc-900 dark:text-white' 
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
          ))}
        </div>

        {/* Ribbon Content */}
        <div className="h-28 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center px-6 gap-6 relative z-50">
          {activeTab === 'Home' && (
            <>
              {/* Clipboard Group */}
              <div className="flex flex-col h-20 border-r border-zinc-200 dark:border-zinc-800 pr-6 shrink-0">
                <div className="flex-1 flex items-center gap-2">
                  <button className="flex flex-col items-center justify-center gap-1 p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all group">
                    <Clipboard size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold">Paste</span>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button className="flex items-center gap-2 px-2 py-1 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-[10px] font-bold">
                      <Scissors size={12} /> Cut
                    </button>
                    <button className="flex items-center gap-2 px-2 py-1 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-[10px] font-bold">
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center mt-auto pb-1">Clipboard</div>
              </div>

              {/* Font Group */}
              <div className="flex flex-col h-20 border-r border-zinc-200 dark:border-zinc-800 pr-6 shrink-0">
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <select 
                      onChange={(e) => document.execCommand('fontName', false, e.target.value)}
                      className="text-[10px] font-bold bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 w-32 outline-none"
                    >
                      <option>Inter</option>
                      <option>Arial</option>
                      <option>Times New Roman</option>
                    </select>
                    <select 
                      onChange={(e) => document.execCommand('fontSize', false, e.target.value)}
                      className="text-[10px] font-bold bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 w-16 outline-none"
                    >
                      <option value="1">12</option>
                      <option value="3">16</option>
                      <option value="5">24</option>
                      <option value="7">48</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => document.execCommand('bold')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><Bold size={12} /></button>
                    <button onClick={() => document.execCommand('italic')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><Italic size={12} /></button>
                    <button onClick={() => document.execCommand('underline')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><Underline size={12} /></button>
                    <button onClick={() => document.execCommand('strikeThrough')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><Strikethrough size={12} /></button>
                    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                    <div className="relative">
                      <button className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm text-red-500"><Palette size={12} /></button>
                      <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => document.execCommand('foreColor', false, e.target.value)} />
                    </div>
                    <div className="relative">
                      <button className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm text-yellow-500"><Highlighter size={12} /></button>
                      <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => document.execCommand('backColor', false, e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center mt-auto pb-1">Font</div>
              </div>

              {/* Paragraph Group */}
              <div className="flex flex-col h-20 border-r border-zinc-200 dark:border-zinc-800 pr-6 shrink-0">
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => document.execCommand('insertUnorderedList')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><List size={12} /></button>
                    <button onClick={() => document.execCommand('insertOrderedList')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><ListOrdered size={12} /></button>
                    <button onClick={() => document.execCommand('outdent')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><Outdent size={12} /></button>
                    <button onClick={() => document.execCommand('indent')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><Indent size={12} /></button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => document.execCommand('justifyLeft')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><AlignLeft size={12} /></button>
                    <button onClick={() => document.execCommand('justifyCenter')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><AlignCenter size={12} /></button>
                    <button onClick={() => document.execCommand('justifyRight')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><AlignRight size={12} /></button>
                    <button onClick={() => document.execCommand('justifyFull')} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-800 shadow-sm"><AlignJustify size={12} /></button>
                  </div>
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center mt-auto pb-1">Paragraph</div>
              </div>

              {/* Styles Group */}
              <div className="flex flex-col h-20 pr-6 shrink-0 max-w-[400px]">
                <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {[
                    { label: 'Normal', tag: 'p', style: 'text-zinc-600' },
                    { label: 'Heading 1', tag: 'h1', style: 'font-black text-lg text-zinc-900' },
                    { label: 'Heading 2', tag: 'h2', style: 'font-black text-sm text-zinc-700' },
                    { label: 'Title', tag: 'h1', style: 'font-black text-xl text-zinc-950 underline underline-offset-4' }
                  ].map(item => (
                    <button 
                      key={item.label}
                      onClick={() => document.execCommand('formatBlock', false, item.tag)}
                      className="h-full min-w-[80px] flex flex-col items-center justify-center p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-blue-500 transition-all shrink-0"
                    >
                      <span className={`${item.style} leading-none mb-1`}>AaBb</span>
                      <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{item.label}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center mt-auto pb-1">Styles</div>
              </div>
            </>
          )}

          {activeTab === 'Insert' && (
             <>
               <div className="relative">
                 <button 
                  onClick={() => setShowPicturePicker(!showPicturePicker)}
                  className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all"
                 >
                   <ImageIcon size={24} className="text-orange-500" />
                   <span className="text-[10px] font-bold">Pictures</span>
                 </button>

                 {showPicturePicker && (
                   <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[100] w-[220px]">
                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 px-2">Insert Picture From</p>
                     <div className="space-y-1">
                        <label className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-3 cursor-pointer">
                          <ImageIcon size={14} className="text-blue-500" />
                          <span>This Device...</span>
                          <input type="file" className="hidden" accept="image/*" onChange={handleLocalImage} />
                        </label>
                        <button onClick={() => {
                          const url = prompt('Enter Online Picture URL:');
                          if(url) document.execCommand('insertImage', false, url);
                          setShowPicturePicker(false);
                        }} className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-3">
                          <Search size={14} className="text-emerald-500" />
                          <span>Online Pictures...</span>
                        </button>
                        <button className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-3 opacity-50">
                          <Grid size={14} className="text-purple-500" />
                          <span>Stock Images...</span>
                        </button>
                     </div>
                   </div>
                 )}
               </div>
               
               <div className="relative">
                 <button 
                  onClick={() => setShowTablePicker(!showTablePicker)}
                  className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all"
                 >
                   <TableIcon size={24} className="text-blue-500" />
                   <span className="text-[10px] font-bold">Table</span>
                 </button>

                 {showTablePicker && (
                   <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[100] w-[240px]">
                     <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 flex justify-between">
                       <span>Insert Table</span>
                       <span className="text-blue-500">{hoveredGrid.c} x {hoveredGrid.r}</span>
                     </div>
                     <div className="grid grid-cols-10 gap-1 mb-4">
                       {[...Array(8)].map((_, r) => (
                         [...Array(10)].map((_, c) => (
                           <div 
                             key={`${r}-${c}`}
                             onMouseEnter={() => setHoveredGrid({ r: r+1, c: c+1 })}
                             onClick={() => insertTable(r+1, c+1)}
                             className={`w-4 h-4 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer ${
                               r < hoveredGrid.r && c < hoveredGrid.c 
                               ? 'bg-blue-500 border-blue-600' 
                               : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                             }`}
                           />
                         ))
                       ))}
                     </div>
                     <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                        <button onClick={() => {
                          const r = prompt('Rows:', '3');
                          const c = prompt('Cols:', '3');
                          if(r && c) insertTable(parseInt(r), parseInt(c));
                        }} className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2">
                          <TableIcon size={12} /> Insert Table...
                        </button>
                        <button className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 opacity-50">
                          <Eraser size={12} /> Draw Table
                        </button>
                     </div>
                   </div>
                 )}
               </div>

               <div className="relative">
                 <button 
                  onClick={() => setShowShapesPicker(!showShapesPicker)}
                  className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all"
                 >
                   <Columns size={24} className="text-emerald-500" />
                   <span className="text-[10px] font-bold">Shapes</span>
                 </button>

                 {showShapesPicker && (
                   <div className="absolute top-full left-0 mt-2 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[100] w-[320px] max-h-[400px] overflow-y-auto no-scrollbar">
                     <div className="space-y-6">
                       <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Lines</p>
                         <div className="flex flex-wrap gap-2">
                           <button onClick={() => insertShape('line')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-200 transition-all">
                             <div className="w-8 h-px bg-zinc-900 dark:bg-white" />
                           </button>
                           <button onClick={() => insertShape('arrow-right')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-200 transition-all font-bold text-lg">➜</button>
                           <button onClick={() => insertShape('arrow-left')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-200 transition-all font-bold text-lg">⬅</button>
                         </div>
                       </div>

                       <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Rectangles</p>
                         <div className="flex flex-wrap gap-2">
                           <button onClick={() => insertShape('rect')} className="w-10 h-8 border-2 border-zinc-400 rounded-sm hover:border-blue-500 transition-colors" />
                           <button onClick={() => insertShape('rect')} className="w-10 h-8 border-2 border-zinc-400 rounded-md hover:border-blue-500 transition-colors" />
                         </div>
                       </div>

                       <div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Basic Shapes</p>
                         <div className="flex flex-wrap gap-3 items-center">
                           <button onClick={() => insertShape('circle')} className="w-10 h-10 border-2 border-zinc-400 rounded-full hover:border-blue-500 transition-colors" />
                           <button onClick={() => insertShape('triangle')} className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-bottom-[26px] border-bottom-zinc-400 hover:border-bottom-blue-500 transition-colors" />
                           <button onClick={() => insertShape('star')} className="text-2xl text-zinc-400 hover:text-amber-500 transition-colors">★</button>
                           <button onClick={() => insertShape('heart')} className="text-2xl text-zinc-400 hover:text-red-500 transition-colors">❤</button>
                         </div>
                       </div>

                       <div className="opacity-30 pointer-events-none">
                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">Block Arrows</p>
                         <div className="flex flex-wrap gap-2">
                           <div className="w-8 h-8 border-2 border-zinc-400" />
                           <div className="w-8 h-8 border-2 border-zinc-400" />
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
               </div>
             </>
          )}

          {activeTab === 'File' && (
             <>
               <button onClick={handleSave} className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all">
                 <Save size={24} className="text-blue-500" />
                 <span className="text-[10px] font-bold">Save</span>
               </button>
               <button onClick={handleCreate} className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all">
                 <FilePlus size={24} className="text-emerald-500" />
                 <span className="text-[10px] font-bold">New</span>
               </button>
               <button onClick={handleDownload} className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all">
                 <Download size={24} className="text-purple-500" />
                 <span className="text-[10px] font-bold">Download</span>
               </button>
               <button onClick={() => window.print()} className="flex flex-col items-center justify-center gap-2 p-4 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all">
                 <Printer size={24} className="text-zinc-600" />
                 <span className="text-[10px] font-bold">Print</span>
               </button>
             </>
          )}
        </div>
      </div>

      {/* Editor Surface */}
      <div className="flex-1 overflow-y-auto p-12 flex items-start justify-center bg-zinc-100 dark:bg-black gap-8 relative print:p-0 print:bg-white print:overflow-visible">
        <div 
          id="doc-editor"
          className="w-full max-w-[816px] h-max min-h-[1056px] bg-white dark:bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-sm p-24 focus:outline-none text-base leading-relaxed document-surface shrink-0 print:shadow-none print:max-w-none print:w-full print:min-h-0" 
          contentEditable 
          suppressContentEditableWarning
          onBlur={syncContent}
          dangerouslySetInnerHTML={{ __html: activeDoc.content?.html || '' }}
        />

        {/* AI Assistant Sidebar */}
        <div className="w-80 shrink-0 h-fit bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm sticky top-12 border border-zinc-200 dark:border-zinc-800 print:hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center">
              <Settings2 size={16} />
            </div>
            <h3 className="font-bold text-sm">AI Assistant</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
            Describe the document you want to create, and the AI will generate it for you instantly.
          </p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="w-full h-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-3 resize-none"
            placeholder="E.g., Write a project requirements document for a new messaging app..."
          />
          <button
            onClick={handleGenerateAI}
            disabled={isGenerating || !aiPrompt.trim()}
            className="w-full bg-blue-600 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <><Loader2 size={16} className="animate-spin" /> Generating...</>
            ) : (
              'Prepare Document'
            )}
          </button>
        </div>
      </div>
      </div>
  );

  return (
    <AppLayout appName="Docs" appIcon={FileText} appColor="#0891B2">
      {activeDoc ? renderEditor() : (
        <div className="flex h-full w-full">
          {/* Sidebar */}
          <div className="w-64 border-r shrink-0 flex flex-col bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <div className="p-5">
              <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl">
                <Plus size={18} /> New Document
              </button>
            </div>
            <div className="px-3 py-2 space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-4">Workspace Drive</p>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl">
                <FileText size={18} /> My Documents
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-all">
                <Share2 size={18} /> Shared Space
              </button>
            </div>
            <SidebarProfile />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-black">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
              <h2 className="text-xl font-bold">Workspace Drive</h2>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="text" placeholder="Search files..." className="pl-10 pr-4 py-2 border dark:border-zinc-800 rounded-xl text-sm bg-zinc-50 dark:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-900" />
              </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 opacity-20">
                  <Loader2 className="animate-spin mb-2" />
                  <p className="text-sm font-bold uppercase tracking-widest">Loading Drive...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 opacity-20 grayscale">
                  <FileText size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Your drive is empty</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {documents.map(doc => (
                    <div key={doc._id} onClick={() => setActiveDoc(doc)} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 hover:shadow-2xl hover:border-zinc-900 transition-all cursor-pointer flex flex-col relative">
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white shrink-0 group-hover:scale-110 transition-transform relative">
                          <FileText size={24} />
                          {doc.isPublic && (
                            <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm" title="Public Document">
                              <Globe size={10} />
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setMenuOpenForId(menuOpenForId === doc._id ? null : doc._id); 
                            }}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical size={16} />
                          </button>
                          
                          {menuOpenForId === doc._id && (
                            <div className="absolute right-0 top-10 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleTogglePrivacy(doc); 
                                  setMenuOpenForId(null); 
                                }}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-3 transition-colors"
                              >
                                {doc.isPublic ? <Lock size={16} className="text-zinc-500" /> : <Globe size={16} className="text-amber-500" />}
                                <div className="flex flex-col">
                                  <span className="font-semibold">{doc.isPublic ? 'Make Private' : 'Make Public'}</span>
                                  <span className="text-[10px] text-zinc-500">{doc.isPublic ? 'Only you can view' : 'Team can view'}</span>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-sm truncate mb-2">{doc.title}</h3>
                      <div className="flex items-center justify-between mt-auto text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        <span>{new Date(doc.lastModified).toLocaleDateString()}</span>
                        <span>Doc</span>
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

export default DocsApp;
