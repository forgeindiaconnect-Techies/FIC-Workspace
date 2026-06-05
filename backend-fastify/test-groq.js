require('dotenv').config();
const fs = require('fs');

async function test() {
  const cachedExamples = fs.readFileSync('d:/New folder/backend-fastify/src/ppt_examples.json', 'utf8');
  const groqKey = process.env.GROQ_API_KEY;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert presentation creator. Generate a professional presentation based on the user prompt. 
You must strictly reply with a JSON object containing two keys: "theme" and "slides".
1. "theme": Choose one from ["modern", "corporate", "playful", "dark", "elegant"] based on the topic.
2. "slides": An array of slide objects.

Each slide object MUST have:
- "layout": Choose ONE from ["title", "bullets", "split", "quote", "default"].
- "title": The slide title string.
- "subtitle": (Optional) The slide subtitle string, mostly used for "title" layout.
- "content": An array of strings representing bullet points, paragraphs, or split content. Do NOT use HTML tags.

Here are some training examples showing the PROFESSIONAL STRUCTURE and FLOW of a presentation (note: map their layouts to our supported layouts ["title", "bullets", "split", "quote", "default"]):
${cachedExamples}

Generate 5 to 7 slides with rich, professional content following the flow in the training examples. Provide the JSON object.`
        },
        { role: 'user', content: 'Create 10 slides on javascript' }
      ],
      temperature: 0.5
    })
  });

  const text = await response.text();
  console.log('Status:', response.status);
  console.log('Body:', text);
}
test();
