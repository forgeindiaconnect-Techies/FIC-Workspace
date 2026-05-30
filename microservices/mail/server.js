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

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mail-service' });
});

const PORT = 3102;
app.listen(PORT, () => {
  console.log(`✉️ [Mail Service] Running on http://localhost:${PORT}`);
});
