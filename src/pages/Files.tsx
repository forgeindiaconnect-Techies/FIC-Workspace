import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Folder,
  File,
  Search,
  Plus,
  MoreVertical,
  LayoutGrid,
  X,
  Trash2,
} from 'lucide-react-native';
import { api, getSession } from '../lib/api';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

// Fallback data shown when the backend has no documents yet
const MOCK_FILES = [
  { id: '1', name: 'Core Guidelines.pdf', size: '12.4 MB', type: 'pdf', ownerName: 'Design Team', date: 'Aug 12' },
  { id: '2', name: 'Nexus Roadmap.docx', size: '420 KB', type: 'doc', ownerName: 'You', date: 'Yesterday' },
  { id: '3', name: 'Q3 Financials', size: '--', type: 'folder', ownerName: 'Finance', date: 'Aug 15' },
  { id: '4', name: 'App Mockups.fig', size: '8.2 MB', type: 'other', ownerName: 'You', date: '2 days' },
  { id: '5', name: 'Feedback Logs.csv', size: '2.1 MB', type: 'sheet', ownerName: 'Support', date: 'Aug 10' },
];

const DOC_TYPES = ['doc', 'sheet', 'pdf', 'folder', 'other'] as const;
type DocType = typeof DOC_TYPES[number];

interface DocFile {
  id: string;
  name: string;
  size: string;
  type: DocType;
  ownerName: string;
  date: string;
}

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes === 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function Files() {
  const [filesList, setFilesList] = React.useState<DocFile[]>(MOCK_FILES);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createVisible, setCreateVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newType, setNewType] = React.useState<DocType>('doc');

  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';

  const loadDocs = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.docs.getDocs(workspaceId);
      if (Array.isArray(data) && data.length > 0) {
        const mapped: DocFile[] = data.map((d: any) => ({
          id: d._id,
          name: d.title,
          size: formatBytes(d.sizeBytes),
          type: (d.type as DocType) || 'doc',
          ownerName: d.ownerName || d.ownerEmail || 'System',
          date: formatDate(d.updatedAt || d.createdAt),
        }));
        setFilesList(mapped);
      } else {
        // No docs yet — keep mock data as placeholder
        setFilesList(MOCK_FILES);
      }
    } catch (err) {
      console.warn('Could not fetch documents, using mock fallback:', err);
      setFilesList(MOCK_FILES);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleCreateDoc = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a document title.');
      return;
    }
    setSaving(true);
    try {
      await api.docs.createDoc({
        workspaceId,
        title: newTitle.trim(),
        type: newType,
      });
      setCreateVisible(false);
      setNewTitle('');
      setNewType('doc');
      await loadDocs();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create document.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    // Only allow deleting real DB docs (not mock ones)
    if (['1', '2', '3', '4', '5'].includes(docId)) {
      Alert.alert('Demo Data', 'This is placeholder data. Add real documents to manage them.');
      return;
    }
    Alert.alert('Delete Document', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setFilesList(prev => prev.filter(f => f.id !== docId));
          try {
            await api.docs.deleteDoc(docId);
          } catch (err) {
            console.warn('Delete failed:', err);
            await loadDocs();
          }
        },
      },
    ]);
  };

  const filtered = filesList.filter(f => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || f.ownerName.toLowerCase().includes(q);
  });

  const renderCreateModal = () => (
    <Modal
      visible={createVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setCreateVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Document</Text>
            <TouchableOpacity onPress={() => setCreateVisible(false)}>
              <X size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Document name..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {DOC_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, newType === t && styles.typeBtnActive]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeBtnText, newType === t && styles.typeBtnTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateDoc} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {renderCreateModal()}

      {/* Search and Actions */}
      <View style={styles.header}>
        <View style={styles.searchWrapper}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            placeholder="Search all files..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionIcon}>
            <LayoutGrid size={20} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => setCreateVisible(true)}>
            <Plus size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>New Doc</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Storage Overview */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Storage', value: '1.2 TB', detail: '75%', color: '#2563eb' },
          { label: 'Docs', value: String(filesList.length), detail: 'files', color: '#10b981' },
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

      {/* File List */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Files</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : (
          <View style={styles.fileGrid}>
            {filtered.map(file => (
              <TouchableOpacity key={file.id} style={styles.fileCard}>
                <View style={styles.fileTop}>
                  <View style={[styles.fileIconBox, file.type === 'folder' ? styles.folderBg : styles.fileBg]}>
                    {file.type === 'folder' ? (
                      <Folder size={24} color="#f59e0b" fill="#f59e0b" />
                    ) : (
                      <File size={24} color="#2563eb" />
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteDoc(file.id)}>
                    <MoreVertical size={16} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>

                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <View style={styles.fileMeta}>
                    <Text style={styles.fileMetaText}>{file.size}</Text>
                    <Text style={styles.fileMetaText}>{file.date}</Text>
                  </View>
                  <Text style={styles.fileOwner} numberOfLines={1}>{file.ownerName}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {filtered.length === 0 && (
              <View style={styles.emptyBox}>
                <File size={40} color="#e2e8f0" />
                <Text style={styles.emptyText}>No files found</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 40, gap: 32 },
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
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
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
  statValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  statDetail: { fontSize: 10, fontWeight: '900', color: '#2563eb' },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
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
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  fileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
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
  fileName: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  fileMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  fileMetaText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  fileOwner: { fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12, width: '100%' },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  formGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  typeBtnText: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'capitalize' },
  typeBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
