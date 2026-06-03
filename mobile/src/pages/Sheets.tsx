import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Wand2, Calculator, BarChart, FileSpreadsheet, ListFilter } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DocumentBrowser from '../components/DocumentBrowser';
import RibbonToolbar, { RibbonTab } from '../components/RibbonToolbar';
import AIPromptModal from '../components/AIPromptModal';

const ROWS = 20;
const COLS = 10;
const COL_WIDTH = 100;
const ROW_HEIGHT = 40;

export default function Sheets() {
  const insets = useSafeAreaInsets();
  
  // State for browser vs editor
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);

  // Mock Recent Docs
  const [recentDocs, setRecentDocs] = useState([
    { id: '1', title: 'Q3 Financials.xlsx', updatedAt: new Date().toISOString() },
    { id: '2', title: 'Employee Roster.xlsx', updatedAt: new Date(Date.now() - 86400000).toISOString() },
  ]);

  // Initialize grid data: 20 rows, 10 columns
  const [gridData, setGridData] = useState(() => {
    return Array(ROWS).fill(null).map(() => Array(COLS).fill(''));
  });

  const updateCell = (r: number, c: number, value: string) => {
    const newData = [...gridData];
    newData[r][c] = value;
    setGridData(newData);
  };

  const getColumnLabel = (index: number) => String.fromCharCode(65 + index); // A, B, C...

  const handleNewDoc = () => {
    setGridData(Array(ROWS).fill(null).map(() => Array(COLS).fill('')));
    setCurrentDocId('new_' + Date.now());
  };

  const handleOpenDoc = (id: string) => {
    setGridData(Array(ROWS).fill(null).map(() => Array(COLS).fill('Loaded')));
    setCurrentDocId(id);
  };

  const handleCloseDoc = () => {
    setCurrentDocId(null);
  };

  const generateAIText = async (prompt: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateCell(0, 0, 'AI Generated:');
      updateCell(0, 1, prompt);
    } catch (e) {
      console.error(e);
    }
  };

  const ToolbarButton = ({ icon: Icon, onPress, color = "#333" }: { icon: any, onPress: () => void, color?: string }) => (
    <TouchableOpacity onPress={onPress} style={styles.toolbarButton}>
      <Icon size={20} color={color} />
    </TouchableOpacity>
  );

  const ribbonTabs: RibbonTab[] = [
    {
      id: 'home',
      label: 'Home',
      groups: [
        {
          id: 'tools',
          label: 'Tools',
          content: (
            <>
              <ToolbarButton icon={FileSpreadsheet} onPress={() => {}} />
              <ToolbarButton icon={Calculator} onPress={() => {}} />
            </>
          )
        }
      ]
    },
    {
      id: 'insert',
      label: 'Insert',
      groups: [
        {
          id: 'charts',
          label: 'Charts',
          content: (
            <>
              <ToolbarButton icon={BarChart} onPress={() => {}} />
            </>
          )
        }
      ]
    },
    {
      id: 'data',
      label: 'Data',
      groups: [
        {
          id: 'filter',
          label: 'Filter',
          content: (
            <>
              <ToolbarButton icon={ListFilter} onPress={() => {}} />
            </>
          )
        }
      ]
    }
  ];

  if (!currentDocId) {
    return (
      <DocumentBrowser
        appName="Sheets"
        onNew={handleNewDoc}
        onOpen={handleOpenDoc}
        recentDocs={recentDocs}
      />
    );
  }

  const handleDownload = async () => {
    if (Platform.OS === 'web') {
      try {
        const content = gridData.map(row => row.join(',')).join('\n');
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = (window as any).document.createElement('a');
        a.href = url;
        a.download = `Spreadsheet.csv`;
        (window as any).document.body.appendChild(a);
        a.click();
        (window as any).document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        alert('Download failed');
      }
    } else {
      try {
        const content = gridData.map(row => row.join(',')).join('\n');
        const fileUri = (FileSystem as any).documentDirectory + `Spreadsheet.csv`;
        
        await FileSystem.writeAsStringAsync(fileUri, content, { encoding: (FileSystem as any).EncodingType.UTF8 });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Download Spreadsheet',
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          alert('Spreadsheet saved to app storage, but sharing is not available.');
        }
      } catch (e) {
        alert('Download failed on mobile');
        console.error(e);
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCloseDoc} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spreadsheet Editor</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDownload} style={styles.downloadBtn}>
            <Text style={styles.downloadBtnText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAiModalVisible(true)} style={styles.aiButton}>
            <Wand2 size={20} color="#fff" />
            <Text style={styles.aiButtonText}>AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RibbonToolbar tabs={ribbonTabs} />

      <ScrollView horizontal bounces={false} contentContainerStyle={styles.scrollContent}>
        <ScrollView bounces={false} stickyHeaderIndices={[0]}>
          
          {/* Header Row */}
          <View style={styles.row}>
            <View style={[styles.cell, styles.headerCell, { width: 40 }]} />
            {Array(COLS).fill(null).map((_, c) => (
              <View key={`header-${c}`} style={[styles.cell, styles.headerCell, { width: COL_WIDTH }]}>
                <Text style={styles.headerText}>{getColumnLabel(c)}</Text>
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {gridData.map((row, r) => (
            <View key={`row-${r}`} style={styles.row}>
              {/* Row Label */}
              <View style={[styles.cell, styles.headerCell, { width: 40 }]}>
                <Text style={styles.headerText}>{r + 1}</Text>
              </View>
              {/* Data Cells */}
              {row.map((cellValue, c) => (
                <TextInput
                  key={`cell-${r}-${c}`}
                  style={[styles.cell, styles.inputCell, { width: COL_WIDTH }]}
                  value={cellValue}
                  onChangeText={(val) => updateCell(r, c, val)}
                  selectTextOnFocus
                />
              ))}
            </View>
          ))}

        </ScrollView>
      </ScrollView>

      <AIPromptModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        onGenerate={generateAIText}
        title="Generate Data with AI"
        placeholder="E.g., Create a 3-month expense budget template..."
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  downloadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
  },
  downloadBtnText: {
    color: '#334155',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981', // Green for sheets
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  aiButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toolbarButton: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scrollContent: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    height: ROW_HEIGHT,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerCell: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  headerText: {
    fontWeight: 'bold',
    color: '#64748b',
    fontSize: 12,
  },
  inputCell: {
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#333',
  },
});
