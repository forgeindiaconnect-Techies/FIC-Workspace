const fs = require('fs');

let content = fs.readFileSync('src/pages/ChatApp.jsx', 'utf8');

// Replace channel (ch) display picture
content = content.replace(/src=\{ch\.displayPicture \|\| `https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{name\}`\}/g, 'src={getDMPicture(ch)}');

// Replace selected display picture (complex ternary)
content = content.replace(/src=\{selected\.type === 'dm' \? \(selected\.displayPicture \|\| `https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{getDMName\(selected\)\}`\) : `https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{selected\.name\}`\}/g, 'src={getDMPicture(selected)}');

// Replace thread sender
content = content.replace(/src=\{`https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{activeThread\.sender\}`\}/g, 'src={getUserPicture(activeThread.sender)}');

// Replace message sender
content = content.replace(/src=\{`https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{msg\.sender\}`\}/g, 'src={getUserPicture(msg.sender)}');

// Replace user list
content = content.replace(/src=\{user\.profilePicture \|\| `https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{user\.name\}`\}/g, 'src={getUserPicture(user.name)}');

// Replace call target
content = content.replace(/src=\{`https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{callTargetName\}`\}/g, 'src={getUserPicture(callTargetName)}');

// Replace story user
content = content.replace(/`https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{story\.userName\}`/g, 'getUserPicture(story.userName)');

// Replace dm map (dm variable)
content = content.replace(/src=\{dm\.displayPicture \|\| `https:\/\/api\.dicebear\.com\/7\.x\/avataaars\/svg\?seed=\$\{dm\.displayName\}`\}/g, 'src={getDMPicture(dm)}');

fs.writeFileSync('src/pages/ChatApp.jsx', content);
console.log('Avatars replaced successfully');
