import { Schema, model, Document } from 'mongoose';

export interface IStory extends Document {
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
}

const StorySchema = new Schema<IStory>({
  workspaceId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String },
  content: { type: String, required: true }, // For text or image URLs
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours (86400 seconds)
});

StorySchema.index({ workspaceId: 1, createdAt: -1 });

export const Story = model<IStory>('Story', StorySchema);
