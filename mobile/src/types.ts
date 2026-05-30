export type AppState = 'meeting' | 'mail' | 'chat';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  workspaceId: string;
  avatarUrl?: string;
  createdAt?: string;
}


export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface Mail {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  timestamp: number;
  read: boolean;
}
