const dotenv = require('dotenv');
dotenv.config({path: 'microservices/.env'});
fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' },
    messages: [
      { 
        role: 'system', 
        content: `You are an expert presentation creator. Generate a presentation based on the user prompt. 
You must strictly reply with a JSON object. Do not include any markdown wrappers, code blocks, or surrounding text. Just output the raw JSON object.

The JSON schema must be exactly:
{
  "theme": "modern", // Options: modern, corporate, playful, dark, elegant
  "slides": [
    {
      "layout": "title", // Options: title, bullets, split, quote
      "title": "Slide Title",
      "subtitle": "Subtitle or author (only for title layout)",
      "content": ["Point 1", "Point 2"] // Array of strings (for bullets/split), or string for quote
    }
  ]
}
Produce 5 to 7 beautifully structured slides.` 
      },
      { role: 'user', content: 'test presentation' }
    ],
    temperature: 0.7
  })
}).then(r => {
  if (!r.ok) return r.text().then(t => { throw new Error(t); });
  return r.json();
}).then(t => console.log(JSON.stringify(t))).catch(e => console.error(e));
