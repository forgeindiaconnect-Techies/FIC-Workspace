import { Schema, model, Document, Types } from 'mongoose';

export interface ITask extends Document {
  workspaceId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeEmail?: string;
  assigneeName?: string;
  createdByEmail: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>({
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'done'],
    default: 'todo',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  assigneeEmail: { type: String, lowercase: true, trim: true },
  assigneeName: { type: String },
  createdByEmail: { type: String, required: true, lowercase: true, trim: true },
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TaskSchema.index({ workspaceId: 1, status: 1 });
TaskSchema.index({ workspaceId: 1, createdAt: -1 });

TaskSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Task = model<ITask>('Task', TaskSchema);
