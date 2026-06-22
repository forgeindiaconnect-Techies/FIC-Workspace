const fs = require('fs');

async function convert() {
    const mdContent = fs.readFileSync('Forge_Connect_Mobile_Manual.md', 'utf8');
    
    // We can use the 'marked' package to convert markdown to HTML
    // Let's import it dynamically. If it fails, we instruct to install it.
    let marked;
    try {
        marked = require('marked');
    } catch (e) {
        console.error("Please run: npm install marked");
        process.exit(1);
    }

    const htmlContent = marked.parse(mdContent);
    
    const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><title>Forge Connect Mobile Manual</title></head>
    <body>
        ${htmlContent}
    </body>
    </html>
    `;

    fs.writeFileSync('Forge_Connect_Mobile_Manual.doc', docHtml);
    console.log('Successfully created Forge_Connect_Mobile_Manual.doc');
}

convert();
