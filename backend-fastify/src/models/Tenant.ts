import { Schema, model, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  organisationName: string;
  workspaceId: string;
  domain: string;
  adminEmail: string;
  password?: string;
  paymentStatus?: string;
  subscriptionTier?: string;
  maxUsers?: number;
  subscriptionExpiryDate?: Date;
  createdAt: Date;
}

const TenantSchema = new Schema<ITenant>({
  name: { type: String, required: true },
  organisationName: { type: String, required: true, unique: true },
  workspaceId: { type: String, required: true, unique: true },
  domain: { type: String, required: true, unique: true },
  adminEmail: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  paymentStatus: { type: String, default: 'active' },
  subscriptionTier: { type: String, default: 'starter' },
  maxUsers: { type: Number, default: 20 },
  subscriptionExpiryDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'tenants' });

export const Tenant = model<ITenant>('Tenant', TenantSchema);
