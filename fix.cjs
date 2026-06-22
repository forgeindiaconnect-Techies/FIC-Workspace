const fs = require('fs');
let content = fs.readFileSync('src/pages/ChatApp.jsx', 'utf8');
content = content.replace(/ch\.type === 'dm'/g, "['dm', 'direct'].includes(ch.type)");
content = content.replace(/prev\?\.type === 'dm'/g, "['dm', 'direct'].includes(prev?.type)");
content = content.replace(/channel\.type !== 'dm'/g, "!['dm', 'direct'].includes(channel.type)");
content = content.replace(/selected\?\.type === 'dm'/g, "['dm', 'direct'].includes(selected?.type)");
content = content.replace(/selected\.type === 'dm'/g, "['dm', 'direct'].includes(selected.type)");
fs.writeFileSync('src/pages/ChatApp.jsx', content);
console.log('Fixed');
