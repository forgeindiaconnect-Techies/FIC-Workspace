import { Schema, model, Document } from 'mongoose';

export interface IThreadComment extends Document {
  postId: string;
  parentCommentId?: string; // null/undefined if it's a top-level comment
  authorEmail: string;
  authorName: string;
  content: string;
  likes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ThreadCommentSchema = new Schema<IThreadComment>({
  postId: { type: String, required: true, index: true },
  parentCommentId: { type: String, index: true },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  likes: [{ type: String }],
}, { timestamps: true });

export const ThreadComment = model<IThreadComment>('ThreadComment', ThreadCommentSchema);
