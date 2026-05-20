import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  avatarUrl?: string;
  googleId?: string;
  appleId?: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  googleId: { type: String },
  appleId: { type: String },
  mfaSecret: { type: String },
  mfaEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const User = model<IUser>('User', UserSchema);
