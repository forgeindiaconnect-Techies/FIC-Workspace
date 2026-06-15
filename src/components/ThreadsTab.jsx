import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Send, MoreHorizontal, MessageSquarePlus, Image as ImageIcon, Smile, BarChart2, Video, FileText, X, Trash2, Pin, Flag, Loader2, Sparkles, Download } from 'lucide-react';
import { getApiUrl } from '../api';

const getWsUrl = (path) => {
  const base = getApiUrl('/');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase.replace(/\/$/, '')}${path}`;
};

const MentionTextarea = ({ value, onChange, onSubmit, placeholder, members, className, minRows = 3 }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

    if (mentionMatch) {
      setShowDropdown(true);
      setMentionQuery(mentionMatch[1] || '');
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  const filteredMembers = members.filter(m => m.name.toLowerCase().replace(/\s+/g, '').includes(mentionQuery.toLowerCase())).slice(0, 5);

  const handleKeyDown = (e) => {
    if (showDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectUser(filteredMembers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const selectUser = (user) => {
    if (!user) return;
    const cursor = textareaRef.current.selectionStart;
    const textBeforeCursor = value.slice(0, cursor);
    const textAfterCursor = value.slice(cursor);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

    if (mentionMatch) {
      const matchLength = mentionMatch[0].length;
      const prefix = mentionMatch[0].startsWith(' ') ? ' @' : '@';
      const formattedName = user.name.replace(/\s+/g, '');
      const newValue = textBeforeCursor.slice(0, -matchLength) + prefix + formattedName + ' ' + textAfterCursor;
      onChange(newValue);
    }
    setShowDropdown(false);
    textareaRef.current.focus();
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        className={`w-full bg-transparent border-none resize-none text-[15px] text-[#0B1C30] outline-none placeholder:text-[#8D8E94] ${className}`}
        rows={minRows}
        placeholder={placeholder}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && filteredMembers.length > 0 && (
        <div className="absolute z-10 bottom-full left-0 mb-1 w-64 bg-white rounded-xl shadow-lg border border-[#E5E7EB] overflow-hidden">
          {filteredMembers.map((member, idx) => (
            <div
              key={member._id}
              onClick={() => selectUser(member)}
              className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-[#F0F4FF]' : 'hover:bg-[#F8F9FF]'}`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2170E4] to-[#4EDEA3] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-[#0B1C30]">{member.name}</span>
                <span className="text-[12px] text-[#8D8E94]">@{member.name.replace(/\s+/g, '').toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ThreadsTab = ({ workspaceId, currentUserEmail, currentUserName, activityMode, onExitActivityMode }) => {
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [visibility, setVisibility] = useState('everyone');
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCompanyName, setAiCompanyName] = useState('WorkspacePro');
  const [aiCompanyLogo, setAiCompanyLogo] = useState('https://via.placeholder.com/150x50/2170E4/FFFFFF?text=Logo');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [useRealisticPhotos, setUseRealisticPhotos] = useState(false);
  
  const fileInputRef = useRef(null);
  const aiLogoInputRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (workspaceId) {
      fetchThreads();
      fetchMembers();
      connectSocket();
    }
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [workspaceId]);

  useEffect(() => {
    if (activityMode) {
      const me = members.find(m => m.email === currentUserEmail) || { email: currentUserEmail, name: currentUserName };
      setSelectedUser(me);
    }
  }, [activityMode, members, currentUserEmail, currentUserName]);

  const connectSocket = () => {
    if (socketRef.current) socketRef.current.close();
    const token = localStorage.getItem('token');
    const ws = new WebSocket(getWsUrl(`/ws/threads?workspaceId=${workspaceId}&token=${token}`));
    
    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        handleSocketEvent(type, payload);
      } catch (e) {
        console.error('Socket message parse error', e);
      }
    };
    
    ws.onerror = (e) => console.error('Threads socket error', e);
    socketRef.current = ws;
  };

  const handleSocketEvent = useCallback((type, payload) => {
    setPosts(currentPosts => {
      let newPosts = [...currentPosts];
      
      switch (type) {
        case 'NEW_POST':
          if (!newPosts.find(p => p._id === payload._id)) {
            newPosts.unshift({ ...payload, comments: [] });
          }
          break;
        case 'POST_LIKED':
          newPosts = newPosts.map(p => p._id === payload.postId ? { ...p, likes: payload.likes } : p);
          break;
        case 'POST_DELETED':
          newPosts = newPosts.filter(p => p._id !== payload.postId);
          break;
        case 'NEW_COMMENT':
          newPosts = newPosts.map(p => {
            if (p._id === payload.postId) {
              const comments = p.comments || [];
              if (!comments.find(c => c._id === payload._id)) {
                return { ...p, comments: [...comments, payload] };
              }
            }
            return p;
          });
          break;
        case 'COMMENT_LIKED':
          newPosts = newPosts.map(p => {
            if (p._id === payload.postId) {
              const comments = (p.comments || []).map(c => c._id === payload.commentId ? { ...c, likes: payload.likes } : c);
              return { ...p, comments };
            }
            return p;
          });
          break;
        case 'COMMENT_DELETED':
          newPosts = newPosts.map(p => {
            if (p._id === payload.postId) {
              const comments = (p.comments || []).filter(c => c._id !== payload.commentId && c.parentCommentId !== payload.commentId);
              return { ...p, comments };
            }
            return p;
          });
          break;
      }
      return newPosts;
    });
  }, []);

  const fetchThreads = async () => {
    setIsLoadingFeed(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/threads/${workspaceId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/members/${workspaceId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setMembers(await res.json());
    } catch (err) {}
  };

  const handleUserClick = (email, name) => {
    const member = members.find(m => m.email === email);
    setSelectedUser(member || { email, name });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch(getApiUrl('/api/threads/upload'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          setMediaAttachments(prev => [...prev, data]);
        }
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAILogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(getApiUrl('/api/threads/upload'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) setAiCompanyLogo(data.url);
      }
    } catch (err) {
      console.error('Logo upload failed', err);
    } finally {
      setIsUploadingLogo(false);
      if (aiLogoInputRef.current) aiLogoInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    setMediaAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && mediaAttachments.length === 0) || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/threads/create'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          workspaceId, 
          content: newPostContent,
          mediaUrls: mediaAttachments,
          visibility 
        })
      });
      
      if (res.ok) {
        setNewPostContent('');
        setMediaAttachments([]);
        setVisibility('everyone');
        setGeneratedPoster(null);
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateAIPoster = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAI(true);
    setGeneratedPoster(null);
    
    try {
      const apiKey = 'AIzaSyA3nfLFZhoElBN7i4Vtt8ah0x0odFDW1vg'; // Provided key
      const prompt = `You are a professional corporate graphic designer. Generate a visually stunning and modern SVG poster/ad.
The poster must look "Professional Corporate".
${useRealisticPhotos 
  ? 'CRITICAL: You MUST use the <image> tag to embed realistic photographs of people using this exact URL format: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=800". DO NOT use SVG paths to draw humans.' 
  : 'Feature animated/illustrated persons/images (using SVG paths or embedded shapes).'}
It MUST contain the company name "${aiCompanyName}" and prominently display the company logo image using this URL: "${aiCompanyLogo}".
The topic/content of the poster is: "${aiPrompt}".
Use a beautiful, vibrant color palette. Ensure text is readable. Make it standard poster size (e.g., 800x1200 or 1200x630).
CRITICAL XML RULES: All ampersands (&) in URLs MUST be escaped as &amp;. If using preserveAspectRatio, use a valid value like "xMidYMid slice" (with a space).
RETURN ONLY THE RAW SVG CODE. Do not include markdown code blocks (\`\`\`), just the raw <svg>...</svg>.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });
      
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        let svgCode = data.candidates[0].content.parts[0].text.trim();
        if (svgCode.startsWith('\`\`\`xml')) svgCode = svgCode.replace(/^\`\`\`xml/, '').replace(/\`\`\`$/, '');
        if (svgCode.startsWith('\`\`\`svg')) svgCode = svgCode.replace(/^\`\`\`svg/, '').replace(/\`\`\`$/, '');
        if (svgCode.startsWith('\`\`\`html')) svgCode = svgCode.replace(/^\`\`\`html/, '').replace(/\`\`\`$/, '');
        if (svgCode.startsWith('\`\`\`')) svgCode = svgCode.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '');
        setGeneratedPoster(svgCode.trim());
      }
    } catch (error) {
      console.error('Failed to generate AI poster:', error);
      alert('Failed to generate poster. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAttachGeneratedPoster = () => {
    if (!generatedPoster) return;
    
    // Clean up unescaped ampersands to prevent XML parsing errors in downloaded SVG
    let cleanedSvg = generatedPoster.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[a-fA-F0-9]+;)/g, '&amp;');
    // Fix common AI hallucination for preserveAspectRatio
    cleanedSvg = cleanedSvg.replace(/preserveAspectRatio="([^"\s]+)(meet|slice)"/gi, 'preserveAspectRatio="$1 $2"');
    
    // Convert SVG string to Base64 data URL
    const svgBase64 = btoa(unescape(encodeURIComponent(cleanedSvg)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
    
    setMediaAttachments(prev => [...prev, {
      type: 'image',
      url: dataUrl,
      name: 'AI_Generated_Poster.svg'
    }]);
    setShowAIModal(false);
    setGeneratedPoster(null);
  };

  const handleToggleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl(`/api/threads/${postId}/like`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this post?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl(`/api/threads/${postId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {}
  };

  const handlePostComment = async (postId, parentCommentId = null) => {
    const inputKey = parentCommentId ? `${postId}-${parentCommentId}` : postId;
    const content = commentInputs[inputKey];
    if (!content?.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/threads/${postId}/comment`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ content, parentCommentId })
      });

      if (res.ok) {
        setCommentInputs({ ...commentInputs, [inputKey]: '' });
        setExpandedComments({ ...expandedComments, [postId]: true });
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl(`/api/threads/comment/${commentId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {}
  };

  const handleToggleCommentLike = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl(`/api/threads/comment/${commentId}/like`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {}
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderWithMentions = (text) => {
    const mentionRegex = /(@\w+)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.match(mentionRegex)) {
        return <span key={index} className="text-[#2170E4] font-semibold hover:underline cursor-pointer">{part}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderImageOrSVG = (url, className) => {
    if (url && url.startsWith('data:image/svg+xml;base64,')) {
      try {
        const svgContent = decodeURIComponent(escape(atob(url.split(',')[1])));
        return (
          <div 
            className={`flex justify-center items-center overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain ${className}`}
            dangerouslySetInnerHTML={{ __html: svgContent }} 
          />
        );
      } catch (e) {
        return <img src={url} alt="attachment" className={className} />;
      }
    }
    return <img src={url} alt="attachment" className={className} />;
  };

  const renderMediaPreview = (media) => {
    return (
      <div className="flex gap-2 mt-3 flex-wrap">
        {media.map((item, idx) => (
          <div key={idx} className="relative rounded-xl overflow-hidden border border-[#E5E7EB] bg-gray-50 group">
            {item.type === 'image' && renderImageOrSVG(item.url, "h-32 w-auto object-contain rounded-xl bg-black/5")}
            {item.type === 'video' && <video src={item.url} className="h-32 object-cover bg-black" controls />}
            {item.type === 'document' && (
              <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-4 h-32 w-32 bg-[#F8F9FF] hover:bg-[#F0F4FF]">
                <FileText size={32} className="text-[#2170E4]" />
                <span className="text-xs truncate">{item.name}</span>
              </a>
            )}
            <button 
              onClick={() => removeAttachment(idx)}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Helper to render nested comments
  const renderComments = (post, parentId = null, level = 0) => {
    const comments = (post.comments || []).filter(c => (c.parentCommentId || null) === parentId);
    if (!comments.length) return null;

    return comments.map(comment => {
      const hasLiked = comment.likes?.includes(currentUserEmail);
      const isAuthor = comment.authorEmail === currentUserEmail;

      return (
        <div key={comment._id} className={`flex flex-col gap-2 ${level > 0 ? 'ml-10 mt-3 relative before:absolute before:-left-6 before:top-4 before:w-4 before:h-px before:bg-[#E5E7EB] before:border-l' : 'mt-4'}`}>
          <div className="flex gap-3">
            <div onClick={() => handleUserClick(comment.authorEmail, comment.authorName)} className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#CBD5E1] to-[#94A3B8] text-white flex items-center justify-center font-bold text-[11px] shrink-0 cursor-pointer hover:opacity-90 overflow-hidden">
              {members.find(m => m.email === comment.authorEmail)?.avatarUrl ? (
                <img src={members.find(m => m.email === comment.authorEmail).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : getInitials(comment.authorName)}
            </div>
            <div className="flex-1">
              <div className="bg-[#F8F9FF] px-4 py-3 rounded-2xl rounded-tl-none border border-[#E5E7EB]/50 group/comment">
                <div className="flex justify-between items-start">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span onClick={() => handleUserClick(comment.authorEmail, comment.authorName)} className="font-bold text-[14px] text-[#0B1C30] hover:underline cursor-pointer">{comment.authorName}</span>
                    <span className="text-[12px] text-[#8D8E94]">{formatTime(comment.createdAt)}</span>
                  </div>
                  {isAuthor && (
                    <button onClick={() => handleDeleteComment(comment._id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-[14px] text-[#45464D]">{renderWithMentions(comment.content)}</p>
              </div>
              
              <div className="flex items-center gap-4 mt-1 ml-2 text-[12px] font-semibold text-[#8D8E94]">
                <button onClick={() => handleToggleCommentLike(comment._id)} className={`hover:text-[#FF4A6B] transition-colors ${hasLiked ? 'text-[#FF4A6B]' : ''}`}>
                  {hasLiked ? 'Liked' : 'Like'} {comment.likes?.length > 0 && `(${comment.likes.length})`}
                </button>
                {level < 1 && ( // Only allow 1 level of nested replies visually
                  <button onClick={() => setExpandedComments(prev => ({...prev, [`reply-${comment._id}`]: !prev[`reply-${comment._id}`]}))} className="hover:text-[#2170E4] transition-colors">
                    Reply
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reply Input */}
          {expandedComments[`reply-${comment._id}`] && (
            <div className="flex gap-3 items-start mt-2 ml-10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#2170E4] to-[#4EDEA3] text-white flex items-center justify-center font-bold text-[9px] shrink-0 mt-1 overflow-hidden">
                {members.find(m => m.email === currentUserEmail)?.avatarUrl ? (
                  <img src={members.find(m => m.email === currentUserEmail).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : getInitials(currentUserName)}
              </div>
              <div className="flex-1 bg-white rounded-xl border border-[#E5E7EB] focus-within:border-[#2170E4]/30 transition-colors flex items-end pb-1 pr-1">
                <MentionTextarea 
                  value={commentInputs[`${post._id}-${comment._id}`] || ''}
                  onChange={(val) => setCommentInputs({ ...commentInputs, [`${post._id}-${comment._id}`]: val })}
                  onSubmit={() => {
                    handlePostComment(post._id, comment._id);
                    setExpandedComments(prev => ({...prev, [`reply-${comment._id}`]: false}));
                  }}
                  members={members}
                  placeholder="Write a reply..."
                  className="px-3 py-2 min-h-[36px] text-[13px]"
                  minRows={1}
                />
                <button 
                  onClick={() => {
                    handlePostComment(post._id, comment._id);
                    setExpandedComments(prev => ({...prev, [`reply-${comment._id}`]: false}));
                  }}
                  disabled={!(commentInputs[`${post._id}-${comment._id}`]?.trim())}
                  className="mb-1 mr-1 p-1.5 bg-[#2170E4] hover:bg-[#1A5BB8] disabled:bg-gray-300 disabled:opacity-50 text-white rounded-full transition-colors flex shrink-0"
                >
                  <Send size={14} className="ml-0.5" />
                </button>
              </div>
            </div>
          )}

          {/* Recursive Replies */}
          {renderComments(post, comment._id, level + 1)}
        </div>
      );
    });
  };

  const displayedPosts = selectedUser ? posts.filter(p => p.authorEmail === selectedUser.email) : posts;

  return (
    <div className="flex-1 bg-[#F5F7FB] flex flex-col items-center overflow-y-auto custom-scrollbar pt-4 pb-20">
      <div className="w-full max-w-[680px] px-4 flex flex-col gap-6">
        
        {selectedUser ? (
          <div className="w-full h-32 rounded-3xl bg-gradient-to-r from-[#2170E4] to-[#4EDEA3] p-6 flex items-end relative overflow-hidden shadow-sm mt-2">
            <div className="absolute inset-0 bg-black/10"></div>
            <button onClick={() => {
              setSelectedUser(null);
              if (activityMode && onExitActivityMode) onExitActivityMode();
            }} className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
              <X size={20} />
            </button>
            <div className="relative z-10 flex items-center gap-4 w-full">
              <div className="w-20 h-20 rounded-full border-4 border-white/20 bg-white text-[#2170E4] flex items-center justify-center font-bold text-[28px] shrink-0 shadow-lg overflow-hidden">
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : getInitials(selectedUser.name)}
              </div>
              <div className="pb-1">
                <h1 className="text-white text-2xl font-bold">{selectedUser.name}</h1>
                <p className="text-white/80 text-[14px]">{selectedUser.email}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="w-full h-32 rounded-3xl bg-gradient-to-r from-[#2170E4] to-[#4EDEA3] p-6 flex items-end relative overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative z-10 flex justify-between items-end w-full">
                <div>
                  <h1 className="text-white text-2xl font-bold">Company Wall</h1>
                  <p className="text-white/80 text-[14px]">Announcements, updates, and celebrations.</p>
                </div>
              </div>
            </div>

            {/* Compose Box */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#E5E7EB] p-5">
              <div className="flex gap-4">
                 <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#2170E4] to-[#4EDEA3] text-white flex items-center justify-center font-bold text-[16px] shrink-0 shadow-sm overflow-hidden">
                    {members.find(m => m.email === currentUserEmail)?.avatarUrl ? (
                      <img src={members.find(m => m.email === currentUserEmail).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : getInitials(currentUserName)}
                 </div>
             <div className="flex-1 flex flex-col">
                <MentionTextarea 
                  value={newPostContent}
                  onChange={setNewPostContent}
                  onSubmit={handleCreatePost}
                  members={members}
                  placeholder="What's happening in your workspace?"
                  className="mt-2 text-[16px]"
                />
                {mediaAttachments.length > 0 && renderMediaPreview(mediaAttachments)}
             </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-[#F0F1F5] flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 text-[#8D8E94]">
              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*,.pdf,.doc,.docx" />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-[#F0F4FF] hover:text-[#2170E4] rounded-full transition-colors flex items-center gap-1.5 tooltip-wrapper relative">
                {isSubmitting && mediaAttachments.length === 0 ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
              </button>
              <button className="p-2 hover:bg-[#F0F4FF] hover:text-[#2170E4] rounded-full transition-colors">
                <Smile size={20} />
              </button>
              <button onClick={() => setShowAIModal(true)} className="p-2 hover:bg-amber-50 hover:text-amber-500 text-amber-400 rounded-full transition-colors flex items-center gap-1.5 tooltip-wrapper relative" title="AI Poster Designer">
                <Sparkles size={20} />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                value={visibility} 
                onChange={(e) => setVisibility(e.target.value)}
                className="text-[13px] bg-gray-50 border border-gray-200 text-gray-700 rounded-full px-3 py-1.5 outline-none focus:border-[#2170E4]"
              >
                <option value="everyone">Everyone</option>
                <option value="team">My Team</option>
                <option value="selected">Selected Users</option>
              </select>
              <button 
                onClick={handleCreatePost}
                disabled={(!newPostContent.trim() && mediaAttachments.length === 0) || isSubmitting}
                className="bg-[#2170E4] hover:bg-[#1A5BB8] disabled:opacity-50 text-white px-6 py-2 rounded-full font-bold text-[15px] transition-all shadow-sm"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Post'}
              </button>
            </div>
              </div>
            </div>
          </>
        )}

        {/* Feed */}
        <div className="flex flex-col gap-5">
          {isLoadingFeed ? (
            // Skeleton Loaders
            [1,2,3].map(i => (
              <div key={i} className="bg-white rounded-3xl shadow-sm border border-[#E5E7EB] p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/6 mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))
          ) : displayedPosts.map(post => {
            const hasLiked = post.likes?.includes(currentUserEmail);
            const commentsCount = post.comments?.length || 0;
            const isCommentsExpanded = expandedComments[post._id];
            const isAuthor = post.authorEmail === currentUserEmail;

            return (
              <div key={post._id} className="bg-white rounded-3xl shadow-sm border border-[#E5E7EB] p-5 sm:p-6 transition-all hover:shadow-md group">
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div 
                    onClick={() => handleUserClick(post.authorEmail, post.authorName)}
                    className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#94A3B8] to-[#64748B] text-white flex items-center justify-center font-bold text-[16px] shrink-0 shadow-sm cursor-pointer hover:opacity-90 overflow-hidden"
                  >
                    {members.find(m => m.email === post.authorEmail)?.avatarUrl ? (
                      <img src={members.find(m => m.email === post.authorEmail).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : getInitials(post.authorName)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span onClick={() => handleUserClick(post.authorEmail, post.authorName)} className="font-bold text-[16px] text-[#0B1C30] hover:underline cursor-pointer">{post.authorName}</span>
                        <div className="flex items-center gap-2 text-[13px] text-[#8D8E94]">
                          <span>{formatTime(post.createdAt)}</span>
                          <span>•</span>
                          <span className="capitalize">{post.visibility}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAuthor && (
                          <button onClick={() => handleDeletePost(post._id)} className="text-[#8D8E94] hover:text-red-500 p-2 rounded-full hover:bg-red-50">
                            <Trash2 size={18} />
                          </button>
                        )}
                        <button className="text-[#8D8E94] hover:text-[#0B1C30] p-2 rounded-full hover:bg-[#F8F9FF]">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-[15px] text-[#33343C] whitespace-pre-wrap leading-relaxed mt-3">
                      {renderWithMentions(post.content)}
                    </p>

                    {/* Media Previews */}
                    {post.mediaUrls?.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
                        {post.mediaUrls.map((media, idx) => (
                          <div key={idx} className={`relative group ${post.mediaUrls.length === 1 ? 'col-span-2' : ''}`}>
                            {media.type === 'image' && (
                              <>
                                {renderImageOrSVG(media.url, "w-full h-auto object-contain rounded-xl border border-gray-100 bg-black/5 block")}
                                <a
                                  href={media.url}
                                  download={media.name || `attachment-${idx}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10 shadow-lg"
                                  title="Save Image"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download size={18} />
                                </a>
                              </>
                            )}
                            {media.type === 'video' && <video src={media.url} controls className="w-full h-auto bg-black rounded-xl block" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-8 mt-4 pt-2 border-t border-gray-50">
                      <button 
                        onClick={() => handleToggleLike(post._id)}
                        className={`flex items-center gap-2 text-[14px] font-semibold transition-colors group/btn ${hasLiked ? 'text-[#FF4A6B]' : 'text-[#8D8E94] hover:text-[#FF4A6B]'}`}
                      >
                        <div className={`p-2 rounded-full transition-colors ${hasLiked ? 'bg-[#FF4A6B]/10' : 'group-hover/btn:bg-[#FF4A6B]/10'}`}>
                          <Heart size={20} className={`transition-transform ${hasLiked ? "fill-current scale-110" : "group-hover/btn:scale-110"}`} /> 
                        </div>
                        <span>{post.likes?.length || 0}</span>
                      </button>

                      <button 
                        onClick={() => setExpandedComments({ ...expandedComments, [post._id]: !isCommentsExpanded })}
                        className="flex items-center gap-2 text-[14px] font-semibold text-[#8D8E94] hover:text-[#2170E4] transition-colors group/btn"
                      >
                         <div className="p-2 rounded-full transition-colors group-hover/btn:bg-[#2170E4]/10">
                          <MessageCircle size={20} className="transition-transform group-hover/btn:scale-110" /> 
                         </div>
                        <span>{commentsCount}</span>
                      </button>
                    </div>

                    {/* Comments Section */}
                    {(isCommentsExpanded || commentsCount > 0) && (
                      <div className="mt-2 flex flex-col">
                        {isCommentsExpanded && renderComments(post)}
                        
                        {/* Add Root Comment */}
                        <div className="flex gap-3 items-start mt-4 pt-4 border-t border-gray-100">
                           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#2170E4] to-[#4EDEA3] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-1 overflow-hidden">
                              {members.find(m => m.email === currentUserEmail)?.avatarUrl ? (
                                <img src={members.find(m => m.email === currentUserEmail).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                              ) : getInitials(currentUserName)}
                            </div>
                          <div className="flex-1 bg-[#F0F1F5] rounded-2xl border border-transparent focus-within:border-[#2170E4]/30 focus-within:bg-white transition-colors flex items-end pb-1 pr-1 shadow-inner">
                            <MentionTextarea 
                              value={commentInputs[post._id] || ''}
                              onChange={(val) => setCommentInputs({ ...commentInputs, [post._id]: val })}
                              onSubmit={() => handlePostComment(post._id)}
                              members={members}
                              placeholder="Write a comment..."
                              className="px-4 py-3 min-h-[44px]"
                              minRows={1}
                            />
                            <button 
                              onClick={() => handlePostComment(post._id)}
                              disabled={!(commentInputs[post._id]?.trim())}
                              className="mb-1 mr-1 p-2 bg-[#2170E4] hover:bg-[#1A5BB8] disabled:bg-gray-300 disabled:opacity-50 text-white rounded-full transition-colors flex shrink-0"
                            >
                              <Send size={16} className="ml-0.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })}
          
          {!isLoadingFeed && displayedPosts.length === 0 && (
            <div className="text-center p-16 bg-white rounded-3xl border border-[#E5E7EB] shadow-sm mt-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-[#F0F4FF] to-[#E5F0FF] rounded-full flex items-center justify-center mx-auto mb-6 text-[#2170E4] shadow-inner">
                <MessageSquarePlus size={36} />
              </div>
              <h3 className="text-[22px] font-bold text-[#0B1C30] mb-2">No updates yet</h3>
              <p className="text-[#8D8E94] text-[15px] max-w-sm mx-auto">Be the first to share an announcement, ask a question, or start a conversation with the team!</p>
            </div>
          )}
        </div>

      </div>

      {/* AI Poster Designer Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
              <h2 className="text-xl font-bold text-[#0B1C30] flex items-center gap-2">
                <Sparkles className="text-amber-500" size={24} /> AI Poster Designer
              </h2>
              <button onClick={() => setShowAIModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-white rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 custom-scrollbar">
              {!generatedPoster ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700">What is the poster about?</label>
                    <textarea 
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. A new product launch for our marketing tool..."
                      className="w-full border border-gray-200 rounded-xl p-4 text-[15px] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none h-32 bg-gray-50/50"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700">Company Name</label>
                      <input 
                        type="text" 
                        value={aiCompanyName}
                        onChange={(e) => setAiCompanyName(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-[14px] outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700">Logo URL</label>
                        <input type="file" ref={aiLogoInputRef} onChange={handleAILogoUpload} accept="image/*" className="hidden" />
                        <button onClick={() => aiLogoInputRef.current?.click()} disabled={isUploadingLogo} className="text-xs text-[#2170E4] hover:underline font-semibold flex items-center gap-1">
                          {isUploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Upload Image
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={aiCompanyLogo}
                        onChange={(e) => setAiCompanyLogo(e.target.value)}
                        placeholder="Paste URL or upload image"
                        className="w-full border border-gray-200 rounded-xl p-3 text-[14px] outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      type="checkbox" 
                      id="ai-realistic-photos"
                      checked={useRealisticPhotos}
                      onChange={(e) => setUseRealisticPhotos(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500"
                    />
                    <label htmlFor="ai-realistic-photos" className="text-[14px] text-gray-700 font-medium cursor-pointer">
                      Force AI to use Realistic Photos (instead of illustrations)
                    </label>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4 items-center">
                  <div className="w-full flex justify-between items-center bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-medium border border-green-100">
                    <span>✨ Generation complete!</span>
                    <button onClick={() => setGeneratedPoster(null)} className="text-green-800 hover:underline">Regenerate</button>
                  </div>
                  <div 
                    className="w-full flex justify-center border border-gray-200 rounded-2xl shadow-sm overflow-hidden bg-gray-50/50 p-4 [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:max-h-[55vh]"
                    dangerouslySetInnerHTML={{ __html: generatedPoster }} 
                  />
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-3xl">
              <button 
                onClick={() => setShowAIModal(false)}
                className="px-6 py-2.5 rounded-full font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              
              {!generatedPoster ? (
                <button 
                  onClick={handleGenerateAIPoster}
                  disabled={!aiPrompt.trim() || isGeneratingAI}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-2.5 rounded-full font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGeneratingAI ? (
                    <><Loader2 size={18} className="animate-spin" /> Designing...</>
                  ) : (
                    <><Sparkles size={18} /> Generate Poster</>
                  )}
                </button>
              ) : (
                <button 
                  onClick={handleAttachGeneratedPoster}
                  className="bg-[#2170E4] hover:bg-[#1A5BB8] text-white px-8 py-2.5 rounded-full font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <ImageIcon size={18} /> Attach to Post
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ThreadsTab;
