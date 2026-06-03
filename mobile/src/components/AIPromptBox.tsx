import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Settings2 } from 'lucide-react-native';

interface AIPromptBoxProps {
  onGenerate: (prompt: string) => Promise<void>;
  title?: string;
  placeholder?: string;
}

export default function AIPromptBox({ 
  onGenerate, 
  title = "AI Assistant", 
  placeholder = "Describe the document you want to create..."
}: AIPromptBoxProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      await onGenerate(prompt);
      setPrompt('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Settings2 size={16} color="#2563eb" />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      
      <Text style={styles.description}>
        Describe what you want to create, and the AI will generate it for you instantly.
      </Text>

      <TextInput
        style={styles.input}
        multiline
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={prompt}
        onChangeText={setPrompt}
        textAlignVertical="top"
      />

      <TouchableOpacity 
        style={[styles.button, (!prompt.trim() || isGenerating) && styles.buttonDisabled]} 
        onPress={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
      >
        {isGenerating ? (
          <>
            <ActivityIndicator size="small" color="#ffffff" style={styles.loader} />
            <Text style={styles.buttonText}>Generating...</Text>
          </>
        ) : (
          <Text style={styles.buttonText}>Prepare Document</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loader: {
    marginRight: 8,
  }
});
