import { FastifyInstance } from 'fastify';
import { Mail } from '../models/Mail';
import { authenticate } from '../middlewares/auth';
import { activeMailSockets } from '../services/mailSockets';

async function fetchJsonWithTimeout(url: string, options: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

function buildLocalEmailDraft(prompt: string, subject?: string, context?: string) {
  const cleanPrompt = String(prompt || '').trim();
  const cleanSubject = String(subject || '').trim();
  const cleanContext = String(context || '').trim();
  const subjectLine = cleanSubject ? ` regarding "${cleanSubject}"` : '';
  const contextLine = cleanContext
    ? 'I have reviewed the previous context and will keep the response aligned with it.'
    : 'I wanted to follow up with a clear update.';

  return [
    'Hi,',
    '',
    `${contextLine} ${cleanPrompt || `Please find my response${subjectLine} below.`}`,
    '',
    'Please let me know if you would like me to adjust the timeline or add any further details.',
    '',
    'Best regards,'
  ].join('\n');
}

export async function mailRoutes(fastify: FastifyInstance) {
  // Apply token authentication middleware
  fastify.addHook('preValidation', authenticate);

  // 1. Fetch Mail List (Filtered by Folder)
  fastify.get('/', async (request: any, reply) => {
    try {
      const folder = (request.query.folder as string) || 'inbox';
      const ownerEmail = request.user.email;
      
      const mails = await Mail.find({ ownerEmail, folder }).sort({ sentAt: -1 });
      return reply.code(200).send(mails);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch mail' });
    }
  });

  // 2. Fetch Single Mail by ID
  fastify.get('/:id', async (request: any, reply) => {
    try {
      const mail = await Mail.findOne({ _id: request.params.id, ownerEmail: request.user.email });
      if (!mail) return reply.code(404).send({ error: 'Mail not found' });
      return reply.code(200).send(mail);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch mail' });
    }
  });

  // 3. Compose & Send Mail
  fastify.post('/send', async (request: any, reply) => {
    try {
      const { to, subject, body, attachments } = request.body;
      const senderName = request.user.name || request.user.email.split('@')[0];
      const senderEmail = request.user.email;
      const workspaceId = request.user.workspaceId || 'antigraviity-hq';
      
      const recipientList = Array.isArray(to) ? to : [to].filter(Boolean);

      if (recipientList.length === 0) {
        return reply.code(400).send({ error: 'At least one recipient is required' });
      }

      // Create Sent copy for the sender
      const sentMail = await Mail.create({
        workspaceId,
        ownerEmail: senderEmail,
        folder: 'sent',
        senderName,
        senderEmail,
        recipientEmails: recipientList,
        subject,
        body,
        attachments: attachments || [],
        isRead: true 
      });

      // Create Inbox copies for recipients
      for (const recipientEmail of recipientList) {
        const inboxMail = await Mail.create({
          workspaceId,
          ownerEmail: recipientEmail,
          folder: 'inbox',
          senderName,
          senderEmail,
          recipientEmails: recipientList,
          subject,
          body,
          attachments: attachments || [],
          isRead: false
        });

        // Push real-time event
        if (activeMailSockets.has(recipientEmail)) {
          const ws = activeMailSockets.get(recipientEmail);
          if (ws?.readyState === 1) { // OPEN
            ws.send(JSON.stringify({ type: 'NEW_MAIL', mail: inboxMail }));
          }
        }
      }

      return reply.code(201).send(sentMail);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to send mail', details: err.message });
    }
  });

  // 4. Mark Mail as Read
  fastify.put('/:id/read', async (request: any, reply) => {
    try {
      const mail = await Mail.findOneAndUpdate(
        { _id: request.params.id, ownerEmail: request.user.email },
        { isRead: true },
        { new: true }
      );
      return reply.code(200).send(mail);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update mail' });
    }
  });

  // 5. Toggle Star Status
  fastify.put('/:id/star', async (request: any, reply) => {
    try {
      const mail = await Mail.findOne({ _id: request.params.id, ownerEmail: request.user.email });
      if (!mail) return reply.code(404).send({ error: 'Mail not found' });
      
      mail.isStarred = !mail.isStarred;
      await mail.save();
      
      return reply.code(200).send(mail);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update mail' });
    }
  });

  // 6. Move Mail to Folder (Trash/Archive)
  fastify.put('/:id/move', async (request: any, reply) => {
    try {
      const { folder } = request.body;
      const mail = await Mail.findOneAndUpdate(
        { _id: request.params.id, ownerEmail: request.user.email },
        { folder },
        { new: true }
      );
      return reply.code(200).send(mail);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to move mail' });
    }
  });

  // 7. Delete Mail permanently
  fastify.delete('/:id', async (request: any, reply) => {
    try {
      await Mail.findOneAndDelete({ _id: request.params.id, ownerEmail: request.user.email });
      return reply.code(200).send({ message: 'Mail permanently deleted' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete mail' });
    }
  });

  // 8. AI Text Suggestion / Smart Reply
  fastify.post('/smart-reply', async (request: any, reply) => {
    try {
      const { prompt, subject, context } = request.body;
      const groqKey = process.env.GROQ_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      
      const aiPrompt = `You are a highly professional AI email assistant. Your task is to draft or complete an email based on the following context.
Context/Previous Email: ${context || 'None'}
Subject: ${subject || 'None'}
User Prompt / Draft: ${prompt}

Important: Provide ONLY the final generated email body text. Do not include introductory conversational text like "Here is the email:" or quotes.`;

      let generatedText = '';
      let provider = 'local-fallback';

      try {
        if (groqKey) {
          console.log('Routing smart-reply query to Groq...');
          const data = await fetchJsonWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [{ role: 'user', content: aiPrompt }]
            })
          });
          if (data.error) {
            console.error('Groq API Error Response:', JSON.stringify(data.error));
            throw new Error(data.error.message || 'Groq error');
          }
          generatedText = data.choices?.[0]?.message?.content || '';
          provider = 'groq';
        } else if (geminiKey) {
          console.log('Routing smart-reply query to Gemini...');
          const data = await fetchJsonWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] })
          });
          if (data.error) {
            console.error('Gemini API Error Response:', JSON.stringify(data.error));
            throw new Error(data.error.message || 'Gemini error');
          }
          generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          provider = 'gemini';
        }
      } catch (aiErr: any) {
        console.warn('AI Provider connection failed. Detail:', aiErr.message);
      }

      if (!generatedText) {
        console.log('Defaulting to high-fidelity local email draft fallback...');
        generatedText = buildLocalEmailDraft(prompt, subject, context);
      }

      return reply.code(200).send({ suggestion: generatedText.trim(), provider });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to generate suggestion', details: err.message });
    }
  });
}
