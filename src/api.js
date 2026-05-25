// API Configuration for both Web and Mobile
const isMobile = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

// Detecting Localhost
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname.startsWith('192.168.'));

// Production Backend URL
const PROD_BACKEND_URL = 'https://workspace-backend-r9f8.onrender.com';

// Resolve Base URL
const getBaseUrl = () => {
  if (isMobile) return 'http://192.168.1.1:3001';
  
  // Priority 1: If VITE_API_URL is an absolute URL, use it
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Priority 2: If we are on Vercel or any other cloud provider (not localhost), force Render URL
  if (!isLocalhost) {
    return PROD_BACKEND_URL;
  }
  
  // Priority 3: Local development
  return 'http://localhost:3001';
};

const API_BASE_URL = getBaseUrl();

export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export const getSocketUrl = () => API_BASE_URL;

export default API_BASE_URL;
