export type AppState = 'meeting' | 'mail' | 'chat' | 'tasks' | 'files';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
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
