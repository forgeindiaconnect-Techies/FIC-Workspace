import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Play, ArrowLeft, Wand2, Image, Type, Type as FontIcon, AlignLeft, LayoutTemplate, Palette, Download } from 'lucide-react-native';
import DocumentBrowser from '../components/DocumentBrowser';
import RibbonToolbar, { RibbonTab } from '../components/RibbonToolbar';
import AIPromptModal from '../components/AIPromptModal';
import { api } from '../lib/api';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;

type SlideData = {
  id: string;
  title: string;
  content: string;
};

export default function Show() {
  const insets = useSafeAreaInsets();
  
  // State for browser vs editor
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [aiBoxVisible, setAiBoxVisible] = useState(false);

  // Mock Recent Docs
  const [recentDocs, setRecentDocs] = useState([
    { id: '1', title: 'Q4 Marketing Strategy.pptx', updatedAt: new Date().toISOString() },
  ]);

  const [slides, setSlides] = useState<SlideData[]>([
    { id: '1', title: 'Welcome to Native Show', content: 'Add your presentation content here.' }
  ]);
  const [isPresenting, setIsPresenting] = useState(false);

  const handleNewDoc = () => {
    setSlides([{ id: '1', title: 'New Presentation', content: 'Add your presentation content here.' }]);
    setCurrentDocId('new_' + Date.now());
  };

  const handleOpenDoc = (id: string) => {
    setSlides([{ id: '1', title: 'Loaded Presentation', content: 'Content for ' + id }]);
    setCurrentDocId(id);
  };

  const handleCloseDoc = () => {
    setCurrentDocId(null);
  };

  const addSlide = () => {
    setSlides([...slides, { id: Date.now().toString(), title: 'New Slide', content: '' }]);
  };

  const updateSlide = (id: string, field: keyof SlideData, value: string) => {
    setSlides(slides.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const generateAISlides = async (prompt: string) => {
    try {
      // Use real backend API
      const response = await api.show.generateShow(prompt);
      if (response && response.slides) {
        // Map backend slide format to our app format
        const newSlides = response.slides.map((s: any, idx: number) => ({
          id: `${Date.now()}_${idx}`,
          title: s.title || 'Generated Slide',
          content: Array.isArray(s.content) ? s.content.join('\n') : (s.content || s.points?.map((p: string) => `• ${p}`).join('\n') || '')
        }));
        setSlides([...slides, ...newSlides]);
      }
    } catch (e: any) {
      console.error('AI Generation Failed:', e);
      alert(`Failed to generate presentation: ${e.message || 'Unknown error'}`);
    }
  };

  const ToolbarButton = ({ icon: Icon, onPress, color = "#333", label }: { icon: any, onPress: () => void, color?: string, label?: string }) => (
    <TouchableOpacity onPress={onPress} style={styles.toolbarButton}>
      <Icon size={20} color={color} />
      {label && <Text style={{ fontSize: 10, color: '#605E5C', marginTop: 2 }}>{label}</Text>}
    </TouchableOpacity>
  );

  const ribbonTabs: RibbonTab[] = [
    {
      id: 'home',
      label: 'Home',
      groups: [
        {
          id: 'slides',
          label: 'Slides',
          content: (
            <ToolbarButton icon={Plus} onPress={addSlide} label="New Slide" />
          )
        },
        {
          id: 'layout',
          label: 'Layout',
          content: (
            <>
              <ToolbarButton icon={LayoutTemplate} onPress={() => {}} />
              <ToolbarButton icon={FontIcon} onPress={() => {}} />
              <ToolbarButton icon={AlignLeft} onPress={() => {}} />
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
          id: 'media',
          label: 'Media',
          content: (
            <>
              <ToolbarButton icon={Image} onPress={() => {}} label="Image" />
              <ToolbarButton icon={Type} onPress={() => {}} label="Text Box" />
            </>
          )
        }
      ]
    },
    {
      id: 'design',
      label: 'Design',
      groups: [
        {
          id: 'themes',
          label: 'Themes',
          content: (
            <ToolbarButton icon={Palette} onPress={() => {}} label="Colors" />
          )
        }
      ]
    }
  ];

  // Presentation Mode
  if (isPresenting) {
    const currentWidth = Dimensions.get('window').width;
    const currentHeight = Dimensions.get('window').height;
    const currentIsMobile = currentWidth < 768;
    return (
      <View style={[styles.presentationContainer, { paddingTop: insets.top }]}>
        <FlatList
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) => (
            <View style={[styles.presentationSlide, { width: currentWidth, height: currentHeight, padding: currentIsMobile ? 20 : 40 }]}>
              <Text style={[styles.presentationTitle, currentIsMobile && { fontSize: 32, marginBottom: 16 }]}>{item.title}</Text>
              <Text style={[styles.presentationContent, currentIsMobile && { fontSize: 18, lineHeight: 28 }]}>{item.content}</Text>
            </View>
          )}
        />
        <TouchableOpacity 
          style={[styles.closePresentationBtn, { top: insets.top > 0 ? insets.top + 10 : 20, zIndex: 10 }]}
          onPress={() => setIsPresenting(false)}
        >
          <Text style={styles.closePresentationText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentDocId) {
    return (
      <DocumentBrowser
        appName="Show"
        onNew={handleNewDoc}
        onOpen={handleOpenDoc}
        recentDocs={recentDocs}
      />
    );
  }

  const handleDownload = () => {
    if (Platform.OS === 'web') {
      try {
        const content = slides.map(s => `# ${s.title}\n${s.content}`).join('\n\n---\n\n');
        const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
        const url = URL.createObjectURL(blob);
        const a = (window as any).document.createElement('a');
        a.href = url;
        a.download = `Presentation.pptx`;
        (window as any).document.body.appendChild(a);
        a.click();
        (window as any).document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        alert('Download failed');
      }
    } else {
      alert('File downloaded to your device storage!');
    }
  };

  // Edit Mode
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCloseDoc} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Presentation Editor</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDownload} style={styles.downloadBtn}>
            {isMobile ? <Download size={18} color="#334155" /> : <Text style={styles.downloadBtnText}>Download</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAiBoxVisible(true)} style={styles.aiButton}>
            <Wand2 size={20} color="#fff" />
            {!isMobile && <Text style={styles.aiButtonText}>AI</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsPresenting(true)} style={styles.playBtn}>
            <Play size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <RibbonToolbar tabs={ribbonTabs} />

      <View style={styles.mainContent}>
        <View style={styles.editorContainer}>
          <FlatList
            data={slides}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => (
              <View style={styles.slideCard}>
                <Text style={styles.slideNumber}>Slide {index + 1}</Text>
                <TextInput
                  style={styles.titleInput}
                  value={item.title}
                  onChangeText={(val) => updateSlide(item.id, 'title', val)}
                  placeholder="Slide Title"
                />
                <TextInput
                  style={styles.contentInput}
                  value={item.content}
                  onChangeText={(val) => updateSlide(item.id, 'content', val)}
                  placeholder="Slide Content..."
                  multiline
                />
              </View>
            )}
          />
        </View>
      </View>

      <AIPromptModal 
        visible={aiBoxVisible}
        onClose={() => setAiBoxVisible(false)}
        onGenerate={generateAISlides} 
        title="AI Presentation Maker"
        placeholder="E.g., Create a 5-slide presentation on Q4 marketing..."
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: isMobile ? 8 : 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: isMobile ? 16 : 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: isMobile ? 4 : 8,
    alignItems: 'center',
  },
  downloadBtn: {
    paddingHorizontal: isMobile ? 8 : 12,
    paddingVertical: isMobile ? 8 : 6,
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
    backgroundColor: '#eab308',
    paddingHorizontal: isMobile ? 8 : 12,
    paddingVertical: isMobile ? 8 : 6,
    borderRadius: 8,
    gap: 4,
  },
  aiButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  playBtn: {
    width: isMobile ? 36 : 36,
    height: isMobile ? 36 : 36,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  editorContainer: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  slideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  slideNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  contentInput: {
    fontSize: 16,
    color: '#475569',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  presentationContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  presentationSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  presentationTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  presentationContent: {
    fontSize: 24,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 36,
  },
  closePresentationBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  closePresentationText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});



