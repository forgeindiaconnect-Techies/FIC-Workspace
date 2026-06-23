import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import { AppSwitcher } from '../../../src/components/AppLayout';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Heading1, Heading2, MessageSquare, Share2, Printer, 
  Undo, Redo, Sparkles, FileText, ChevronDown, 
  FilePlus, Image as ImageIcon, Link as LinkIcon, Table as TableIcon,
  Shapes, Smile, Box, BarChart2, MonitorPlay, Bookmark,
  GitCommit, Type, CaseSensitive, CalendarDays, Calculator, Omega,
  FileSignature, MessageCircle, Palette, PaintBucket, AlignJustify, 
  Wand2, CheckCircle2, Stamp, Square, LayoutTemplate
} from 'lucide-react';

const App = () => {
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [activeTab, setActiveTab] = useState('Insert');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      Youtube,
    ],
    content: '<p>Start typing your professional document here...</p>',
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[800px] px-12 py-10',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const MenuButton = ({ children, isActive, onClick }) => (
    <button 
      onClick={onClick}
      className={`px-3 py-1 text-sm rounded-t cursor-pointer transition-colors ${isActive ? 'bg-[#EDF2FA] text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}>
      {children}
    </button>
  );

  const ToolButton = ({ icon: Icon, onClick, isActive, label, className = "" }) => (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded hover:bg-slate-200 transition-colors flex flex-col items-center justify-center gap-1 ${isActive ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'} ${className}`}
    >
      <Icon size={18} />
      {label && <span className="text-[10px] whitespace-nowrap">{label}</span>}
    </button>
  );

  const RibbonGroup = ({ title, children }) => (
    <div className="flex flex-col justify-between items-center px-3 border-r border-slate-300 min-h-[64px]">
      <div className="flex items-center gap-1 flex-1">
        {children}
      </div>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{title}</span>
    </div>
  );

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const insertImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertLink = () => {
    const url = window.prompt('Enter link URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };
  
  const insertYoutube = () => {
    const url = window.prompt('Enter YouTube URL:');
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url, width: 640, height: 480 }).run();
    }
  };

  const comingSoon = (feature) => {
    alert(`${feature} feature coming soon!`);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-slate-800 font-sans">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 flex flex-col pt-2 px-4 z-20 shadow-sm relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <AppSwitcher workspaceId="demo" />
            <div className="w-10 h-10 bg-indigo-600 text-white rounded shadow-sm flex items-center justify-center cursor-pointer">
               <FileText size={24} />
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <input 
                  type="text" 
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="text-[18px] font-medium text-slate-800 hover:border-slate-300 border border-transparent px-1 rounded focus:border-indigo-500 focus:outline-none transition-colors w-64"
                />
                <div className="bg-slate-100 text-slate-500 p-1 rounded hover:bg-slate-200 cursor-pointer">
                   <Sparkles size={14} className="text-indigo-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 -ml-1 mt-1">
                <MenuButton isActive={activeTab === 'Home'} onClick={() => setActiveTab('Home')}>Home</MenuButton>
                <MenuButton isActive={activeTab === 'Insert'} onClick={() => setActiveTab('Insert')}>Insert</MenuButton>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <button className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-full text-sm font-medium transition-colors">
                  <MessageSquare size={16} />
               </button>
               <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-sm">
                  <Share2 size={16} /> Share
               </button>
             </div>
             <div className="w-8 h-8 rounded-full bg-indigo-900 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm ring-2 ring-slate-100 cursor-pointer">
               SJ
             </div>
          </div>
        </div>
      </header>

      {/* Dynamic Ribbon */}
      <div className="bg-[#EDF2FA] border-b border-slate-200 px-2 py-2 flex items-center gap-0 z-10 sticky top-0 shadow-sm overflow-x-auto">
        
        {activeTab === 'Home' && (
          <>
            <RibbonGroup title="Clipboard">
              <ToolButton icon={Undo} onClick={() => editor.chain().focus().undo().run()} />
              <ToolButton icon={Redo} onClick={() => editor.chain().focus().redo().run()} />
              <ToolButton icon={Printer} onClick={() => window.print()} />
            </RibbonGroup>

            <RibbonGroup title="Font">
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-200 px-2 py-1 rounded bg-white border border-slate-300">
                     <span className="text-sm font-medium w-24">Inter</span>
                     <ChevronDown size={14} />
                   </div>
                   <div className="flex items-center gap-0 bg-white border border-slate-300 rounded overflow-hidden">
                      <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-100">-</button>
                      <span className="text-sm w-6 text-center border-x border-slate-200">11</span>
                      <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-100">+</button>
                   </div>
                 </div>
                 <div className="flex items-center gap-1">
                    <button className={`p-1 rounded hover:bg-slate-200 ${editor.isActive('bold') ? 'bg-slate-200 text-indigo-600' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14}/></button>
                    <button className={`p-1 rounded hover:bg-slate-200 ${editor.isActive('italic') ? 'bg-slate-200 text-indigo-600' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14}/></button>
                    <button className={`p-1 rounded hover:bg-slate-200 ${editor.isActive('underline') ? 'bg-slate-200 text-indigo-600' : ''}`}><Underline size={14}/></button>
                    <button className={`p-1 rounded hover:bg-slate-200 ${editor.isActive('strike') ? 'bg-slate-200 text-indigo-600' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14}/></button>
                 </div>
               </div>
            </RibbonGroup>

            <RibbonGroup title="Paragraph">
              <div className="flex items-center gap-1">
                <ToolButton icon={AlignLeft} />
                <ToolButton icon={AlignCenter} />
                <ToolButton icon={AlignRight} />
                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                <ToolButton icon={ListOrdered} isActive={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                <ToolButton icon={List} isActive={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              </div>
            </RibbonGroup>

            <div className="flex items-center gap-1 pl-4 ml-auto pr-4">
              <button className="flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm">
                 <Sparkles size={16} className="text-indigo-500" /> Write with AI
              </button>
            </div>
          </>
        )}

        {activeTab === 'Insert' && (
          <>
            <RibbonGroup title="Pages">
              <ToolButton icon={FilePlus} label="Blank Page" onClick={() => comingSoon('Blank Page')} />
              <ToolButton icon={AlignLeft} label="Page Break" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
            </RibbonGroup>

            <RibbonGroup title="Tables">
              <ToolButton icon={TableIcon} label="Table" onClick={insertTable} />
            </RibbonGroup>

            <RibbonGroup title="Illustrations">
              <ToolButton icon={ImageIcon} label="Pictures" onClick={insertImage} />
              <ToolButton icon={Shapes} label="Shapes" onClick={() => comingSoon('Shapes')} />
              <ToolButton icon={Smile} label="Icons" onClick={() => comingSoon('Icons')} />
              <ToolButton icon={Box} label="3D Models" onClick={() => comingSoon('3D Models')} />
              <ToolButton icon={GitCommit} label="SmartArt" onClick={() => comingSoon('SmartArt')} />
              <ToolButton icon={BarChart2} label="Chart" onClick={() => comingSoon('Chart')} />
            </RibbonGroup>

            <RibbonGroup title="Media">
              <ToolButton icon={MonitorPlay} label="Online Videos" onClick={insertYoutube} />
            </RibbonGroup>

            <RibbonGroup title="Links">
              <ToolButton icon={LinkIcon} label="Link" onClick={insertLink} />
              <ToolButton icon={Bookmark} label="Bookmark" onClick={() => comingSoon('Bookmark')} />
            </RibbonGroup>

            <RibbonGroup title="Comments">
              <ToolButton icon={MessageCircle} label="Comment" onClick={() => comingSoon('Comment')} />
            </RibbonGroup>

            <RibbonGroup title="Text">
              <ToolButton icon={Type} label="Text Box" onClick={() => comingSoon('Text Box')} />
              <ToolButton icon={CaseSensitive} label="WordArt" onClick={() => comingSoon('WordArt')} />
              <ToolButton icon={CalendarDays} label="Date & Time" onClick={() => comingSoon('Date & Time')} />
              <ToolButton icon={FileSignature} label="Signature Line" onClick={() => comingSoon('Signature Line')} />
            </RibbonGroup>

            <RibbonGroup title="Symbols">
              <ToolButton icon={Calculator} label="Equation" onClick={() => comingSoon('Equation')} />
              <ToolButton icon={Omega} label="Symbol" onClick={() => comingSoon('Symbol')} />
            </RibbonGroup>
          </>
        )}



      </div>

      {/* Main Canvas Area */}
      <main className="flex-1 overflow-auto bg-[#F8F9FA] p-6 lg:p-10 flex justify-center">
        <div className="bg-white shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] min-h-[1056px] w-full max-w-[816px] mx-auto border border-slate-200/50 relative group">
           <EditorContent editor={editor} className="h-full w-full" />
        </div>
      </main>
    </div>
  );
};

export default App;
