import mongoose, { Document, Schema } from 'mongoose';

export interface ICallLog extends Document {
  callerEmail: string;
  calleeEmail: string;
  callerName: string;
  calleeName: string;
  callType: 'audio' | 'video';
  status: 'answered' | 'missed' | 'declined';
  duration: number; // in seconds
  timestamp: Date;
  deletedBy: string[]; // Emails of users who deleted this log from their view
}

const CallLogSchema = new Schema<ICallLog>(
  {
    callerEmail: { type: String, required: true },
    calleeEmail: { type: String, required: true },
    callerName: { type: String, required: true },
    calleeName: { type: String, required: true },
    callType: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: { type: String, enum: ['answered', 'missed', 'declined'], default: 'answered' },
    duration: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    deletedBy: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Index for faster queries when fetching history for a user
CallLogSchema.index({ callerEmail: 1, timestamp: -1 });
CallLogSchema.index({ calleeEmail: 1, timestamp: -1 });

export const CallLog = mongoose.model<ICallLog>('CallLog', CallLogSchema);
