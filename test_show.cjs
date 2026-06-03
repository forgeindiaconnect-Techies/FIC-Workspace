fetch('http://localhost:3104/api/show/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Make a presentation' })
}).then(r => r.text()).then(console.log).catch(console.error);
