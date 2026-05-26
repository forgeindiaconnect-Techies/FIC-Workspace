import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '3001';
const FALLBACK_LAN_IP = '192.168.1.72';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeHost = (host?: string | null) => {
  if (!host) return null;

  return host
    .replace(/^https?:\/\//, '')
    .replace(/^wss?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
};

const getMetroHost = () => {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  return normalizeHost(scriptURL);
};

// Dynamic host detection for seamless cross-platform, emulator, and Expo Go execution.
const getHostIp = () => {
  const configuredHost = normalizeHost(process.env.EXPO_PUBLIC_API_HOST);
  if (configuredHost) {
    return configuredHost;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.hostname;
  }

  const metroHost = getMetroHost();
  if (metroHost) {
    if (Platform.OS === 'android' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(metroHost)) {
      return '10.0.2.2';
    }

    return metroHost;
  }

  // Workstation active LAN IP address fallback for physical mobile device routing.
  return FALLBACK_LAN_IP;
};

export const BASE_IP = getHostIp();

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ? stripTrailingSlash(process.env.EXPO_PUBLIC_API_URL) : '';
const configuredSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL ? stripTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL) : '';
const LOCAL_API_URL = configuredApiUrl || `http://${BASE_IP}:${API_PORT}`;
const LOCAL_SOCKET_URL = configuredSocketUrl || LOCAL_API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

// Cloud backend (Render)
export const PRODUCTION_API_URL = 'https://workspace-backend-r9f8.onrender.com';
const PRODUCTION_SOCKET_URL = 'wss://workspace-backend-r9f8.onrender.com';

const forceLocalBackend =
  process.env.EXPO_PUBLIC_USE_LOCAL === 'true' ||
  process.env.EXPO_PUBLIC_USE_LOCAL === '1';

// Default to cloud unless EXPO_PUBLIC_USE_LOCAL or EXPO_PUBLIC_API_URL points at your PC.
const defaultApiUrl =
  configuredApiUrl || (forceLocalBackend ? LOCAL_API_URL : PRODUCTION_API_URL);
const defaultSocketUrl =
  configuredSocketUrl || (forceLocalBackend ? LOCAL_SOCKET_URL : PRODUCTION_SOCKET_URL);

export let API_URL = configuredApiUrl || defaultApiUrl;
export let SOCKET_URL = configuredSocketUrl || defaultSocketUrl;

let sessionInitPromise: Promise<void> | null = null;

export const waitForSession = () => {
  if (!sessionInitPromise) {
    sessionInitPromise = initializeSession();
  }
  return sessionInitPromise;
};

export const setCustomServerUrl = async (url: string) => {
  const cleanUrl = stripTrailingSlash(url.trim());
  if (!cleanUrl) {
    API_URL = configuredApiUrl || defaultApiUrl;
    SOCKET_URL = configuredSocketUrl || defaultSocketUrl;
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem('nexus_custom_api_url');
      } catch (e) {}
    } else {
      try {
        await AsyncStorage.removeItem('nexus_custom_api_url');
      } catch (e) {}
    }
    return;
  }

  API_URL = cleanUrl;
  SOCKET_URL = cleanUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

  if (Platform.OS === 'web') {
    try {
      localStorage.setItem('nexus_custom_api_url', cleanUrl);
    } catch (e) {}
  } else {
    try {
      await AsyncStorage.setItem('nexus_custom_api_url', cleanUrl);
    } catch (e) {}
  }
};

export const getCustomServerUrl = () => {
  return API_URL;
};

/** Point API at Render (clears a saved LAN/custom URL). */
export const useCloudServer = async () => {
  API_URL = PRODUCTION_API_URL;
  SOCKET_URL = PRODUCTION_SOCKET_URL;
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem('nexus_custom_api_url');
    } catch {
      /* ignore */
    }
  } else {
    try {
      await AsyncStorage.removeItem('nexus_custom_api_url');
    } catch {
      /* ignore */
    }
  }
};

export const checkBackendHealth = async (): Promise<{ ok: boolean; message?: string }> => {
  try {
    const response = await fetch(`${API_URL}/health`, { method: 'GET' });
    if (!response.ok) {
      return { ok: false, message: `Server returned ${response.status}` };
    }
    const data = await response.json().catch(() => ({}));
    if (data?.database === 'disconnected') {
      return {
        ok: false,
        message: 'API is up but database is disconnected (check MONGO_URI on Render).',
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network request failed';
    return {
      ok: false,
      message: `${msg} — trying ${API_URL}`,
    };
  }
};

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
      const customUrl = localStorage.getItem('nexus_custom_api_url');
      if (customUrl) {
        API_URL = customUrl;
        SOCKET_URL = customUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      }

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
      const customUrl = await AsyncStorage.getItem('nexus_custom_api_url');
      if (customUrl) {
        API_URL = customUrl;
        SOCKET_URL = customUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      }

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

const parseApiError = (payload: any, status: number) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (payload?.error) return payload.error;
  if (payload?.message) return payload.message;
  if (payload?.details) return payload.details;
  return `HTTP Error ${status}: Request failed`;
};

const isAuthPath = (path: string) =>
  path.startsWith('/api/auth/login') ||
  path.startsWith('/api/auth/signup') ||
  path.startsWith('/api/auth/register-tenant') ||
  path.startsWith('/api/auth/refresh');

/** Extra headers that trigger CORS preflight in browsers if not allowed by the API. */
const applyNoCacheHeaders = (headers: Headers) => {
  if (Platform.OS === 'web') return;
  headers.set('Cache-Control', 'no-cache');
  headers.set('Pragma', 'no-cache');
};

// Generic safe fetch handler
async function request(path: string, options: RequestInit = {}): Promise<any> {
  await waitForSession();
  const { token } = getSession();
  const headers = new Headers(options.headers || {});
  
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  applyNoCacheHeaders(headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_URL}${path}`;
  console.log(`[Request] ${options.method || 'GET'} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Network request failed';
    throw new Error(
      `${detail}. Cannot reach ${API_URL}. ` +
        (forceLocalBackend || configuredApiUrl
          ? 'Check Wi‑Fi, backend is running, and EXPO_PUBLIC_API_URL uses your PC LAN IP.'
          : 'Use server settings to switch to cloud, or set EXPO_PUBLIC_USE_LOCAL=true for local backend.')
    );
  }

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
        const refreshHeaders = new Headers({ 'Content-Type': 'application/json' });
        applyNoCacheHeaders(refreshHeaders);
        const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: refreshHeaders,
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
    const errorMessage = parseApiError(errorData, response.status);
    
    // Auto-logout on expired sessions (not during login/signup attempts)
    if (response.status === 401 && !isAuthPath(path)) {
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
      if (data.mfaRequired) {
        return data;
      }
      const token = data.token || data.accessToken;
      if (!token) {
        throw new Error('Login succeeded but no access token was returned.');
      }
      const userObj = data.user && typeof data.user === 'object' ? data.user : {
        name: data.user,
        role: data.role,
        workspaceId: data.workspaceId,
        email: data.email || email
      };
      setSession(token, userObj, data.refreshToken);
      return data;
    },
    async signup(name: string, email: string, password: string) {
      const data = await request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      const token = data.token || data.accessToken;
      if (token) {
        setSession(token, data.user, data.refreshToken);
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
      const encodedRoomId = encodeURIComponent(roomId.trim());
      const query = password ? `?passcode=${encodeURIComponent(password)}` : '';
      return request(`/api/meetings/join/${encodedRoomId}${query}`);
    },
    async startMeeting(id: string) {
      return request(`/api/meetings/${id}/start`, { method: 'POST' });
    },
    async endMeeting(id: string) {
      return request(`/api/meetings/${id}/end`, { method: 'POST' });
    },
    async leaveMeeting(id: string) {
      return request(`/api/meetings/${id}/leave`, { method: 'POST' });
    },
    async startAIBot(id: string, frontendUrl: string) {
      return request(`/api/meetings/${id}/start-ai`, {
        method: 'POST',
        body: JSON.stringify({ frontendUrl }),
      });
    },
    async getParticipants(meetingId: string) {
      return request(`/api/meetings/${meetingId}/participants`);
    },
    async summarizeMeeting(id: string) {
      return request(`/api/meetings/${id}/summarize`, { method: 'POST' });
    },
    async getIceServers() {
      try {
        return await request('/api/meet/ice-servers');
      } catch {
        // Fallback STUN servers if request fails
        return [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
      }
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
    async sendMessage(workspaceId: string, channelId: string, content: string) {
      return request(`/api/chat/${workspaceId}/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    async startDm(members: string[], createdBy: string, workspaceId?: string) {
      return request('/api/chat/start-dm', {
        method: 'POST',
        body: JSON.stringify({ members, createdBy, workspaceId }),
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
