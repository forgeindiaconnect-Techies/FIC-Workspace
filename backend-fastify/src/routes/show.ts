import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middlewares/auth';
import * as fs from 'fs';
import * as path from 'path';

let cachedExamples = '';
try {
  const examplesPath = path.join(__dirname, '../ppt_examples.json');
  if (fs.existsSync(examplesPath)) {
    cachedExamples = fs.readFileSync(examplesPath, 'utf8');
  }
} catch (e) {
  console.error("Failed to load ppt_examples.json", e);
}

export async function showRoutes(fastify: FastifyInstance) {
  // Authentication temporarily removed for local debugging
  // fastify.addHook('preValidation', authenticate);

  fastify.get('/ping', async () => ({ pong: true }));

  // GENERATE AI Presentation Slides
  fastify.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { prompt } = request.body as any;
      if (!prompt) return reply.code(400).send({ error: 'Prompt is required' });
      
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return reply.code(500).send({ error: 'AI API key not configured' });
      }

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
            { role: 'user', content: prompt }
          ],
          temperature: 0.5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error: ${errorText}`);
      }

      const data = await response.json();
      let generatedJsonText = data.choices?.[0]?.message?.content || '{"slides":[]}';
      console.log('Raw AI Output:', generatedJsonText);

      let slides = [];
      let theme = 'modern';
      try {
        const cleanedText = generatedJsonText.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        slides = parsed.slides || [];
        theme = parsed.theme || 'modern';
      } catch (parseError: any) {
        throw new Error(`Failed to parse AI output as JSON. Output: ${generatedJsonText}. Error: ${parseError.message}`);
      }

      return reply.code(200).send({ slides, theme });
    } catch (err: any) {
      console.error('AI GENERATION ERROR:', err);
      try { fs.writeFileSync(path.join(__dirname, '../groq_error_debug.log'), err.message + '\\n' + err.stack); } catch (e) {}
      return reply.code(500).send({ error: err.message || 'Failed to generate presentation' });
    }
  });
}
