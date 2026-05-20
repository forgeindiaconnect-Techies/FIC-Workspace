import { Schema, model, Document, Types } from 'mongoose';

export interface IChatMessage extends Document {
  meetingId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  sentAt: Date;
  reactions: string[];
}

const ChatMessageSchema = new Schema<IChatMessage>({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  reactions: [{ type: String }]
});

// Compound index for high performance chronological pagination per meeting
ChatMessageSchema.index({ meetingId: 1, sentAt: 1 });

export const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);
