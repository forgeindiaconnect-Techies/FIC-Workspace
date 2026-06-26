import { getApiUrl } from '../api';

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Sets up a global window.fetch interceptor.
 * If any API request returns 401 Unauthorized, it attempts to silently rotate
 * the access token using the refresh token, and then retries the failed requests.
 */
export function setupFetchInterceptor() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  window.fetch = async function (url, options = {}) {
    // 1. Ensure any request to the backend with authorization headers uses the latest token
    let currentOptions = { ...options };
    const token = localStorage.getItem('token');
    
    if (token) {
      const headers = new Headers(currentOptions.headers || {});
      if (headers.has('Authorization') || headers.has('authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
        currentOptions.headers = Object.fromEntries(headers.entries());
      }
    }

    // 2. Perform the original fetch
    let response;
    try {
      response = await originalFetch(url, currentOptions);
    } catch (err) {
      throw err;
    }

    // 3. Intercept 401 Unauthorized errors (excluding login/refresh endpoints themselves)
    const urlString = typeof url === 'string' ? url : url.url || '';
    const isAuthRequest = urlString.includes('/api/auth/login') || urlString.includes('/api/auth/refresh');

    if (response.status === 401 && !isAuthRequest) {
      const authData = JSON.parse(localStorage.getItem('auth') || '{}');
      const refreshToken = authData.refreshToken || localStorage.getItem('refreshToken');

      if (refreshToken) {
        if (!isRefreshing) {
          isRefreshing = true;

          // Request a new access token
          try {
            console.log('[FetchInterceptor] Access token expired. Attempting silent token rotation...');
            const refreshUrl = getApiUrl('/api/auth/refresh');
            const refreshResponse = await originalFetch(refreshUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              const newToken = data.token || data.accessToken;
              const newRefreshToken = data.refreshToken;

              // Update localStorage with new credentials
              localStorage.setItem('token', newToken);
              if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
                authData.refreshToken = newRefreshToken;
              }
              authData.token = newToken;
              authData.accessToken = newToken;
              localStorage.setItem('auth', JSON.stringify(authData));

              console.log('[FetchInterceptor] Silent token rotation succeeded.');
              isRefreshing = false;
              onRefreshed(newToken);
            } else {
              console.warn('[FetchInterceptor] Token rotation rejected by server. Redirecting to login.');
              isRefreshing = false;
              
              // Clear session to force user re-login
              localStorage.removeItem('token');
              localStorage.removeItem('auth');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
              throw new Error('Session expired');
            }
          } catch (refreshErr) {
            console.error('[FetchInterceptor] Silent token rotation failed:', refreshErr);
            isRefreshing = false;
            throw refreshErr;
          }
        }

        // Return a promise that resolves with the retried original request once refreshed
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken) => {
            const headers = new Headers(currentOptions.headers || {});
            headers.set('Authorization', `Bearer ${newToken}`);
            currentOptions.headers = Object.fromEntries(headers.entries());
            resolve(originalFetch(url, currentOptions));
          });
        });
      }
    }

    return response;
  };
}
