import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator, Image, Alert, Switch } from 'react-native';
import tw from 'twrnc';
import { api, getSession, SOCKET_URL } from '../lib/api';
import { Heart, MessageCircle, Send, MoreHorizontal, Sparkles, Image as ImageIcon, X, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

const btoaPolyfill = (input: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input;
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3/4);
    block = block << 8 | charCode;
  }
  return output;
};

export default function ThreadsTab() {
  const { user } = getSession();
  const workspaceId = user?.workspaceId || 'antigraviity-hq';
  const currentUserEmail = user?.email || 'admin@fic.com';
  const currentUserName = user?.name || 'Admin';

  const [posts, setPosts] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);

  // AI Poster extra options
  const [aiCompanyName, setAiCompanyName] = useState('WorkspacePro');
  const [aiCompanyLogo, setAiCompanyLogo] = useState('');
  const [useRealisticPhotos, setUseRealisticPhotos] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    fetchThreads();
  }, [workspaceId]);

  const fetchThreads = async () => {
    setIsLoadingFeed(true);
    try {
      const data = await api.threads.getThreads(workspaceId);
      setPosts(data);
    } catch (err) {
      console.warn('Failed to fetch threads', err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    
    const asset = result.assets[0];
    setIsSubmitting(true);
    try {
      const uploadRes = await api.threads.uploadThreadFile(asset.uri, asset.mimeType || 'image/jpeg', asset.fileName || 'upload.jpg');
      setMediaAttachments(prev => [...prev, uploadRes]);
    } catch (e) {
      Alert.alert('Upload Failed', 'Could not upload image');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    
    const asset = result.assets[0];
    setIsUploadingLogo(true);
    try {
      const uploadRes = await api.threads.uploadThreadFile(asset.uri, asset.mimeType || 'image/jpeg', asset.fileName || 'logo.jpg');
      setAiCompanyLogo(uploadRes.url);
    } catch (e) {
      Alert.alert('Upload Failed', 'Could not upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && mediaAttachments.length === 0) return;
    setIsSubmitting(true);
    try {
      await api.threads.createThread({
        workspaceId,
        content: newPostContent,
        mediaUrls: mediaAttachments,
        visibility: 'everyone'
      });
      setNewPostContent('');
      setMediaAttachments([]);
      fetchThreads(); // Refresh feed
    } catch (e) {
      Alert.alert('Post Failed', 'Could not create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateAIPoster = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAI(true);
    setGeneratedPoster(null);
    try {
      const apiKey = 'AIzaSyA3nfLFZhoElBN7i4Vtt8ah0x0odFDW1vg'; // Same as web
      const prompt = `You are a professional corporate graphic designer. Generate a visually stunning and modern SVG poster/ad.
The poster must look "Professional Corporate".
${useRealisticPhotos 
  ? 'CRITICAL: You MUST use the <image> tag to embed realistic photographs of people using this exact URL format: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800". DO NOT use SVG paths to draw humans.' 
  : 'Feature animated/illustrated persons/images (using SVG paths or embedded shapes).'}
It MUST contain the company name "${aiCompanyName}" and prominently display the company logo image using this URL: "${aiCompanyLogo}".
The topic/content of the poster is: "${aiPrompt}".
Use a beautiful, vibrant color palette. Ensure text is readable. Make it standard poster size.
CRITICAL XML RULES: All ampersands (&) in URLs MUST be escaped as &amp;. If using preserveAspectRatio, use a valid value like "xMidYMid slice" (with a space).
RETURN ONLY THE RAW SVG CODE. Do not include markdown code blocks, just the raw <svg>...</svg>.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        let svgCode = data.candidates[0].content.parts[0].text.trim();
        svgCode = svgCode.replace(/^\`\`\`xml/, '').replace(/^\`\`\`svg/, '').replace(/^\`\`\`html/, '').replace(/^\`\`\`/, '').replace(/\`\`\`$/, '');
        setGeneratedPoster(svgCode.trim());
      }
    } catch (error) {
      Alert.alert('Generation Failed', 'Could not generate AI poster');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAttachGeneratedPoster = () => {
    if (!generatedPoster) return;
    let cleanedSvg = generatedPoster.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[a-fA-F0-9]+;)/g, '&amp;');
    cleanedSvg = cleanedSvg.replace(/preserveAspectRatio="([^"\s]+)(meet|slice)"/gi, 'preserveAspectRatio="$1 $2"');
    
    // A simpler utf8 encoding workaround for react-native
    const b64 = btoaPolyfill(unescape(encodeURIComponent(cleanedSvg)));
    const dataUrl = `data:image/svg+xml;base64,${b64}`;

    setMediaAttachments(prev => [...prev, {
      type: 'image',
      url: dataUrl,
      name: 'AI_Generated_Poster.svg'
    }]);
    setShowAIModal(false);
    setGeneratedPoster(null);
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.threads.deletePost(postId);
          fetchThreads();
        } catch {}
      }}
    ]);
  };

  const toggleLike = async (postId: string) => {
    try {
      await api.threads.likePost(postId);
      fetchThreads(); // Simple refresh instead of optimistic for now
    } catch {}
  };

  return (
    <View style={tw`flex-1 bg-[#F5F7FB]`}>
      <View style={tw`bg-white px-4 py-4 border-b border-gray-200`}>
        <View style={tw`flex-row items-center gap-3`}>
          <TextInput
            placeholder="Share an update, idea, or ask a question..."
            value={newPostContent}
            onChangeText={setNewPostContent}
            style={tw`flex-1 bg-gray-100 rounded-xl px-4 py-3 text-[14px]`}
            multiline
          />
        </View>
        
        {mediaAttachments.length > 0 && (
          <ScrollView horizontal style={tw`mt-3`} showsHorizontalScrollIndicator={false}>
            {mediaAttachments.map((m, i) => (
              <View key={i} style={tw`mr-3 relative`}>
                <Image source={{ uri: m.url }} style={tw`w-20 h-20 rounded-lg bg-gray-200`} />
                <TouchableOpacity onPress={() => setMediaAttachments(p => p.filter((_, idx) => idx !== i))} style={tw`absolute top-1 right-1 bg-black/50 rounded-full p-1`}>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={tw`flex-row justify-between items-center mt-3`}>
          <View style={tw`flex-row gap-2`}>
            <TouchableOpacity onPress={handlePickImage} style={tw`p-2 bg-gray-100 rounded-full`}>
              <ImageIcon size={20} color="#2170E4" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAIModal(true)} style={tw`p-2 bg-[#F0F4FF] rounded-full flex-row items-center gap-1 px-3`}>
              <Sparkles size={16} color="#2170E4" />
              <Text style={tw`text-[#2170E4] font-bold text-xs`}>AI Poster</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            onPress={handleCreatePost}
            disabled={isSubmitting || (!newPostContent.trim() && mediaAttachments.length === 0)}
            style={tw`bg-[#2170E4] px-5 py-2 rounded-full opacity-${isSubmitting ? '50' : '100'}`}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={tw`text-white font-bold`}>Post</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={tw`flex-1 p-4`} contentContainerStyle={tw`pb-24`}>
        {isLoadingFeed ? (
          <ActivityIndicator size="large" color="#2170E4" style={tw`mt-10`} />
        ) : (
          posts.map(post => {
            const hasLiked = post.likes?.includes(currentUserEmail);
            return (
              <View key={post._id} style={tw`bg-white p-4 rounded-2xl mb-4 border border-gray-100 shadow-sm`}>
                <View style={tw`flex-row justify-between items-start mb-3`}>
                  <View style={tw`flex-row items-center gap-3`}>
                    <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center`}>
                      <Text style={tw`font-bold text-blue-700`}>{post.authorName?.substring(0,2).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={tw`font-bold text-[#0B1C30]`}>{post.authorName}</Text>
                      <Text style={tw`text-xs text-gray-500`}>{new Date(post.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  {post.authorEmail === currentUserEmail && (
                    <TouchableOpacity onPress={() => handleDeletePost(post._id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {post.content ? <Text style={tw`text-[#0B1C30] mb-3`}>{post.content}</Text> : null}
                
                {post.mediaUrls?.length > 0 && (
                  <View style={tw`mb-3`}>
                    {post.mediaUrls.map((m: any, i: number) => (
                      <Image key={i} source={{ uri: m.url }} style={tw`w-full h-48 rounded-xl bg-gray-100 mb-2`} resizeMode="contain" />
                    ))}
                  </View>
                )}

                <View style={tw`flex-row items-center gap-4 mt-2 pt-3 border-t border-gray-100`}>
                  <TouchableOpacity onPress={() => toggleLike(post._id)} style={tw`flex-row items-center gap-1`}>
                    <Heart size={20} color={hasLiked ? '#ef4444' : '#6b7280'} fill={hasLiked ? '#ef4444' : 'transparent'} />
                    <Text style={tw`text-gray-500`}>{post.likes?.length || 0}</Text>
                  </TouchableOpacity>
                  <View style={tw`flex-row items-center gap-1`}>
                    <MessageCircle size={20} color="#6b7280" />
                    <Text style={tw`text-gray-500`}>{post.comments?.length || 0}</Text>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* AI Poster Modal */}
      <Modal visible={showAIModal} animationType="slide" transparent>
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6 h-[80%]`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <Text style={tw`font-bold text-lg text-[#0B1C30]`}>Generate AI Poster</Text>
              <TouchableOpacity onPress={() => setShowAIModal(false)}><X size={24} color="#000" /></TouchableOpacity>
            </View>
            
            <TextInput
              style={tw`border border-gray-200 rounded-xl p-4 h-24 mb-4`}
              placeholder="Describe what you want the poster to be about..."
              multiline
              value={aiPrompt}
              onChangeText={setAiPrompt}
            />

            <View style={tw`mb-4`}>
              <Text style={tw`font-bold text-[#0B1C30] mb-2`}>Company Name</Text>
              <TextInput
                style={tw`border border-gray-200 rounded-xl px-4 py-3`}
                placeholder="e.g. WorkspacePro"
                value={aiCompanyName}
                onChangeText={setAiCompanyName}
              />
            </View>

            <View style={tw`flex-row items-center justify-between mb-4`}>
              <Text style={tw`font-bold text-[#0B1C30]`}>Use Realistic Photos</Text>
              <Switch value={useRealisticPhotos} onValueChange={setUseRealisticPhotos} />
            </View>

            <View style={tw`mb-4`}>
              <Text style={tw`font-bold text-[#0B1C30] mb-2`}>Company Logo</Text>
              <View style={tw`flex-row items-center gap-3`}>
                <TouchableOpacity onPress={handlePickLogo} style={tw`bg-gray-100 p-3 rounded-xl border border-gray-200`}>
                  {isUploadingLogo ? <ActivityIndicator size="small" /> : <Text style={tw`text-blue-600 font-bold`}>Upload Logo</Text>}
                </TouchableOpacity>
                {aiCompanyLogo ? <Image source={{uri: aiCompanyLogo}} style={tw`w-10 h-10 rounded-full`} /> : null}
              </View>
            </View>
            
            <TouchableOpacity 
              onPress={handleGenerateAIPoster}
              disabled={isGeneratingAI || !aiPrompt}
              style={tw`bg-[#2170E4] p-4 rounded-xl items-center flex-row justify-center gap-2 mb-4 opacity-${isGeneratingAI ? '50' : '100'}`}
            >
              {isGeneratingAI ? <ActivityIndicator color="#fff" /> : <Sparkles size={20} color="#fff" />}
              <Text style={tw`text-white font-bold`}>{isGeneratingAI ? 'Generating...' : 'Generate Poster'}</Text>
            </TouchableOpacity>

            {generatedPoster && (
              <ScrollView style={tw`flex-1`}>
                <Text style={tw`font-bold text-gray-500 mb-2`}>Preview (SVG rendered as Image base64)</Text>
                <View style={tw`w-full h-64 bg-gray-100 rounded-xl overflow-hidden mb-4 items-center justify-center`}>
                  <Image 
                    source={{ uri: `data:image/svg+xml;base64,${btoaPolyfill(unescape(encodeURIComponent(generatedPoster)))}` }} 
                    style={tw`w-full h-full`} 
                    resizeMode="contain" 
                  />
                </View>
                <TouchableOpacity onPress={handleAttachGeneratedPoster} style={tw`bg-black p-4 rounded-xl items-center`}>
                  <Text style={tw`text-white font-bold`}>Attach to Post</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
