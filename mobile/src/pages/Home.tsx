import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Bell, User as UserIcon, Mail, Video, MessageCircle, Users, ShieldCheck, Grid } from 'lucide-react-native';
import { useNavigate } from '../lib/router';
import { getSession, api } from '../lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Modal, TouchableWithoutFeedback, useWindowDimensions, StyleSheet, Platform } from 'react-native';

type AppItem = {
  id: string;
  label: string;
  icon: any;
  image?: any;
};

const apps: AppItem[] = [
  { id: 'mail', icon: Mail, image: require('../../assets/Mail.png'), label: 'Mail' },
  { id: 'meetings', icon: Video, image: require('../../assets/Meet.png'), label: 'Meet' },
  { id: 'chat', icon: MessageCircle, image: require('../../assets/Chat.png'), label: 'Kural' },
];

const GradientText = (props: any) => {
  return (
    <MaskedView maskElement={<Text {...props} />}>
      <LinearGradient colors={['#0053B3', '#002652']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text {...props} style={[props.style, { opacity: 0 }]} />
      </LinearGradient>
    </MaskedView>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = getSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const screenType = width < 768 ? 'small' : 'large';

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
    refreshNotifications();
  }, [refreshNotifications]);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    await Promise.all(unread.map(n => api.mail.markRead(n.id).catch(() => null)));
    refreshNotifications();
  };

  const topBarHeight = Math.max(insets.top + 10, 30) + 40;
  const notificationsMenuWidth = screenType === 'small' ? Math.min(280, width - 32) : 320;

  const displayedApps = React.useMemo(() => {
    const list: AppItem[] = [...apps];
    if (user?.email === 'admin@fic.com' || user?.role === 'company-admin') {
      list.push({ id: 'team', icon: Users, label: 'Team' });
    }
    if (user?.role === 'super-admin') {
      list.push({ id: 'superadmin', icon: ShieldCheck, label: 'Subscriptions' });
    }
    return list;
  }, [user]);

  return (
    <ScrollView style={tw`flex-1 bg-[#FAFAFA]`}>
      {/* Top Header */}
      <View style={[tw`flex-row justify-between items-center px-5`, { paddingTop: Math.max(insets.top + 10, 30) }]}>
        <GradientText style={[tw`text-[24px] capitalize tracking-wide`, { fontFamily: 'Outfit_600SemiBold' }]}>
          Work Space
        </GradientText>
        <View style={tw`flex-row items-center gap-[20px]`}>
          <TouchableOpacity style={tw`relative`} onPress={() => setShowNotifications(true)}>
            <Bell size={28} color="#262D36" strokeWidth={2} />
            {/* Notification Badge */}
            {unreadCount > 0 && <View style={tw`absolute top-[1px] right-[2px] w-[10px] h-[10px] bg-red-500 rounded-full border-2 border-[#FAFAFA]`} />}
          </TouchableOpacity>
          <TouchableOpacity style={tw`w-[40px] h-[40px] rounded-[24px] bg-[#EDF1FD] items-center justify-center`} onPress={() => navigate('/settings')}>
            <UserIcon size={24} color="#262D36" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

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
                    top: topBarHeight,
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

      {/* Greeting block */}
      <View style={tw`px-5 mt-[45px] mb-[40px]`}>
        <Text style={[tw`text-[24px] text-[#262D36]`, { fontFamily: 'Outfit_500Medium', lineHeight: 30 }]}>
          Welcome Back,
        </Text>
        <Text style={[tw`text-[24px] text-[#262D36]`, { fontFamily: 'Outfit_500Medium', lineHeight: 30 }]}>
          {user?.name?.split(' ')[0] || 'Demo'}
        </Text>
        <Text style={[tw`text-[14px] text-[#4E5155] mt-[4px]`, { fontFamily: 'Outfit_400Regular', lineHeight: 18 }]}>
          Select an application to begin
        </Text>
      </View>

      {/* Apps Container */}
      <View style={tw`px-2 flex-row flex-wrap`}>
        {displayedApps.map((app) => (
          <View key={app.id} style={[tw`items-center mb-8`, { width: '33.33%' }]}>
            <TouchableOpacity
              onPress={() => navigate(`/${app.id}`)}
              style={tw`w-[85px] h-[85px] rounded-[67px] bg-[#EDF1FD] items-center justify-center overflow-hidden`}
              activeOpacity={0.7}
            >
              {app.image ? (
                <Image source={app.image} style={tw`w-full h-full`} resizeMode="cover" />
              ) : (
                <app.icon size={40} color="#0053B3" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
            <Text style={[tw`mt-[12px] text-[#262D36] text-[16px] text-center`, { fontFamily: 'Outfit_400Regular', lineHeight: 20 }]}>
              {app.label}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
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
  menuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
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
