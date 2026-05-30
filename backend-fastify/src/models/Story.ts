import { Schema, model, Document } from 'mongoose';

export interface IStory extends Document {
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  content?: string;
  mediaType: string;
  mediaUrl?: string;
  bgColor?: string;
  views: string[];
  createdAt: Date;
}

const StorySchema = new Schema<IStory>({
  workspaceId: { type: String, required: true, index: true },
  userId: { type: String },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String },
  content: { type: String },
  mediaType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  mediaUrl: { type: String },
  bgColor: { type: String },
  views: [{ type: String }],
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
});

StorySchema.index({ workspaceId: 1, createdAt: -1 });

export const Story = model<IStory>('Story', StorySchema);
