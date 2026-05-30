import { Schema, model, Document } from 'mongoose';

export interface IMutedUser extends Document {
  userId: string;
  userEmail: string;
  mutedUserEmail: string;
  createdAt: Date;
}

const MutedUserSchema = new Schema<IMutedUser>({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  mutedUserEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

MutedUserSchema.index({ userEmail: 1, mutedUserEmail: 1 }, { unique: true });

export const MutedUser = model<IMutedUser>('MutedUser', MutedUserSchema);
