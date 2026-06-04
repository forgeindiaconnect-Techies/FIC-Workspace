import React, { useState } from 'react';
import {
  Deck, Slide, Heading, Text, UnorderedList, ListItem, FlexBox
} from 'spectacle';
import { AppSwitcher } from '../../../src/components/AppLayout';
import { 
  Type, Image as ImageIcon, LayoutTemplate, Plus, Play, Share2, 
  MessageSquare, Sparkles, Presentation, Settings, Undo, Redo, Printer,
  MousePointer2, Square, Circle, Triangle, Type as TypeIcon
} from 'lucide-react';

const theme = {
  colors: {
    primary: '#1a202c',
    secondary: '#e53e3e',
    tertiary: '#f7fafc',
  },
  fonts: {
    header: 'Inter, sans-serif',
    text: 'Inter, sans-serif',
  },
};

const App = () => {
  const [docTitle, setDocTitle] = useState('Quarterly Sales Pitch');
  const [activeSlide, setActiveSlide] = useState(1);

  const MenuButton = ({ children }) => (
    <button className="px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 rounded cursor-pointer transition-colors">
      {children}
    </button>
  );

  const ToolButton = ({ icon: Icon, label, isActive }) => (
    <button className={`p-1.5 rounded hover:bg-slate-200 transition-colors flex items-center justify-center ${isActive ? 'bg-slate-200 text-orange-600' : 'text-slate-600'}`}>
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 flex flex-col pt-2 pb-1 px-4 z-20 shadow-sm relative shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppSwitcher workspaceId="demo" />
            <div className="w-10 h-10 bg-orange-500 text-white rounded shadow-sm flex items-center justify-center cursor-pointer">
               <Presentation size={24} />
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-0.5">
                <input 
                  type="text" 
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="text-[18px] font-medium text-slate-800 hover:border-slate-300 border border-transparent px-1 rounded focus:border-orange-500 focus:outline-none transition-colors w-64"
                />
                <div className="bg-slate-100 text-slate-500 p-1 rounded hover:bg-slate-200 cursor-pointer">
                   <Sparkles size={14} className="text-orange-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 -ml-1">
                <MenuButton>File</MenuButton>
                <MenuButton>Edit</MenuButton>
                <MenuButton>View</MenuButton>
                <MenuButton>Insert</MenuButton>
                <MenuButton>Format</MenuButton>
                <MenuButton>Slide</MenuButton>
                <MenuButton>Arrange</MenuButton>
                <MenuButton>Tools</MenuButton>
                <MenuButton>Help</MenuButton>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full text-sm font-medium transition-colors border border-slate-200">
                <Play size={16} className="fill-slate-700" /> Present
             </button>
             <div className="flex items-center gap-2">
               <button className="flex items-center gap-2 bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-2 rounded-full text-sm font-medium transition-colors">
                  <MessageSquare size={16} />
               </button>
               <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-sm">
                  <Share2 size={16} /> Share
               </button>
             </div>
             <div className="w-8 h-8 rounded-full bg-orange-800 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm ring-2 ring-slate-100 cursor-pointer">
               SJ
             </div>
          </div>
        </div>
      </header>

      {/* Formatting Toolbar */}
      <div className="bg-[#EDF2FA] border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 z-10 shrink-0">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
          <ToolButton icon={Plus} />
          <ToolButton icon={Undo} />
          <ToolButton icon={Redo} />
          <ToolButton icon={Printer} />
        </div>
        
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
           <ToolButton icon={MousePointer2} isActive />
           <ToolButton icon={TypeIcon} />
           <ToolButton icon={ImageIcon} />
           <ToolButton icon={Square} />
           <ToolButton icon={Circle} />
           <ToolButton icon={Triangle} />
        </div>

        <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
          <button className="flex items-center gap-1 px-2 py-1 text-sm text-slate-700 hover:bg-slate-200 rounded transition-colors">
             <LayoutTemplate size={16} /> Layout
          </button>
          <button className="flex items-center gap-1 px-2 py-1 text-sm text-slate-700 hover:bg-slate-200 rounded transition-colors">
             <Settings size={16} /> Theme
          </button>
        </div>

        {/* The elegant AI integration */}
        <div className="flex items-center gap-1 pl-2 ml-auto">
          <button className="flex items-center gap-1.5 bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">
             <Sparkles size={14} className="text-orange-500" /> Generate Slides with AI
          </button>
        </div>
      </div>

      {/* Main App Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Thumbnails) */}
        <aside className="w-48 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0">
          <div className={`p-3 border-b border-transparent cursor-pointer flex gap-2 ${activeSlide === 1 ? 'bg-orange-50 border-r-4 border-r-orange-500' : 'hover:bg-slate-50'}`} onClick={() => setActiveSlide(1)}>
            <div className="text-xs font-bold text-slate-400 pt-1">1</div>
            <div className="flex-1 aspect-[16/9] bg-white border border-slate-300 rounded shadow-sm overflow-hidden pointer-events-none flex items-center justify-center">
              <div className="text-[6px] font-bold">Welcome to Show</div>
            </div>
          </div>
          <div className={`p-3 border-b border-transparent cursor-pointer flex gap-2 ${activeSlide === 2 ? 'bg-orange-50 border-r-4 border-r-orange-500' : 'hover:bg-slate-50'}`} onClick={() => setActiveSlide(2)}>
            <div className="text-xs font-bold text-slate-400 pt-1">2</div>
            <div className="flex-1 aspect-[16/9] bg-white border border-slate-300 rounded shadow-sm overflow-hidden pointer-events-none p-1">
              <div className="text-[5px] font-bold text-orange-600 mb-1">Features</div>
              <div className="text-[4px] ml-1">- Create slides</div>
              <div className="text-[4px] ml-1">- Present anywhere</div>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 bg-[#F1F3F4] overflow-auto flex items-center justify-center p-8 relative">
           <div className="w-[800px] aspect-[16/9] bg-white shadow-lg border border-slate-200 rounded-sm relative overflow-hidden group">
             
             {/* Spectacle Deck Container */}
             <div className="absolute inset-0 z-0">
               <Deck theme={theme} disableInteractivity={false} transition={{}}>
                  <Slide>
                    <FlexBox height="100%" flexDirection="column" justifyContent="center">
                      <Heading margin="0px" fontSize="h1" color="primary">
                        Welcome to Show
                      </Heading>
                      <Text color="secondary">A beautiful presentation app</Text>
                    </FlexBox>
                  </Slide>
                  <Slide>
                    <Heading color="primary">Features</Heading>
                    <UnorderedList>
                      <ListItem>Create slides easily</ListItem>
                      <ListItem>Present anywhere</ListItem>
                      <ListItem>Rich text formatting</ListItem>
                    </UnorderedList>
                  </Slide>
                </Deck>
             </div>

             {/* Overlay to block Spectacle's internal controls from messing up our editor look */}
             <div className="absolute inset-0 z-10 pointer-events-none border-2 border-transparent group-hover:border-blue-400 transition-colors"></div>
             
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;
