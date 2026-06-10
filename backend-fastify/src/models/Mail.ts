import mongoose from 'mongoose';

const mailSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, default: 'antigraviity-hq' },
  ownerEmail: { type: String, required: true }, // The user who owns this specific copy of the email
  folder: { type: String, enum: ['inbox', 'sent', 'drafts', 'trash', 'archive'], default: 'inbox' },
  senderName: { type: String, required: true },
  senderEmail: { type: String, required: true },
  recipientEmails: [{ type: String, required: true }],
  subject: { type: String, default: '(No Subject)' },
  body: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  label: { type: String, default: null },
  attachments: [{
    name: String,
    url: String,
    size: Number,
    type: String
  }],
  sentAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
mailSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Mail = mongoose.model('Mail', mailSchema);
