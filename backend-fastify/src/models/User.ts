import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  password?: string; // Fallback for web application compatibility
  workspaceId?: string; // For web application schema compatibility
  role?: string; // For web application schema compatibility
  avatarUrl?: string;
  googleId?: string;
  appleId?: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  expoPushToken?: string;
  webPushSubscriptions?: Array<{
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }>;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  password: { type: String }, // Fallback for web application compatibility
  workspaceId: { type: String },
  role: { type: String, default: 'Member' },
  avatarUrl: { type: String },
  googleId: { type: String },
  appleId: { type: String },
  mfaSecret: { type: String },
  mfaEnabled: { type: Boolean, default: false },
  expoPushToken: { type: String },
  webPushSubscriptions: [{
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  }],
  createdAt: { type: Date, default: Date.now }
});

export const User = model<IUser>('User', UserSchema);
