import { Schema, model, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
  workspaceId: string;
  title: string;
  type: 'doc' | 'sheet' | 'pdf' | 'folder' | 'other';
  ownerEmail: string;
  ownerName?: string;
  sizeBytes?: number;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['doc', 'sheet', 'pdf', 'folder', 'other'],
    default: 'doc',
  },
  ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  ownerName: { type: String },
  sizeBytes: { type: Number, default: 0 },
  url: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DocumentSchema.index({ workspaceId: 1, createdAt: -1 });

DocumentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const WorkspaceDocument = model<IDocument>('WorkspaceDocument', DocumentSchema);
