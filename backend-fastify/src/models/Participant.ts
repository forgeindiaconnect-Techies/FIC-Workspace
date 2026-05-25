import { Schema, model, Document, Types } from 'mongoose';

export interface IParticipant extends Document {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'host' | 'co-host' | 'attendee';
  joinedAt: Date;
  leftAt?: Date;
  audioMuted: boolean;
  videoMuted: boolean;
}

const ParticipantSchema = new Schema<IParticipant>({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['host', 'co-host', 'attendee'], default: 'attendee' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  audioMuted: { type: Boolean, default: false },
  videoMuted: { type: Boolean, default: false }
});

export const Participant = model<IParticipant>('Participant', ParticipantSchema);
