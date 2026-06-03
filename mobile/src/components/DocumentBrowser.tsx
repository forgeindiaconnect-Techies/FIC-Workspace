import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { Plus, FolderOpen, FileText } from 'lucide-react-native';

type DocumentBrowserProps = {
  appName: string;
  onNew: () => void;
  onOpen: (id: string) => void;
  recentDocs: { id: string; title: string; updatedAt: string }[];
};

export default function DocumentBrowser({ appName, onNew, onOpen, recentDocs }: DocumentBrowserProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{appName}</Text>
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionCard} onPress={onNew}>
          <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
            <Plus size={24} color="#3b82f6" />
          </View>
          <Text style={styles.actionText}>New Document</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionCard} onPress={() => { /* Placeholder for file picker */ }}>
          <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
            <FolderOpen size={24} color="#a855f7" />
          </View>
          <Text style={styles.actionText}>Open Document</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.recentTitle}>Recent Documents</Text>
        {recentDocs.length === 0 ? (
          <Text style={styles.emptyText}>No recent documents.</Text>
        ) : (
          <FlatList
            data={recentDocs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.docItem} onPress={() => onOpen(item.id)}>
                <FileText size={20} color="#64748b" style={styles.docIcon} />
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{item.title}</Text>
                  <Text style={styles.docDate}>Updated {new Date(item.updatedAt).toLocaleDateString()}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  recentSection: {
    flex: 1,
    padding: 20,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  docIcon: {
    marginRight: 16,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  docDate: {
    fontSize: 12,
    color: '#64748b',
  },
});
