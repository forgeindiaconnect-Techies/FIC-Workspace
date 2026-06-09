import React, { useEffect } from 'react';
import { getApiUrl, getSocketUrl } from '../../api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import MailList from './components/MailList';
import ReadingPane from './components/ReadingPane';
import ComposeModal from './components/ComposeModal';
import SearchOverlay from './components/SearchOverlay';
import SettingsPanel from './components/SettingsPanel';
import CommandPalette from './components/CommandPalette';
import { useMailStore } from './store';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { Plus } from 'lucide-react';

const cn = (...inputs) => twMerge(clsx(inputs));
const queryClient = new QueryClient();

const MailApp = () => {
  const { setComposeOpen, setSearchOpen, setFolder } = useMailStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const mailId = active.id;
      const targetFolder = over.id;
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      
      // Update in DB
      await fetch(getApiUrl(`/api/mail/${mailId}/move`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ folder: targetFolder.toLowerCase() })
      });
      
      queryClient.invalidateQueries(['mails', auth.workspaceId, auth.email]);
    }
  };

  useEffect(() => {
    // Keyboard Shortcuts Logic
    let comboBuffer = '';
    const comboTimeout = 1000;
    let timer;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;

      const key = e.key.toUpperCase();
      if (key === 'C') { e.preventDefault(); setComposeOpen(true); }
      if (key === '/') { e.preventDefault(); setSearchOpen(true); }
      
      if (key === 'G') {
        comboBuffer = 'G';
        clearTimeout(timer);
        timer = setTimeout(() => { comboBuffer = ''; }, comboTimeout);
      } else if (comboBuffer === 'G') {
        if (key === 'I') { e.preventDefault(); setFolder('Inbox'); }
        if (key === 'S') { e.preventDefault(); setFolder('Sent'); }
        comboBuffer = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setComposeOpen, setSearchOpen, setFolder]);

  const mailSocketRef = React.useRef(null);
  const mailReconnectAttemptsRef = React.useRef(0);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const connectMailSocket = () => {
      if (typeof window === 'undefined') return;
      
      if (
        mailSocketRef.current?.readyState === WebSocket.OPEN ||
        mailSocketRef.current?.readyState === WebSocket.CONNECTING
      ) return;

      if (mailSocketRef.current) {
        mailSocketRef.current.onclose = null;
        mailSocketRef.current.close(1000, 'Reconnecting');
        mailSocketRef.current = null;
      }

      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      const email = auth.email || auth.user?.email || '';
      if (!email) {
        console.warn('[Mail] No email found in auth, skipping WebSocket connection');
        return;
      }
      const wsUrl = getSocketUrl().replace('http', 'ws') + `/ws/mail?email=${encodeURIComponent(email)}`;
      const socket = new WebSocket(wsUrl);
      mailSocketRef.current = socket;

      socket.onopen = () => {
        console.log('[Mail] WebSocket connected');
        mailReconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new-email') {
            if (data.payload?.recipient === auth.email || data.payload?.workspaceId === auth.workspaceId) {
              queryClient.invalidateQueries(['mails']);
            }
          }
        } catch (e) {}
      };

      socket.onclose = (event) => {
        if (event.code === 1000 || !isMountedRef.current) return;
        if (mailReconnectAttemptsRef.current < 3) {
          mailReconnectAttemptsRef.current++;
          setTimeout(() => connectMailSocket(), 2000 * mailReconnectAttemptsRef.current);
        }
      };

      socket.onerror = () => {
        console.error('[Mail] WebSocket error');
      };
    };

    connectMailSocket();

    return () => {
      isMountedRef.current = false;
      if (mailSocketRef.current) {
        mailSocketRef.current.onclose = null;
        mailSocketRef.current.close(1000, 'Unmount');
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <MailWorkspace />
        <CommandPalette />
      </DndContext>
    </QueryClientProvider>
  );
};

import { useTheme } from '../../context/ThemeContext';

const MailWorkspace = () => {
  const { selectedId, isSearchOpen, isSettingsOpen, setComposeOpen, isMobileMenuOpen, setMobileMenuOpen } = useMailStore();
  const { setIsDark } = useTheme();

  useEffect(() => {
    // Force light mode for a clean professional appearance
    setIsDark(false);
  }, [setIsDark]);

  return (
    <div className="h-screen w-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans flex overflow-hidden selection:bg-[var(--brand-light)] selection:text-[var(--brand-primary)] relative">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      
      <div className={cn("fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 md:relative md:translate-x-0", isMobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>
        <Sidebar />
      </div>
      
      <main className="flex-1 flex min-w-0 overflow-hidden relative flex-col md:flex-row">
        <div className={cn("flex-1 h-full md:w-[380px] md:flex-none", selectedId ? "hidden md:flex" : "flex")}>
          <MailList />
        </div>
        <div className={cn("flex-1 h-full min-w-0", !selectedId ? "hidden md:flex" : "flex")}>
          <ReadingPane />
        </div>
      </main>

      <ComposeModal />
      <SearchOverlay />
      <SettingsPanel />


    </div>
  );
};



export default MailApp;
