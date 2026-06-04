const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'MeetingApp.jsx');
let content = fs.readFileSync(target, 'utf8');

const replacements = [
  // Global backgrounds
  ['bg-[#0a0b0d]', 'bg-gray-50'],
  ['bg-[#1a1b1e]', 'bg-white'],
  ['bg-[#0f172a]', 'bg-gray-100'],
  ['bg-[#1e293b]', 'bg-white'],
  
  // Specific border colors
  ['border-slate-800/50', 'border-gray-200'],
  ['border-slate-800', 'border-gray-200'],
  ['border-slate-700/50', 'border-gray-200'],
  ['border-slate-700', 'border-gray-200'],
  ['border-white/10', 'border-gray-200'],
  ['border-white/5', 'border-gray-200'],
  
  // Specific dark elements
  ['bg-slate-800/80 backdrop-blur-md', 'bg-white shadow-md'],
  ['bg-slate-900/90 backdrop-blur-xl', 'bg-white shadow-lg'],
  ['bg-slate-900/80 backdrop-blur-md', 'bg-white/90 backdrop-blur-sm'],
  
  // Text colors
  ['text-white overflow-hidden', 'text-gray-900 overflow-hidden'],
  ['text-slate-50', 'text-gray-700'],
  ['text-white/50', 'text-gray-400'],
  ['text-white', 'text-gray-900'],
  ['text-slate-300', 'text-gray-800'],
  ['text-slate-400', 'text-gray-500'],
  ['text-slate-500', 'text-gray-500'],
  ['text-zinc-500', 'text-gray-500'],
  ['text-zinc-400', 'text-gray-500'],
  ['text-slate-200', 'text-gray-800'],
  
  // Input fields
  ['bg-slate-900 border-slate-800', 'bg-white border-gray-300'],
  ['bg-slate-900', 'bg-white'],
  
  // Buttons
  ['bg-[#5244e1]', 'bg-blue-600'],
  ['bg-slate-800 text-gray-900 hover:bg-slate-700', 'bg-gray-100 text-gray-700 hover:bg-gray-200'],
  ['bg-slate-800 hover:bg-slate-700', 'bg-gray-100 hover:bg-gray-200'],
  ['bg-slate-700 text-gray-900', 'bg-gray-200 text-gray-900'],
  ['bg-slate-700', 'bg-gray-200'],
  ['bg-white/5 hover:bg-white/10', 'bg-gray-100 hover:bg-gray-200'],
  ['bg-white/5', 'bg-gray-50'],
  
  // Other components
  ['bg-violet-600', 'bg-gray-800'],
  ['from-[#0f172a]', 'from-gray-100'],
  
  // Fix button text colors that were just swapped
  ['bg-gray-100 text-gray-900 hover:bg-gray-200', 'bg-gray-100 text-gray-700 hover:bg-gray-200'],
];

for (const [find, replace] of replacements) {
  content = content.split(find).join(replace);
}

// Add Forge India logo to Meeting Lobby
content = content.replace(
  '<h2 className="text-3xl font-black">Ready to join?</h2>',
  `<div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        </div>
                        <span className="text-xl font-black tracking-tighter text-gray-900">Forge India</span>
                     </div>
                     <h2 className="text-3xl font-black text-gray-900">Ready to join?</h2>`
);

// Add Forge India logo to In-Call State (replace the first part of top header)
content = content.replace(
  '<div className="flex items-center gap-2">',
  `<div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                 </div>
                 <span className="text-sm font-black tracking-tighter text-gray-900">Forge India</span>
              </div>
              <div className="w-px h-4 bg-gray-300"></div>`
);

fs.writeFileSync(target, content);
console.log("Refactored MeetingApp.jsx");
