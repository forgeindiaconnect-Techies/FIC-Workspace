import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { X, Wand2 } from 'lucide-react-native';

type AIPromptModalProps = {
  visible: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<void>;
  title?: string;
  placeholder?: string;
};

export default function AIPromptModal({ 
  visible, 
  onClose, 
  onGenerate,
  title = "Generate with AI",
  placeholder = "Describe what you want to create..."
}: AIPromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      await onGenerate(prompt);
      setPrompt('');
      onClose();
    } catch (e) {
      console.error("AI Generation Error", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Wand2 size={20} color="#8b5cf6" />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isGenerating}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            autoFocus
            editable={!isGenerating}
          />
          
          <TouchableOpacity 
            style={[styles.generateBtn, (!prompt.trim() || isGenerating) && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.generateText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#334155',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  generateBtn: {
    backgroundColor: '#8b5cf6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  generateBtnDisabled: {
    backgroundColor: '#c4b5fd',
  },
  generateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
