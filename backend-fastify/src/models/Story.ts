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
  privacyType: string;
  mentions: string[];
  views: { viewerEmail: string; viewedAt: Date }[];
  reactions: { userEmail: string; emoji: string; addedAt: Date }[];
  isArchived: boolean;
  createdAt: Date;
}

const StorySchema = new Schema<IStory>({
  workspaceId: { type: String, required: true, index: true },
  userId: { type: String },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String },
  content: { type: String },
  mediaType: { type: String, enum: ['text', 'image', 'video', 'voice'], default: 'text' },
  mediaUrl: { type: String },
  bgColor: { type: String },
  privacyType: { type: String, enum: ['everyone', 'contacts', 'except', 'only_share'], default: 'everyone' },
  mentions: [{ type: String }],
  views: [{ 
    viewerEmail: String, 
    viewedAt: { type: Date, default: Date.now } 
  }],
  reactions: [{
    userEmail: String,
    emoji: String,
    addedAt: { type: Date, default: Date.now }
  }],
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
});

StorySchema.index({ workspaceId: 1, createdAt: -1 });

export const Story = model<IStory>('Story', StorySchema);
