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
import Tasks from "./pages/Tasks";
import Files from "./pages/Files";
import Settings from "./pages/Settings";
import { waitForSession, getSession } from "./lib/api";

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

export default function App() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    waitForSession().finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaProvider>
  {loading ? (
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
          <Route path="tasks" element={<Tasks />} />
          <Route path="files" element={<Files />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch-all  redirect unknown paths to home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )}
    </SafeAreaProvider>
  );
}
