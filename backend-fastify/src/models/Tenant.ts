import { Schema, model, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  workspaceId: string;
  domain: string;
  adminEmail: string;
  password?: string;
  createdAt: Date;
}

const TenantSchema = new Schema<ITenant>({
  name: { type: String, required: true },
  workspaceId: { type: String, required: true, unique: true },
  domain: { type: String, required: true },
  adminEmail: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'tenants' });

export const Tenant = model<ITenant>('Tenant', TenantSchema);
