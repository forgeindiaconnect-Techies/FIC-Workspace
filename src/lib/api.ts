import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dynamic host detection for seamless cross-platform & local execution
const getHostIp = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }
  // Workstation active LAN IP address for physical mobile device routing
  return '192.168.1.72';
};

export const BASE_IP = getHostIp();

const LOCAL_API_HOST = Platform.OS === 'android' && typeof __DEV__ !== 'undefined' && __DEV__ ? '10.0.2.2' : BASE_IP;
const LOCAL_API_URL = `http://${LOCAL_API_HOST}:3001`;
const LOCAL_SOCKET_URL = `ws://${LOCAL_API_HOST}:3001`;

// Use the publicly deployed backend for release APK builds.
const PRODUCTION_API_URL = 'https://workspace-dkwd.onrender.com';
const PRODUCTION_SOCKET_URL = 'wss://workspace-dkwd.onrender.com';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : (process.env.NODE_ENV === 'development' || true); // Force dev mode for local testing

export const API_URL = isDev ? LOCAL_API_URL : PRODUCTION_API_URL;
export const SOCKET_URL = isDev ? LOCAL_SOCKET_URL : PRODUCTION_SOCKET_URL;

// If you need a fully custom backend for release builds, replace PRODUCTION_API_URL with your hosted backend domain.

// Client Session Token Storage using global persistence for robust hot-reload & cross-platform support
export const setSession = (token: string, user: any, refreshToken?: string) => {
  (global as any).nexus_token = token;
  (global as any).nexus_user = user;
  if (refreshToken) {
    (global as any).nexus_refresh_token = refreshToken;
  }
  
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem('nexus_token', token);
      localStorage.setItem('nexus_user', JSON.stringify(user));
      if (refreshToken) {
        localStorage.setItem('nexus_refresh_token', refreshToken);
      }
    } catch (e) {
      console.warn("localStorage persistence blocked:", e);
    }
  } else {
    try {
      AsyncStorage.setItem('nexus_token', token).catch(e => console.warn(e));
      AsyncStorage.setItem('nexus_user', JSON.stringify(user)).catch(e => console.warn(e));
      if (refreshToken) {
        AsyncStorage.setItem('nexus_refresh_token', refreshToken).catch(e => console.warn(e));
      }
    } catch (e) {
      console.warn("AsyncStorage persistence blocked:", e);
    }
  }
};

export const getSession = () => {
  let token = (global as any).nexus_token || null;
  let user = (global as any).nexus_user || null;
  let refreshToken = (global as any).nexus_refresh_token || null;

  if (!token && Platform.OS === 'web') {
    try {
      token = localStorage.getItem('nexus_token');
      refreshToken = localStorage.getItem('nexus_refresh_token');
      const userStr = localStorage.getItem('nexus_user');
      if (userStr) user = JSON.parse(userStr);
      
      // Seed global for subsequent calls
      (global as any).nexus_token = token;
      (global as any).nexus_user = user;
      (global as any).nexus_refresh_token = refreshToken;
    } catch (e) {
      // Ignore security constraints
    }
  }
  
  return { token, user, refreshToken };
};

export const initializeSession = async () => {
  if (Platform.OS === 'web') {
    try {
      const token = localStorage.getItem('nexus_token');
      const refreshToken = localStorage.getItem('nexus_refresh_token');
      const userStr = localStorage.getItem('nexus_user');
      if (token) {
        (global as any).nexus_token = token;
      }
      if (refreshToken) {
        (global as any).nexus_refresh_token = refreshToken;
      }
      if (userStr) {
        (global as any).nexus_user = JSON.parse(userStr);
      }
    } catch (e) {
      // Ignore
    }
  } else {
    try {
      const token = await AsyncStorage.getItem('nexus_token');
      const refreshToken = await AsyncStorage.getItem('nexus_refresh_token');
      const userStr = await AsyncStorage.getItem('nexus_user');
      if (token) {
        (global as any).nexus_token = token;
      }
      if (refreshToken) {
        (global as any).nexus_refresh_token = refreshToken;
      }
      if (userStr) {
        (global as any).nexus_user = JSON.parse(userStr);
      }
    } catch (e) {
      console.warn("Failed to initialize session from AsyncStorage:", e);
    }
  }
};

export const clearSession = () => {
  (global as any).nexus_token = null;
  (global as any).nexus_user = null;
  (global as any).nexus_refresh_token = null;
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem('nexus_token');
      localStorage.removeItem('nexus_user');
      localStorage.removeItem('nexus_refresh_token');
    } catch (e) {
      // Ignore
    }
  } else {
    try {
      AsyncStorage.removeItem('nexus_token').catch(e => console.warn(e));
      AsyncStorage.removeItem('nexus_user').catch(e => console.warn(e));
      AsyncStorage.removeItem('nexus_refresh_token').catch(e => console.warn(e));
    } catch (e) {
      // Ignore
    }
  }
};

let isRefreshing = false;

// Generic safe fetch handler
async function request(path: string, options: RequestInit = {}): Promise<any> {
  const { token } = getSession();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Pragma', 'no-cache');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Debug log for tracing requests and their active token credentials
  console.log(`[Request] Calling: ${path}, Token Excerpt: ${token ? '...' + token.slice(-8) : 'none'}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle concurrent requests that fail with 401 while a refresh is already in progress
  if (response.status === 401 && isRefreshing && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    console.log(`[Request] Queueing concurrent call to ${path} for 500ms during token refresh...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return request(path, options);
  }

  // Handle automatic silent token rotation if 401 occurs
  if (response.status === 401 && !isRefreshing && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    const { refreshToken } = getSession();
    if (refreshToken) {
      isRefreshing = true;
      try {
        console.log('[Request] Access token expired. Attempting silent token rotation...');
        const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({ refreshToken }),
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          console.log('[Request] Token rotation succeeded! Retrying original request.');
          setSession(data.accessToken, data.user, data.refreshToken);
          isRefreshing = false;
          
          // Retry the original request transparently with the new token
          return request(path, options);
        } else {
          console.warn('[Request] Token rotation rejected by server. Clearing session.');
          clearSession();
        }
      } catch (err) {
        console.error('[Request] Silent token rotation failed:', err);
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `HTTP Error ${response.status}: Request failed`;
    
    // Auto-logout UI redirect on persistent 401s to break infinite loops
    if (response.status === 401) {
      clearSession();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

// REST API CLIENT
export const api = {
  // Authentication
  auth: {
    async login(email: string, password: string) {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const token = data.token || data.accessToken;
      if (token) {
        const userObj = data.user && typeof data.user === 'object' ? data.user : {
          name: data.user,
          role: data.role,
          workspaceId: data.workspaceId,
          email: data.email || email
        };
        // Securely bind the active session including the refresh token
        setSession(token, userObj, data.refreshToken);
      }
      return data;
    },
    async registerTenant(tenantData: any) {
      return request('/api/auth/register-tenant', {
        method: 'POST',
        body: JSON.stringify(tenantData),
      });
    }
  },

  // Mail Module
  mail: {
    async getMails(folder: string = 'inbox') {
      return request(`/api/mail?folder=${encodeURIComponent(folder)}`);
    },
    async sendMail(mailData: any) {
      return request('/api/mail/send', {
        method: 'POST',
        body: JSON.stringify(mailData),
      });
    },
    async markRead(id: string) {
      return request(`/api/mail/${id}/read`, { method: 'PUT' });
    },
    async toggleStar(id: string) {
      return request(`/api/mail/${id}/star`, { method: 'PUT' });
    },
    async moveMail(id: string, folder: string) {
      return request(`/api/mail/${id}/move`, {
        method: 'PUT',
        body: JSON.stringify({ folder }),
      });
    },
    async deleteMail(id: string) {
      return request(`/api/mail/${id}`, { method: 'DELETE' });
    },
    async getSmartReply(prompt: string, subject: string, context: string = '') {
      return request('/api/mail/smart-reply', {
        method: 'POST',
        body: JSON.stringify({ prompt, subject, context }),
      });
    }
  },

  // Meetings Module
  meetings: {
    async getMeetings(workspaceId?: string) {
      try {
        const res = await request('/api/meetings/history?page=1&limit=20');
        return res.meetings || [];
      } catch (e) {
        return [];
      }
    },
    async createMeeting(meetingData: any) {
      return request('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: meetingData.title,
          passcode: meetingData.password || undefined,
          durationMinutes: meetingData.duration || 60,
          scheduledAt: meetingData.startTime || new Date(),
          recordingEnabled: true
        }),
      });
    },
    async registerLiveMeeting(meetingData: any) {
      return request('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: meetingData.title,
          passcode: meetingData.password || undefined,
          durationMinutes: meetingData.duration || 60,
          scheduledAt: meetingData.startTime || new Date(),
          recordingEnabled: true
        }),
      });
    },
    async validateMeeting(roomId: string, password?: string) {
      return request(`/api/meetings/join/${roomId}`);
    },
    async startMeeting(id: string) {
      return request(`/api/meetings/${id}/start`, { method: 'POST' });
    },
    async endMeeting(id: string) {
      return request(`/api/meetings/${id}/end`, { method: 'POST' });
    },
    async getParticipants(meetingId: string) {
      return request(`/api/meetings/${meetingId}/participants`);
    },
    async summarizeMeeting(id: string) {
      return request(`/api/meetings/${id}/summarize`, { method: 'POST' });
    }
  },

  // Document Vault Module
  docs: {
    async getDocs(workspaceId: string, type?: string) {
      let url = `/api/docs/${workspaceId}`;
      if (type) url += `?type=${encodeURIComponent(type)}`;
      return request(url);
    },
    async createDoc(docData: any) {
      return request('/api/docs/create', {
        method: 'POST',
        body: JSON.stringify(docData),
      });
    },
    async updateDoc(id: string, updateData: any) {
      return request(`/api/docs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    }
  },

  // Chat Module (Kural)
  chat: {
    async getChannels(workspaceId: string, email: string) {
      return request(`/api/channels/${workspaceId}?email=${encodeURIComponent(email)}`);
    },
    async createChannel(channelData: any) {
      return request('/api/channels/create', {
        method: 'POST',
        body: JSON.stringify(channelData),
      });
    },
    async getMessages(workspaceId: string, channelId: string) {
      return request(`/api/chat/${workspaceId}/${channelId}`);
    },
    async startDm(members: string[], createdBy: string) {
      return request('/api/chat/start-dm', {
        method: 'POST',
        body: JSON.stringify({ members, createdBy }),
      });
    },
    async deleteConversation(channelId: string) {
      return request(`/api/chat/delete-conversation/${channelId}`, {
        method: 'DELETE',
      });
    }
  },

  // Team Directory
  members: {
    async getMembers(workspaceId: string) {
      return request(`/api/members/${workspaceId}`);
    },
    async addMember(memberData: any) {
      return request('/api/members/add', {
        method: 'POST',
        body: JSON.stringify(memberData),
      });
    }
  }
};
