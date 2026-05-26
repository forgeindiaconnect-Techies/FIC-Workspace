import { Schema, model, Document, Types } from 'mongoose';

export interface ITranscript extends Document {
  meetingId: string;
  userId: string;       // User ID of the speaker
  speakerName: string;  // Name of the speaker for easy display
  text: string;         // The transcribed text chunk
  timestamp: Date;      // When this was spoken
  createdAt: Date;
}

const TranscriptSchema = new Schema<ITranscript>({
  meetingId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  speakerName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

export const Transcript = model<ITranscript>('Transcript', TranscriptSchema);
