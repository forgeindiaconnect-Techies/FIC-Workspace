import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { 
  Bold, Italic, Underline, List, Wand2, ArrowLeft, Image, Link, Type,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Strikethrough, Palette,
  ClipboardPaste, Scissors, Copy, Paintbrush, Highlighter, ListOrdered,
  Subscript, Superscript, Type as TypeIcon, Heading1, Heading2,
  Indent as IndentIcon, Outdent as OutdentIcon, TextSelect, Search
} from 'lucide-react-native';
import DocumentBrowser from '../components/DocumentBrowser';
import RibbonToolbar, { RibbonTab, RibbonGroup } from '../components/RibbonToolbar';
import RibbonDropdown from '../components/RibbonDropdown';
import AIPromptModal from '../components/AIPromptModal';
import { api } from '../lib/api';

export default function Docs() {
  const insets = useSafeAreaInsets();
  
  // State for browser vs editor
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('Untitled Document');
  
  // Editor State
  const webViewRef = useRef<WebView>(null);
  const [aiBoxVisible, setAiBoxVisible] = useState(false);

  // Mock Recent Docs
  const [recentDocs, setRecentDocs] = useState([
    { id: '1', title: 'Project Proposal.docx', updatedAt: new Date().toISOString() },
    { id: '2', title: 'Meeting Notes.docx', updatedAt: new Date(Date.now() - 86400000).toISOString() },
  ]);

  const handleNewDoc = () => {
    setDocTitle('Untitled Document');
    setCurrentDocId('new_' + Date.now());
  };

  const handleOpenDoc = (id: string) => {
    setDocTitle('Loaded Document');
    setCurrentDocId(id);
  };

  const handleCloseDoc = () => {
    setCurrentDocId(null);
  };

  const generateAIText = async (prompt: string) => {
    try {
      // Connect to real backend API
      const response = await api.docs.generateDoc(prompt);
      if (response && response.html) {
        // Inject generated HTML into the WebView
        webViewRef.current?.injectJavaScript(`
          (function() {
            var el = document.getElementById('editor');
            el.innerHTML += ${JSON.stringify(response.html)};
            return true;
          })();
        `);
      }
    } catch (e) {
      console.error('AI Generation Failed:', e);
      alert('Failed to generate document. Please try again.');
    }
  };

  const execCommand = (command: string, value: string = '') => {
    webViewRef.current?.injectJavaScript(`
      document.execCommand('${command}', false, '${value}');
      true;
    `);
  };

  const ToolbarButton = ({ icon: Icon, onPress, color = "#333", label }: { icon: any, onPress: () => void, color?: string, label?: string }) => (
    <TouchableOpacity onPress={onPress} style={styles.toolbarButton}>
      <Icon size={18} color={color} />
      {label && <Text style={styles.toolbarButtonLabel}>{label}</Text>}
    </TouchableOpacity>
  );

  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState('3');
  const [styleType, setStyleType] = useState('p');

  const handleFontFamilyChange = (val: string) => {
    setFontFamily(val);
    execCommand('fontName', val);
  };

  const handleFontSizeChange = (val: string) => {
    setFontSize(val);
    execCommand('fontSize', val);
  };

  const handleStyleChange = (val: string) => {
    setStyleType(val);
    execCommand('formatBlock', val);
  };

  const ribbonTabs: RibbonTab[] = [
    {
      id: 'home',
      label: 'Home',
      groups: [
        {
          id: 'clipboard',
          label: 'Clipboard',
          content: (
            <>
              <ToolbarButton icon={ClipboardPaste} onPress={() => execCommand('paste')} label="Paste" />
              <View style={{ flexDirection: 'column', justifyContent: 'space-around', height: '100%', gap: 2 }}>
                <ToolbarButton icon={Scissors} onPress={() => execCommand('cut')} />
                <ToolbarButton icon={Copy} onPress={() => execCommand('copy')} />
              </View>
              <ToolbarButton icon={Paintbrush} onPress={() => {}} />
            </>
          )
        },
        {
          id: 'font',
          label: 'Font',
          content: (
            <View style={{ flexDirection: 'column', gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <RibbonDropdown 
                  items={[
                    { label: 'Arial', value: 'Arial', style: { fontFamily: 'Arial' } },
                    { label: 'Times New Roman', value: 'Times New Roman', style: { fontFamily: 'Times New Roman' } },
                    { label: 'Courier New', value: 'Courier New', style: { fontFamily: 'Courier New' } },
                    { label: 'Georgia', value: 'Georgia', style: { fontFamily: 'Georgia' } },
                  ]}
                  value={fontFamily}
                  onChange={handleFontFamilyChange}
                  width={110}
                />
                <RibbonDropdown 
                  items={[
                    { label: '10', value: '1' },
                    { label: '13', value: '2' },
                    { label: '16', value: '3' },
                    { label: '18', value: '4' },
                    { label: '24', value: '5' },
                    { label: '32', value: '6' },
                    { label: '48', value: '7' },
                  ]}
                  value={fontSize}
                  onChange={handleFontSizeChange}
                  width={50}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <ToolbarButton icon={Bold} onPress={() => execCommand('bold')} />
                <ToolbarButton icon={Italic} onPress={() => execCommand('italic')} />
                <ToolbarButton icon={Underline} onPress={() => execCommand('underline')} />
                <ToolbarButton icon={Strikethrough} onPress={() => execCommand('strikeThrough')} />
                <ToolbarButton icon={Subscript} onPress={() => execCommand('subscript')} />
                <ToolbarButton icon={Superscript} onPress={() => execCommand('superscript')} />
                <ToolbarButton icon={Highlighter} onPress={() => execCommand('hiliteColor', 'yellow')} />
                <ToolbarButton icon={Palette} onPress={() => execCommand('foreColor', 'red')} color="red" />
              </View>
            </View>
          )
        },
        {
          id: 'paragraph',
          label: 'Paragraph',
          content: (
            <View style={{ flexDirection: 'column', gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <ToolbarButton icon={List} onPress={() => execCommand('insertUnorderedList')} />
                <ToolbarButton icon={ListOrdered} onPress={() => execCommand('insertOrderedList')} />
                <ToolbarButton icon={AlignLeft} onPress={() => execCommand('justifyLeft')} />
                <ToolbarButton icon={AlignCenter} onPress={() => execCommand('justifyCenter')} />
                <ToolbarButton icon={AlignRight} onPress={() => execCommand('justifyRight')} />
                <ToolbarButton icon={AlignJustify} onPress={() => execCommand('justifyFull')} />
              </View>
            </View>
          )
        },
        {
          id: 'styles',
          label: 'Styles',
          content: (
             <RibbonDropdown 
              items={[
                { label: 'Normal', value: 'p' },
                { label: 'Heading 1', value: 'H1', style: { fontSize: 24, fontWeight: 'bold' } },
                { label: 'Heading 2', value: 'H2', style: { fontSize: 20, fontWeight: 'bold' } },
                { label: 'Heading 3', value: 'H3', style: { fontSize: 18, fontWeight: 'bold' } },
                { label: 'Title', value: 'H4', style: { fontSize: 28, fontWeight: 'bold', borderBottomWidth: 1 } },
              ]}
              value={styleType}
              onChange={handleStyleChange}
              width={140}
            />
          )
        },
        {
          id: 'editing',
          label: 'Editing',
          content: (
             <View style={{ flexDirection: 'column', gap: 4 }}>
                <ToolbarButton icon={Search} onPress={() => {}} label="Find" />
                <ToolbarButton icon={TextSelect} onPress={() => execCommand('selectAll')} label="Select" />
             </View>
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
              <ToolbarButton icon={Image} onPress={() => execCommand('insertImage', 'https://via.placeholder.com/150')} label="Pictures" />
              <ToolbarButton icon={Link} onPress={() => {}} label="Link" />
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
            <>
              <ToolbarButton icon={Palette} onPress={() => execCommand('foreColor', '#2563eb')} color="#2563eb" label="Blue" />
              <ToolbarButton icon={Palette} onPress={() => execCommand('foreColor', '#ef4444')} color="#ef4444" label="Red" />
            </>
          )
        }
      ]
    }
  ];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
      <style>
        body {
          font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          padding: 20px;
          margin: 0;
          color: #333;
          font-size: 16px;
          line-height: 1.5;
        }
        #editor {
          min-height: 90vh;
          outline: none;
        }
        [contenteditable]:empty:before {
          content: attr(placeholder);
          color: #9ca3af;
          pointer-events: none;
          display: block; /* For Firefox */
        }
      </style>
    </head>
    <body>
      <div id="editor" contenteditable="true" placeholder="Start typing your document here..."></div>
      <script>
        // Make sure editor is always focused when tapped
        document.getElementById('editor').focus();
      </script>
    </body>
    </html>
  `;

  const { width } = Dimensions.get('window');
  const isMobile = width < 768;

  if (!currentDocId) {
    return (
      <DocumentBrowser
        appName="Docs"
        onNew={handleNewDoc}
        onOpen={handleOpenDoc}
        recentDocs={recentDocs}
      />
    );
  }

  const handleDownload = async () => {
    if (Platform.OS === 'web') {
      try {
        const content = `<h1>${docTitle}</h1><p>Document exported successfully.</p>`;
        const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = (window as any).document.createElement('a');
        a.href = url;
        a.download = `${docTitle || 'document'}.docx`;
        (window as any).document.body.appendChild(a);
        a.click();
        (window as any).document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        alert('Download failed');
      }
    } else {
      try {
        const content = `<h1>${docTitle}</h1><p>Document exported successfully.</p>`;
        const safeTitle = (docTitle || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileUri = (FileSystem as any).documentDirectory + `${safeTitle}.html`;
        
        await FileSystem.writeAsStringAsync(fileUri, content, { encoding: (FileSystem as any).EncodingType.UTF8 });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/html',
            dialogTitle: 'Download Document',
            UTI: 'public.html'
          });
        } else {
          alert('Document saved to app storage, but sharing is not available.');
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
        <Text style={styles.headerTitle}>{docTitle}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDownload} style={styles.downloadBtn}>
            <Text style={styles.downloadBtnText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAiBoxVisible(true)} style={styles.aiButton}>
            <Wand2 size={20} color="#fff" />
            <Text style={styles.aiButtonText}>AI</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <RibbonToolbar tabs={ribbonTabs} />

      <View style={styles.mainContent}>
        <View style={styles.editorContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              ref={(ref) => {
                if (ref) {
                  // @ts-ignore - we store the iframe ref dynamically to simulate WebView
                  webViewRef.current = {
                    injectJavaScript: (js: string) => {
                      if (ref.contentWindow) {
                        (ref.contentWindow as any).eval(js);
                      }
                    }
                  };
                }
              }}
              srcDoc={htmlContent}
              style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent }}
              style={styles.webview}
              hideKeyboardAccessoryView={false}
              scrollEnabled={true}
              bounces={false}
            />
          )}
        </View>
      </View>

      <AIPromptModal 
        visible={aiBoxVisible}
        onClose={() => setAiBoxVisible(false)}
        onGenerate={generateAIText} 
        title="AI Document Assistant"
        placeholder="E.g., Write a project proposal for a new mobile app..."
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
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
    backgroundColor: '#8b5cf6',
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
    padding: 6,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButtonLabel: {
    fontSize: 10,
    marginTop: 2,
    color: '#605E5C',
  },
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  editorContainer: {
    flex: 1,

    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sidebar: {
    width: 320,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  sidebarMobile: {
    width: '100%',
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  }
});


