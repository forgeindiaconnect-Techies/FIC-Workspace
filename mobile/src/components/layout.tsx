import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Platform,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  Home as HomeIcon,
  Video, 
  Mail, 
  MessageSquare, 
  CheckSquare, 
  FileText,
  User as UserIcon,
  Settings,
  LogOut,
  Bell
} from "lucide-react-native";
import { useNavigate, useLocation } from "../lib/router";
import { getScreenType, getBottomNavHeight, getSafeAreaInsets as getSafeInsets } from "../lib/responsive";

const navItems = [
  { id: "home", icon: HomeIcon, label: "Home", path: "/home" },
  { id: "meetings", icon: Video, label: "Meet", path: "/meetings" },
  { id: "mail", icon: Mail, label: "Mail", path: "/mail" },
  { id: "chat", icon: MessageSquare, label: "Kural", path: "/chat" },
  { id: "tasks", icon: CheckSquare, label: "Tasks", path: "/tasks" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenType = getScreenType(width);
  const navHeight = getBottomNavHeight(width);
  const safeInsets = getSafeInsets(insets);

  if (location.pathname === '/login') return null;

  return (
    <View style={[
      styles.tabBar,
      {
        height: navHeight,
        paddingBottom: safeInsets.bottom,
      }
    ]}>
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigate(item.path)}
            style={[styles.tabItem, screenType === 'small' && styles.tabItemSmall]}
          >
            <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
              <item.icon 
                size={screenType === 'small' ? 18 : 20}
                color={isActive ? "#2563eb" : "#94a3b8"} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
            </View>
            <Text style={[
              styles.tabLabel,
              isActive && styles.tabLabelActive,
              screenType === 'small' && styles.tabLabelSmall
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

import { api, clearSession, getSession } from "../lib/api";
import { Alert } from "react-native";

export function TopBar({ title }: { title: string }) {
  const navigate = useNavigate();
  const { user } = getSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenType = getScreenType(width);
  const safeInsets = getSafeInsets(insets);
  
  const [showMenu, setShowMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);

  const [notifications, setNotifications] = React.useState<any[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const refreshNotifications = React.useCallback(async () => {
    try {
      const inbox = await api.mail.getMails('inbox');
      const mapped = Array.isArray(inbox) ? inbox.slice(0, 30).map((m: any) => ({
        id: m._id,
        title: m.subject || '(No Subject)',
        desc: `${m.senderName || m.senderEmail || 'Unknown'} — ${String(m.body || '').replace(/\s+/g, ' ').trim()}`.trim(),
        time: m.sentAt ? new Date(m.sentAt).toLocaleString() : '',
        read: !!m.isRead,
      })) : [];
      setNotifications(mapped);
    } catch {
      setNotifications([]);
    }
  }, []);

  React.useEffect(() => {
    // Keep badge stable across relogin by loading from persisted mail state.
    refreshNotifications();
  }, [refreshNotifications]);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    await Promise.all(unread.map(n => api.mail.markRead(n.id).catch(() => null)));
    refreshNotifications();
  };

  const handleLogout = () => {
    setShowMenu(false);
    clearSession();
    navigate('/login');
  };

  const handleSettings = () => {
    setShowMenu(false);
    navigate('/settings');
  };

  const topBarHeight = Platform.select({
    ios: 56,
    android: 56,
    web: 64,
  }) || 56;

  const notificationsMenuWidth = screenType === 'small' ? Math.min(280, width - 32) : 320;
  const dropdownMenuWidth = screenType === 'small' ? Math.min(160, width - 32) : 200;

  return (
    <View style={[
      styles.topBar,
      {
        paddingTop: safeInsets.top,
        height: topBarHeight + safeInsets.top,
        paddingHorizontal: screenType === 'small' ? 12 : 24,
      }
    ]}>
      <View style={[styles.logoRow, screenType === 'small' && styles.logoRowSmall]}>
        <View style={[styles.logoIcon, screenType === 'small' && styles.logoIconSmall]}>
          <Text style={[styles.logoText, screenType === 'small' && styles.logoTextSmall]}>N</Text>
        </View>
        <Text style={[styles.pageTitle, screenType === 'small' && styles.pageTitleSmall]}>
          {screenType === 'small' ? title.substring(0, 12) : title}
        </Text>
      </View>
      
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.topButton} onPress={async () => {
          await refreshNotifications();
          setShowNotifications(true);
        }}>
          <Bell size={screenType === 'small' ? 18 : 20} color="#64748b" />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.profileBox, screenType === 'small' && styles.profileBoxSmall]} onPress={() => setShowMenu(true)}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <UserIcon size={screenType === 'small' ? 16 : 18} color="#64748b" />
          )}
        </TouchableOpacity>
      </View>

      {showMenu && (
        <Modal transparent visible={showMenu} onRequestClose={() => setShowMenu(false)} animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
            <View style={styles.menuOverlay}>
              <TouchableWithoutFeedback>
                <View style={[
                  styles.dropdownMenu,
                  {
                    width: dropdownMenuWidth,
                    right: screenType === 'small' ? 12 : 24,
                    top: topBarHeight + safeInsets.top + 8,
                  }
                ]}>
                  <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
                    <Settings size={18} color="#475569" />
                    <Text style={styles.menuItemText}>Settings</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                    <LogOut size={18} color="#ef4444" />
                    <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {showNotifications && (
        <Modal transparent visible={showNotifications} onRequestClose={() => setShowNotifications(false)} animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowNotifications(false)}>
            <View style={styles.menuOverlay}>
              <TouchableWithoutFeedback>
                <View style={[
                  styles.notificationsMenu,
                  {
                    width: notificationsMenuWidth,
                    right: screenType === 'small' ? 12 : 24,
                    top: topBarHeight + safeInsets.top + 8,
                    maxHeight: Platform.OS === 'web' ? 400 : 350,
                  }
                ]}>
                  <View style={styles.notificationsHeader}>
                    <Text style={styles.notificationsTitle}>Notifications</Text>
                    {unreadCount > 0 && (
                      <TouchableOpacity onPress={markAllRead}>
                        <Text style={styles.markReadText}>Mark all read</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.menuDivider} />
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {notifications.length === 0 ? (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#94a3b8' }}>No notifications</Text>
                      </View>
                    ) : notifications.map(n => (
                      <TouchableOpacity 
                        key={n.id} 
                        style={[styles.notificationItem, !n.read && styles.notificationUnread]} 
                        onPress={async () => {
                          setNotifications(p => p.map(x => x.id === n.id ? { ...x, read: true } : x));
                          try { await api.mail.markRead(n.id); } catch {}
                          // Open Mail module (user can view details there)
                          setShowNotifications(false);
                          navigate('/mail');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notifTitle}>{n.title}</Text>
                          <Text style={styles.notifDesc} numberOfLines={2}>{n.desc}</Text>
                          <Text style={styles.notifTime}>{n.time}</Text>
                        </View>
                        {!n.read && <View style={styles.notifDot} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    zIndex: 1000,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  tabItemSmall: {
    gap: 2,
  },
  iconBox: {
    padding: 10,
    borderRadius: 14,
  },
  iconBoxActive: {
    backgroundColor: '#eff6ff',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabLabelSmall: {
    fontSize: 8,
    letterSpacing: 0,
  },
  tabLabelActive: {
    color: '#2563eb',
  },
  topBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    position: 'relative',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoRowSmall: {
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  logoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  logoTextSmall: {
    fontSize: 12,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'capitalize',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  pageTitleSmall: {
    fontSize: 16,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topButton: {
    padding: 8,
    borderRadius: 12,
  },
  profileBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileBoxSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notificationsMenu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  notificationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  markReadText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  notificationUnread: {
    backgroundColor: '#f0fdf4',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  notifDesc: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginLeft: 12,
  },
});
