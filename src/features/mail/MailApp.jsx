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

  useEffect(() => {
    const handleWsMessage = (event) => {
      const data = event.detail;
      if (data && (data.type === 'NEW_MAIL' || data.type === 'new-email')) {
        const mail = data.mail || data.payload;
        const auth = JSON.parse(localStorage.getItem('auth') || '{}');
        if (mail && (mail.ownerEmail === auth.email || mail.recipient === auth.email || mail.workspaceId === auth.workspaceId)) {
          console.log('[MailApp] Real-time mail event received via global event bus. Invalidating cache...');
          queryClient.invalidateQueries(['mails']);
        }
      }
    };
    window.addEventListener('ws-message', handleWsMessage);
    return () => {
      window.removeEventListener('ws-message', handleWsMessage);
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
