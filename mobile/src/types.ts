export type AppState = 'meeting' | 'mail' | 'chat' | 'tasks';

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

export interface Task {
  _id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'pending_approval' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigneeEmail?: string;
  assigneeName?: string;
  createdByEmail: string;
  dueDate?: string;
  feedback?: string;
  createdAt: string;
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
