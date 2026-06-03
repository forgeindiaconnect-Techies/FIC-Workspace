import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { Presentation, Search, MoreVertical, Upload, Share2, Download, Play, Plus, Type, Image as ImageIcon, Layout, Video, Settings2, Loader2, Sparkles, Wand2, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import pptxgen from 'pptxgenjs';
import { getApiUrl } from '../api';

const THEMES = {
  modern: { bg: 'bg-white dark:bg-zinc-900', text: 'text-zinc-900 dark:text-white', primary: 'text-blue-600 dark:text-blue-400', font: 'font-sans' },
  corporate: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-100', primary: 'text-indigo-700 dark:text-indigo-400', font: 'font-serif' },
  playful: { bg: 'bg-yellow-50 dark:bg-orange-950', text: 'text-orange-900 dark:text-orange-100', primary: 'text-pink-600 dark:text-pink-400', font: 'font-sans font-bold' },
  dark: { bg: 'bg-zinc-950', text: 'text-zinc-100', primary: 'text-emerald-400', font: 'font-sans' },
  elegant: { bg: 'bg-stone-50 dark:bg-stone-900', text: 'text-stone-800 dark:text-stone-200', primary: 'text-amber-700 dark:text-amber-500', font: 'font-serif' }
};

const PPTX_THEMES = {
  modern: { bg: 'FFFFFF', text: '18181B', primary: '2563EB', font: 'Arial' },
  corporate: { bg: 'F1F5F9', text: '1E293B', primary: '4338CA', font: 'Georgia' },
  playful: { bg: 'FEFCE8', text: '7C2D12', primary: 'DB2777', font: 'Comic Sans MS' },
  dark: { bg: '09090B', text: 'F4F4F5', primary: '34D399', font: 'Arial' },
  elegant: { bg: 'FAFAF9', text: '292524', primary: 'B45309', font: 'Times New Roman' }
};

const SlideRenderer = ({ slide, themeKey = 'modern', isPresenting = false }) => {
  const theme = THEMES[themeKey] || THEMES.modern;
  
  if (!slide) return <div className="flex-1 flex items-center justify-center text-gray-400">Empty Slide</div>;

  const contentClass = isPresenting ? "text-2xl" : "text-lg";
  const titleClass = isPresenting ? "text-6xl mb-12" : "text-4xl mb-8";
  
  switch (slide.layout) {
    case 'title':
      return (
        <div className={`flex-1 flex flex-col items-center justify-center p-16 text-center ${theme.bg} ${theme.text} ${theme.font} h-full`}>
          <h1 className={`${isPresenting ? 'text-7xl mb-8' : 'text-5xl mb-6'} font-black ${theme.primary}`}>{slide.title}</h1>
          {slide.subtitle && <p className={`${isPresenting ? 'text-3xl' : 'text-xl'} opacity-80`}>{slide.subtitle}</p>}
        </div>
      );
    case 'bullets':
      return (
        <div className={`flex-1 flex flex-col p-16 ${theme.bg} ${theme.text} ${theme.font} h-full`}>
          <h2 className={`${titleClass} font-bold ${theme.primary}`}>{slide.title}</h2>
          <ul className={`list-disc pl-8 space-y-4 ${contentClass} flex-1`}>
            {(Array.isArray(slide.content) ? slide.content : []).map((point, i) => (
              <li key={i} className="leading-relaxed">{point}</li>
            ))}
          </ul>
        </div>
      );
    case 'split':
      return (
        <div className={`flex-1 flex flex-col p-16 ${theme.bg} ${theme.text} ${theme.font} h-full`}>
          <h2 className={`${titleClass} font-bold ${theme.primary}`}>{slide.title}</h2>
          <div className="flex-1 flex gap-12">
            <div className="flex-1">
              <ul className={`list-disc pl-6 space-y-4 ${contentClass}`}>
                {(Array.isArray(slide.content) ? slide.content.slice(0, Math.ceil(slide.content.length/2)) : []).map((point, i) => (
                  <li key={i} className="leading-relaxed">{point}</li>
                ))}
              </ul>
            </div>
            <div className="flex-1">
              <ul className={`list-disc pl-6 space-y-4 ${contentClass}`}>
                {(Array.isArray(slide.content) ? slide.content.slice(Math.ceil(slide.content.length/2)) : []).map((point, i) => (
                  <li key={i} className="leading-relaxed">{point}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    case 'quote':
      return (
        <div className={`flex-1 flex flex-col items-center justify-center p-16 text-center ${theme.bg} ${theme.text} ${theme.font} h-full`}>
          <h2 className={`${titleClass} font-bold ${theme.primary}`}>{slide.title}</h2>
          <blockquote className={`${isPresenting ? 'text-4xl' : 'text-2xl'} font-serif italic border-l-4 border-current pl-6 py-2 opacity-90 max-w-3xl`}>
            "{Array.isArray(slide.content) ? slide.content[0] : slide.content}"
          </blockquote>
        </div>
      );
    default:
      return (
        <div className={`flex-1 flex flex-col p-16 ${theme.bg} ${theme.text} ${theme.font} h-full`}>
          <h2 className={`${titleClass} font-bold ${theme.primary}`}>{slide.title}</h2>
          <div className={`${contentClass} leading-relaxed`}>{Array.isArray(slide.content) ? slide.content.join(', ') : slide.content}</div>
        </div>
      );
  }
};


const ShowApp = () => {
  const [presentations, setPresentations] = useState(() => {
    const saved = localStorage.getItem('dominators_show');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dominators_show', JSON.stringify(presentations));
  }, [presentations]);
  
  const [activeDeck, setActiveDeck] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  // Present Mode Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPresenting) return;
      if (e.key === 'Escape') setIsPresenting(false);
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setActiveSlide(prev => Math.min(prev + 1, (activeDeck?.slides?.length || 1) - 1));
      }
      if (e.key === 'ArrowLeft') {
        setActiveSlide(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresenting, activeDeck]);

  const handleUpload = () => {
    const newDeck = {
      id: Date.now(),
      name: 'Untitled Presentation.pptx',
      modified: 'Just now',
      author: 'You',
      size: '0 KB',
      theme: 'modern',
      slides: [
        { layout: 'title', title: 'Click to add title', subtitle: 'Click to add subtitle' }
      ]
    };
    setPresentations([newDeck, ...presentations]);
    setActiveDeck(newDeck);
    setActiveSlide(0);
  };

  const updateActiveDeck = (updates) => {
    const updatedDeck = { ...activeDeck, ...updates };
    setActiveDeck(updatedDeck);
    setPresentations(presentations.map(p => p.id === updatedDeck.id ? updatedDeck : p));
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      if (!activeDeck) handleUpload(); 

      const response = await fetch(getApiUrl('/api/show/generate'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      if (!response.ok) throw new Error('Failed to generate presentation');

      const data = await response.json();
      if (data.slides && data.slides.length > 0) {
        updateActiveDeck({ slides: data.slides, theme: data.theme || 'modern' });
        setActiveSlide(0);
      }
      setAiPrompt('');
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to generate presentation. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPPT = () => {
    if (!activeDeck) return;
    
    const pres = new pptxgen();
    pres.author = 'Kural AI Presentation';
    pres.company = 'Nexus Workspace';
    
    const themeConf = PPTX_THEMES[activeDeck.theme] || PPTX_THEMES.modern;

    activeDeck.slides.forEach(slide => {
      const pptSlide = pres.addSlide();
      pptSlide.background = { color: themeConf.bg };
      pptSlide.color = themeConf.text;

      const titleOpts = { 
        x: 0.5, y: 0.5, w: '90%', h: 1.5, 
        fontSize: 36, color: themeConf.primary, fontFace: themeConf.font, 
        bold: true 
      };

      if (slide.layout === 'title') {
        titleOpts.y = '40%';
        titleOpts.align = 'center';
        pptSlide.addText(slide.title, titleOpts);
        
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, { 
            x: 0.5, y: '60%', w: '90%', align: 'center', 
            fontSize: 24, color: themeConf.text, fontFace: themeConf.font 
          });
        }
      } else if (slide.layout === 'bullets') {
        pptSlide.addText(slide.title, titleOpts);
        const bulletData = Array.isArray(slide.content) ? slide.content : [slide.content];
        pptSlide.addText(bulletData.join('\n'), { 
          x: 0.5, y: 2.0, w: '90%', h: 4, 
          fontSize: 20, color: themeConf.text, fontFace: themeConf.font, bullet: true 
        });
      } else if (slide.layout === 'split') {
        pptSlide.addText(slide.title, titleOpts);
        const bulletData = Array.isArray(slide.content) ? slide.content : [slide.content];
        const half = Math.ceil(bulletData.length / 2);
        pptSlide.addText(bulletData.slice(0, half).join('\n'), { 
          x: 0.5, y: 2.0, w: '40%', h: 4, 
          fontSize: 20, color: themeConf.text, bullet: true 
        });
        pptSlide.addText(bulletData.slice(half).join('\n'), { 
          x: '50%', y: 2.0, w: '40%', h: 4, 
          fontSize: 20, color: themeConf.text, bullet: true 
        });
      } else if (slide.layout === 'quote') {
        titleOpts.y = '30%';
        titleOpts.align = 'center';
        pptSlide.addText(slide.title, titleOpts);
        const quoteText = Array.isArray(slide.content) ? slide.content[0] : slide.content;
        pptSlide.addText(`"${quoteText}"`, { 
          x: 1, y: '50%', w: '80%', align: 'center', 
          fontSize: 28, italic: true, color: themeConf.text, fontFace: themeConf.font 
        });
      } else {
        pptSlide.addText(slide.title, titleOpts);
        const textData = Array.isArray(slide.content) ? slide.content.join(', ') : slide.content;
        pptSlide.addText(textData, { 
          x: 0.5, y: 2.0, w: '90%', h: 4, 
          fontSize: 20, color: themeConf.text, fontFace: themeConf.font 
        });
      }
    });

    pres.writeFile({ fileName: `${activeDeck.name.replace('.pptx', '')}.pptx` });
  };

  const slides = activeDeck?.slides || [];

  const renderPresentMode = () => (
    <AnimatePresence>
      {isPresenting && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
        >
          <div className="absolute top-6 right-6 z-50 flex gap-4">
             <button onClick={() => setIsPresenting(false)} className="bg-black/50 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition">
               <X size={24} />
             </button>
          </div>
          
          <div className="w-full h-full aspect-[16/9] max-h-screen relative overflow-hidden">
             <AnimatePresence mode="wait">
               <motion.div
                 key={activeSlide}
                 initial={{ opacity: 0, scale: 0.95, x: 50 }}
                 animate={{ opacity: 1, scale: 1, x: 0 }}
                 exit={{ opacity: 0, scale: 1.05, x: -50 }}
                 transition={{ duration: 0.4, ease: "easeInOut" }}
                 className="w-full h-full"
               >
                 <SlideRenderer slide={slides[activeSlide]} themeKey={activeDeck?.theme} isPresenting={true} />
               </motion.div>
             </AnimatePresence>
          </div>

          {/* Navigation Overlay */}
          <div className="absolute bottom-10 flex gap-6 z-50">
            <button onClick={() => setActiveSlide(prev => Math.max(prev - 1, 0))} disabled={activeSlide === 0} className="p-4 rounded-full bg-black/30 hover:bg-white/20 text-white disabled:opacity-30 transition">
              <ChevronLeft size={32} />
            </button>
            <button onClick={() => setActiveSlide(prev => Math.min(prev + 1, slides.length - 1))} disabled={activeSlide === slides.length - 1} className="p-4 rounded-full bg-black/30 hover:bg-white/20 text-white disabled:opacity-30 transition">
              <ChevronRight size={32} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderEditor = () => (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0A0A0B] overflow-hidden relative">
      {/* Editor Toolbar */}
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-white dark:bg-[#121214] border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveDeck(null)} className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline">
            ← Back
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800" />
          <span className="font-semibold text-sm">{activeDeck.name}</span>
          <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium uppercase">
            {activeDeck.theme} Theme
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-icon"><Share2 size={16} /></button>
          <button onClick={handleDownloadPPT} className="btn btn-ghost btn-icon" title="Download PPTX"><Download size={16} /></button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />
          <button onClick={() => setIsPresenting(true)} className="btn bg-amber-500 hover:bg-amber-600 text-white btn-sm px-4 flex items-center gap-2">
            <Play size={14} className="fill-current" /> Present
          </button>
        </div>
      </div>

      {/* Ribbon Tabs Header */}
      <div className="flex px-2 pt-2 bg-gray-50 dark:bg-[#0A0A0B] border-b border-gray-200 dark:border-gray-800">
        {['Home', 'Insert', 'Design', 'Transitions', 'Animations'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-t-lg border-t border-l border-r ${
              activeTab === tab
                ? 'bg-white dark:bg-[#121214] text-amber-600 border-gray-200 dark:border-gray-800 border-b-white dark:border-b-[#121214] -mb-px relative z-10'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Ribbon Toolbar */}
      <div className="h-16 flex items-center gap-4 px-4 shrink-0 bg-white dark:bg-[#121214] border-b border-gray-200 dark:border-gray-800 shadow-sm relative z-0">
        {activeTab === 'Home' && (
          <>
            <div className="flex flex-col items-center pr-4 border-r border-gray-200 dark:border-gray-800">
              <button className="flex flex-col items-center gap-1 text-xs font-semibold p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-amber-600">
                <Plus size={18} />
                <span>New Slide</span>
              </button>
            </div>
            <div className="flex flex-col justify-center gap-1 pr-4 border-r border-gray-200 dark:border-gray-800">
              <div className="flex gap-1">
                <select className="text-xs border dark:border-gray-700 rounded px-1 py-0.5 bg-transparent w-32"><option>Inter</option><option>Arial</option><option>Times New Roman</option></select>
                <select className="text-xs border dark:border-gray-700 rounded px-1 py-0.5 bg-transparent w-16"><option>18</option><option>24</option><option>36</option><option>48</option></select>
              </div>
              <div className="flex gap-1 mt-1">
                <button className="px-2 py-0.5 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded">B</button>
                <button className="px-2 py-0.5 italic hover:bg-gray-100 dark:hover:bg-gray-800 rounded">I</button>
                <button className="px-2 py-0.5 underline hover:bg-gray-100 dark:hover:bg-gray-800 rounded">U</button>
              </div>
            </div>
          </>
        )}
        {activeTab === 'Insert' && (
          <>
            <button className="flex flex-col items-center gap-1 text-xs p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><ImageIcon size={18} />Pictures</button>
            <button className="flex flex-col items-center gap-1 text-xs p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><Layout size={18} />Shapes</button>
            <button className="flex flex-col items-center gap-1 text-xs p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><Type size={18} />Text Box</button>
            <button className="flex flex-col items-center gap-1 text-xs p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><Video size={18} />Video</button>
          </>
        )}
        {activeTab === 'Design' && (
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-gray-500">Themes:</span>
            {Object.keys(THEMES).map(themeKey => (
              <button 
                key={themeKey}
                onClick={() => activeDeck && updateActiveDeck({ theme: themeKey })}
                className={`w-20 h-10 rounded border-2 overflow-hidden flex flex-col ${activeDeck?.theme === themeKey ? 'border-amber-500 shadow-md scale-105' : 'border-gray-200 dark:border-gray-800 hover:border-amber-300'} transition-all`}
                title={`Switch to ${themeKey} theme`}
              >
                <div className={`flex-1 ${THEMES[themeKey].bg} flex items-center justify-center`}>
                  <span className={`text-[9px] font-bold ${THEMES[themeKey].text} ${THEMES[themeKey].font} capitalize`}>{themeKey}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {['Transitions', 'Animations'].includes(activeTab) && (
          <div className="text-xs text-gray-500 italic">These features are managed automatically by the Present mode AI.</div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Slide Thumbnail Sidebar */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] overflow-y-auto p-4 flex flex-col gap-4 shrink-0 z-10">
          {slides.map((slide, i) => (
            <div 
              key={i} 
              onClick={() => setActiveSlide(i)}
              className={`relative rounded-lg border-2 cursor-pointer transition-colors ${activeSlide === i ? 'border-amber-500' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-700'}`}
            >
              <div className="aspect-[16/9] bg-gray-100 dark:bg-[#18181B] rounded-md border border-gray-200 dark:border-gray-800 flex items-center justify-center p-2 overflow-hidden text-center relative">
                <span className="text-gray-600 dark:text-gray-400 text-[8px] font-bold line-clamp-3 relative z-10">{slide.title}</span>
                <div className={`absolute inset-0 opacity-20 ${THEMES[activeDeck?.theme || 'modern'].bg}`} />
              </div>
              <span className="absolute -left-3 top-1 text-[10px] font-bold text-gray-400">{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Slide Canvas */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center bg-gray-100 dark:bg-[#0A0A0B] relative">
          <div className="w-full max-w-4xl aspect-[16/9] bg-white shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col relative outline-none focus:ring-4 focus:ring-amber-500 overflow-hidden" contentEditable suppressContentEditableWarning>
             <SlideRenderer slide={slides[activeSlide]} themeKey={activeDeck?.theme} />
          </div>
          
          {/* AI Assistant Sidebar */}
          <div className="w-80 shrink-0 h-fit bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm sticky top-12 border border-zinc-200 dark:border-zinc-800 ml-8 print:hidden z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <Settings2 size={16} />
              </div>
              <div>
                <h3 className="font-bold text-sm">AI Assistant</h3>
                <p className="text-[10px] text-zinc-500">Presentation Generator</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <Sparkles size={14} className="text-amber-500" />
                  Generate Presentation
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Create a 5-slide elegant presentation on Q3 Marketing Strategy..."
                  className="w-full h-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none mb-2"
                />
                <button 
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-md transition-colors shadow-sm"
                >
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {isGenerating ? 'Generating Designs...' : 'Design Slides'}
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {renderPresentMode()}
    </div>
  );

  return (
    <AppLayout appName="Show" appIcon={Presentation} appColor="#F59E0B">
      {activeDeck ? renderEditor() : (
        <div className="flex h-full w-full">
          {/* Sidebar */}
          <div className="w-64 border-r shrink-0 flex flex-col bg-white dark:bg-[#121214] border-gray-200 dark:border-gray-800">
            <div className="p-4">
              <button onClick={handleUpload} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-medium transition-colors shadow-sm">
                <Upload size={16} />
                New Presentation
              </button>
            </div>
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">Views</p>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg">
                <Presentation size={16} /> My Presentations
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg">
                <Share2 size={16} /> Shared with me
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0A0A0B]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Presentations</h2>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search presentations..." className="pl-9 pr-4 py-2 border dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-[#18181B] focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {presentations.map(deck => (
                  <div key={deck.id} onClick={() => setActiveDeck(deck)} className="group bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md hover:border-amber-500/50 transition-all cursor-pointer flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Presentation size={20} />
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                    <h3 className="font-semibold text-sm truncate mb-1">{deck.name}</h3>
                    <div className="flex items-center justify-between mt-auto pt-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{deck.theme ? deck.theme.toUpperCase() : 'STANDARD'} Theme</span>
                      <span>{deck.slides?.length || 1} slides</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ShowApp;
