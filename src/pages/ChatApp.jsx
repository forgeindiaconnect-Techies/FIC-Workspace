import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getApiUrl, getSocketUrl } from '../api';
if (typeof window !== 'undefined') {
  window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
}
import AppLayout from '../components/AppLayout';
import { 
  Send, Plus, Hash, Search, Smile, Paperclip, 
  Phone, Video, MessageSquare, Loader2, MessageCircle, 
  Users, Settings, X, Check, Zap, MoreHorizontal, ArrowRight, Circle, History, UserCircle, Camera, Trash2, Mic, VideoOff, Square,
  Star, Pin, Bell, MoreVertical, Layout, List, Layers, ShieldCheck, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Peer from 'simple-peer';

const ChatApp = () => {
  const navigate = useNavigate();
  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
  const workspaceId = auth.workspaceId || 'demo';
  const isIndependent = auth.isIndependent || false;
  const currentUserEmail = auth.email || auth.mobile || 'guest@example.com';
  const currentUserName = auth.user || auth.name || 'Alex Rivers'; 
  const currentUserUsername = auth.username || (isIndependent ? `@${auth.username}` : `@${currentUserName.toLowerCase().replace(/\s+/g, '_')}_${auth.id?.slice(-4) || 'user'}`);
  const currentUserPhoto = auth.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserName}`;
  
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isFindingFriends, setIsFindingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('messenger'); // 'messenger', 'conversations', 'updates', 'calls', 'preferences'
  const [stories, setStories] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [isPostingStory, setIsPostingStory] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyImage, setStoryImage] = useState(null);
  const [editName, setEditName] = useState(currentUserName);
  const [editUsername, setEditUsername] = useState(currentUserUsername.replace('@', ''));
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [lastMessageStatus, setLastMessageStatus] = useState({});
  const [ringingAudio] = useState(typeof Audio !== 'undefined' ? new Audio('https://www.soundjay.com/phone/phone-calling-1.mp3') : null);
  const [dialingAudio] = useState(typeof Audio !== 'undefined' ? new Audio('https://www.soundjay.com/phone/phone-calling-1.mp3') : null);

  if (ringingAudio) ringingAudio.loop = true;
  if (dialingAudio) dialingAudio.loop = true;

  const playAudio = (audio) => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => console.log("Audio play blocked or failed:", err));
    }
  };
  
  const [callTime, setCallTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const stripHtml = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };
  
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  
  const [activeThread, setActiveThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [showThread, setShowThread] = useState(false);
  const [threadInput, setThreadInput] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(null); // stores messageId
  
  const [showMemberInfo, setShowMemberInfo] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); 
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // WebRTC States
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callTargetEmail, setCallTargetEmail] = useState("");
  const [callTargetName, setCallTargetName] = useState("");
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const peerRef = useRef();

  // API Base URL - Managed by global config
  const socketRef = useRef();
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedIdRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selected?._id;
  }, [selected?._id]);

  const fetchChannels = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/channels/${workspaceId}?email=${currentUserEmail}`));
      const data = await res.json();
      if (res.ok) {
        setChannels(data);
        if (data.length > 0 && !selected) setSelected(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  };

  const fetchStories = async () => {
    try {
      const res = await fetch(getApiUrl('/api/stories'));
      const data = await res.json();
      if (res.ok) setStories(data);
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    }
  };

  const fetchCallHistory = async () => {
    if (!currentUserEmail) return;
    try {
      const res = await fetch(getApiUrl(`/api/calls/${currentUserEmail}`));
      const data = await res.json();
      if (res.ok) setCallHistory(data);
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'updates') fetchStories();
    if (activeTab === 'calls') fetchCallHistory();
  }, [activeTab]);

  const fetchMembers = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/members/${workspaceId}`));
      const data = await res.json();
      if (res.ok) setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  useEffect(() => {
    let timer;
    if (callAccepted && !callEnded) {
      timer = setInterval(() => setCallTime(prev => prev + 1), 1000);
    } else {
      setCallTime(0);
    }
    return () => clearInterval(timer);
  }, [callAccepted, callEnded]);

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsCameraOff(!isCameraOff);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true,
          latency: 0,
          channelCount: 1,
          googHighpassFilter: false,
          googTypingNoiseDetection: false
        } 
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedAudio(URL.createObjectURL(audioBlob));
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { console.error("Mic access failed:", err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };



  const fetchMessages = async (channelId) => {
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/chat/${workspaceId}/${channelId}`));
      const data = await response.json();
      if (response.ok) setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Kural Messenger";
    fetchChannels();
    fetchMembers();
    fetchCallHistory();
    
    socketRef.current = io(getSocketUrl());
    
    socketRef.current.on("connect", () => {
      console.log("Connected to Chat Signaling Server");
      socketRef.current.emit("register-user", { 
        email: auth.email,
        mobile: auth.mobile
      });
    });

    socketRef.current.on("call-incoming", (data) => {
      console.log("Incoming call from:", data.from);
      setReceivingCall(true);
      setCaller(data.from);
      setCallerName(data.name);
      setCallTargetEmail(data.from);
      setCallTargetName(data.name);
      setCallerSignal(data.signal);
      setIsVideoCall(data.isVideo);
      playAudio(ringingAudio);
    });

    socketRef.current.on("call-error", (data) => {
      alert(data.message);
      if (dialingAudio) dialingAudio.pause();
    });

    socketRef.current.on("call-accepted", (signal) => {
      setCallAccepted(true);
      setIsCalling(false);
      if (dialingAudio) dialingAudio.pause();
      if (ringingAudio) ringingAudio.pause();
      if (peerRef.current) peerRef.current.signal(signal);
    });

    socketRef.current.on("call-ended", () => {
      setCallEnded(true);
      if (ringingAudio) ringingAudio.pause();
      if (dialingAudio) dialingAudio.pause();
      if (connectionRef.current) connectionRef.current.destroy();
      setReceivingCall(false);
      setCallAccepted(false);
      setIsCalling(false);
      setStream(null);
      fetchCallHistory();
    });

    socketRef.current.on("new message", (message) => {
      if (message.parentMessageId) {
        setMessages(prev => prev.map(m => 
          m._id === message.parentMessageId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        ));
      } else if (selectedIdRef.current === message.channelId) {
        setMessages(prev => [...prev, message]);
      }
      
      // Update channels list last message
      setChannels(prev => prev.map(ch => 
        ch._id === message.channelId ? { ...ch, lastMessage: message.timestamp, lastMessageContent: message.content } : ch
      ));
    });

    socketRef.current.on("reaction-updated", ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    });

    socketRef.current.on("user typing", ({ channelId, user }) => {
      if (selectedIdRef.current === channelId) {
        setTypingUsers(prev => ({
          ...prev,
          [channelId]: [...new Set([...(prev[channelId] || []), user])]
        }));
      }
    });

    socketRef.current.on("user stop typing", ({ channelId, user }) => {
      setTypingUsers(prev => ({
        ...prev,
        [channelId]: (prev[channelId] || []).filter(u => u !== user)
      }));
    });

    socketRef.current.on('presence-update', ({ mobile, isOnline, lastSeen }) => {
      setChannels(prev => prev.map(ch => {
        if (ch.type === 'dm' && ch.members.includes(mobile)) {
          return { ...ch, isOnline, lastSeen };
        }
        return ch;
      }));
      
      setSelected(prev => {
        if (prev?.type === 'dm' && prev.members.includes(mobile)) {
          return { ...prev, isOnline, lastSeen };
        }
        return prev;
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selected) {
      socketRef.current.emit("join chat", selected._id);
      fetchMessages(selected._id);
    }
  }, [selected?._id]);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  const sendMessage = (e, fileData = null) => {
    if (e) e.preventDefault();
    if (!input.trim() && !fileData || !selected) return;
    
    const msgContent = fileData ? `Sent a file: ${fileData.originalName}` : input.trim();
    const msgData = {
      workspaceId,
      channelId: selected._id,
      sender: currentUserName,
      senderEmail: currentUserEmail,
      content: msgContent,
      fileUrl: fileData?.url,
      fileType: fileData?.type
    };
    
    socketRef.current.emit("send message", msgData);
    setInput('');
    stopTyping();
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!isTyping && selected) {
      setIsTyping(true);
      socketRef.current.emit("typing", { channelId: selected._id, user: currentUserName });
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 3000);
  };

  const stopTyping = () => {
    if (isTyping && selected) {
      setIsTyping(false);
      socketRef.current.emit("stop typing", { channelId: selected._id, user: currentUserName });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(getApiUrl('/api/chat/upload'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        sendMessage(null, data);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const startCall = async (type) => {
    const passcode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const res = await fetch(getApiUrl('/api/meetings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title: `${type === 'audio' ? 'Audio' : 'Video'} Call`,
          passcode,
        }),
      });
      const meeting = await res.json();
      if (!res.ok) {
        throw new Error(meeting.error || 'Failed to create call.');
      }
      window.open(`/w/${workspaceId}/meet/room/${meeting.joinCode}?pwd=${passcode}&intent=join`, '_blank');
    } catch (err) {
      console.error('Failed to start call:', err);
      alert(err.message || 'Failed to start call. Please try again.');
    }
  };

  // Handle User Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setSearching(true);
        try {
          const res = await fetch(getApiUrl(`/api/chat/search-users?query=${searchQuery}&currentUserId=${auth._id}`));
          const data = await res.json();
          setSearchResults(data);
        } catch (err) {
          console.error('Search failed:', err);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const startChat = async (targetUser) => {
    try {
      const res = await fetch(getApiUrl('/api/chat/start-dm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: [currentUserEmail, targetUser.mobile],
          createdBy: currentUserEmail
        })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchChannels();
        setSelected(data);
        setIsFindingFriends(false);
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;
    try {
      const res = await fetch(getApiUrl('/api/channels/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'independent',
          name: groupName,
          type: 'group',
          members: [...selectedGroupMembers, currentUserEmail],
          createdBy: currentUserEmail
        })
      });
      const newChannel = await res.json();
      if (res.ok) {
        setChannels(prev => [newChannel, ...prev]);
        setSelected(newChannel);
        setIsCreatingGroup(false);
        setGroupName('');
        setSelectedGroupMembers([]);
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleDeleteChat = async () => {
    if (!selected) return;
    if (!window.confirm(`Permanently delete conversation with ${getDMName(selected)}?`)) return;

    try {
      console.log('Attempting to delete channel:', selected._id);
      const res = await fetch(getApiUrl(`/api/chat/delete-conversation/${selected._id}`), {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log('Delete successful');
        setChannels(prev => prev.filter(ch => ch._id !== selected._id));
        setSelected(null);
        setMessages([]);
      } else {
        const errorData = await res.json();
        console.error('Delete failed:', errorData);
        alert(`Failed to delete chat: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
      alert(`Error deleting chat: ${err.message}`);
    }
  };

  const toggleReaction = (messageId, emoji) => {
    const message = [...messages, ...threadMessages, activeThread].find(m => m?._id === messageId);
    if (!message) return;

    const reaction = message.reactions?.find(r => r.emoji === emoji);
    const hasReacted = reaction?.users.includes(currentUserEmail);

    if (hasReacted) {
      socketRef.current.emit("remove-reaction", { messageId, emoji, userEmail: currentUserEmail, channelId: selected._id });
    } else {
      socketRef.current.emit("add-reaction", { messageId, emoji, userEmail: currentUserEmail, channelId: selected._id });
    }
    setShowReactionPicker(null);
  };

  const openThread = async (message) => {
    setActiveThread(message);
    setShowThread(true);
    setShowMemberInfo(false);
    setThreadMessages([]);
    try {
      const res = await fetch(getApiUrl(`/api/chat/thread/${message._id}`));
      const data = await res.json();
      if (res.ok) setThreadMessages(data);
    } catch (err) {
      console.error('Failed to fetch thread:', err);
    }
  };

  const sendThreadReply = () => {
    if (!threadInput.trim() || !activeThread) return;
    const msgData = {
      workspaceId,
      channelId: selected._id,
      sender: currentUserName,
      senderEmail: currentUserEmail,
      content: threadInput,
      parentMessageId: activeThread._id
    };
    socketRef.current.emit("send message", msgData);
    setThreadInput('');
  };

  const formatLastSeen = (date) => {
    if (!date) return 'Long ago';
    const lastSeen = new Date(date);
    const now = new Date();
    const diff = (now - lastSeen) / 1000;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return lastSeen.toLocaleDateString();
  };

  const formatTime = (date) => {
    if (!date) return 'Just now';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDMName = (channel) => {
    if (channel.displayName) return channel.displayName;
    if (channel.type !== 'dm') return channel.name;
    const otherMemberEmail = channel.members.find(m => m !== currentUserEmail);
    const otherMember = members.find(m => m.email === otherMemberEmail);
    return otherMember ? otherMember.name : (channel.name || 'Direct Message');
  };

  const otherUserEmail = selected?.type === 'dm' ? selected.members.find(m => m !== currentUserEmail) : null;

  const callUser = (userToCall, isVideo = true) => {
    const targetName = getDMName(selected);
    setIsCalling(true);
    setIsVideoCall(isVideo);
    setCallEnded(false);
    setCallTargetEmail(userToCall);
    setCallTargetName(targetName);
    
    navigator.mediaDevices.getUserMedia({ 
      video: isVideo, 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true,
        latency: 0,
        channelCount: 1,
        googHighpassFilter: false,
        googTypingNoiseDetection: false
      } 
    }).then((currentStream) => {
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      if (typeof RTCPeerConnection === 'undefined') {
         throw new Error("Your browser does not support WebRTC. Please use a modern browser.");
      }

      const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });

      peer.on("signal", (data) => {
        socketRef.current.emit("call-user", {
          userToCall,
          signalData: data,
          from: currentUserEmail,
          name: currentUserName,
          isVideo
        });
        playAudio(dialingAudio);
      });

      peer.on("stream", (remoteStream) => {
        if (userVideo.current) userVideo.current.srcObject = remoteStream;
      });

      connectionRef.current = peer;
      peerRef.current = peer;
    }).catch(err => {
      console.error("Media access denied:", err);
      alert("Please allow camera and microphone access to make calls.");
      setIsCalling(false);
    });
  };

  const answerCall = () => {
    setCallAccepted(true);
    if (ringingAudio) ringingAudio.pause();
    navigator.mediaDevices.getUserMedia({ 
      video: isVideoCall, 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true,
        latency: 0,
        channelCount: 1,
        googHighpassFilter: false,
        googTypingNoiseDetection: false
      } 
    }).then((currentStream) => {
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });
      const target = callTargetEmail || caller;

      peer.on("signal", (data) => {
        socketRef.current.emit("answer-call", { signal: data, to: target });
      });

      peer.on("stream", (remoteStream) => {
        if (userVideo.current) userVideo.current.srcObject = remoteStream;
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
      peerRef.current = peer;
    });
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (ringingAudio) ringingAudio.pause();
    if (dialingAudio) dialingAudio.pause();
    if (stream) stream.getTracks().forEach(track => track.stop());
    
    const target = callTargetEmail || caller;
    if (target) {
       socketRef.current.emit("end-call", { to: target });
    }
    if (connectionRef.current) connectionRef.current.destroy();
    
    setReceivingCall(false);
    setCallAccepted(false);
    setIsCalling(false);
    setStream(null);

    // Save to history
    if (callTargetEmail) {
      fetch(getApiUrl('/api/calls'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: currentUserEmail,
          to: callTargetEmail,
          type: isVideoCall ? 'video' : 'voice',
          status: callAccepted ? 'completed' : 'busy',
          duration: callTime
        })
      }).then(() => fetchCallHistory()).catch(e => console.error("History save failed:", e));
    }
  };

  return (
    <AppLayout appName="Kural" appIcon={MessageSquare} appColor="#00A884">

      <div className="flex h-full w-full bg-[#f0f2f5] overflow-hidden font-sans selection:bg-[#25d366]/30">
        
        {/* Pane 1: Global Navigation Sidebar */}
        <div className="w-[64px] shrink-0 flex flex-col items-center py-6 bg-[#111b21] z-50">
           <div className="w-12 h-12 bg-[#00A884] rounded-2xl flex items-center justify-center p-1.5 shadow-2xl mb-8 cursor-pointer hover:scale-105 transition-all">
             <img src="/kural_logo.png" alt="Kural" className="w-full h-full object-cover rounded-xl" />
           </div>
           
           <div className="flex-1 space-y-6">
              {[
                { icon: MessageSquare, id: 'messenger' },
                { icon: Globe, id: 'updates' },
                { icon: Phone, id: 'calls' },
                { icon: Star, id: 'stories' },
                { icon: Settings, id: 'preferences' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => item.id === 'preferences' ? navigate(`/w/${workspaceId}/chat/settings`) : setActiveTab(item.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    activeTab === item.id ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                </button>
              ))}
           </div>

               <div className="mt-auto pb-6">
                  <div className="relative group cursor-pointer" onClick={() => navigate(`/w/${workspaceId}/chat/settings`)} title="Settings">
                     <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-md">
                       <img src={currentUserPhoto} alt="Me" className="w-full h-full object-cover" />
                     </div>
                     <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25d366] border-2 border-[#111b21] shadow-sm" />
                  </div>
               </div>
        </div>

        {/* Pane 2: Conversation List Area */}
        <div className="w-[400px] bg-white border-r border-[#E9EDEF] flex flex-col z-40">
           <div className="p-6 pb-4">
              <div className="flex items-center justify-between mb-6">
                 <h1 className="text-2xl font-bold text-[#111b21]">Chats</h1>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setIsCreatingGroup(true)} className="w-10 h-10 rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#f0f2f5] transition-all"><Users size={20} /></button>
                    <button onClick={() => setIsFindingFriends(true)} className="w-10 h-10 rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#f0f2f5] transition-all"><Plus size={20} /></button>
                 </div>
              </div>
              
              <div className="relative group">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f] group-focus-within:text-[#00a884] transition-colors"><Search size={18} /></div>
                 <input 
                   type="text" 
                   placeholder="Search or start new chat" 
                   className="w-full bg-[#f0f2f5] rounded-xl py-2 pl-12 pr-4 text-[14px] text-[#111b21] placeholder-[#667781] outline-none border-none"
                 />
              </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1 pb-8">
              {activeTab === 'messenger' || activeTab === 'conversations' ? (
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 py-2 mb-1">Direct Messages</p>
                  {channels
                    .filter(ch => activeTab === 'messenger' ? ch.type === 'dm' : ch.type === 'group')
                    .map(ch => {
                    const name = getDMName(ch);
                    const isSelected = selected?._id === ch._id;
                    return (
                      <div 
                        key={ch._id}
                        onClick={() => setSelected(ch)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all relative group cursor-pointer ${
                          isSelected ? 'bg-emerald-50 shadow-sm border border-emerald-100/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-[1rem] overflow-hidden bg-gray-100 border-2 ${isSelected ? 'border-emerald-400' : 'border-white'} transition-all flex items-center justify-center shadow-sm`}>
                            {ch.type === 'dm' ? (
                              <img 
                                src={ch.displayPicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
                                alt={name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users size={16} className="text-emerald-500" />
                            )}
                          </div>
                          {ch.isOnline && (
                             <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className={`text-[11px] font-black truncate ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>{name}</span>
                            <span className="text-[9px] text-gray-400 font-bold">{formatTime(ch.lastMessage)}</span>
                          </div>
                          <p className={`text-[10px] truncate font-semibold leading-relaxed ${isSelected ? 'text-emerald-600/70' : 'text-gray-400'}`}>
                            {stripHtml(ch.lastMessageContent) || 'Start a conversation...'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(ch);
                              handleDeleteChat();
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-50 text-gray-300 hover:text-rose-500 rounded-lg transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {isSelected && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : activeTab === 'updates' ? (
                <div className="space-y-4 pt-2">
                   <button 
                    onClick={() => setIsPostingStory(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100/50 hover:bg-emerald-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-emerald-500 border border-emerald-100 shadow-sm group-hover:scale-105 transition-transform">
                      <Plus size={18} strokeWidth={3} />
                    </div>
                    <div className="text-left">
                      <div className="text-[11px] font-black text-gray-900">My Status</div>
                      <div className="text-[9px] text-emerald-600 font-bold">Update your presence</div>
                    </div>
                  </button>
                  <div className="space-y-1 pt-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 mb-2">Team Updates</p>
                    {stories.map(story => (
                      <button key={story._id} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
                        <div className="w-10 h-10 rounded-2xl p-0.5 border-2 border-emerald-500 shadow-sm">
                           <img src={story.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.userName}`} className="w-full h-full object-cover rounded-[0.8rem]" alt={story.userName} />
                        </div>
                        <div className="text-left">
                           <div className="text-[11px] font-black text-gray-900">{story.userName}</div>
                           <div className="text-[9px] text-gray-400 font-bold">Today, {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeTab === 'calls' ? (
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 py-2 mb-1">Recent Calls</p>
                   {callHistory.map(call => (
                    <div key={call._id} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-all group border border-transparent hover:border-gray-100">
                      <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white transition-colors">
                         <Phone size={16} />
                      </div>
                      <div className="flex-1 text-left">
                         <div className="text-[11px] font-black text-gray-900 truncate">{call.to === currentUserEmail ? call.from : call.to}</div>
                         <div className="flex items-center gap-1 mt-0.5">
                            <History size={10} className="text-gray-300" />
                            <span className="text-[9px] text-gray-400 font-bold capitalize">{call.status} • {new Date(call.timestamp).toLocaleDateString()}</span>
                         </div>
                      </div>
                      <button className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><Phone size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 mb-4 shadow-sm">
                    <Settings size={28} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 mb-2">Chat Settings</h3>
                  <p className="text-[11px] text-gray-400 font-bold max-w-xs leading-relaxed mb-6">
                    Manage your profile, privacy, notifications and more.
                  </p>
                  <button
                    onClick={() => navigate(`/w/${workspaceId}/chat/settings`)}
                    className="px-6 py-3 bg-[#00A884] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#008f6b] transition-all shadow-lg shadow-emerald-100"
                  >
                    Open Settings
                  </button>
                </div>
              )}
           </div>
        </div>
        {/* Pane 3: Main Chat Viewport */}
        <div className="flex-1 flex flex-col relative bg-[#efeae2] overflow-hidden">
          {selected ? (
            <>
              {/* WhatsApp Style Header */}
              <div className="h-[64px] px-6 bg-[#f0f2f5] border-b border-[#E9EDEF] flex items-center justify-between z-30">
                 <div className="flex items-center gap-4 cursor-pointer" onClick={() => setShowMemberInfo(true)}>
                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm border border-black/5">
                       <img 
                         src={selected.type === 'dm' ? (selected.displayPicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getDMName(selected)}`) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selected.name}`} 
                         alt="Avatar" 
                       />
                    </div>
                    <div className="flex flex-col">
                       <span className="font-bold text-[#111b21] leading-tight">{getDMName(selected)}</span>
                       <span className={`text-[11px] font-medium ${selected.isOnline ? 'text-emerald-500' : 'text-[#667781]'}`}>
                          {selected.type === 'dm' ? (selected.isOnline ? 'online' : (selected.lastSeen ? `last seen ${formatLastSeen(selected.lastSeen)}` : 'offline')) : 'click for group info'}
                       </span>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {selected?.type === 'dm' && otherUserEmail && (
                      <>
                        <button onClick={() => callUser(otherUserEmail, true)} className="p-2 text-[#54656f] hover:bg-black/5 rounded-full"><Video size={20} /></button>
                        <button onClick={() => callUser(otherUserEmail, false)} className="p-2 text-[#54656f] hover:bg-black/5 rounded-full"><Phone size={20} /></button>
                        <div className="w-px h-6 bg-black/10 mx-2" />
                      </>
                    )}
                    <button className="p-2 text-[#54656f] hover:bg-black/5 rounded-full"><Search size={20} /></button>
                    <button className="p-2 text-[#54656f] hover:bg-black/5 rounded-full"><MoreVertical size={20} /></button>
                 </div>
              </div>
              {/* Chat Canvas with Wallpaper */}
              <div 
                className="flex-1 overflow-y-auto p-6 space-y-4 relative custom-scrollbar"
                style={{ 
                  backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/678/wallpaper-whatsapp-doodle-patterns-background-whatsapp-doodle-patterns-thumbnail.jpg")', 
                  backgroundBlendMode: 'overlay',
                  backgroundColor: 'rgba(239, 234, 226, 0.9)'
                }}
              >
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                     <Loader2 className="animate-spin text-[#00a884]" size={32} />
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    {messages.map((msg, i) => {
                      const isMe = msg.senderEmail === currentUserEmail;
                      
                      return (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={msg._id || i} 
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`group relative px-2.5 py-1.5 rounded-lg shadow-sm text-[14.2px] font-normal leading-relaxed min-w-[80px] ${
                              isMe ? 'bg-[#dcf8c6] text-[#303030] rounded-tr-none' : 'bg-white text-[#303030] rounded-tl-none border border-black/5'
                            }`}>
                              <div className="prose mb-1 max-w-none text-inherit" dangerouslySetInnerHTML={{ __html: msg.content }} />
                              
                              {msg.fileUrl && (
                                 <div className="mt-2 rounded-lg overflow-hidden border border-black/5">
                                   {msg.fileType?.startsWith('image/') ? (
                                      <img src={msg.fileUrl} className="w-full h-auto max-w-[300px] cursor-pointer" onClick={() => window.open(msg.fileUrl, '_blank')} />
                                   ) : (
                                      <div className="p-3 bg-black/5 flex items-center gap-3">
                                         <Paperclip size={18} className="text-gray-500" />
                                         <span className="text-[12px] truncate max-w-[150px]">{msg.content.replace('Sent a file: ', '')}</span>
                                      </div>
                                   )}
                                 </div>
                              )}

                              <div className="flex items-center justify-end gap-1.5 -mb-0.5 select-none opacity-60">
                                <span className="text-[10.5px] tabular-nums">{formatTime(msg.timestamp)}</span>
                                {isMe && (
                                  <div className="flex items-center -space-x-1.5">
                                     <Check size={14} className="text-[#53BDEB]" strokeWidth={2.5} />
                                     <Check size={14} className="text-[#53BDEB]" strokeWidth={2.5} />
                                  </div>
                                )}
                              </div>

                              <div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                                 <div className="flex items-center gap-1 p-1 bg-white shadow-xl rounded-full border border-gray-100 relative">
                                    <button onClick={() => setShowReactionPicker(msg._id)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 rounded-full text-gray-400"><Smile size={14} /></button>
                                    <button onClick={() => openThread(msg)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 rounded-full text-gray-400"><MessageSquare size={14} /></button>
                                    
                                    {showReactionPicker === msg._id && (
                                       <div className="absolute bottom-full mb-2 left-0 bg-white shadow-2xl border border-gray-100 rounded-full p-1 flex gap-1 z-50">
                                          {['👍', '❤️', '😂', '🎉', '🚀', '🔥'].map(emoji => (
                                            <button key={emoji} onClick={() => toggleReaction(msg._id, emoji)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-full transition-transform hover:scale-125">{emoji}</button>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* WhatsApp Style Input Component */}
              <div className="px-6 py-4 bg-[#F0F2F5] flex items-end gap-3 z-30">
                 <div className="flex items-center gap-1.5 mb-1 text-[#54656F]">
                    <button className="p-2 hover:bg-black/5 rounded-full transition-all"><Smile size={24} /></button>
                    <button onClick={() => fileInputRef.current.click()} className="p-2 hover:bg-black/5 rounded-full transition-all"><Plus size={24} /></button>
                 </div>
                 
                 <div className="flex-1 bg-white rounded-xl shadow-sm border border-transparent focus-within:border-emerald-100 transition-all flex items-center px-4 min-h-[48px]">
                    <RichInput 
                      value={input} 
                      onChange={setInput} 
                      onSend={() => sendMessage()} 
                      placeholder="Type a message" 
                    />
                 </div>

                 <button 
                   onClick={(input.trim() && input !== '<p></p>') ? () => sendMessage() : (isRecording ? stopRecording : startRecording)}
                   className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 ${
                     isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-[#00A884] text-white hover:scale-105 active:scale-95'
                   }`}
                 >
                    {(input.trim() && input !== '<p></p>') ? <ArrowRight size={22} strokeWidth={3} /> : (isRecording ? <Square size={22} /> : <Mic size={22} />)}
                 </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#667781] bg-[#F0F2F5] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1.5 bg-[#00A884]" />
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="w-64 h-64 flex items-center justify-center text-[#E9EDEF] mb-8"
               >
                  <MessageSquare size={160} strokeWidth={0.5} />
               </motion.div>
               <h3 className="text-3xl font-light text-[#41525D] tracking-tight">Kural for Web</h3>
               <p className="text-sm text-[#667781] mt-4 max-w-md text-center leading-relaxed">
                  Send and receive messages without keeping your phone online.<br/>
                  Use Kural on up to 4 linked devices and 1 phone at the same time.
               </p>
               <div className="mt-auto pb-10 flex items-center gap-2 text-[12px] text-[#8696A0]">
                  <ShieldCheck size={14} /> End-to-end encrypted
               </div>
            </div>
          )}
        </div>

        {/* SaaS Pane 4: Info/Thread Sidebar with Tabbed Content */}
        <AnimatePresence>
          {showThread && activeThread && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="shrink-0 border-l border-gray-100 bg-[#F9FAFB] flex flex-col z-30 shadow-2xl"
            >
              <div className="h-[72px] px-8 flex items-center justify-between border-b border-gray-100 bg-white">
                 <div className="flex flex-col">
                    <span className="font-black text-gray-900 text-[10px] tracking-widest uppercase">Thread</span>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tight">{getDMName(selected)}</span>
                 </div>
                 <button onClick={() => setShowThread(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-50 hover:text-rose-500 transition-all"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                 {/* Parent Message */}
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                       <div className="w-8 h-8 rounded-xl bg-gray-100 overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeThread.sender}`} />
                       </div>
                       <div>
                          <div className="text-[11px] font-black text-gray-900">{activeThread.sender}</div>
                          <div className="text-[9px] text-gray-400 font-bold tabular-nums">{formatTime(activeThread.timestamp)}</div>
                       </div>
                    </div>
                    <div className="text-[12px] font-semibold text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: activeThread.content }} />
                    
                    {activeThread.reactions?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1">
                        {activeThread.reactions.map(r => (
                          <div key={r.emoji} className="px-1.5 py-0.5 rounded-lg bg-gray-50 text-[10px] font-bold border border-gray-100 flex items-center gap-1">
                            {r.emoji} {r.users.length}
                          </div>
                        ))}
                      </div>
                    )}
                 </div>

                 <div className="flex items-center justify-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{threadMessages.length} Replies</span>
                    <div className="h-px flex-1 bg-gray-200" />
                 </div>

                 <div className="space-y-6">
                    {threadMessages.map(msg => (
                      <div key={msg._id} className="flex gap-4">
                         <div className="w-8 h-8 rounded-xl bg-gray-100 overflow-hidden shrink-0 mt-1">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender}`} />
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-[11px] font-black text-gray-900">{msg.sender}</span>
                               <span className="text-[9px] text-gray-300 font-bold tabular-nums">{formatTime(msg.timestamp)}</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm inline-block max-w-full">
                               <div className="prose text-[12px] font-semibold text-gray-700" dangerouslySetInnerHTML={{ __html: msg.content }} />
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="p-6 bg-white border-t border-gray-100">
                 <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center gap-3">
                    <RichInput 
                      value={threadInput} 
                      onChange={setThreadInput} 
                      onSend={sendThreadReply} 
                      placeholder="Reply to thread..." 
                    />
                    <button 
                      onClick={sendThreadReply}
                      className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100 shrink-0"
                    >
                       <ArrowRight size={14} />
                    </button>
                 </div>
              </div>
            </motion.div>
          )}

          {showMemberInfo && selected && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="shrink-0 border-l border-gray-100 bg-white flex flex-col z-30 shadow-2xl"
            >
              <div className="h-[72px] px-8 flex items-center justify-between border-b border-gray-100">
                 <span className="font-black text-gray-900 text-[10px] tracking-widest uppercase">Information</span>
                 <button onClick={() => setShowMemberInfo(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-50 hover:text-rose-500 transition-all"><X size={18} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-emerald-50 mx-auto mb-6 overflow-hidden border-4 border-white shadow-2xl relative">
                    <img 
                      src={selected.type === 'dm' ? (selected.displayPicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getDMName(selected)}`) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selected.name}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-full bg-emerald-500 border-4 border-white shadow-lg" />
                  </div>
                  <h3 className="font-black text-xl text-gray-900 leading-tight">{getDMName(selected)}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-3">Team Member • Forge India Connect</p>
                  
                  <div className="mt-10 grid grid-cols-2 gap-4 px-2">
                     <button className="py-3.5 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-95">Message</button>
                     <button className="py-3.5 bg-gray-50 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95">View Profile</button>
                  </div>
                </div>

                <div className="space-y-8 px-2">
                   <div className="space-y-5">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 flex items-center gap-2 px-1">
                        <Star size={12} className="text-amber-400" /> Member Details
                      </h4>
                      <div className="bg-gray-50 rounded-3xl p-6 space-y-6 border border-gray-100/50 shadow-inner">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</span>
                            <span className="text-[11px] font-bold text-gray-800 truncate max-w-[140px]">{selected.type === 'dm' ? selected.members?.find(m => m !== currentUserEmail) : 'Team Channel'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Local Time</span>
                            <span className="text-[11px] font-bold text-gray-800">1:12 PM IST</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
                            <div className="flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                               <span className="text-[11px] font-bold text-emerald-600">Available</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 flex items-center gap-2 px-1">
                        <History size={12} /> Shared Resources
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                         {[1,2,3].map(i => (
                           <div key={i} className="aspect-square bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:border-emerald-200 transition-all">
                              <img src={`https://picsum.photos/seed/${i+10}/200`} className="w-full h-full object-cover opacity-80 hover:opacity-100" />
                           </div>
                         ))}
                      </div>
                      <button className="w-full py-3 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 hover:text-emerald-500 transition-all">See all attachments</button>
                   </div>

                   <button className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 mt-10">
                     <ShieldCheck size={14} /> Block Teammate
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SaaS-Style Find Friends Modal */}
        {isFindingFriends && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] rounded-[2.5rem] overflow-hidden border border-white p-2">
              <div className="p-10 pb-6">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Connect with Team</h2>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">Enterprise Directory Search</p>
                  </div>
                  <button onClick={() => setIsFindingFriends(false)} className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm border border-gray-100/50"><X size={20} strokeWidth={3} /></button>
                </div>
                <div className="relative group">
                   <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500"><Search size={22} strokeWidth={2.5} /></div>
                   <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name or @username..."
                    className="w-full bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-3xl py-5 pl-16 pr-6 text-[13px] font-bold text-gray-900 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
              <div className="p-10 pt-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6 px-4">
                  {searching ? 'Querying database...' : searchResults.length > 0 ? `${searchResults.length} Teammates Found` : searchQuery.length > 1 ? 'Zero matches found' : 'Suggested for you'}
                </h3>
                <div className="max-h-[400px] overflow-y-auto space-y-2 mb-4 custom-scrollbar pr-2">
                  {searchResults.length > 0 ? (
                    searchResults.map(user => (
                      <button 
                        key={user._id}
                        onClick={() => startChat(user)}
                        className="w-full flex items-center justify-between p-5 rounded-[2rem] transition-all hover:bg-emerald-50 group border border-transparent hover:border-emerald-100 bg-gray-50/50 mb-2"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-[1.2rem] overflow-hidden bg-white border-2 border-white shadow-xl group-hover:scale-105 transition-transform">
                            <img 
                              src={user.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                              alt={user.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-left">
                             <div className="text-sm font-black text-gray-900">{user.name}</div>
                             <div className="text-[11px] text-emerald-500 font-bold tracking-tight">@{user.username}</div>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-emerald-500 opacity-0 group-hover:opacity-100 transition-all shadow-lg border border-emerald-50">
                           <ArrowRight size={20} strokeWidth={3} />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center">
                       <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-200 mb-4 border border-gray-100 shadow-inner">
                         <Search size={32} />
                       </div>
                       <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Start typing to find peers</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {isCreatingGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/10 backdrop-blur-md">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border border-white p-2">
              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Create Group</h2>
                  <button onClick={() => setIsCreatingGroup(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all"><X size={18} /></button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500"><Hash size={18} /></div>
                    <input 
                      type="text" 
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="Group Name (e.g. Family, Project Team)"
                      className="w-full bg-gray-50 border-none focus:ring-2 focus:ring-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6 px-2">Select Friends</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 mb-8 custom-scrollbar pr-2">
                  {channels.filter(ch => ch.type === 'dm').map(dm => {
                    const friendMobile = dm.members.find(m => m !== currentUserEmail);
                    const isSelected = selectedGroupMembers.includes(friendMobile);
                    return (
                      <button 
                        key={dm._id}
                        onClick={() => setSelectedGroupMembers(prev => isSelected ? prev.filter(m => m !== friendMobile) : [...prev, friendMobile])}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${isSelected ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-gray-50 border border-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50">
                            <img src={dm.displayPicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.displayName}`} alt={dm.displayName} />
                          </div>
                          <div className="text-left">
                             <div className="text-xs font-bold text-gray-900">{dm.displayName}</div>
                             <div className="text-[9px] text-gray-400 font-bold">@{dm.displayUsername}</div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-200'}`}>
                           {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                        </div>
                      </button>
                    );
                  })}
                  {channels.filter(ch => ch.type === 'dm').length === 0 && (
                    <p className="text-center py-4 text-xs text-gray-400 font-medium">Find some friends first to start a group!</p>
                  )}
                </div>
                <button 
                  onClick={createGroup}
                  disabled={!groupName.trim() || selectedGroupMembers.length === 0}
                  className="w-full py-4 bg-[#00C17E] text-white rounded-3xl font-black text-sm shadow-xl shadow-emerald-100 disabled:opacity-20 disabled:shadow-none transition-all hover:bg-[#00A36C] hover:scale-[1.02] active:scale-95"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden"
          accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf"
          onChange={handleFileUpload}
        />
      </div>
      {/* IMMERSIVE CALL MODAL */}
      <AnimatePresence>
        {(receivingCall || isCalling || (callAccepted && !callEnded)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-[#111b21] flex flex-col items-center justify-center text-white"
          >
             {/* Background Glass Overlay */}
             <div className="absolute inset-0 opacity-20 blur-[100px] pointer-events-none">
                <div className="w-full h-full bg-gradient-to-tr from-[#00a884] to-[#111b21]" />
             </div>

             {/* Call Content */}
             <div className="relative z-10 flex flex-col items-center w-full max-w-lg h-full justify-between py-20 px-8">
                <div className="flex flex-col items-center gap-6">
                   <motion.div 
                     animate={(receivingCall || isCalling) && !callAccepted ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] } : {}}
                     transition={{ repeat: Infinity, duration: 3 }}
                     className="w-32 h-32 rounded-full border-4 border-emerald-500/20 overflow-hidden shadow-[0_0_50px_rgba(0,168,132,0.3)]"
                   >
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${callTargetName}`} className="w-full h-full object-cover" />
                   </motion.div>
                   <div className="text-center">
                      <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">{callTargetName || 'Kural Call'}</h2>
                      <div className="flex flex-col items-center gap-1">
                         <p className="text-emerald-500 font-black uppercase tracking-[0.4em] text-[9px] animate-pulse">
                            {callAccepted ? 'Connected' : (receivingCall ? 'Incoming Call' : 'Dialing')}
                         </p>
                         {callAccepted && (
                            <span className="text-[11px] font-mono text-gray-400 font-bold">{formatCallTime(callTime)}</span>
                         )}
                      </div>
                   </div>
                </div>

              <div className="flex-1 w-full flex items-center justify-center gap-6 relative">
                {/* Remote Video */}
                {callAccepted && (
                  <div className="w-full h-full max-h-[70vh] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative border border-white/10">
                    <video playsInline muted ref={userVideo} autoPlay className={`w-full h-full object-cover mirror ${!isVideoCall && 'hidden'}`} />
                    {!isVideoCall && (
                       <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                          <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center">
                             <UserCircle size={64} className="text-emerald-500" />
                          </div>
                       </div>
                    )}
                  </div>
                )}
                
                {/* Local Video */}
                <div className={`${callAccepted ? 'absolute bottom-8 right-8 w-64 h-48' : 'w-full max-w-3xl h-[60vh]'} bg-zinc-800 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 border-2 border-white/20 z-10`}>
                  <video playsInline muted ref={myVideo} autoPlay className={`w-full h-full object-cover ${(!isVideoCall || isCameraOff) ? 'hidden' : ''}`} />
                  {(!isVideoCall || isCameraOff) && (
                     <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <UserCircle size={48} className="text-white/30" />
                     </div>
                  )}
                </div>
              </div>

                {/* Premium Controls */}
                <div className="w-full max-w-md">
                   {receivingCall && !callAccepted ? (
                      <div className="flex justify-around items-center w-full">
                         <motion.button 
                           whileHover={{ scale: 1.1 }}
                           whileTap={{ scale: 0.9 }}
                           onClick={leaveCall} 
                           className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(244,63,94,0.3)] group"
                         >
                            <Phone size={32} className="rotate-[135deg] group-hover:-rotate-12 transition-transform" />
                         </motion.button>
                         <motion.button 
                           whileHover={{ scale: 1.1 }}
                           whileTap={{ scale: 0.9 }}
                           onClick={answerCall} 
                           className="w-20 h-20 bg-[#00a884] rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(0,168,132,0.3)] animate-bounce"
                         >
                            <Phone size={32} />
                         </motion.button>
                      </div>
                   ) : (
                      <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[3rem] flex items-center justify-between shadow-2xl">
                         <button onClick={toggleMute} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-rose-500 text-white' : 'hover:bg-white/10 text-gray-400'}`}>
                            {isMuted ? <Zap size={24} /> : <MessageSquare size={24} />}
                         </button>
                         
                         <motion.button 
                           whileHover={{ scale: 1.1, rotate: 135 }}
                           onClick={leaveCall} 
                           className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center shadow-[0_15px_40px_rgba(244,63,94,0.4)]"
                         >
                            <Phone size={32} className="rotate-[135deg]" />
                         </motion.button>

                         {isVideoCall ? (
                            <button onClick={toggleCamera} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCameraOff ? 'bg-rose-500 text-white' : 'hover:bg-white/10 text-gray-400'}`}>
                               <Camera size={24} />
                            </button>
                         ) : (
                            <div className="w-14 h-14" /> // Spacer
                         )}
                      </div>
                   )}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INCOMING CALL MODAL REMOVED - NOW PART OF IMMERSIVE MODAL */}

    </AppLayout>
  );
};

const RichInput = ({ value, onChange, onSend, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          onSend();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value && value === '') {
      editor.commands.setContent('');
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="flex-1">
      <EditorContent editor={editor} />
    </div>
  );
};

export default ChatApp;
