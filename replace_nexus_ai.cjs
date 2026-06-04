const fs = require('fs');
const path = require('path');

const directoriesToScan = [
  path.join(__dirname, 'src'),
  path.join(__dirname, 'backend-fastify', 'src'),
  path.join(__dirname, 'mobile', 'src')
];

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  content = content.replace(/Nexus AI Assistant/g, 'Forge India Connect AI');
  content = content.replace(/Nexus AI Engine/g, 'Forge India Connect AI Engine');
  content = content.replace(/Nexus AI/g, 'Forge India Connect AI');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (stat.isFile() && extensions.includes(path.extname(fullPath))) {
      processFile(fullPath);
    }
  }
}

for (const dir of directoriesToScan) {
  scanDirectory(dir);
}

console.log('Replacement complete.');
