import React, { useState } from 'react';
import DataGrid from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { AppSwitcher } from '../../../src/components/AppLayout';
import { 
  Bold, Italic, Strikethrough, AlignLeft, AlignCenter, AlignRight, 
  MessageSquare, Share2, Sparkles, FileSpreadsheet, ChevronDown, 
  Search, Filter, Plus, FileDown, Undo, Redo, Printer, Percent, DollarSign,
  PaintBucket, Type
} from 'lucide-react';

const columns = [
  { key: 'id', name: '', width: 50, cellClass: 'bg-slate-50 text-slate-500 font-medium text-center border-r border-slate-300' },
  { key: 'colA', name: 'A', editable: true, width: 120 },
  { key: 'colB', name: 'B', editable: true, width: 120 },
  { key: 'colC', name: 'C', editable: true, width: 120 },
  { key: 'colD', name: 'D', editable: true, width: 120 },
  { key: 'colE', name: 'E', editable: true, width: 120 },
  { key: 'colF', name: 'F', editable: true, width: 120 },
  { key: 'colG', name: 'G', editable: true, width: 120 },
  { key: 'colH', name: 'H', editable: true, width: 120 },
  { key: 'colI', name: 'I', editable: true, width: 120 },
];

const initialRows = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  colA: i === 0 ? 'Project Name' : i === 1 ? 'Website Redesign' : '',
  colB: i === 0 ? 'Owner' : i === 1 ? 'Sarah J.' : '',
  colC: i === 0 ? 'Status' : i === 1 ? 'In Progress' : '',
  colD: i === 0 ? 'Budget' : i === 1 ? '$15,000' : '',
  colE: i === 0 ? 'Deadline' : i === 1 ? 'Oct 15' : '',
  colF: '',
  colG: '',
  colH: '',
  colI: '',
}));

const App = () => {
  const [rows, setRows] = useState(initialRows);
  const [docTitle, setDocTitle] = useState('Untitled Spreadsheet');
  const [formula, setFormula] = useState('');

  const MenuButton = ({ children }) => (
    <button className="px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 rounded cursor-pointer transition-colors">
      {children}
    </button>
  );

  const ToolButton = ({ icon: Icon, onClick, isActive, className = "" }) => (
    <button
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-slate-200 transition-colors flex items-center justify-center ${isActive ? 'bg-slate-200 text-green-700' : 'text-slate-600'} ${className}`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 flex flex-col pt-2 pb-1 px-4 z-20 shadow-sm relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppSwitcher workspaceId="demo" />
            <div className="w-10 h-10 bg-emerald-600 text-white rounded shadow-sm flex items-center justify-center cursor-pointer">
               <FileSpreadsheet size={24} />
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-0.5">
                <input 
                  type="text" 
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="text-[18px] font-medium text-slate-800 hover:border-slate-300 border border-transparent px-1 rounded focus:border-emerald-500 focus:outline-none transition-colors w-64"
                />
                <div className="bg-slate-100 text-slate-500 p-1 rounded hover:bg-slate-200 cursor-pointer">
                   <Sparkles size={14} className="text-emerald-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 -ml-1">
                <MenuButton>File</MenuButton>
                <MenuButton>Edit</MenuButton>
                <MenuButton>Insert</MenuButton>
                <MenuButton>Format</MenuButton>
                <MenuButton>Data</MenuButton>
                <MenuButton>Tools</MenuButton>
                <MenuButton>Extensions</MenuButton>
                <MenuButton>Help</MenuButton>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <button className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-full text-sm font-medium transition-colors">
                  <MessageSquare size={16} />
               </button>
               <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-sm">
                  <Share2 size={16} /> Share
               </button>
             </div>
             <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm ring-2 ring-slate-100 cursor-pointer">
               SJ
             </div>
          </div>
        </div>
      </header>

      {/* Formatting Toolbar */}
      <div className="bg-[#EDF2FA] border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
          <ToolButton icon={Undo} />
          <ToolButton icon={Redo} />
          <ToolButton icon={Printer} />
        </div>

        <div className="flex items-center gap-1 pr-2 border-r border-slate-300 text-slate-600">
           <ToolButton icon={DollarSign} />
           <ToolButton icon={Percent} />
           <div className="text-sm font-bold px-1.5 cursor-pointer hover:bg-slate-200 rounded">.00</div>
           <div className="text-sm font-bold px-1.5 cursor-pointer hover:bg-slate-200 rounded">.0</div>
        </div>

        <div className="flex items-center gap-2 px-2 border-r border-slate-300">
           <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-200 px-2 py-1 rounded text-slate-700">
             <span className="text-sm font-medium">100%</span>
             <ChevronDown size={14} />
           </div>
           <div className="h-4 w-px bg-slate-300 mx-1"></div>
           <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-200 px-2 py-1 rounded text-slate-700">
             <span className="text-sm font-medium">Arial</span>
             <ChevronDown size={14} />
           </div>
           <div className="h-4 w-px bg-slate-300 mx-1"></div>
           <div className="flex items-center gap-2 text-slate-700">
              <button className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded">-</button>
              <span className="text-sm w-4 text-center">10</span>
              <button className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded">+</button>
           </div>
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300">
          <ToolButton icon={Bold} />
          <ToolButton icon={Italic} />
          <ToolButton icon={Strikethrough} />
          <ToolButton icon={Type} />
          <ToolButton icon={PaintBucket} />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-300">
          <ToolButton icon={AlignLeft} />
          <ToolButton icon={AlignCenter} />
          <ToolButton icon={AlignRight} />
        </div>
        
        <div className="flex items-center gap-1 px-2 border-r border-slate-300">
          <ToolButton icon={Filter} />
        </div>

        {/* The elegant AI integration */}
        <div className="flex items-center gap-1 pl-2 ml-auto">
          <button className="flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm">
             <Sparkles size={14} className="text-emerald-500" /> Analyze Data
          </button>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center border-b border-slate-200 bg-white flex-shrink-0">
        <div className="w-12 h-8 flex items-center justify-center bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-500 italic">
          fx
        </div>
        <input 
          type="text" 
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          className="flex-1 h-8 px-3 text-sm focus:outline-none"
        />
      </div>

      {/* Main Canvas Area */}
      <main className="flex-1 overflow-hidden relative">
        <DataGrid 
          columns={columns} 
          rows={rows} 
          onRowsChange={setRows}
          className="h-full w-full rdg-light !border-0 text-sm"
          rowHeight={30}
          headerRowHeight={32}
        />
      </main>
      
      {/* Footer / Sheet Tabs */}
      <footer className="bg-slate-50 border-t border-slate-200 h-10 flex items-center px-4 flex-shrink-0">
         <div className="flex items-center">
            <button className="p-1 hover:bg-slate-200 rounded text-slate-600 mr-2"><Plus size={16}/></button>
            <div className="flex">
               <div className="px-4 py-1.5 bg-white border-t-2 border-t-emerald-500 border-x border-slate-200 text-sm font-medium text-emerald-700 cursor-pointer border-b-white translate-y-[1px]">
                  Sheet1
               </div>
               <div className="px-4 py-1.5 hover:bg-slate-100 text-sm font-medium text-slate-600 cursor-pointer">
                  Sheet2
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default App;
