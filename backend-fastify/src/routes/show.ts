import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middlewares/auth';

export async function showRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

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
              content: 'You are an expert presentation creator. Generate a presentation based on the user prompt. You must strictly reply with a JSON object containing a single key "slides", which is an array of objects. Each object must have a "title" string and a "content" string (which contains HTML formatting like <ul>, <li>, <strong>, <p>). Produce 5 to 7 slides.' 
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
      try {
        const parsed = JSON.parse(generatedJsonText);
        slides = parsed.slides || [];
      } catch (parseError: any) {
        throw new Error(`Failed to parse AI output as JSON. Output: ${generatedJsonText}. Error: ${parseError.message}`);
      }

      return reply.code(200).send({ slides });
    } catch (err: any) {
      console.error('AI GENERATION ERROR:', err);
      return reply.code(500).send({ error: err.message || 'Failed to generate presentation' });
    }
  });
}
