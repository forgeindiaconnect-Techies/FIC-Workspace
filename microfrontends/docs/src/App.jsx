import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { AppSwitcher } from '../../../src/components/AppLayout';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Heading1, Heading2, MessageSquare, Share2, Printer, 
  Undo, Redo, Sparkles, FileText, ChevronDown
} from 'lucide-react';

const App = () => {
  const [docTitle, setDocTitle] = useState('Untitled Document');

  const editor = useEditor({
    extensions: [
      StarterKit,
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

  const MenuButton = ({ children }) => (
    <button className="px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 rounded cursor-pointer transition-colors">
      {children}
    </button>
  );

  const ToolButton = ({ icon: Icon, onClick, isActive, className = "" }) => (
    <button
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-slate-200 transition-colors flex items-center justify-center ${isActive ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'} ${className}`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-slate-800 font-sans">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 flex flex-col pt-2 pb-1 px-4 z-20 shadow-sm relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppSwitcher workspaceId="demo" />
            <div className="w-10 h-10 bg-indigo-600 text-white rounded shadow-sm flex items-center justify-center cursor-pointer">
               <FileText size={24} />
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-0.5">
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
              <div className="flex items-center gap-1 -ml-1">
                <MenuButton>File</MenuButton>
                <MenuButton>Edit</MenuButton>
                <MenuButton>View</MenuButton>
                <MenuButton>Insert</MenuButton>
                <MenuButton>Format</MenuButton>
                <MenuButton>Tools</MenuButton>
                <MenuButton>Extensions</MenuButton>
                <MenuButton>Help</MenuButton>
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

      {/* Formatting Toolbar */}
      <div className="bg-[#EDF2FA] border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 z-10 sticky top-0">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
          <ToolButton icon={Undo} onClick={() => editor.chain().focus().undo().run()} />
          <ToolButton icon={Redo} onClick={() => editor.chain().focus().redo().run()} />
          <ToolButton icon={Printer} onClick={() => window.print()} />
        </div>

        <div className="flex items-center gap-2 px-2 border-r border-slate-300">
           <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-200 px-2 py-1 rounded">
             <span className="text-sm font-medium">Normal text</span>
             <ChevronDown size={14} />
           </div>
           <div className="h-4 w-px bg-slate-300 mx-1"></div>
           <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-200 px-2 py-1 rounded">
             <span className="text-sm font-medium">Inter</span>
             <ChevronDown size={14} />
           </div>
           <div className="h-4 w-px bg-slate-300 mx-1"></div>
           <div className="flex items-center gap-2">
              <button className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded">-</button>
              <span className="text-sm w-4 text-center">11</span>
              <button className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded">+</button>
           </div>
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300">
          <ToolButton icon={Bold} isActive={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
          <ToolButton icon={Italic} isActive={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <ToolButton icon={Underline} isActive={editor.isActive('underline')} onClick={() => {}} />
          <ToolButton icon={Strikethrough} isActive={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300">
          <ToolButton icon={AlignLeft} />
          <ToolButton icon={AlignCenter} />
          <ToolButton icon={AlignRight} />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300">
          <ToolButton icon={ListOrdered} isActive={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
          <ToolButton icon={List} isActive={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        </div>

        {/* The elegant AI integration */}
        <div className="flex items-center gap-1 pl-2 ml-auto">
          <button className="flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">
             <Sparkles size={14} className="text-indigo-500" /> Write with AI
          </button>
        </div>
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
