import React from "react";
import { View, ActivityIndicator } from "react-native";
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

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  React.useEffect(() => {
    waitForSession().finally(() => {
      setLoading(false);
      // Init call signaling after session is ready
      const { token, user } = getSession();
      if (token && SOCKET_URL && user?.email) {
        callManager.init(SOCKET_URL, token, user.email);
      }
    });
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
