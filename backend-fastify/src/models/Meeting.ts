import { Schema, model, Document, Types } from 'mongoose';

export interface IMeeting extends Document {
  title: string;
  hostId: Types.ObjectId;
  joinCode: string; // Zoom-like unique code
  passcodeHash?: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: 'scheduled' | 'live' | 'ended';
  recordingEnabled: boolean;
  participantIds: Types.ObjectId[];
  aiSummary?: string;
  createdAt: Date;
}

const MeetingSchema = new Schema<IMeeting>({
  title: { type: String, required: true },
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  joinCode: { type: String, required: true, unique: true, index: true },
  passcodeHash: { type: String },
  scheduledAt: { type: Date, default: Date.now },
  durationMinutes: { type: Number, default: 60 },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  recordingEnabled: { type: Boolean, default: false },
  participantIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  aiSummary: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Meeting = model<IMeeting>('Meeting', MeetingSchema);
