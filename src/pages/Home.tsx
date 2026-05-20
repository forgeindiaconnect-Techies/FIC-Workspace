import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Platform 
} from 'react-native';
import { 
  Video, 
  Mail, 
  MessageSquare, 
  CheckSquare, 
  FileText, 
  Settings, 
  TrendingUp,
  Clock,
  ShieldCheck
} from 'lucide-react-native';
import { useNavigate } from '../lib/router';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const apps = [
  { id: 'meetings', icon: Video, label: 'Meetings', color: '#2563eb', description: 'Video conferencing' },
  { id: 'mail', icon: Mail, label: 'Mail', color: '#4f46e5', description: 'Internal & external mail' },
  { id: 'chat', icon: MessageSquare, label: 'Kural', color: '#10b981', description: 'Enterprise messaging' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks', color: '#059669', description: 'Project management' },
  { id: 'files', icon: FileText, label: 'Files', color: '#d97706', description: 'Vault & documents' },
  { id: 'security', icon: ShieldCheck, label: 'Security', color: '#1e293b', description: 'E2E encryption logs' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Nexus Workspace</Text>
          <Text style={styles.subtitle}>Select an application to begin your session.</Text>
        </View>
        <View style={styles.statusBadge}>
          <Clock size={16} color="#fff" />
          <Text style={styles.statusText}>System Status: Online</Text>
        </View>
      </View>

      {/* App Grid */}
      <View style={styles.grid}>
        {apps.map((app) => (
          <TouchableOpacity
            key={app.id}
            onPress={() => navigate(`/${app.id}`)}
            style={styles.appCard}
          >
            <View style={[styles.iconContainer, { backgroundColor: app.color }]}>
              <app.icon size={isMobile ? 24 : 28} color="#fff" />
            </View>
            <Text style={styles.appLabel}>{app.label}</Text>
            {!isMobile && <Text style={styles.appDesc}>{app.description}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Overview Section */}
      <View style={styles.overviewContainer}>
        <View style={styles.activeCard}>
          <View style={styles.activeContent}>
            <View style={styles.tag}>
              <TrendingUp size={20} color="#60a5fa" />
              <Text style={styles.tagText}>Workspace Activity</Text>
            </View>
            <Text style={styles.activeTitle}>Your team is highly active today.</Text>
            <Text style={styles.activeSubtitle}>
              32 tasks completed and 4 meetings recorded in the last 24 hours. Keep the momentum going.
            </Text>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Generate Weekly Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Settings size={18} color="#0f172a" />
            <Text style={styles.settingsTitle}>Quick Settings</Text>
          </View>
          <View style={styles.settingsList}>
            {[
              { label: 'E2E Encryption', active: true },
              { label: 'Cloud Storage Sync', active: true },
              { label: 'Mobile Notifications', active: false },
            ].map(item => (
              <View key={item.label} style={styles.settingItem}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <View style={[styles.switch, item.active ? styles.switchActive : styles.switchInactive]}>
                  <View style={[styles.switchThumb, item.active ? styles.switchThumbActive : styles.switchThumbInactive]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingBottom: 40,
    gap: 32,
  },
  header: {
    flexDirection: Platform.OS === 'web' && width > 768 ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: Platform.OS === 'web' && width > 768 ? 'center' : 'flex-start',
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isMobile ? 12 : 24,
  },
  appCard: {
    width: isMobile ? (width - 40 - 12) / 2 : (width > 1280 ? (1280 - 120) / 6 : 180),
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: isMobile ? 16 : 24,
    borderRadius: isMobile ? 32 : 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: isMobile ? 48 : 64,
    height: isMobile ? 48 : 64,
    borderRadius: isMobile ? 16 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  appLabel: {
    fontSize: isMobile ? 14 : 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  appDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overviewContainer: {
    flexDirection: width > 1024 ? 'row' : 'column',
    gap: 24,
  },
  activeCard: {
    flex: 2,
    backgroundColor: '#0f172a',
    borderRadius: 40,
    padding: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  activeContent: {
    zIndex: 1,
    gap: 24,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeTitle: {
    fontSize: isMobile ? 24 : 36,
    fontWeight: '800',
    color: '#fff',
    lineHeight: isMobile ? 32 : 44,
  },
  activeSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    maxWidth: 450,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  settingsCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 40,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 24,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  settingsList: {
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  switch: {
    width: 40,
    height: 20,
    borderRadius: 10,
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#2563eb',
  },
  switchInactive: {
    backgroundColor: '#e2e8f0',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
});
