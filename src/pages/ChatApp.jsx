import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getApiUrl, getSocketUrl } from '../api';
if (typeof window !== 'undefined') {
  window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
}
import AppLayout, { SidebarProfile } from '../components/AppLayout';
import LogoImage from '../assets/landing-logo.png';
import { 
  Send, Plus, Hash, Search, Smile, Paperclip, 
  Phone, Video, MessageSquare, Loader2, MessageCircle, 
  Users, Settings, X, Check, Zap, MoreHorizontal, ArrowRight, Circle, History, UserCircle, Camera, Trash2, Mic, VideoOff, Square,
  Star, Pin, Bell, MoreVertical, Layout, List, Layers, ShieldCheck, Globe,
  Home, LayoutGrid, FileText, MessageSquareText, HelpCircle, Info, Bold, Italic, Link2, Code, AtSign, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import { UserPlus } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Peer from 'simple-peer';
import HomeTab from '../components/HomeTab';
import ThreadsTab from '../components/ThreadsTab';
import FilesTab from '../components/FilesTab';
import AppsTab from '../components/AppsTab';

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
  const [meetingUpdateTrigger, setMeetingUpdateTrigger] = useState(0);
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
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

  const handleAddMembersSubmit = async () => {
    if (selectedNewMembers.length === 0 || !selected) return;
    await addMembersToGroup(selected._id, selectedNewMembers);
    setIsAddingMembers(false);
    setSelectedNewMembers([]);
  };
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
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(getApiUrl(`/api/channels/${workspaceId}?email=${currentUserEmail}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      let data = await res.json();
      
      try {
        const groupsRes = await fetch(getApiUrl(`/api/channels/${workspaceId}/groups?email=${currentUserEmail}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          data = [...data, ...groupsData];
        }
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      }
      
      if (res.ok) {
        // Manually verify messages for DMs to handle old backend payloads without 'hasMessages'
        const channelsWithVerification = await Promise.all(data.map(async (ch) => {
          const type = ch.type || (ch.isGroup ? 'group' : 'dm');
          if (['dm', 'direct'].includes(type)) {
            // If backend is already restarted and provides hasMessages, use it
            if (ch.hasMessages !== undefined) return ch;
            
            try {
              const msgRes = await fetch(getApiUrl(`/api/chat/${workspaceId}/${ch._id}`), {
                 headers: { Authorization: `Bearer ${token}` }
              });
              const msgs = await msgRes.json();
              const hasMsg = msgs && msgs.length > 0;
              return { 
                ...ch, 
                hasMessages: hasMsg,
                ...(hasMsg && { 
                  lastMessageContent: msgs[msgs.length - 1].content,
                  lastMessage: msgs[msgs.length - 1].sentAt || msgs[msgs.length - 1].createdAt
                })
              };
            } catch (e) {
              return { ...ch, hasMessages: false };
            }
          }
          return ch;
        }));
        const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
        const fixedData = channelsWithVerification.map(ch => {
          const lastMessageTimeVal = ch.lastMessage || ch.lastMessageTime;
          const lastTime = new Date(lastMessageTimeVal || 0).getTime();
          const readTime = new Date(readTimestamps[ch._id] || 0).getTime();
          return {
            ...ch,
            type: ch.type || 'dm',
            members: ch.members || [currentUserEmail, ch.email],
            lastMessage: lastMessageTimeVal,
            unreadCount: (lastTime > readTime && ch.hasMessages) ? 1 : 0
          };
        });
        
        setChannels(fixedData);
        return fixedData;
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
    return null;
  };

  const fetchStories = async () => {
    if (!currentUserEmail) return;
    // Backend endpoint /api/stories doesn't exist yet, mock to prevent 404 console error
    setStories([]);
  };

  const fetchCallHistory = async () => {
    if (!currentUserEmail) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/chat/call-logs'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setCallHistory(data);
      }
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
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/members/${workspaceId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl(`/api/chat/${workspaceId}/${channelId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    
    // Real WebSocket connection for native voice/video call signaling
    const wsUrl = getSocketUrl(`/ws/calls?token=${localStorage.getItem('token')}`);
    const ws = new WebSocket(wsUrl);
    const listeners = {};

    ws.onopen = () => {
      console.log("[ChatApp] Connected to Call Signaling Server");
      // Register immediately
      ws.send(JSON.stringify({
        type: 'register',
        data: { token: localStorage.getItem('token') }
      }));
      if (listeners["connect"]) {
        listeners["connect"].forEach(cb => cb());
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type } = msg;

        if (type === 'incoming_call') {
          if (listeners["call-incoming"]) {
            listeners["call-incoming"].forEach(cb => cb({
              from: msg.callerEmail,
              name: msg.callerName,
              signal: msg.offer,
              isVideo: msg.isVideo || false
            }));
          }
        } else if (type === 'call_answered') {
          if (listeners["call-accepted"]) {
            listeners["call-accepted"].forEach(cb => cb(msg.answer));
          }
        } else if (type === 'call_ended') {
          if (listeners["call-ended"]) {
            listeners["call-ended"].forEach(cb => cb());
          }
        } else if (type === 'call_declined') {
          if (listeners["call-ended"]) {
            listeners["call-ended"].forEach(cb => cb());
          }
        } else if (type === 'call_unavailable') {
          if (listeners["call-error"]) {
            listeners["call-error"].forEach(cb => cb({ message: "User is offline or unavailable." }));
          }
        }
      } catch (e) {
        console.warn("[ChatApp] Parse signaling message failed:", e);
      }
    };

    ws.onclose = () => {
      console.log("[ChatApp] Call Signaling connection closed.");
    };

    socketRef.current = {
      on: (event, callback) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      },
      emit: (event, payload) => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("[ChatApp] Call signaling socket not open, event ignored:", event);
          return;
        }
        
        if (event === 'register-user') {
          // Handled on open
        } else if (event === 'call-user') {
          ws.send(JSON.stringify({
            type: 'call_user',
            data: {
              targetEmail: payload.userToCall,
              callerName: payload.name,
              offer: payload.signalData
            }
          }));
        } else if (event === 'answer-call') {
          ws.send(JSON.stringify({
            type: 'call_answer',
            data: {
              targetEmail: payload.to,
              answer: payload.signal
            }
          }));
        } else if (event === 'end-call') {
          ws.send(JSON.stringify({
            type: 'call_ended',
            data: {
              targetEmail: payload.to
            }
          }));
        }
      },
      disconnect: () => {
        try {
          ws.close();
        } catch (e) {}
      }
    };

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
      setChannels(prev => prev.map(ch => {
        if (ch._id === message.channelId) {
          const isSelected = selectedIdRef.current === message.channelId;
          if (isSelected) {
            const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
            readTimestamps[ch._id] = new Date().toISOString();
            localStorage.setItem('chat_read_timestamps', JSON.stringify(readTimestamps));
          }
          return { 
            ...ch, 
            lastMessage: message.timestamp, 
            lastMessageContent: message.content,
            hasMessages: true,
            unreadCount: isSelected ? 0 : (ch.unreadCount || 0) + 1
          };
        }
        return ch;
      }));
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

    // Listen to global events via the window event bus instead of establishing a duplicate WebSocket
    const handleWsMessage = (event) => {
      try {
        const data = event.detail;
        if (!data) return;

        if (data.type === 'presence-update') {
          const onlineEmails = data.onlineEmails || [];
          setChannels(prev => prev.map(ch => {
            if (['dm', 'direct'].includes(ch.type)) {
              // Determine if any other member in this DM is online
              const otherMembers = ch.members.filter(m => m !== email);
              const isOnline = otherMembers.some(m => onlineEmails.includes(m));
              return { ...ch, isOnline };
            }
            return ch;
          }));
          
          setSelected(prev => {
            if (['dm', 'direct'].includes(prev?.type)) {
              const otherMembers = prev.members.filter(m => m !== email);
              const isOnline = otherMembers.some(m => onlineEmails.includes(m));
              return { ...prev, isOnline };
            }
            return prev;
          });

          // Update members online status
          setMembers(prev => prev.map(m => ({
            ...m,
            isOnline: onlineEmails.includes(m.email)
          })));
        } else if (data.type === 'new-channel') {
          fetchChannels();
        } else if (data.type === 'NEW_MESSAGE') {
          const message = data.message;
          if (selectedIdRef.current === message.conversationId || selectedIdRef.current === message.channelId) {
            setMessages(prev => {
              if (prev.some(m => m._id === message._id)) return prev;
              return [...prev, {
                _id: message._id,
                conversationId: message.conversationId,
                sender: message.senderEmail === email ? 'You' : message.senderName,
                senderName: message.senderName,
                senderEmail: message.senderEmail,
                content: message.content,
                fileUrl: message.fileUrl,
                fileType: message.fileType,
                originalName: message.originalName,
                timestamp: message.timestamp
              }];
            });
          }

          setChannels(prev => prev.map(ch => {
            if (ch._id === message.conversationId || ch._id === message.channelId) {
              const isSelected = selectedIdRef.current === ch._id;
              return {
                ...ch,
                lastMessage: message.timestamp,
                lastMessageContent: message.content || `Sent a file: ${message.originalName || 'Attachment'}`,
                hasMessages: true,
                unreadCount: isSelected ? 0 : (ch.unreadCount || 0) + 1
              };
            }
            return ch;
          }));
        } else if (data.type === 'group-deleted') {
          setChannels(prev => prev.filter(c => c._id !== data.payload.groupId));
          setSelected(prev => prev?._id === data.payload.groupId ? null : prev);
        } else if (data.type === 'meeting-update') {
          setMeetingUpdateTrigger(prev => prev + 1);
        }
      } catch (e) {
        console.error('[ChatApp] Event bus message processing error:', e);
      }
    };

    window.addEventListener('ws-message', handleWsMessage);

    return () => {
      window.removeEventListener('ws-message', handleWsMessage);
      if (socketRef.current) {
        if (socketRef.current.disconnect) socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (selected) {
      socketRef.current.emit("join chat", selected._id);
      fetchMessages(selected._id);
    }
  }, [selected?._id]);

  const handleLogout = async () => {
    try {
      const { unregisterWebPush } = await import('../utils/webPushHelper');
      await unregisterWebPush();
    } catch (e) {
      console.warn('[ChatApp] Push unregistration failed:', e);
    }
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };



  const sendMessage = async (e, fileData = null) => {
    if (e) e.preventDefault();
    const plainText = stripHtml(input);
    if (!plainText && !fileData || !selected) return;
    
    const msgContent = fileData ? `Sent a file: ${fileData.originalName}` : input.trim();
    const msgData = {
      content: msgContent,
      fileUrl: fileData?.url,
      fileType: fileData?.type,
      originalName: fileData?.originalName
    };
    
    try {
      const res = await fetch(getApiUrl(`/api/chat/${workspaceId}/${selected._id}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(msgData)
      });
      const newMessage = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, newMessage]);
        setChannels(prev => prev.map(ch => 
          ch._id === selected._id ? { 
            ...ch, 
            lastMessage: newMessage.timestamp, 
            lastMessageContent: newMessage.content,
            hasMessages: true 
          } : ch
        ));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          members: [currentUserEmail, targetUser.email || targetUser.mobile],
          createdBy: currentUserEmail
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Build the formatted channel directly to avoid fetch timing/caching issues
        const targetEmail = targetUser.email || targetUser.mobile;
        const targetName = targetUser.name || targetUser.displayName || targetEmail;
        
        const formattedChannel = {
          _id: data._id,
          type: 'direct',
          displayName: targetName,
          name: targetName,
          email: targetEmail,
          avatar: targetUser.avatarUrl || targetUser.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetName}`,
          role: targetUser.role || 'Member',
          workspaceId: data.workspaceId || workspaceId,
          isOnline: true,
          unreadCount: 0,
          hasMessages: true,
          lastMessageContent: data.lastMessageContent || 'Start a secure Kural conversation',
          lastMessageTime: data.lastMessageTime || data.updatedAt || new Date().toISOString(),
          members: data.participantEmails || [currentUserEmail, targetEmail]
        };

        // Add to channels list if not already there
        setChannels(prev => {
          if (!prev.find(ch => ch._id === formattedChannel._id)) {
            return [formattedChannel, ...prev];
          }
          // If already exists, ensure it is marked as having messages so it displays
          return prev.map(ch => ch._id === formattedChannel._id ? { ...ch, hasMessages: true } : ch);
        });

        setSelected(formattedChannel);
        const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
        readTimestamps[formattedChannel._id] = new Date().toISOString();
        localStorage.setItem('chat_read_timestamps', JSON.stringify(readTimestamps));
        setChannels(prev => prev.map(c => c._id === formattedChannel._id ? { ...c, unreadCount: 0 } : c));
        setIsFindingFriends(false);
        setSearchQuery('');
        setActiveTab('messenger');
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleSelectChannel = (ch) => {
    setSelected(ch);
    const readTimestamps = JSON.parse(localStorage.getItem('chat_read_timestamps') || '{}');
    readTimestamps[ch._id] = new Date().toISOString();
    localStorage.setItem('chat_read_timestamps', JSON.stringify(readTimestamps));
    // Clear unread count locally when opened
    setChannels(prev => prev.map(c => c._id === ch._id ? { ...c, unreadCount: 0 } : c));
  };

  const deleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Are you sure you want to permanently delete the chat/group "${groupName}" and all its messages?`)) {
      return;
    }
    try {
      const res = await fetch(getApiUrl(`/api/chat/groups/${groupId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        setChannels(prev => prev.filter(c => c._id !== groupId));
        if (selected?._id === groupId) {
          setSelected(null);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete group');
      }
    } catch (err) {
      console.error('Delete group error:', err);
      alert('An error occurred while deleting the group.');
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;
    try {
      const res = await fetch(getApiUrl('/api/chat/groups'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          workspaceId: workspaceId,
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

  const addMembersToGroup = async (channelId, newMemberEmails) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/chat/group/${channelId}/members`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ members: newMemberEmails })
      });
      if (!res.ok) throw new Error('Failed to add members');
      const updatedGroup = await res.json();
      setChannels(prev => prev.map(ch => ch._id === channelId ? { ...ch, members: updatedGroup.members } : ch));
    } catch (err) {
      console.error('Failed to add members:', err);
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
    if (!['dm', 'direct'].includes(channel.type)) return channel.name;
    const otherMemberEmail = channel.members.find(m => m !== currentUserEmail);
    const otherMember = members.find(m => m.email === otherMemberEmail);
    return otherMember ? otherMember.name : (channel.name || 'Direct Message');
  };

  const getUserPicture = (identifier, type = 'name') => {
    let member;
    if (identifier === 'You') {
      member = members.find(m => m.email === currentUserEmail);
    } else {
      member = members.find(m => m[type] === identifier);
    }
    
    if (member && member.profilePicture) return member.profilePicture;
    if (member && member.avatarUrl && !member.avatarUrl.includes('avataaars')) return member.avatarUrl;
    
    const seed = identifier === 'You' ? currentUserName : identifier;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
  };

  const getDMPicture = (channel) => {
    if (channel.displayPicture) return channel.displayPicture;
    if (!['dm', 'direct'].includes(channel.type)) return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(channel.name)}`;
    const otherMemberEmail = channel.members?.find(m => m !== currentUserEmail);
    const otherMember = members.find(m => m.email === otherMemberEmail);
    if (otherMember && otherMember.profilePicture) return otherMember.profilePicture;
    if (otherMember && otherMember.avatarUrl && !otherMember.avatarUrl.includes('avataaars')) return otherMember.avatarUrl;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(getDMName(channel))}`;
  };

  const otherUserEmail = ['dm', 'direct'].includes(selected?.type) ? selected.members?.find(m => m !== currentUserEmail) : null;

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
      const token = localStorage.getItem('token');
      fetch(getApiUrl('/api/chat/call-logs'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          calleeEmail: callTargetEmail,
          callerName: currentUserName,
          calleeName: callTargetName || callTargetEmail,
          callType: isVideoCall ? 'video' : 'voice',
          status: callAccepted ? 'answered' : 'missed',
          duration: callTime
        })
      }).then(() => fetchCallHistory()).catch(e => console.error("History save failed:", e));
    }
  };

  return (
    <AppLayout appName="Kural" appIcon={MessageSquare} appColor="#00A884">

      <div className="flex h-full w-full bg-[#f0f2f5] overflow-hidden font-sans selection:bg-[#25d366]/30">
        
        {/* MAIN WORKSPACE WRAPPER */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">


           <div className="flex-1 flex overflow-hidden">
              {/* Pane 2: Side Navigation Bar */}
              <div className="w-[260px] bg-[#EFF4FF] border-r border-[#C6C6CD] flex flex-col justify-between items-start p-2 z-10 shrink-0">
                 {/* Workspace Profile / Button */}
                 <div className="w-full pt-2 pb-4">
                    <div className="flex items-center gap-2 mb-4 px-2">
                       <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                          <img src={LogoImage} alt="Forge India Connect" className="w-full h-full object-contain" />
                       </div>
                       <div>
                          <h3 className="font-semibold text-[16px] text-[#0B1C30] leading-none tracking-tight">Forge India Connect</h3>
                          <p className="text-[11px] font-semibold text-[#45464D] tracking-wide mt-1">PRO PLAN</p>
                       </div>
                    </div>
                    <button onClick={() => setIsFindingFriends(true)} className="w-full bg-black hover:bg-neutral-800 text-white shadow-sm rounded-lg py-3 flex items-center justify-center gap-2 font-bold text-[14px] transition-all">
                       <Plus size={18} strokeWidth={3} /> New Message
                    </button>
                 </div>

                 {/* Navigation Items */}
                 <div className="flex-1 w-full overflow-y-auto px-2 space-y-6 custom-scrollbar pb-6">
                    <div className="space-y-1">
                       <button onClick={() => setActiveTab('home')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'home' ? 'bg-[#2170E4] text-white font-semibold' : 'text-[#0B1C30] hover:bg-black/5 font-medium'}`}>
                          <Home size={18} /> <span className="text-[14px] tracking-wide">Home</span>
                       </button>
                       <button onClick={() => setActiveTab('messenger')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'messenger' ? 'bg-[#2170E4] text-white font-semibold' : 'text-[#0B1C30] hover:bg-black/5 font-medium'}`}>
                          <MessageSquareText size={18} /> <span className="text-[14px] tracking-wide">Direct Messages</span>
                       </button>
                       <button onClick={() => setActiveTab('channels')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'channels' ? 'bg-[#2170E4] text-white font-semibold' : 'text-[#0B1C30] hover:bg-black/5 font-medium'}`}>
                          <Hash size={18} /> <span className="text-[14px] tracking-wide">Channels</span>
                       </button>
                       <button onClick={() => setActiveTab('apps')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'apps' ? 'bg-[#2170E4] text-white font-semibold' : 'text-[#0B1C30] hover:bg-black/5 font-medium'}`}>
                          <LayoutGrid size={18} /> <span className="text-[14px] tracking-wide">Apps</span>
                       </button>
                       <button onClick={() => setActiveTab('files')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === 'files' ? 'bg-[#2170E4] text-white font-semibold' : 'text-[#0B1C30] hover:bg-black/5 font-medium'}`}>
                          <FileText size={18} /> <span className="text-[14px] tracking-wide">Files</span>
                       </button>
                    </div>

                    {/* Channels List - Kept for functionality until Channels Tab is built */}
                    <div className="space-y-1">
                       <div className="px-2 text-[11px] font-bold text-[#76777D] tracking-wider uppercase mb-2">Channels</div>
                       {channels.filter(ch => ch.type === 'group').map(ch => {
                         const isSelected = selected?._id === ch._id;
                         return (
                             <button key={ch._id} onClick={() => setSelected(ch)} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-all group ${isSelected ? 'bg-blue-100 text-[#0B1C30] font-semibold' : 'text-[#45464D] hover:bg-black/5 font-medium'}`}>
                               <div className="flex items-center gap-2 truncate">
                                 <Hash size={16} className="shrink-0" />
                                 <span className="text-[12px] truncate">{ch.name}</span>
                               </div>
                               {(ch.createdBy === currentUserEmail || ch.createdByEmail === currentUserEmail) && (
                                 <Trash2 
                                   size={14} 
                                   className="text-gray-400 hover:text-red-500 transition-colors hidden group-hover:block shrink-0" 
                                   onClick={(e) => { e.stopPropagation(); deleteGroup(ch._id, ch.name); }} 
                                 />
                               )}
                             </button>
                         )
                       })}
                    </div>
                 </div>
                 {/* Sidebar Footer with Logout & Profile */}
                 <div className="w-full mt-auto">
                   <SidebarProfile />
                 </div>
              </div>

               {/* Pane 3: Main Content Canvas */}
               <div className="flex-1 bg-white flex flex-col relative z-0 overflow-hidden">
                  {/* Top Navigation Bar */}
                  <header className="flex justify-between items-center h-14 px-6 w-full shrink-0 border-b border-[#C6C6CD] bg-[#F8F9FF]">
                     <div className="flex items-center gap-6 h-full">
                        <h2 className="font-bold text-[22px] text-[#0B1C30]">WorkspacePro</h2>
                        <div className="hidden md:flex gap-6 items-center h-full ml-4">
                           <button onClick={() => setActiveTab('threads')} className={`text-[13px] font-bold transition-colors h-full border-b-[3px] ${activeTab === 'threads' ? 'text-[#2170E4] border-[#2170E4]' : 'text-[#45464D] border-transparent hover:text-[#0B1C30]'}`}>Threads</button>
                           <button onClick={() => setActiveTab('messenger')} className={`text-[13px] font-bold transition-colors h-full border-b-[3px] ${activeTab === 'messenger' ? 'text-[#2170E4] border-[#2170E4]' : 'text-[#45464D] border-transparent hover:text-[#0B1C30]'}`}>Direct Messages</button>
                           <button onClick={() => setActiveTab('activity')} className={`text-[13px] font-bold transition-colors h-full border-b-[3px] ${activeTab === 'activity' ? 'text-[#2170E4] border-[#2170E4]' : 'text-[#45464D] border-transparent hover:text-[#0B1C30]'}`}>Activity</button>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <button className="w-9 h-9 flex items-center justify-center hover:bg-black/5 rounded-full text-[#45464D] transition-colors"><HelpCircle size={20} /></button>
                        <button className="w-9 h-9 flex items-center justify-center hover:bg-black/5 rounded-full text-[#45464D] transition-colors"><Settings size={20} /></button>
                     </div>
                  </header>

                  <div className="flex flex-1 overflow-hidden">
                     {activeTab === 'threads' || activeTab === 'activity' ? (
                        <ThreadsTab workspaceId={workspaceId} currentUserEmail={currentUserEmail} currentUserName={currentUserName} activityMode={activeTab === 'activity'} onExitActivityMode={() => setActiveTab('threads')} />
) : activeTab === 'files' ? (
                        <FilesTab workspaceId={workspaceId} currentUserEmail={currentUserEmail} currentUserName={currentUserName} />
                     ) : activeTab === 'apps' ? (
                        <AppsTab workspaceId={workspaceId} />
                     ) : activeTab === 'home' ? (
                        <HomeTab
                          members={members.filter(m => m.email !== currentUserEmail)}
                          workspaceId={workspaceId}
                          onViewAllMembers={() => setIsFindingFriends(true)}
                          onStartChat={(user) => { startChat(user); setActiveTab('messenger'); }}
                          meetingUpdateTrigger={meetingUpdateTrigger}
                        />
                     ) : (
                        <>
                           {(activeTab === 'messenger' || activeTab === 'channels') && (
                              <section className="w-80 border-r border-[#C6C6CD] bg-white flex flex-col shrink-0 z-10">
                                 <div className="p-4 border-b border-[#C6C6CD]">
                                    <div className="relative">
                                       <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#76777D]" />
                                       <input className="w-full bg-[#EFF4FF] border-none rounded-lg pl-9 pr-4 py-2 text-[13px] focus:ring-2 focus:ring-[#2170E4]/20 outline-none text-[#0B1C30] placeholder-[#76777D] font-medium" placeholder="Jump to..." type="text" />
                                    </div>
                                 </div>
                                 <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {activeTab === 'channels' && (
                                       <div className="px-2 mb-2 pt-1">
                                          <button onClick={() => setIsCreatingGroup(true)} className="w-full bg-[#2170E4] hover:bg-[#1A5BB8] text-white py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center justify-center gap-2">
                                             <Plus size={16} /> Create Team
                                          </button>
                                       </div>
                                    )}
                                    {channels
                                      .filter(ch => activeTab === 'channels' ? (ch.type === 'group' || ch.isGroup) : (['dm', 'direct'].includes(ch.type) && ch.hasMessages))
                                      .sort((a, b) => new Date(b.lastMessage || 0) - new Date(a.lastMessage || 0))
                                      .map(ch => {
                                      const name = getDMName(ch);
                                      const isSelected = selected?._id === ch._id;
                                      return (
                                         <button key={ch._id} onClick={() => handleSelectChannel(ch)} className={`w-full flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors group ${isSelected ? 'bg-[#EFF4FF]' : 'hover:bg-black/5'}`}>
                                            <div className="relative shrink-0">
                                               <img alt={name} className="w-10 h-10 rounded-full object-cover border border-[#C6C6CD]" src={getDMPicture(ch)} />
                                               <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${ch.isOnline ? 'bg-[#4EDEA3]' : 'bg-[#C6C6CD]'}`}></span>
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                               <div className="flex justify-between items-center mb-0.5">
                                                  <span className={`text-[14px] truncate ${isSelected ? 'font-semibold text-[#0B1C30]' : 'font-medium text-[#45464D] group-hover:text-[#0B1C30]'}`}>{name}</span>
                                                  <div className="flex items-center gap-2">
                                                    {(ch.type === 'group' || ch.isGroup) && (ch.createdBy === currentUserEmail || ch.createdByEmail === currentUserEmail) && (
                                                      <Trash2 
                                                        size={14} 
                                                        className="text-gray-400 hover:text-red-500 transition-colors hidden group-hover:block" 
                                                        onClick={(e) => { e.stopPropagation(); deleteGroup(ch._id, name); }} 
                                                      />
                                                    )}
                                                    <span className="text-[10px] text-[#76777D] font-medium mt-0.5">
                                                       {ch.lastMessage ? formatTime(ch.lastMessage) : ''}
                                                    </span>
                                                  </div>
                                               </div>
                                               <p className="text-[12px] text-[#76777D] truncate font-medium">
                                                  {stripHtml(ch.lastMessageContent) || 'No messages yet'}
                                               </p>
                                            </div>
                                            {ch.unreadCount > 0 && <div className="w-[18px] h-[18px] rounded-full bg-[#2170E4] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{ch.unreadCount}</div>}
                                         </button>
                                      )
                                    })}
                                 </div>
                              </section>
                           )}

                           <section className="flex-1 flex flex-col bg-white relative z-0">
                              {selected ? (
                                <>
                                  {/* Chat Header */}
                                  <div className="h-16 px-6 border-b border-[#C6C6CD] flex items-center justify-between shrink-0 bg-white">
                                     <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setShowMemberInfo(true)}>
                                        <div className="relative">
                                           <img src={getDMPicture(selected)} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#C6C6CD]" />
                                           {['dm', 'direct'].includes(selected.type) && <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-[1.5px] border-white ${selected.isOnline ? 'bg-[#4EDEA3]' : 'bg-[#C6C6CD]'}`}></span>}
                                        </div>
                                        <div className="flex flex-col">
                                           <span className="font-semibold text-[#0B1C30] text-[16px] leading-tight group-hover:text-[#2170E4] transition-colors">{getDMName(selected)}</span>
                                           <span className="text-[12px] font-medium text-[#009668] mt-0.5 tracking-wide">
                                              {['dm', 'direct'].includes(selected.type) ? (selected.isOnline ? 'Active now' : (selected.lastSeen ? `Last seen ${formatLastSeen(selected.lastSeen)}` : 'Offline')) : 'Group Chat'}
                                           </span>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-4">
                                       {( (['dm', 'direct'].includes(selected.type)) || ((['group', 'channel'].includes(selected.type) || selected.isGroup) && (selected.createdBy === currentUserEmail || selected.createdByEmail === currentUserEmail)) ) && (
                                         <button
                                           onClick={() => deleteGroup(selected._id, selected.name || getDMName(selected))}
                                           className="text-[#76777D] hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                                           title={['dm', 'direct'].includes(selected.type) ? "Delete Chat" : "Delete Chat/Group"}
                                         >
                                           <Trash2 size={20} />
                                         </button>
                                       )}
                                     </div>
                                  </div>

                                  {/* Messages Area */}
                                  <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar relative bg-[#FFFFFF]">
                        {loading ? (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                             <Loader2 className="animate-spin text-blue-500" size={32} />
                          </div>
                        ) : (
                          <div className="flex flex-col space-y-6">
                            {messages.map((msg, i) => {
                              const isMe = msg.senderEmail === currentUserEmail;
                              const showDateDivider = i === 0 || new Date(msg.timestamp).getDate() !== new Date(messages[i-1].timestamp).getDate();
                              
                              return (
                                <React.Fragment key={msg._id || i}>
                                  {showDateDivider && (
                                    <div className="flex items-center justify-center py-2">
                                       <div className="h-px bg-[#C6C6CD] w-full max-w-[280px]"></div>
                                       <span className="px-4 text-[11px] font-bold text-[#76777D] tracking-widest uppercase">{new Date(msg.timestamp).toLocaleDateString()}</span>
                                       <div className="h-px bg-[#C6C6CD] w-full max-w-[280px]"></div>
                                    </div>
                                  )}
                                  <motion.div 
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-start gap-4 group w-full ${isMe ? 'flex-row-reverse' : ''}`}
                                  >
                                    <div className={`flex flex-col flex-1 min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                                       <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                          <span className="text-[11px] text-[#76777D] font-medium px-1">{formatTime(msg.timestamp)}</span>
                                       </div>
                                       <div className={`text-[14px] leading-[1.62] max-w-[800px] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-[#2170E4] text-white rounded-tr-sm [&_p]:!text-white' : 'bg-[#EFF4FF] text-[#0B1C30] rounded-tl-sm [&_p]:!text-[#0B1C30]'}`}>
                                          <div className="prose text-inherit" dangerouslySetInnerHTML={{ __html: msg.content }} />
                                          {msg.fileUrl && (
                                             <div className="mt-3 rounded-xl overflow-hidden border border-[#C6C6CD] inline-block">
                                               {msg.fileType?.startsWith('image/') ? (
                                                  <img src={msg.fileUrl} className="max-w-[400px] h-auto cursor-pointer" onClick={() => window.open(msg.fileUrl, '_blank')} />
                                               ) : (
                                                  <div className="p-4 bg-[#EFF4FF] flex items-center gap-3 w-64 cursor-pointer hover:bg-blue-50 transition-colors" onClick={() => window.open(msg.fileUrl, '_blank')}>
                                                     <div className="w-10 h-10 rounded bg-[#FFDAD6] flex items-center justify-center text-[#93000A]"><List size={20} /></div>
                                                     <div className="flex flex-col overflow-hidden">
                                                        <span className="text-[14px] font-semibold text-[#0B1C30] truncate">{msg.content.replace('Sent a file: ', '')}</span>
                                                        <span className="text-[12px] text-[#76777D] font-medium truncate">Document</span>
                                                     </div>
                                                  </div>
                                               )}
                                             </div>
                                          )}
                                          {msg.reactions?.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                              {msg.reactions.map(r => (
                                                <button key={r.emoji} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-[#C6C6CD] shadow-sm hover:bg-gray-50 text-[11px] font-bold text-[#0058BE]">
                                                  {r.emoji} {r.users.length}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                       </div>
                                    </div>
                                    
                                    {/* Hover Actions */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-[#C6C6CD] rounded-lg shadow-sm p-1 shrink-0 -mt-2">
                                       <button onClick={() => setShowReactionPicker(msg._id)} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-[#45464D]"><Smile size={14} /></button>
                                       <button onClick={() => openThread(msg)} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-[#45464D]"><MessageSquare size={14} /></button>
                                       <button className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-[#45464D]"><MoreHorizontal size={14} /></button>
                                       
                                       {showReactionPicker === msg._id && (
                                          <div className="absolute right-12 mt-8 bg-white shadow-xl border border-[#C6C6CD] rounded-xl p-2 flex gap-2 z-50">
                                             {['👍', '❤️', '😂', '🎉', '🚀', '🔥'].map(emoji => (
                                               <button key={emoji} onClick={() => toggleReaction(msg._id, emoji)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-lg text-lg transition-transform hover:scale-110">{emoji}</button>
                                             ))}
                                          </div>
                                       )}
                                    </div>
                                  </motion.div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                        <div ref={bottomRef} />
                     </div>
                         {/* Message Input Area */}
                     <div className="px-6 pb-6 bg-[#FFFFFF] z-30 shrink-0">
                        <div className="border border-[#C6C6CD] rounded-2xl bg-white focus-within:border-[#2170E4] focus-within:ring-1 focus-within:ring-[#2170E4] transition-all flex flex-col p-1 shadow-sm">
                           {/* Action Toolbar */}
                           <div className="px-3 py-2 flex items-center gap-2 border-b border-[#C6C6CD]/30">
                              <button onClick={() => fileInputRef.current.click()} className="p-1.5 hover:bg-black/5 rounded-md text-[#45464D]" title="Attach File"><Paperclip size={18} /></button>
                              <button className="p-1.5 hover:bg-black/5 rounded-md text-[#45464D]" title="Add Emoji"><Smile size={18} /></button>
                              <button className="p-1.5 hover:bg-black/5 rounded-md text-[#45464D]" title="Mention Someone"><AtSign size={18} /></button>
                           </div>

                           <div className="px-3 min-h-[40px] pt-1">
                              <RichInput
                                value={input}
                                onChange={setInput}
                                onSend={() => sendMessage()}
                                placeholder={`Message ${selected ? getDMName(selected) : '...'}`}
                              />
                           </div>
                           
                           <div className="flex items-center justify-end px-3 pb-2 pt-1">
                              <button
                                onClick={(input.trim() && input !== '<p></p>') ? () => sendMessage() : (isRecording ? stopRecording : startRecording)}
                                className={`px-4 py-1.5 rounded-lg shrink-0 flex items-center justify-center gap-2 transition-all font-semibold text-[13px] ${
                                  isRecording ? 'bg-rose-500 text-white animate-pulse' :
                                  ((input.trim() && input !== '<p></p>') ? 'bg-[#2170E4] text-white hover:bg-blue-700 shadow-sm' : 'bg-[#EFF4FF] text-[#2170E4]')
                                }`}
                              >
                                 Send {((input.trim() && input !== '<p></p>') || !isRecording) && <Send size={14} className="ml-1" />}
                              </button>
                           </div>
                        </div>
                        <div className="text-center mt-3">
                           <span className="text-[10px] text-[#C6C6CD] font-medium tracking-wide">Press Shift + Enter for a new line</span>
                        </div>
                     </div>
                   </>
                 ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-[#76777D] bg-[#FFFFFF] relative h-full">
                      <div className="w-20 h-20 rounded-2xl bg-[#EFF4FF] mb-6 flex items-center justify-center overflow-hidden shadow-sm border border-[#C6C6CD]">
                         <MessageSquare size={32} className="text-[#2170E4]" />
                      </div>
                      <h3 className="text-2xl font-bold text-[#0B1C30] tracking-tight">Direct Messages</h3>
                      <p className="text-[14px] text-[#45464D] mt-2 max-w-sm text-center font-medium">
                         Select a direct message from the list to start chatting with your team.
                      </p>
                      <button onClick={() => setIsFindingFriends(true)} className="mt-8 bg-[#2170E4] text-white px-6 py-2.5 rounded-lg font-semibold text-[14px] hover:bg-blue-700 transition-colors shadow-sm">
                         New Message
                      </button>
                   </div>
                 )}
               </section>
            </>
         )}
      </div>
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
                    <span className="text-[9px] text-[#2170E4] font-bold uppercase tracking-tight">{getDMName(selected)}</span>
                 </div>
                 <button onClick={() => setShowThread(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-50 hover:text-rose-500 transition-all"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                 {/* Parent Message */}
                 <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                       <div className="w-8 h-8 rounded-xl bg-gray-100 overflow-hidden">
                          <img src={getUserPicture(activeThread.sender)} />
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
                            <img src={getUserPicture(msg.sender)} />
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
                      className="w-8 h-8 rounded-xl bg-[#2170E4] text-white flex items-center justify-center shadow-lg shadow-blue-100 shrink-0"
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
                  <div className="w-32 h-32 rounded-[2.5rem] bg-[#EFF4FF] mx-auto mb-6 overflow-hidden border-4 border-white shadow-2xl relative">
                    <img 
                      src={getDMPicture(selected)} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute bottom-2.5 right-2.5 w-6 h-6 rounded-full bg-[#4EDEA3] border-4 border-white shadow-lg" />
                  </div>
                  <h3 className="font-black text-xl text-gray-900 leading-tight">{getDMName(selected)}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-3">Team Member • Forge India Connect</p>
                  
                  <div className="mt-10 grid grid-cols-2 gap-4 px-2">
                     <button className="py-3.5 bg-[#2170E4] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95">Message</button>
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
                            <span className="text-[11px] font-bold text-gray-800 truncate max-w-[140px]">{['dm', 'direct'].includes(selected.type) ? selected.members?.find(m => m !== currentUserEmail) : 'Team Channel'}</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Local Time</span>
                            <span className="text-[11px] font-bold text-gray-800">1:12 PM IST</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
                            <div className="flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full bg-[#4EDEA3] shadow-[0_0_8px_rgba(78,222,163,0.5)]" />
                               <span className="text-[11px] font-bold text-[#008950]">Available</span>
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
                           <div key={i} className="aspect-square bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden cursor-pointer hover:border-[#2170E4] transition-all">
                              <img src={`https://picsum.photos/seed/${i+10}/200`} className="w-full h-full object-cover opacity-80 hover:opacity-100" />
                           </div>
                         ))}
                      </div>
                      <button className="w-full py-3 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-[#EFF4FF] hover:text-[#2170E4] transition-all">See all attachments</button>
                   </div>

                   <button className="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 mt-10">
                     <ShieldCheck size={14} /> Block Teammate
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
           </div>
        </div>

        {/* Find Friends / Team Directory Modal */}
        {isFindingFriends && (() => {
          const displayUsers = searchQuery ? searchResults : members.filter(m => m.email !== currentUserEmail);
          return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1C30]/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-white shadow-2xl rounded-2xl overflow-hidden border border-[#C6C6CD]">
              <div className="p-8 pb-6 border-b border-[#C6C6CD]">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0B1C30] tracking-tight">Connect with Team</h2>
                    <p className="text-[12px] text-[#76777D] font-medium mt-1">WORKSPACE DIRECTORY</p>
                  </div>
                  <button onClick={() => setIsFindingFriends(false)} className="w-10 h-10 rounded-xl bg-[#F8F9FF] flex items-center justify-center text-[#76777D] hover:text-red-500 hover:bg-red-50 transition-all border border-[#C6C6CD]"><X size={20} /></button>
                </div>
                <div className="relative group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#76777D]"><Search size={20} /></div>
                   <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name or email..."
                    className="w-full bg-[#F8F9FF] border border-[#C6C6CD] focus:border-[#2170e4] focus:bg-white rounded-xl py-3 pl-12 pr-4 text-[14px] font-medium text-[#0B1C30] outline-none transition-all shadow-sm"
                  />
                </div>
              </div>
              <div className="p-8 pt-6 bg-[#F8F9FF]">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#76777D] mb-4">
                  {searching ? 'Querying database...' : searchQuery ? `${displayUsers.length} Teammates Found` : 'All Teammates'}
                </h3>
                <div className="max-h-[350px] overflow-y-auto space-y-2 mb-2 custom-scrollbar pr-2">
                  {displayUsers.length > 0 ? (
                    displayUsers.map(user => (
                      <button 
                        key={user._id || user.email}
                        onClick={() => startChat(user)}
                        className="w-full flex items-center justify-between p-4 rounded-xl transition-all hover:bg-[#dce9ff] group border border-[#C6C6CD] bg-white mb-2 shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#2170e4] text-white flex items-center justify-center font-bold shadow-sm">
                            {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="text-left flex flex-col">
                             <span className="text-[15px] font-semibold text-[#0B1C30]">{user.name || user.email}</span>
                             <span className="text-[12px] text-[#76777D] font-medium">{user.email}</span>
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#F8F9FF] flex items-center justify-center text-[#2170e4] opacity-0 group-hover:opacity-100 transition-all border border-[#C6C6CD]">
                           <ArrowRight size={18} strokeWidth={2.5} />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-16 text-center flex flex-col items-center">
                       <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#C6C6CD] mb-4 border border-[#C6C6CD] shadow-sm">
                         <Search size={28} />
                       </div>
                       <p className="text-[13px] text-[#76777D] font-medium">No team members found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Create Group Modal */}
                {isAddingMembers && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/10 backdrop-blur-md">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border border-white p-2">
              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Add to Team</h2>
                  <button onClick={() => setIsAddingMembers(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all"><X size={18} /></button>
                </div>
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-4">Select Team Members</div>
                  <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {members.filter(m => m.email !== currentUserEmail && !selected.members?.includes(m.email)).map(member => {
                      const isSelected = selectedNewMembers.includes(member.email);
                      return (
                        <div key={member._id} onClick={() => setSelectedNewMembers(prev => isSelected ? prev.filter(e => e !== member.email) : [...prev, member.email])} className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-gray-50 border-transparent'} border`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[14px] transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-[#E34A56] text-white'}`}>
                            {member.name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-bold truncate text-[14px] ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>{member.name}</h4>
                            <p className="text-[12px] text-gray-400 truncate">{member.email}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-200'}`}>
                            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                    {members.filter(m => m.email !== currentUserEmail && !selected.members?.includes(m.email)).length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">All users are already in this group.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 pt-2">
                <button disabled={selectedNewMembers.length === 0} onClick={handleAddMembersSubmit} className="w-full bg-[#C1D4F9] text-white font-bold py-4 rounded-[1.5rem] hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-[#C1D4F9] disabled:hover:shadow-none">
                  Add Members
                </button>
              </div>
            </div>
          </div>
        )}

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
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2170E4]"><Hash size={18} /></div>
                    <input 
                      type="text" 
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="Group Name (e.g. Family, Project Team)"
                      className="w-full bg-gray-50 border-none focus:ring-2 focus:ring-[#2170E4] rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-gray-900 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6 px-2">Select Friends</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 mb-8 custom-scrollbar pr-2">
                  {channels.filter(ch => ['dm', 'direct'].includes(ch.type)).map(dm => {
                    const friendMobile = dm.members.find(m => m !== currentUserEmail);
                    const isSelected = selectedGroupMembers.includes(friendMobile);
                    return (
                      <button 
                        key={dm._id}
                        onClick={() => setSelectedGroupMembers(prev => isSelected ? prev.filter(m => m !== friendMobile) : [...prev, friendMobile])}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${isSelected ? 'bg-[#EFF4FF] border border-[#2170E4]' : 'hover:bg-gray-50 border border-transparent'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50">
                            <img src={getDMPicture(dm)} alt={dm.displayName} />
                          </div>
                          <div className="text-left">
                             <div className="text-xs font-bold text-gray-900">{dm.displayName}</div>
                             <div className="text-[9px] text-gray-400 font-bold">@{dm.displayUsername}</div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#2170E4] border-[#2170E4]' : 'border-gray-200'}`}>
                           {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                        </div>
                      </button>
                    );
                  })}
                  {channels.filter(ch => ['dm', 'direct'].includes(ch.type)).length === 0 && (
                    <p className="text-center py-4 text-xs text-gray-400 font-medium">Find some friends first to start a group!</p>
                  )}
                </div>
                <button 
                  onClick={createGroup}
                  disabled={!groupName.trim() || selectedGroupMembers.length === 0}
                  className="w-full py-4 bg-[#2170E4] text-white rounded-3xl font-black text-sm shadow-xl shadow-blue-100 disabled:opacity-20 disabled:shadow-none transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-95"
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
                      <img src={getUserPicture(callTargetName)} className="w-full h-full object-cover" />
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
