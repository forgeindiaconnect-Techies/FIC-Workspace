import { Schema, model, Document, Types } from 'mongoose';

export interface IRoom extends Document {
  workspaceId: string;
  creatorId: Types.ObjectId;
  title: string;
  tag: string;
  color: string;
  createdAt: Date;
}

const RoomSchema = new Schema<IRoom>({
  workspaceId: { type: String, required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  tag: { type: String, required: true },
  color: { type: String, default: '#7c3aed' },
  createdAt: { type: Date, default: Date.now }
});

export const Room = model<IRoom>('Room', RoomSchema);
