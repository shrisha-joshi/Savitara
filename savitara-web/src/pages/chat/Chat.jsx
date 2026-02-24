import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Avatar, 
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  Skeleton,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ForwardIcon from '@mui/icons-material/Forward';
import DoneIcon from '@mui/icons-material/Done';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReportIcon from '@mui/icons-material/Report';
import BlockIcon from '@mui/icons-material/Block';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import MessageSkeleton from '../../components/MessageSkeleton';
import EmojiPickerButton from '../../components/EmojiPickerButton';
import MessageReactions from '../../components/MessageReactions';
import VoiceRecorder from '../../components/VoiceRecorder';
import VoiceMessagePlayer from '../../components/VoiceMessagePlayer';
import ForwardMessageDialog from '../../components/ForwardMessageDialog';

const Chat = ({ inLayout = false, conversationId: propConversationId }) => {
  const { conversationId: urlConversationId, recipientId } = useParams(); // Should handle both URL params based on route
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages: socketMessages, sendTypingIndicator } = useSocket();
  
  // Use prop conversationId if provided (for layout mode), otherwise use URL param
  const conversationId = propConversationId || urlConversationId;
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(conversationId || null);
  const [isTyping, setIsTyping] = useState(false); // Remote user typing state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchChatData = async () => {
      try {
        setError(null);
        let currentConvId = conversationId;
        
        if (!currentConvId && recipientId) {
          // Starting new chat - verify/create conversation first
          try {
            const convRes = await api.post('/chat/verify-conversation', { recipient_id: recipientId });
            // Backend wraps in StandardResponse: { success, data: { conversation_id, recipient } }
            const convData = convRes.data?.data || convRes.data;
            currentConvId = convData.conversation_id;
            
            if (convData.recipient) {
              setRecipient(convData.recipient);
            }
            
            if (currentConvId) {
              setActiveConversationId(currentConvId);
              navigate(`/chat/${currentConvId}`, { replace: true });
            }
          } catch (err) {
            if (err.response?.status === 404) {
              setError('User not found or unavailable');
            } else {
              setError('Failed to start conversation');
            }
            setLoading(false);
            return;
          }
        }

        if (currentConvId) {
          setActiveConversationId(currentConvId);
          const res = await api.get(`/chat/conversations/${currentConvId}/messages?page=1&limit=50`);
          // Backend wraps in StandardResponse: { success, data: { messages, recipient, pagination } }
          const msgData = res.data?.data || res.data;
          setMessages(msgData.messages || []);
          
          // Set pagination info
          if (msgData.pagination) {
            setHasMore(msgData.pagination.has_more || false);
            setPage(1);
          }
          
          // Backend now returns recipient info in messages endpoint
          if (msgData.recipient) {
            setRecipient(msgData.recipient);
          }
        }
      } catch (err) {
        console.error("Failed to load chat", err);
        const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load chat';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchChatData();
    }
  }, [conversationId, recipientId, user, navigate]);

  // Handle socket messages - both chat messages and real-time events
  useEffect(() => {
    if (socketMessages.length > 0) {
      const lastMsg = socketMessages[socketMessages.length - 1];
      
      // Handle typing indicator events
      if (lastMsg.type === 'typing_indicator' && lastMsg.conversation_id === activeConversationId) {
        setIsTyping(lastMsg.is_typing);
        
        // Clear typing indicator after 3 seconds if no update
        if (lastMsg.is_typing) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
        return;
      }
      
      // Handle reaction events
      if (lastMsg.type === 'reaction_added' && lastMsg.conversation_id === activeConversationId) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === lastMsg.message_id || msg._id === lastMsg.message_id) {
            const reactions = msg.reactions || [];
            // Check if user already reacted with this emoji (shouldn't happen, but defensive)
            const alreadyReacted = reactions.some(r => r.user_id === lastMsg.user_id && r.emoji === lastMsg.emoji);
            if (!alreadyReacted) {
              return {
                ...msg,
                reactions: [...reactions, { user_id: lastMsg.user_id, emoji: lastMsg.emoji, created_at: lastMsg.timestamp }]
              };
            }
          }
          return msg;
        }));
        return;
      }
      
      if (lastMsg.type === 'reaction_removed' && lastMsg.conversation_id === activeConversationId) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === lastMsg.message_id || msg._id === lastMsg.message_id) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter(r => !(r.user_id === lastMsg.user_id && r.emoji === lastMsg.emoji))
            };
          }
          return msg;
        }));
        return;
      }
      
      // Handle read receipt events
      if (lastMsg.type === 'message_read' && lastMsg.conversation_id === activeConversationId) {
        // Update message status to 'read'
        setMessages(prev => prev.map(msg => 
          msg.id === lastMsg.message_id || msg._id === lastMsg.message_id
            ? { ...msg, status: 'read', read_at: lastMsg.read_at }
            : msg
        ));
        return;
      }
      
      // Handle regular chat messages
      if (lastMsg.conversation_id === activeConversationId) {
        // Dedupe - don't add if already exists
        setMessages(prev => {
          const exists = prev.some(m => (m.id || m._id) === (lastMsg.id || lastMsg._id));
          if (exists) return prev;
          
          // Mark message as delivered if it's from remote user
          const messageWithStatus = lastMsg.sender_id === user?.id
            ? lastMsg
            : { ...lastMsg, status: lastMsg.status || 'delivered' };
          
          return [...prev, messageWithStatus];
        });
      }
    }
  }, [socketMessages, activeConversationId, user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  // Handle scroll event to show/hide scroll button
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setShowScrollButton(!isNearBottom);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + Enter to send message (when focused on input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && newMessage.trim()) {
        e.preventDefault();
        handleSend();
      }
      
      // Esc to close emoji picker or other dialogs
      if (e.key === 'Escape') {
        if (showForwardDialog) {
          setShowForwardDialog(false);
        }
        if (contextMenu !== null) {
          handleCloseContextMenu();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [newMessage, showForwardDialog, contextMenu]);

  // Debounced typing indicator
  const typingDebounceRef = useRef(null);
  const handleTyping = useCallback(() => {
    const receiverId = recipient?.id || recipient?._id || recipientId;
    if (!receiverId || !sendTypingIndicator) return;
    
    // Send "is typing" immediately
    sendTypingIndicator(receiverId, true);
    
    // Clear previous debounce timeout
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    
    // Send "stopped typing" after 2 seconds of inactivity
    typingDebounceRef.current = setTimeout(() => {
      sendTypingIndicator(receiverId, false);
    }, 2000);
  }, [recipient, recipientId, sendTypingIndicator]);

  // Mark messages as read when conversation is active
  useEffect(() => {
    const markMessagesAsReadLocally = () => {
      if (!activeConversationId || !user?.id) return;
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== user.id && 
        msg.status !== 'read' && 
        !msg.read_at
      );
      if (unreadMessages.length === 0) return;

      // Optimistically mark as read locally; backend marks read on fetch
      setMessages(prev => prev.map(msg => {
        if (msg.sender_id !== user.id && !msg.read_at && msg.status !== 'read') {
          return { ...msg, status: 'read', read_at: new Date().toISOString() };
        }
        return msg;
      }));
    };
    const timer = setTimeout(markMessagesAsReadLocally, 1000);
    return () => clearTimeout(timer);
  }, [messages, activeConversationId, user?.id]);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!activeConversationId || !hasMore || loadingMore) return;
    
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await api.get(`/chat/conversations/${activeConversationId}/messages?page=${nextPage}&limit=50`);
      const msgData = res.data?.data || res.data;
      
      if (msgData.messages && msgData.messages.length > 0) {
        setMessages(prev => [...msgData.messages, ...prev]); // Prepend older messages
        setPage(nextPage);
      }
      
      if (msgData.pagination) {
        setHasMore(msgData.pagination.has_more || false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Context menu handlers
  const handleContextMenu = (event, message) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
    setSelectedMessage(message);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setSelectedMessage(null);
  };

  const handleCopyMessage = () => {
    if (selectedMessage?.content) {
      navigator.clipboard.writeText(selectedMessage.content);
    }
    handleCloseContextMenu();
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    
    try {
      await api.delete(`/chat/messages/${selectedMessage.id || selectedMessage._id}`);
      setMessages(prev => prev.filter(m => (m.id || m._id) !== (selectedMessage.id || selectedMessage._id)));
    } catch (err) {
      console.error('Failed to delete message:', err);
      setError('Failed to delete message');
    }
    handleCloseContextMenu();
  };

  const handleForwardMessage = () => {
    setShowForwardDialog(true);
    handleCloseContextMenu();
  };

  // User menu handlers
  const handleReportUser = async () => {
    const recipientUserId = recipient?.id || recipient?._id || recipientId;
    if (!recipientUserId) return;
    
    const reason = prompt('Please describe why you are reporting this user:');
    if (!reason) return;
    
    try {
      await api.post('/admin/reports', {
        reported_user_id: recipientUserId,
        reason,
        report_type: 'user_behavior'
      });
      alert('Report submitted. Our team will review it shortly.');
    } catch (err) {
      console.error('Failed to report user:', err);
      alert('Failed to submit report. Please try again.');
    }
    setUserMenuAnchor(null);
  };

  const handleBlockUser = async () => {
    const recipientUserId = recipient?.id || recipient?._id || recipientId;
    if (!recipientUserId) return;
    
    const confirmed = globalThis.confirm(`Are you sure you want to block ${recipient?.name}? You will no longer receive messages from them.`);
    if (!confirmed) return;
    
    try {
      await api.post('/users/block', {
        blocked_user_id: recipientUserId
      });
      alert(`${recipient?.name} has been blocked.`);
      navigate('/chat'); // Go back to chat list
    } catch (err) {
      console.error('Failed to block user:', err);
      alert('Failed to block user. Please try again.');
    }
    setUserMenuAnchor(null);
  };

  const handleSend = async () =>{
    if (!newMessage.trim()) return;

    // Need either a recipient or a conversation to send
    const receiverId = recipient?.id || recipient?._id || recipientId;
    if (!receiverId && !activeConversationId) {
      setError('Cannot send message: recipient not found');
      return;
    }

    try {
      setSending(true);
      setError(null);
      const payload = {
        receiver_id: receiverId,
        content: newMessage
      };
      
      const res = await api.post('/chat/messages', payload);
      // Backend wraps in StandardResponse: { success, data: { message_id, sender_id, content, ... } }
      const sentMsg = res.data?.data || res.data;
      
      // Add with 'sent' status initially
      const messageWithStatus = { ...sentMsg, status: 'sent' };
      
      // Optimistically add to UI (dedupe against WebSocket)
      setMessages(prev => {
        const exists = prev.some(m => (m.id || m._id) === (sentMsg.id || sentMsg._id || sentMsg.message_id));
        if (exists) return prev;
        return [...prev, messageWithStatus];
      });
      setNewMessage('');
      
      // Stop typing indicator after sending
      if (sendTypingIndicator) {
        sendTypingIndicator(receiverId, false);
        if (typingDebounceRef.current) {
          clearTimeout(typingDebounceRef.current);
        }
      }
      
    } catch (err) {
      console.error("Failed to send message", err);
      
      // Special handling for rate limiting
      if (err.response?.status === 429) {
        const retryAfter = err.response?.headers?.['retry-after'] || '60';
        setError(`Too many messages. Please wait ${retryAfter} seconds before sending again.`);
      } else {
        const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send message';
        setError(errorMsg);
      }
    } finally {
      setSending(false);
    }
  };

  // Add reaction to a message
  const handleReact = async (messageId, emoji) => {
    try {
      await api.post(`/messages/${messageId}/reactions`, { emoji });
      // WebSocket will update the UI via reaction_added event
    } catch (err) {
      console.error('Failed to add reaction:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to add reaction';
      setError(errorMsg);
    }
  };

  // Remove reaction from a message
  const handleUnreact = async (messageId, emoji) => {
    try {
      await api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      // WebSocket will update the UI via reaction_removed event
    } catch (err) {
      console.error('Failed to remove reaction:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to remove reaction';
      setError(errorMsg);
    }
  };

  if (loading) return (
    <Box sx={{ height: inLayout ? '100%' : '85vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header skeleton */}
      {!inLayout && (
        <Paper elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box>
            <Skeleton variant="text" width={120} height={24} />
            <Skeleton variant="text" width={60} height={16} />
          </Box>
        </Paper>
      )}
      
      {/* Messages skeleton */}
      <Paper elevation={0} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
        <MessageSkeleton count={5} align="left" />
        <MessageSkeleton count={3} align="right" />
      </Paper>
      
      {/* Input skeleton */}
      <Paper elevation={3} sx={{ p: 2, mt: inLayout ? 0 : 2 }}>
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      </Paper>
    </Box>
  );

  if (error && !recipient) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
      <Typography variant="h6" color="error" gutterBottom>{error}</Typography>
      <Button variant="contained" onClick={() => navigate('/chat')}>Back to Conversations</Button>
    </Box>
  );

  return (
    <Box sx={{ height: inLayout ? '100%' : '85vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header - only show when not in layout */}
      {!inLayout && (
        <Paper elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar src={recipient?.profile_picture || recipient?.profile_image} alt={recipient?.name} sx={{ mr: 2 }} />
          
          {showSearch ? (
            <>
              <TextField
                autoFocus
                fullWidth
                size="small"
                variant="outlined"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1 }}
              />
              <IconButton onClick={() => { setShowSearch(false); setSearchQuery(''); }} sx={{ ml: 1 }}>
                <CloseIcon />
              </IconButton>
            </>
          ) : (
            <>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{recipient?.name || 'Chat'}</Typography>
                <Typography variant="caption" color={recipient?.is_online ? 'success.main' : 'text.secondary'}>
                  {recipient?.is_online ? 'Online' : 'Offline'}
                </Typography>
              </Box>
              <IconButton onClick={() => setShowSearch(true)} aria-label="Search messages">
                <SearchIcon />
              </IconButton>
              <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} aria-label="More options">
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
              >
                <MenuItem onClick={handleReportUser}>
                  <ListItemIcon>
                    <ReportIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Report User</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleBlockUser}>
                  <ListItemIcon>
                    <BlockIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Block User</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Paper>
      )}

      {/* Messages Area */}
      <Paper 
        ref={messagesContainerRef}
        elevation={0} 
        onScroll={handleScroll}
        sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* Search info */}
        {searchQuery && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Searching for: "{searchQuery}"
          </Alert>
        )}
        
        {/* Load More Button */}
        {hasMore && messages.length >= 50 && !searchQuery && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Button 
              variant="outlined" 
              size="small"
              onClick={loadMoreMessages}
              disabled={loadingMore}
            >
              {loadingMore ? <CircularProgress size={20} /> : 'Load Earlier Messages'}
            </Button>
          </Box>
        )}
        
        {(() => {
          // Filter messages if search is active
          const filteredMessages = searchQuery 
            ? messages.filter(msg => 
                msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : messages;
          
          if (filteredMessages.length === 0 && searchQuery) {
            return (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No messages found for "{searchQuery}"
                </Typography>
              </Box>
            );
          }
          
          return <>{filteredMessages.map((msg) => {
          const isMe = msg.sender_id === user.id;
          const msgTime = msg.created_at || msg.timestamp;
          const msgId = msg.id || msg._id;
          return (
            <Box 
              key={msgId || `${msg.sender_id}-${msgTime}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
              sx={{ 
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '70%',
                mb: 1.5,
                p: 1.5,
                bgcolor: isMe ? 'primary.main' : 'white',
                color: isMe ? 'white' : 'text.primary',
                borderRadius: 2,
                boxShadow: 1,
                cursor: 'context-menu',
                position: 'relative',
                '&:hover .emoji-picker': {
                  opacity: 1
                }
              }}
            >
              {/* Message content - support voice, image, regular text */}
              {msg.message_type === 'voice' ? (
                <VoiceMessagePlayer
                  audioUrl={msg.media_url}
                  duration={msg.duration_s}
                  waveform={msg.waveform}
                />
              ) : msg.message_type === 'image' ? (
                <Box
                  component="img"
                  src={msg.media_url}
                  alt="Image message"
                  sx={{ 
                    maxWidth: '100%', 
                    borderRadius: 1, 
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => window.open(msg.media_url, '_blank')}
                />
              ) : msg.message_type === 'file' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachFileIcon fontSize="small" />
                  <Typography 
                    variant="body2" 
                    component="a" 
                    href={msg.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: isMe ? 'white' : 'primary.main', textDecoration: 'underline' }}
                  >
                    {msg.file_name || 'Download File'}
                  </Typography>
                </Box>
              ) : (
                /* Regular text or forwarded message */
                <>
                  {msg.forwarded_from && (
                    <Box sx={{ 
                      borderLeft: 2, 
                      borderColor: isMe ? 'rgba(255,255,255,0.5)' : 'primary.main', 
                      pl: 1, 
                      mb: 0.5 
                    }}>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Forwarded from {msg.forwarded_from?.name || 'Unknown'}
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="body1">{msg.content}</Typography>
                </>
              )}
              
              {/* Reactions display */}
              {msg.reactions && msg.reactions.length > 0 && (
                <MessageReactions
                  reactions={msg.reactions}
                  currentUserId={user.id}
                  onReact={(emoji) => handleReact(msgId, emoji)}
                  onUnreact={(emoji) => handleUnreact(msgId, emoji)}
                />
              )}
              
              {/* Bottom row: timestamp, read receipts, emoji picker */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5, gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {msgTime ? new Date(msgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                  {isMe && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {msg.status === 'read' && <DoneAllIcon sx={{ fontSize: 14, color: '#4fc3f7' }} />}
                      {msg.status === 'delivered' && <DoneAllIcon sx={{ fontSize: 14, opacity: 0.7 }} />}
                      {msg.status === 'sent' && <DoneIcon sx={{ fontSize: 14, opacity: 0.7 }} />}
                      {!msg.status && <DoneIcon sx={{ fontSize: 14, opacity: 0.4 }} />}
                    </Box>
                  )}
                </Box>
                
                {/* Emoji picker button (shows on hover) */}
                <Box className="emoji-picker" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                  <EmojiPickerButton
                    onSelect={(emoji) => handleReact(msgId, emoji)}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>
          );
          })}</>
        })()}
        
        {isTyping && (
          <Box 
            sx={{ 
              alignSelf: 'flex-start',
              maxWidth: '70%',
              mb: 1.5,
              p: 1.5,
              bgcolor: 'white',
              borderRadius: 2,
              boxShadow: 1
            }}
          >
            <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              {recipient?.name || 'User'} is typing...
            </Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
        
        {/* Scroll to bottom FAB */}
        {showScrollButton && (
          <Fab 
            size="small" 
            color="primary"
            onClick={scrollToBottom}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 10,
              boxShadow: 3
            }}
          >
            <KeyboardArrowDownIcon />
          </Fab>
        )}
      </Paper>

      {/* Input Area */}
      <Paper elevation={3} sx={{ p: 2, mt: inLayout ? 0 : 2, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {showVoiceRecorder ? (
          <VoiceRecorder
            conversationId={activeConversationId}
            onSend={() => {
              setShowVoiceRecorder(false);
            }}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        ) : (
          <>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              variant="outlined"
              placeholder="Type a message... (Shift+Enter for new line)"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                  }
              }}
              size="small"
            />
            <IconButton 
              color="primary" 
              onClick={() => setShowVoiceRecorder(true)}
              sx={{ height: 40, width: 40 }}
            >
              <MicIcon />
            </IconButton>
            <Button 
               variant="contained" 
               color="primary" 
               endIcon={<SendIcon />} 
               onClick={handleSend}
               sx={{ minWidth: 100, height: 40 }}
               disabled={!newMessage.trim() || sending}
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </>
        )}
      </Paper>
      
      {/* Context Menu for message actions */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleCopyMessage}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Message</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleForwardMessage}>
          <ListItemIcon>
            <ForwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Forward Message</ListItemText>
        </MenuItem>
        {selectedMessage && selectedMessage.sender_id === user?.id && (
          <MenuItem onClick={handleDeleteMessage}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete Message</ListItemText>
          </MenuItem>
        )}
      </Menu>
      
      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={showForwardDialog}
        onClose={() => setShowForwardDialog(false)}
        message={selectedMessage}
        currentUserId={user?.id}
      />
      
      {/* Global error Snackbar */}
      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError('')} severity="error" variant="filled" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

Chat.propTypes = {
  inLayout: PropTypes.bool,
  conversationId: PropTypes.string
};

export default Chat;