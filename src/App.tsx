import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { BrowserRouter, Routes, Route, Navigate } from "./lib/router";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Meetings from "./pages/Meetings";
import Mail from "./pages/Mail";
import Chat from "./pages/Chat";
import Tasks from "./pages/Tasks";
import Files from "./pages/Files";
import { waitForSession } from "./lib/api";

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    waitForSession().finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="mail" element={<Mail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="files" element={<Files />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


