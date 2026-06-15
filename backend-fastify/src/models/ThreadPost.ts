import { Schema, model, Document } from 'mongoose';

export interface IThreadPost extends Document {
  workspaceId: string;
  authorEmail: string;
  authorName: string;
  content: string;
  mediaUrls: Array<{
    url: string;
    type: 'image' | 'video' | 'document';
    name?: string;
  }>;
  likes: string[]; // array of emails
  visibility: 'everyone' | 'team' | 'channel' | 'selected';
  visibilityData: string[]; // channel IDs or team names or emails
  isPinned: boolean;
  isReported: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadPostSchema = new Schema<IThreadPost>({
  workspaceId: { type: String, required: true, index: true },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String },
  mediaUrls: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video', 'document'], required: true },
    name: { type: String }
  }],
  likes: [{ type: String }],
  visibility: { type: String, enum: ['everyone', 'team', 'channel', 'selected'], default: 'everyone' },
  visibilityData: [{ type: String }],
  isPinned: { type: Boolean, default: false },
  isReported: { type: Boolean, default: false },
}, { timestamps: true });

export const ThreadPost = model<IThreadPost>('ThreadPost', ThreadPostSchema);
