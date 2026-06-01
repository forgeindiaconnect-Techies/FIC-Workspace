import { Schema, model, Document } from 'mongoose';

export interface IKuralConversation extends Document {
  workspaceId: string;
  type: 'direct' | 'channel';
  name?: string;
  avatarUrl?: string;
  participantEmails: string[];
  createdByEmail: string;
  lastMessageContent?: string;
  lastMessageTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KuralConversationSchema = new Schema<IKuralConversation>({
  workspaceId: { type: String, required: true, index: true },
  type: { type: String, enum: ['direct', 'channel'], default: 'direct' },
  name: { type: String },
  avatarUrl: { type: String },
  participantEmails: [{ type: String, required: true, lowercase: true, trim: true }],
  createdByEmail: { type: String, required: true, lowercase: true, trim: true },
  lastMessageContent: { type: String },
  lastMessageTime: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

KuralConversationSchema.index({ workspaceId: 1, participantEmails: 1 });
KuralConversationSchema.index({ workspaceId: 1, updatedAt: -1 });

KuralConversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const KuralConversation = model<IKuralConversation>('KuralConversation', KuralConversationSchema);
