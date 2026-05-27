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
import { io } from 'socket.io-client';
import { DndContext } from '@dnd-kit/core';
import { Plus } from 'lucide-react';

const cn = (...inputs) => twMerge(clsx(inputs));
const queryClient = new QueryClient();

const MailApp = () => {
  const { setComposeOpen, setSearchOpen, setFolder } = useMailStore();

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
    const socket = io(getSocketUrl());
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    
    socket.on('new-email', (data) => {
      if (data.recipient === auth.email || data.workspaceId === auth.workspaceId) {
        queryClient.invalidateQueries(['mails']);
      }
    });

    return () => socket.disconnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DndContext onDragEnd={handleDragEnd}>
        <MailWorkspace />
        <CommandPalette />
      </DndContext>
    </QueryClientProvider>
  );
};

const MailWorkspace = () => {
  const { isSearchOpen, isSettingsOpen, setComposeOpen } = useMailStore();

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="h-screen w-screen bg-[var(--bg)] text-[var(--text-primary)] font-sans flex overflow-hidden selection:bg-[var(--brand-light)] selection:text-[var(--brand-primary)]">
      <Sidebar />
      
      <main className="flex-1 flex min-w-0 overflow-hidden relative">
        <MailList />
        <ReadingPane />
      </main>

      <ComposeModal />
      <SearchOverlay />
      <SettingsPanel />


    </div>
  );
};



export default MailApp;
