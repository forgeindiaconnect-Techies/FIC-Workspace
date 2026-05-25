import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { Presentation, Search, MoreVertical, Upload, Share2, Download, Play, Plus, Type, Image, Layout, Video } from 'lucide-react';

const ShowApp = () => {
  const [presentations, setPresentations] = useState(() => {
    const saved = localStorage.getItem('dominators_show');
    return saved ? JSON.parse(saved) : [];
  });

  React.useEffect(() => {
    localStorage.setItem('dominators_show', JSON.stringify(presentations));
  }, [presentations]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [activeSlide, setActiveSlide] = useState(1);

  const handleUpload = () => {
    const newDeck = {
      id: Date.now(),
      name: 'Untitled Presentation.pptx',
      modified: 'Just now',
      author: 'You',
      size: '0 KB',
    };
    setPresentations([newDeck, ...presentations]);
    setActiveDeck(newDeck);
  };

  const slides = Array.from({ length: 5 }, (_, i) => i + 1);

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
          <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Saved</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-icon"><Share2 size={16} /></button>
          <button className="btn btn-ghost btn-icon"><Download size={16} /></button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />
          <button className="btn bg-amber-500 hover:bg-amber-600 text-white btn-sm px-4 flex items-center gap-2">
            <Play size={14} className="fill-current" /> Present
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="h-10 border-b flex items-center gap-2 px-4 shrink-0 bg-white dark:bg-[#121214] border-gray-200 dark:border-gray-800">
        <button className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <Plus size={14} /> New Slide
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-2" />
        <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"><Layout size={16} /></button>
        <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"><Type size={16} /></button>
        <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"><Image size={16} /></button>
        <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-600 dark:text-gray-300"><Video size={16} /></button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide Thumbnail Sidebar */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121214] overflow-y-auto p-4 flex flex-col gap-4">
          {slides.map(slide => (
            <div 
              key={slide} 
              onClick={() => setActiveSlide(slide)}
              className={`relative rounded-lg border-2 cursor-pointer transition-colors ${activeSlide === slide ? 'border-amber-500' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-700'}`}
            >
              <div className="aspect-[16/9] bg-gray-100 dark:bg-[#18181B] rounded-md border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                <span className="text-gray-400 text-xs font-bold">{slide}</span>
              </div>
              <span className="absolute -left-3 top-1 text-[10px] font-bold text-gray-400">{slide}</span>
            </div>
          ))}
        </div>

        {/* Slide Canvas */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gray-100 dark:bg-[#0A0A0B]">
          <div className="w-full max-w-4xl aspect-[16/9] bg-white dark:bg-[#18181B] shadow-lg border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center relative outline-none focus:ring-2 focus:ring-amber-500" contentEditable suppressContentEditableWarning>
            {activeSlide === 1 ? (
              <>
                <h1 className="text-5xl font-bold mb-6 text-center">Click to add title</h1>
                <p className="text-xl text-gray-500 text-center">Click to add subtitle</p>
              </>
            ) : (
              <>
                <div className="absolute top-8 left-8 right-8">
                  <h2 className="text-3xl font-bold">Click to add title</h2>
                </div>
                <div className="absolute top-24 left-8 right-8 bottom-8 border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center">
                  <p className="text-gray-400">Click to add text or objects</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
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
                Upload Presentation
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
                      <span>{deck.modified}</span>
                      <span>{deck.size}</span>
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
