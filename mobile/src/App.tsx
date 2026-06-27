import React from "react";
import { View, ActivityIndicator, Platform, DeviceEventEmitter, Animated, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from "./lib/pushHelper";
import { X } from 'lucide-react-native';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BrowserRouter, Routes, Route, Navigate } from "./lib/router";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Meetings from "./pages/Meetings";
import Mail from "./pages/Mail";
import Chat from "./pages/Chat";
import Docs from "./pages/Docs";
import Sheets from "./pages/Sheets";
import Show from "./pages/Show";

import Settings from "./pages/Settings";
import TeamManagement from "./pages/TeamManagement";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import { waitForSession, getSession, SOCKET_URL } from "./lib/api";
import { callManager } from "./lib/callManager";
import IncomingCallOverlay from "./components/IncomingCallOverlay";
import { registerWebRTCGlobals } from "./lib/webrtc";

// Register react-native-webrtc globals once at startup (native builds only)
registerWebRTCGlobals();

/**
 * ProtectedRoute  redirects to /login if no valid session token exists.
 * This ensures the mobile app enforces authentication on all inner routes,
 * consistent with the web application's auth guard behaviour.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = getSession();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import * as Linking from 'expo-linking';
import { useNavigate } from './lib/router';

function DeepLinkHandler() {
  const navigate = useNavigate();
  
  React.useEffect(() => {
    const handleUrl = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        // If deep link is nexus://meet/room/123-456-789?pwd=abc
        // parsed.path might be 'meet/room/123-456-789'
        if (parsed.path && parsed.path.startsWith('meet/room/')) {
          const roomId = parsed.path.replace('meet/room/', '');
          const pwd = parsed.queryParams?.pwd || '';
          navigate(`/meetings?joinCode=${roomId}&pwd=${pwd}`);
        } else if (url.includes('/meet/room/')) {
          // Fallback for universal links
          const match = url.match(/\/meet\/room\/([\w-]+)/);
          if (match) {
            const pwdMatch = url.match(/[?&]pwd=([^&]+)/);
            navigate(`/meetings?joinCode=${match[1]}&pwd=${pwdMatch ? pwdMatch[1] : ''}`);
          }
        }
      } catch (e) {
        console.warn('Deep link parse error:', e);
      }
    };

    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    
    let responseSubscription: any = null;

    if (Platform.OS !== 'web') {
      // Handle Notifee initial notification (cold start)
      notifee.getInitialNotification().then(initialNotification => {
        if (initialNotification) {
          const data = initialNotification.notification.data;
          console.log('[Notifee] Cold start notification data:', data);
          if (data && data.type === 'incoming_call') {
            const { callerEmail, callerName, offer, isVideo } = data as any;
            if (callerEmail && offer) {
              callManager.handleIncomingCallFromPush(callerEmail, callerName, offer, isVideo || false);
            }
          }
        }
      }).catch(err => console.warn('getInitialNotification error:', err));

      // Handle Expo notification that opened the app from a cold start
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response) {
          const data = response.notification.request.content.data;
          console.log('[PushNotification] Cold start notification data:', data);
          if (data) {
            if (data.type === 'chat') {
              navigate('/chat');
            } else if (data.type === 'mail') {
              navigate('/mail');
            } else if (data.type === 'post') {
              navigate('/chat');
            } else if (data.type === 'incoming_call') {
              const { callerEmail, callerName, offer, isVideo } = data as any;
              if (callerEmail && offer) {
                callManager.handleIncomingCallFromPush(callerEmail, callerName, offer, isVideo || false);
              }
            }
          }
        }
      }).catch(err => console.warn('getLastNotificationResponseAsync error:', err));

      // Handle tapping on push notifications while the app is backgrounded or foregrounded
      responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        try {
          const data = response.notification.request.content.data;
          console.log('[PushNotification] User tapped on notification, data:', data);
          if (data) {
            if (data.type === 'chat') {
              navigate('/chat');
            } else if (data.type === 'mail') {
              navigate('/mail');
            } else if (data.type === 'post') {
              navigate('/chat');
            } else if (data.type === 'incoming_call') {
              const { callerEmail, callerName, offer, isVideo } = data as any;
              if (callerEmail && offer) {
                callManager.handleIncomingCallFromPush(callerEmail, callerName, offer, isVideo || false);
              }
            }
          }
        } catch (err) {
          console.warn('[PushNotification] Handle tap error:', err);
        }
      });
    }

    return () => {
      sub.remove();
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, [navigate]);

  return null;
}

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  React.useEffect(() => {
    // Request local notification permissions on mount
    const requestPermissions = async () => {
      if (Platform.OS === 'web') return;
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.warn('[Notifications] Permission denied.');
        }
      } catch (e) {
        console.warn('[Notifications] Request permission error:', e);
      }
    };
    requestPermissions();

    let globalMailWs: WebSocket | null = null;

    waitForSession().finally(() => {
      setLoading(false);
      
      const { token, user } = getSession();
      if (token && SOCKET_URL && user?.email) {
        // Init call signaling
        callManager.init(SOCKET_URL, token, user.email);

        // Register for remote push notifications
        registerForPushNotificationsAsync();

        // Connect global wssMail socket for background notifications and real-time events
        try {
          const wsBase = SOCKET_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
          const wsUrl = `${wsBase.replace(/\/+$/, '')}/ws/mail?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;
          console.log('[App] Connecting global notifications socket to:', wsUrl);
          const ws = new WebSocket(wsUrl);
          globalMailWs = ws;

          ws.onmessage = async (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.type === 'NEW_MESSAGE') {
                // Emit event to update Chat UI in real-time if active
                DeviceEventEmitter.emit('new_chat_message', data.message);

                // Show in-app toast banner
                DeviceEventEmitter.emit('show_in_app_toast', {
                  title: `New Message from ${data.message.senderName || 'Workspace'}`,
                  body: data.message.content || 'Sent a file.',
                  type: 'chat',
                  target: '/chat'
                });

                // Present OS-level local notification popup
                if (Platform.OS !== 'web') {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: `New Message from ${data.message.senderName || 'Workspace'}`,
                      body: data.message.content || 'Sent a file.',
                      sound: true,
                    },
                    trigger: null, // trigger immediately
                  });
                }
              } else if (data.type === 'NEW_MAIL') {
                // Emit event to update Mail UI in real-time if active
                DeviceEventEmitter.emit('new_mail_received', data.mail);

                // Show in-app toast banner
                DeviceEventEmitter.emit('show_in_app_toast', {
                  title: `New Email: ${data.mail.subject || '(No Subject)'}`,
                  body: `From: ${data.mail.senderName || data.mail.senderEmail}`,
                  type: 'mail',
                  target: '/mail'
                });

                if (Platform.OS !== 'web') {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: `New Email: ${data.mail.subject || '(No Subject)'}`,
                      body: `From: ${data.mail.senderName || data.mail.senderEmail}`,
                      sound: true,
                    },
                    trigger: null,
                  });
                }
              }
            } catch (e) {
              console.warn('[App] Socket message parse error:', e);
            }
          };

          ws.onclose = () => {
            console.log('[App] Global notifications socket closed.');
          };
          
          ws.onerror = (err) => {
            console.warn('[App] Global notifications socket error:', err);
          };
        } catch (e) {
          console.warn('[App] Global notifications socket init failed:', e);
        }
      }
    });

    return () => {
      if (globalMailWs) {
        try { globalMailWs.close(); } catch {}
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      {/* Global incoming call overlay  appears on any screen */}
      <IncomingCallOverlay />
  {(loading || !fontsLoaded) ? (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#020617",
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
  ) : (
    <BrowserRouter>
      <DeepLinkHandler />
      <InAppNotificationToast />
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected layout shell  all inner pages require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="mail" element={<Mail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="docs" element={<Docs />} />
          <Route path="sheets" element={<Sheets />} />
          <Route path="show" element={<Show />} />

          <Route path="settings" element={<Settings />} />
          <Route path="team" element={<TeamManagement />} />
          <Route path="superadmin" element={<SuperAdminDashboard />} />
        </Route>

        {/* Catch-all  redirect unknown paths to home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )}
    </SafeAreaProvider>
  );
}

function InAppNotificationToast() {
  const navigate = useNavigate();
  const [toast, setToast] = React.useState<{ title: string; body: string; type: 'chat' | 'mail'; target: string } | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('show_in_app_toast', (data: any) => {
      setToast(data);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return () => sub.remove();
  }, [fadeAnim]);

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        dismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const dismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setToast(null));
  };

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0]
              })
            }
          ]
        }
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        activeOpacity={0.9}
        onPress={() => {
          navigate(toast.target);
          dismiss();
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.toastType}>
            {toast.type === 'chat' ? '💬 NEW MESSAGE' : '✉️ NEW EMAIL'}
          </Text>
          <Text style={styles.toastTitle} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={styles.toastBody} numberOfLines={1}>
            {toast.body}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={dismiss}>
          <X size={16} color="#94a3b8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  toastContent: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
  },
  toastType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3b82f6',
    letterSpacing: 1,
    marginBottom: 2,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  toastBody: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    marginLeft: 8,
  },
});
