import { FastifyInstance } from 'fastify';
import { Mail } from '../models/Mail';
import { authenticate } from '../middlewares/auth';
import { activeMailSockets } from '../services/mailSockets';
import { sendPushNotification } from '../services/pushNotifications';
import { sendWebPush } from '../services/webPush';
import Groq from 'groq-sdk';

let groq: Groq | null = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

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
      
      const query: any = { ownerEmail };
      if (folder === 'starred') {
        query.isStarred = true;
      } else if (folder !== 'all') {
        query.folder = folder;
      }
      
      console.log(`[Mail GET] folder: ${folder}, query:`, query);
      const mails = await Mail.find(query).sort({ sentAt: -1 });
      console.log(`[Mail GET] found ${mails.length} mails`);
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
      const workspaceId = request.user.workspaceId || 'forge-india-connect';
      
      const recipientList = (Array.isArray(to) ? to : [to])
        .map((e: any) => String(e || '').trim())
        .filter(Boolean);

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

        // Dispatch remote push notification
        sendPushNotification(
          [recipientEmail],
          `New Email: ${subject || '(No Subject)'}`,
          `From: ${senderName || senderEmail}`,
          {
            type: 'mail',
            mailId: inboxMail._id.toString(),
            senderEmail,
          }
        ).catch((err: any) => console.error('[Mail] Remote push error:', err));

        // Dispatch Web Push notification (closed-tab browser state)
        sendWebPush(
          [recipientEmail],
          {
            title: `New Email: ${subject || '(No Subject)'}`,
            body: `From: ${senderName || senderEmail}`,
            url: `/w/${workspaceId || 'forge-india-connect'}/mail`
          }
        ).catch((err: any) => console.error('[Mail] Web push error:', err));
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
  fastify.put('/:id/label', async (request: any, reply) => {
    try {
      const { label } = request.body;
      const mail = await Mail.findOneAndUpdate(
        { _id: request.params.id, ownerEmail: request.user.email },
        { label },
        { new: true }
      );
      if (!mail) return reply.code(404).send({ error: 'Mail not found' });
      return reply.code(200).send(mail);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update mail label' });
    }
  });

  // 6. Toggle Star Status
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
      const geminiKey = process.env.GEMINI_API_KEY;
      
      const aiPrompt = `You are a highly professional AI email assistant. Your task is to draft or complete an email based on the following context.
Context/Previous Email: ${context || 'None'}
Subject: ${subject || 'None'}
User Prompt / Draft: ${prompt}
 
Important: Provide ONLY the final generated email body text. Do not include introductory conversational text like "Here is the email:" or quotes.`;

      let generatedText = '';
      let provider = 'local-fallback';

      try {
        if (groq) {
          console.log('[SmartReply] Routing to Groq SDK...');
          const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: 0.2
          });
          generatedText = chatCompletion.choices[0]?.message?.content || '';
          provider = 'groq';
        } else if (geminiKey) {
          console.log('[SmartReply] Routing to Gemini...');
          const data = await fetchJsonWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] })
          });
          if (data.error) throw new Error(data.error.message || 'Gemini error');
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

  // 9. Export HTML to PDF
  fastify.post('/export-pdf', async (request: any, reply) => {
    try {
      const { html } = request.body;
      if (!html) {
        return reply.code(400).send({ error: 'HTML content is required' });
      }
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      await browser.close();

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'attachment; filename="export.pdf"');
      return reply.send(pdfBuffer);
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      return reply.code(500).send({ error: 'Failed to generate PDF', details: err.message });
    }
  });

  // Cloudinary Upload Proxy  keeps API secret server-side
  fastify.post('/upload-attachment', async (request: any, reply) => {
    try {
      const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dfou7lxtg';
      const API_KEY    = process.env.CLOUDINARY_API_KEY    || '323596529822668';
      const API_SECRET = process.env.CLOUDINARY_API_SECRET || '1DGzf5iYPo0OhiAN_KKQs_mVim0';
      const FOLDER     = process.env.CLOUDINARY_FOLDER     || 'c-726de3a6883bccf114775c7a84376e';

      const { fileBase64, fileName, mimeType } = request.body as any;
      if (!fileBase64) return reply.code(400).send({ error: 'fileBase64 is required' });

      const timestamp = Math.floor(Date.now() / 1000);
      const crypto = await import('crypto');
      const signatureStr = `folder=${FOLDER}&timestamp=${timestamp}${API_SECRET}`;
      const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

      const formData = new URLSearchParams();
      formData.append('file', `data:${mimeType};base64,${fileBase64}`);
      formData.append('api_key', API_KEY);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
      formData.append('folder', FOLDER);
      if (fileName) formData.append('public_id', fileName.replace(/\.[^/.]+$/, ''));

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const data: any = await res.json();
      if (!res.ok) return reply.code(500).send({ error: 'Upload failed', details: data });
      return reply.code(200).send({ url: data.secure_url, publicId: data.public_id, bytes: data.bytes });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Upload failed', details: err.message });
    }
  });

  // 13. Save Draft (Create new draft)
  fastify.post('/draft', async (request: any, reply) => {
    try {
      const { to, subject, body, attachments } = request.body;
      const senderName = request.user.name || request.user.email.split('@')[0];
      const senderEmail = request.user.email;
      const workspaceId = request.user.workspaceId || 'forge-india-connect';
      
      const recipientList = (Array.isArray(to) ? to : [to])
        .map((e: any) => String(e || '').trim())
        .filter(Boolean);

      const draftMail = await Mail.create({
        workspaceId,
        ownerEmail: senderEmail,
        folder: 'drafts',
        senderName,
        senderEmail,
        recipientEmails: recipientList,
        subject: subject || '(No Subject)',
        body: body || '',
        attachments: attachments || [],
        isRead: true
      });

      return reply.code(201).send(draftMail);
    } catch (err: any) {
      console.error('[Draft POST Error]:', err.message);
      return reply.code(500).send({ error: 'Failed to save draft', details: err.message });
    }
  });

  // 14. Update Draft / Mail (Auto-saves or sends a draft)
  fastify.patch('/:id', async (request: any, reply) => {
    try {
      const { to, subject, body, attachments, isDraft } = request.body;
      const senderName = request.user.name || request.user.email.split('@')[0];
      const senderEmail = request.user.email;
      const workspaceId = request.user.workspaceId || 'forge-india-connect';

      const draft = await Mail.findOne({ _id: request.params.id, ownerEmail: senderEmail });
      if (!draft) {
        return reply.code(404).send({ error: 'Draft not found' });
      }

      const recipientList = (Array.isArray(to) ? to : [to])
        .map((e: any) => String(e || '').trim())
        .filter(Boolean);

      draft.recipientEmails = recipientList;
      draft.subject = subject !== undefined ? subject : draft.subject;
      draft.body = body !== undefined ? body : draft.body;
      draft.attachments = attachments !== undefined ? attachments : draft.attachments;

      if (isDraft === false) {
        // The user is sending the draft
        draft.folder = 'sent';
        draft.isRead = true;
        await draft.save();

        // Create Inbox copies for recipients
        for (const recipientEmail of recipientList) {
          const inboxMail = await Mail.create({
            workspaceId,
            ownerEmail: recipientEmail,
            folder: 'inbox',
            senderName,
            senderEmail,
            recipientEmails: recipientList,
            subject: draft.subject,
            body: draft.body,
            attachments: draft.attachments,
            isRead: false
          });

          // Push real-time WebSockets event
          if (activeMailSockets.has(recipientEmail)) {
            const ws = activeMailSockets.get(recipientEmail);
            if (ws?.readyState === 1) {
              ws.send(JSON.stringify({ type: 'NEW_MAIL', mail: inboxMail }));
            }
          }

          // Dispatch remote push notification
          sendPushNotification(
            [recipientEmail],
            `New Email: ${draft.subject || '(No Subject)'}`,
            `From: ${senderName || senderEmail}`,
            {
              type: 'mail',
              mailId: inboxMail._id.toString(),
              senderEmail,
            }
          ).catch((err: any) => console.error('[Mail Draft] Remote push error:', err));

          // Dispatch Web Push notification (closed-tab browser state)
          sendWebPush(
            [recipientEmail],
            {
              title: `New Email: ${draft.subject || '(No Subject)'}`,
              body: `From: ${senderName || senderEmail}`,
              url: `/w/${workspaceId || 'forge-india-connect'}/mail`
            }
          ).catch((err: any) => console.error('[Mail Draft] Web push error:', err));
        }
        return reply.code(200).send(draft);
      } else {
        // Regular auto-save update
        await draft.save();
        return reply.code(200).send(draft);
      }
    } catch (err: any) {
      console.error('[Draft PATCH Error]:', err.message);
      return reply.code(500).send({ error: 'Failed to update draft', details: err.message });
    }
  });

  // 15. AI Email Content Generator
  fastify.post('/generate', async (request: any, reply) => {
    try {
      const { subject } = request.body;
      if (!subject) {
        return reply.code(400).send({ error: 'Subject is required to generate content' });
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      
      const aiPrompt = `You are a highly professional AI email assistant. Write a professional, complete email with the subject line: "${subject}". 
Your response MUST be formatted in clean HTML suitable for an email body. Do NOT use markdown. Do NOT use markdown code block syntax (like \`\`\`html). Use paragraph tags, bold tags, and list tags if appropriate.
Provide ONLY the final email body content itself. Do not include any introductory conversational text or email headers (like Subject/To/From).`;

      let generatedHtml = '';

      try {
        if (groq) {
          console.log('[AI Composer] Routing to Groq SDK...');
          const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: 0.5
          });
          generatedHtml = chatCompletion.choices[0]?.message?.content || '';
        } else if (geminiKey) {
          console.log('[AI Composer] Routing to Gemini...');
          const data = await fetchJsonWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] })
          });
          if (data.error) throw new Error(data.error.message || 'Gemini error');
          generatedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (aiErr: any) {
        console.warn('AI Provider generation failed. Detail:', aiErr.message);
      }

      if (!generatedHtml) {
        generatedHtml = `<p>Dear Team,</p><p>I am writing regarding <strong>${subject}</strong>.</p><p>Please find the details regarding this matter attached, and let me know if you have any questions or feedback.</p><p>Best regards,<br/>${request.user.name || 'AI Assistant'}</p>`;
      }

      generatedHtml = generatedHtml.replace(/```html/g, '').replace(/```/g, '').trim();

      return reply.code(200).send({ content: generatedHtml });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to generate email content', details: err.message });
    }
  });

  // 16. AI Smart Compose Autocomplete
  fastify.post('/smart-compose', async (request: any, reply) => {
    try {
      const { currentText, context } = request.body;
      if (!currentText) {
        return reply.code(200).send({ suggestion: '' });
      }

      const aiPrompt = `You are an email autocomplete assistant. Continue the following email draft by suggesting the next 3 to 6 words to complete the current sentence or thought. 
Provide ONLY the suggested next words. Do NOT include introductory text, quotes, or conversational explanations.
If the draft is already complete or no suggestion is natural, return nothing.
Email Draft: "${currentText}"
Context: "${context || 'Professional email'}"`;

      let suggestion = '';

      try {
        if (groq) {
          const chatCompletion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: 0.1,
            max_tokens: 20
          });
          suggestion = chatCompletion.choices[0]?.message?.content || '';
        }
      } catch (e) {}

      suggestion = suggestion.replace(/^["'\s]+|["'\s]+$/g, '');

      return reply.code(200).send({ suggestion });
    } catch (err: any) {
      return reply.code(200).send({ suggestion: '' });
    }
  });
}
