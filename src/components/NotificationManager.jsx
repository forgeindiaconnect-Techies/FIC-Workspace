import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { getSocketUrl } from '../api';
import { registerWebPush } from '../utils/webPushHelper';

/**
 * Global notification manager component that remains mounted across all page routes.
 * Handles the single, persistent WebSocket connection for real-time alerts,
 * registers browser Web Push notifications, and displays beautiful in-app toast popups.
 */
export default function NotificationManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeToast, setActiveToast] = useState(null);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => setActiveToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  useEffect(() => {
    isMountedRef.current = true;
    let ws;

    const connectSocket = () => {
      if (typeof window === 'undefined') return;

      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      const email = auth.email || auth.user?.email || '';
      const token = auth.token || auth.user?.token || localStorage.getItem('token');

      if (!email || !token) {
        // User is not authenticated yet. Socket will connect once they log in and navigate.
        return;
      }

      if (
        socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      // Proactively register browser Web Push notifications (Facebook/YouTube style)
      try {
        registerWebPush();
      } catch (e) {
        console.warn('[NotificationManager] Web push registration failed:', e);
      }

      const wsBase = getSocketUrl().replace('http', 'ws');
      const wsUrl = `${wsBase}/ws/mail?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
      console.log('[NotificationManager] Connecting global notifications socket:', wsUrl);

      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[NotificationManager] Global notification socket connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Dispatch global event for other components (Mail, Chat, Dashboard)
          window.dispatchEvent(new CustomEvent('ws-message', { detail: data }));
          
          if (data.type === 'NEW_MESSAGE') {
            const targetUrl = `/w/${auth.workspaceId || 'forge-india-connect'}/chat`;
            // Trigger browser-native OS desktop notification
            showDesktopNotification(
              `New Message from ${data.message.senderName || 'Workspace'}`,
              data.message.content || 'Sent a file.',
              targetUrl
            );

            // Display in-app visual toast if the user is not currently on the chat page
            const isChatPage = location.pathname.includes('/chat');
            if (!isChatPage) {
              setActiveToast({
                title: `New Message from ${data.message.senderName || 'Workspace'}`,
                body: data.message.content || 'Sent a file.',
                type: 'message',
                target: targetUrl
              });
            }
          } else if (data.type === 'NEW_MAIL') {
            const targetUrl = `/w/${auth.workspaceId || 'forge-india-connect'}/mail`;
            showDesktopNotification(
              `New Email: ${data.mail.subject || '(No Subject)'}`,
              `From: ${data.mail.senderName || data.mail.senderEmail}`,
              targetUrl
            );

            // Display in-app visual toast if the user is not currently on the mail page
            const isMailPage = location.pathname.includes('/mail');
            if (!isMailPage) {
              setActiveToast({
                title: `New Email: ${data.mail.subject || '(No Subject)'}`,
                body: `From: ${data.mail.senderName || data.mail.senderEmail}`,
                type: 'mail',
                target: targetUrl
              });
            }
          } else if (data.type === 'NEW_POST') {
            const targetUrl = `/w/${auth.workspaceId || 'forge-india-connect'}/chat`;
            showDesktopNotification(
              `New Post in Workspace`,
              `${data.post.authorName}: ${data.post.content}`,
              targetUrl
            );

            // Display in-app visual toast if the user is not currently on the chat/threads page
            const isChatPage = location.pathname.includes('/chat');
            if (!isChatPage) {
              setActiveToast({
                title: `New Post by ${data.post.authorName}`,
                body: data.post.content,
                type: 'post',
                target: targetUrl
              });
            }
          } else if (data.type === 'NEW_COMMENT') {
            const targetUrl = `/w/${auth.workspaceId || 'forge-india-connect'}/chat`;
            showDesktopNotification(
              `New Comment in Workspace`,
              `${data.comment.authorName}: ${data.comment.content}`,
              targetUrl
            );

            // Display in-app visual toast if the user is not currently on the chat/threads page
            const isChatPage = location.pathname.includes('/chat');
            if (!isChatPage) {
              setActiveToast({
                title: `New Comment by ${data.comment.authorName}`,
                body: data.comment.content,
                type: 'post',
                target: targetUrl
              });
            }
          }
        } catch (e) {
          console.warn('[NotificationManager] Socket message parse error:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('[NotificationManager] Global notification socket closed:', event.reason);
        socketRef.current = null;
        
        // Reconnect with exponential backoff if mounted
        if (isMountedRef.current && event.code !== 1000) {
          if (reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++;
            const delay = 2000 * reconnectAttemptsRef.current;
            console.log(`[NotificationManager] Reconnecting in ${delay}ms (Attempt ${reconnectAttemptsRef.current}/5)...`);
            setTimeout(connectSocket, delay);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[NotificationManager] Global notification socket error:', err);
      };
    };

    const showDesktopNotification = (title, body, targetUrl = '') => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        try {
          const notification = new Notification(title, { body, icon: '/logo.png' });
          notification.onclick = (e) => {
            e.preventDefault();
            window.focus();
            if (targetUrl) {
              navigate(targetUrl);
            }
          };
        } catch (e) {
          console.warn('[NotificationManager] Failed to show desktop notification:', e);
        }
      }
    };

    connectSocket();

    return () => {
      isMountedRef.current = false;
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Unmount');
        }
      }
    };
  }, [location.pathname]); // Re-evaluate and connect/reconnect dynamically when navigating pages

  if (!activeToast) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] max-w-sm w-80 rounded-xl border shadow-2xl p-4 flex gap-3 cursor-pointer transform transition-all duration-300 hover:scale-102 animate-up"
      style={{
        background: 'var(--surface, #1e293b)',
        borderColor: 'var(--border, #334155)',
        color: 'var(--text, #f8fafc)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}
      onClick={() => {
        navigate(activeToast.target);
        setActiveToast(null);
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
            {activeToast.type === 'message' ? '💬 New Chat Message' : activeToast.type === 'mail' ? '✉️ New Email' : '📋 New Boardroom Post'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            style={{ color: 'var(--text-3, #94a3b8)' }}
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text, #f8fafc)' }}>
          {activeToast.title}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3, #94a3b8)' }}>
          {activeToast.body}
        </p>
      </div>
    </div>
  );
}
