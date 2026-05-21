import { Schema, model, Document, Types } from 'mongoose';

export interface IKuralMessage extends Document {
  conversationId: Types.ObjectId;
  workspaceId: string;
  senderEmail: string;
  senderName: string;
  content: string;
  createdAt: Date;
}

const KuralMessageSchema = new Schema<IKuralMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'KuralConversation', required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  senderEmail: { type: String, required: true, lowercase: true, trim: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

KuralMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const KuralMessage = model<IKuralMessage>('KuralMessage', KuralMessageSchema);
