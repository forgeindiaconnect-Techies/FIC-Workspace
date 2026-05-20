import { Schema, model, Document, Types } from 'mongoose';

export interface IRecording extends Document {
  meetingId: Types.ObjectId;
  r2Key: string; // Cloudflare R2 object key
  durationSeconds: number;
  sizeBytes: number;
  status: 'processing' | 'ready' | 'failed';
  transcriptUrl?: string;
  createdAt: Date;
}

const RecordingSchema = new Schema<IRecording>({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
  r2Key: { type: String, required: true },
  durationSeconds: { type: Number, default: 0 },
  sizeBytes: { type: Number, default: 0 },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  transcriptUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Recording = model<IRecording>('Recording', RecordingSchema);
