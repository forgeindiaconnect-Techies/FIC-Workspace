import express from 'express';
import multer from 'multer';
import { connectMongo, Mail } from '../shared/database.js';
import { authenticate } from '../shared/auth.js';
import { uploadToCloudinary, resolveUploadName } from '../shared/cloudinary.js';

const app = express();
app.use(express.json());

// Multer for file uploads (25MB limit)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Database check middleware
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database service unavailable' });
  }
});

// Enforce auth on all routes
app.use(authenticate);

// ─── FILE UPLOAD (for mail attachments) ───
app.post('/api/mail/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file upload.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    const originalName = resolveUploadName(req.file, result);

    res.json({
      url: result.secure_url || result.url,
      name: originalName,
      size: req.file.size,
      fileType: req.file.mimetype || 'application/octet-stream',
      publicId: result.public_id
    });
  } catch (err) {
    console.error('[Mail Upload Error]:', err.message);
    res.status(500).json({ error: 'File upload failed.', details: err.message });
  }
});

// 1. Fetch Mail List
app.get('/api/mail', async (req, res) => {
  try {
    const folder = req.query.folder || 'inbox';
    const ownerEmail = req.user.email;

    const query = { ownerEmail };
    if (folder !== 'all') {
      query.folder = folder;
    }

    const mails = await Mail.find(query).sort({ sentAt: -1 });
    res.json(mails);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mail' });
  }
});

// 2. Fetch Single Mail by ID
app.get('/api/mail/:id', async (req, res) => {
  try {
    const mail = await Mail.findOne({ _id: req.params.id, ownerEmail: req.user.email });
    if (!mail) return res.status(404).json({ error: 'Mail not found' });
    res.json(mail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mail' });
  }
});

// 3. Compose & Send Mail (with attachments)
app.post('/api/mail/send', async (req, res) => {
  try {
    const { to, subject, body, attachments } = req.body;
    const senderName = req.user.name || req.user.email.split('@')[0];
    const senderEmail = req.user.email;
    const workspaceId = req.user.workspaceId || 'demo';

    const recipientList = Array.isArray(to) ? to : [to].filter(Boolean);
    if (recipientList.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
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

      // Notify Sockets Service of new mail (MFE communication)
      try {
        fetch('http://localhost:3105/internal/new-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientEmail, mail: inboxMail })
        }).catch(() => {});
      } catch (e) {
        // Suppress background errors
      }
    }

    res.status(201).json(sentMail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send mail', details: err.message });
  }
});

// 4. Mark Mail as Read
app.put('/api/mail/:id/read', async (req, res) => {
  try {
    const mail = await Mail.findOneAndUpdate(
      { _id: req.params.id, ownerEmail: req.user.email },
      { isRead: true },
      { new: true }
    );
    res.json(mail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update mail' });
  }
});

// 5. Toggle Star Status
app.put('/api/mail/:id/star', async (req, res) => {
  try {
    const mail = await Mail.findOne({ _id: req.params.id, ownerEmail: req.user.email });
    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    mail.isStarred = !mail.isStarred;
    await mail.save();

    res.json(mail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update mail' });
  }
});

// 6. Move Mail to Folder
app.put('/api/mail/:id/move', async (req, res) => {
  try {
    const { folder } = req.body;
    const mail = await Mail.findOneAndUpdate(
      { _id: req.params.id, ownerEmail: req.user.email },
      { folder },
      { new: true }
    );
    res.json(mail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to move mail' });
  }
});

// 7. Delete Mail
app.delete('/api/mail/:id', async (req, res) => {
  try {
    await Mail.findOneAndDelete({ _id: req.params.id, ownerEmail: req.user.email });
    res.json({ message: 'Mail permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete mail' });
  }
});

// 7a. Create Draft
app.post('/api/mail/draft', async (req, res) => {
  try {
    const { to, subject, body, attachments } = req.body;
    const senderName = req.user.name || req.user.email.split('@')[0];
    const senderEmail = req.user.email;
    const workspaceId = req.user.workspaceId || 'demo';

    const draftMail = await Mail.create({
      workspaceId,
      ownerEmail: senderEmail,
      folder: 'drafts',
      senderName,
      senderEmail,
      recipientEmails: Array.isArray(to) ? to : (to ? [to].filter(Boolean) : []),
      subject: subject || '(No Subject)',
      body: body || '',
      attachments: attachments || [],
      isRead: true
    });
    res.json(draftMail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// 7b. Update Draft
app.patch('/api/mail/:id', async (req, res) => {
  try {
    const { to, subject, body, attachments } = req.body;
    
    const draftMail = await Mail.findOneAndUpdate(
      { _id: req.params.id, ownerEmail: req.user.email, folder: 'drafts' },
      { 
        $set: { 
          recipientEmails: Array.isArray(to) ? to : (to ? [to].filter(Boolean) : []),
          subject: subject || '(No Subject)',
          body: body || '',
          attachments: attachments || [],
          updatedAt: new Date()
        } 
      },
      { new: true }
    );
    
    if (!draftMail) return res.status(404).json({ error: 'Draft not found' });
    res.json(draftMail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

// 8. Generate Mail Content via AI
app.post('/api/mail/generate', async (req, res) => {
  try {
    const { subject } = req.body;
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required to generate mail content.' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'system',
          content: 'You are an AI assistant helping a user write a professional email. Output ONLY the email body. Do not include subject lines, greetings if they are too specific, or placeholders that need filling unless necessary. Keep it concise, polite, and professional.'
        }, {
          role: 'user',
          content: `Write an email body about this topic/subject: "${subject}"`
        }],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    res.json({ content });
  } catch (err) {
    console.error('[AI Mail Generation Error]:', err.message);
    res.status(500).json({ error: `Failed to generate mail content: ${err.message}` });
  }
});

// 8b. Smart Compose (autocomplete suggestion)
app.post('/api/mail/smart-compose', async (req, res) => {
  try {
    const { currentText, context } = req.body;
    if (!currentText) return res.json({ suggestion: '' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'system',
          content: 'You are an AI autocomplete tool. Given a partial sentence, provide ONLY the next few words to complete it seamlessly. Do not include quotes, explanations, or full paragraphs.'
        }, {
          role: 'user',
          content: `Complete this text: "${currentText}"`
        }],
        temperature: 0.3,
        max_tokens: 20
      })
    });

    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    const suggestion = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');

    res.json({ suggestion });
  } catch (err) {
    console.error('[AI Smart Compose Error]:', err.message);
    res.json({ suggestion: '' }); // Fail silently for autocomplete
  }
});

// 8c. Summarize Email Thread
app.post('/api/mail/summarize', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required for summarization.' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'system',
          content: 'Summarize the following email thread into 3 concise bullet points. Each bullet point should be separated by a newline.'
        }, {
          role: 'user',
          content: `Email Content: "${content}"`
        }],
        temperature: 0.5,
        max_tokens: 300
      })
    });

    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    const summaryText = data.choices[0].message.content.trim();
    
    // Split into bullet points
    const summary = summaryText.split('\n').filter(line => line.trim().length > 0);

    res.json({ summary });
  } catch (err) {
    console.error('[AI Summarize Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// 9. AI Text Suggestion / Smart Reply
app.post('/api/mail/smart-reply', async (req, res) => {
  try {
    const { prompt, subject, context } = req.body;
    const aiPrompt = `You are a highly professional AI email assistant. Your task is to draft or complete an email based on the following context.
Context/Previous Email: ${context || 'None'}
Subject: ${subject || 'None'}
User Prompt / Draft: ${prompt}

Important: Provide ONLY the final generated email body text. Do not include introductory conversational text like "Here is the email:" or quotes.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: aiPrompt }],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content.trim();

    res.json({ suggestion: generatedText, provider: 'groq' });
  } catch (err) {
    console.error('[AI Smart Reply Error]:', err.message);
    res.status(500).json({ error: `Failed to generate suggestion: ${err.message}` });
  }
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mail-service' });
});

const PORT = 3102;
app.listen(PORT, () => {
  console.log(`✉️ [Mail Service] Running on http://localhost:${PORT}`);
});
