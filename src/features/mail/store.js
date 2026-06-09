import { create } from 'zustand';

export const MOCK_EMAILS = [];

export const useMailStore = create((set) => ({
  folder: 'Inbox',
  setFolder: (folder) => set({ folder, selectedId: null }),
  
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  
  isComposeOpen: false,
  composeData: null,
  setComposeOpen: (open) => set({ isComposeOpen: open }),
  openCompose: (data = null) => set({ isComposeOpen: true, composeData: data }),
  
  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Selection for bulk actions
  selectedMails: [],
  toggleMailSelection: (id) => set((state) => ({
    selectedMails: state.selectedMails.includes(id)
      ? state.selectedMails.filter(m => m !== id)
      : [...state.selectedMails, id]
  })),
  clearSelection: () => set({ selectedMails: [] }),

  // Auth Context for APIs
  getAuth: () => JSON.parse(localStorage.getItem('auth') || '{}'),
}));
