import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Platform,
  StatusBar
} from "react-native";
import { 
  Home as HomeIcon,
  Video, 
  Mail, 
  MessageSquare, 
  CheckSquare, 
  FileText,
  User as UserIcon,
  LayoutGrid
} from "lucide-react-native";
import { useNavigate, useLocation } from "../lib/router";

const { width } = Dimensions.get('window');

const navItems = [
  { id: "home", icon: HomeIcon, label: "Home", path: "/home" },
  { id: "meetings", icon: Video, label: "Meet", path: "/meetings" },
  { id: "mail", icon: Mail, label: "Mail", path: "/mail" },
  { id: "chat", icon: MessageSquare, label: "Kural", path: "/chat" },
  { id: "tasks", icon: CheckSquare, label: "Tasks", path: "/tasks" },
  { id: "files", icon: FileText, label: "Files", path: "/files" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/login') return null;

  return (
    <View style={styles.tabBar}>
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigate(item.path)}
            style={styles.tabItem}
          >
            <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
              <item.icon 
                size={20} 
                color={isActive ? "#2563eb" : "#94a3b8"} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

import { clearSession } from "../lib/api";
import { Alert } from "react-native";

export function TopBar({ title }: { title: string }) {
  const navigate = useNavigate();

  const handleProfilePress = () => {
    Alert.alert(
      "Account Menu",
      "Would you like to sign out of Nexus Workspace?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive", 
          onPress: () => {
            clearSession();
            navigate('/login');
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.topBar}>
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoText}>N</Text>
        </View>
        <Text style={styles.pageTitle}>{title}</Text>
      </View>
      
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.topButton}>
          <LayoutGrid size={20} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileBox} onPress={handleProfilePress}>
          <UserIcon size={18} color="#64748b" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'web' && width > 768 ? 84 : 72,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    zIndex: 1000,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  tabLabelActive: {
    color: '#2563eb',
  },
  topBar: {
    height: Platform.OS === 'android' ? 64 + (StatusBar.currentHeight || 24) : (Platform.OS === 'ios' ? 88 : 64),
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : (Platform.OS === 'ios' ? 34 : 0),
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    position: 'relative',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'capitalize',
    letterSpacing: -0.5,
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
});
