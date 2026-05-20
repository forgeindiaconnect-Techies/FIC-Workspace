import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Dimensions, 
  Platform 
} from 'react-native';
import { 
  Folder, 
  File, 
  Search, 
  Plus, 
  MoreVertical, 
  LayoutGrid
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const mockFilesData = [
  { id: 1, name: 'Core Guidelines.pdf', size: '12.4 MB', type: 'pdf', owner: 'Design Team', date: 'Aug 12' },
  { id: 2, name: 'Nexus Roadmap.docx', size: '420 KB', type: 'doc', owner: 'You', date: 'Yesterday' },
  { id: 3, name: 'Q3 Financials', size: '--', type: 'folder', owner: 'Finance', date: 'Aug 15' },
  { id: 4, name: 'App Mockups.fig', size: '8.2 MB', type: 'figma', owner: 'You', date: '2 days' },
  { id: 5, name: 'Feedback Logs.csv', size: '2.1 MB', type: 'excel', owner: 'Support', date: 'Aug 10' },
];

import { api, getSession } from '../lib/api';

export default function Files() {
  const [filesList, setFilesList] = React.useState<any[]>(mockFilesData);

  React.useEffect(() => {
    const fetchDocs = async () => {
      try {
        const { user } = getSession();
        const workspaceId = user?.workspaceId || 'antigraviity-hq';
        
        const data = await api.docs.getDocs(workspaceId);
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d._id,
            name: d.title,
            size: '12 KB',
            type: d.type === 'Doc' ? 'doc' : d.type === 'Sheet' ? 'excel' : 'pdf',
            owner: d.owner || 'System',
            date: new Date(d.lastModified).toLocaleDateString()
          }));
          setFilesList(mapped);
        }
      } catch (err) {
        console.warn("Could not fetch live files, using mock fallback:", err);
      }
    };

    fetchDocs();
  }, []);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Search and Filter */}
      <View style={styles.header}>
        <View style={styles.searchWrapper}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput 
            placeholder="Search all files..." 
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>
        <View style={styles.actions}>
           <TouchableOpacity style={styles.actionIcon}><LayoutGrid size={20} color="#475569" /></TouchableOpacity>
           <TouchableOpacity style={styles.uploadBtn}>
             <Plus size={18} color="#fff" />
             <Text style={styles.uploadBtnText}>Upload</Text>
           </TouchableOpacity>
        </View>
      </View>

      {/* Storage Overview */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Storage', value: '1.2 TB', detail: '75%', color: '#2563eb' },
          { label: 'Docs', value: '4,281', detail: '20GB', color: '#10b981' },
          { label: 'Shared', value: '156', detail: '8GB', color: '#a855f7' },
          { label: 'Cloud', value: '890GB', detail: 'Free', color: '#f97316' },
        ].map(stat => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statDetail}>{stat.detail}</Text>
            </View>
            <View style={styles.progressBar}>
               <View style={[styles.progressFill, { backgroundColor: stat.color, width: '45%' }]} />
            </View>
          </View>
        ))}
      </View>

      {/* File List Section */}
      <View style={styles.sectionCard}>
         <Text style={styles.sectionTitle}>Recent Files</Text>
         <View style={styles.fileGrid}>
            {filesList.map(file => (
              <TouchableOpacity key={file.id} style={styles.fileCard}>
                 <View style={styles.fileTop}>
                    <View style={[styles.fileIconBox, file.type === 'folder' ? styles.folderBg : styles.fileBg]}>
                      {file.type === 'folder' ? <Folder size={24} color="#f59e0b" fill="#f59e0b" /> : <File size={24} color="#2563eb" />}
                    </View>
                    <TouchableOpacity>
                      <MoreVertical size={16} color="#cbd5e1" />
                    </TouchableOpacity>
                 </View>
                 
                 <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <View style={styles.fileMeta}>
                       <Text style={styles.fileMetaText}>{file.size}</Text>
                       <Text style={styles.fileMetaText}>{file.date}</Text>
                    </View>
                 </View>
              </TouchableOpacity>
            ))}
         </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    paddingHorizontal: 16,
    width: '100%',
  },
  searchIcon: { marginRight: 12 },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: Platform.OS === 'web' && width < 768 ? '100%' : 'auto',
  },
  actionIcon: {
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isMobile ? 12 : 24,
  },
  statCard: {
    flex: 1,
    minWidth: isMobile ? (width - 40 - 12) / 2 : 240,
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  statDetail: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2563eb',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 40,
    padding: isMobile ? 24 : 32,
    gap: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  fileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  fileCard: {
    width: isMobile ? (width - 80 - 16) / 2 : 180,
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f8fafc',
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  fileIconBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderBg: { backgroundColor: '#fffbeb' },
  fileBg: { backgroundColor: '#eff6ff' },
  fileInfo: { gap: 4 },
  fileName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  fileMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fileMetaText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
});
