import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import BlockIcon from '@mui/icons-material/Block';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ForwardIcon from '@mui/icons-material/Forward';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MicIcon from '@mui/icons-material/Mic';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReplayIcon from '@mui/icons-material/Replay';
import ReportIcon from '@mui/icons-material/Report';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Fab,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Skeleton,
    Snackbar,
    TextField,
    Typography
} from '@mui/material';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmojiPickerButton from '../../components/EmojiPickerButton';
import ForwardMessageDialog from '../../components/ForwardMessageDialog';
import MessageReactions from '../../components/MessageReactions';
import MessageSkeleton from '../../components/MessageSkeleton';
import VoiceMessagePlayer from '../../components/VoiceMessagePlayer';
import VoiceRecorder from '../../components/VoiceRecorder';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';

// ── Module-level message state updaters (avoid deep nesting in component) ──
function applyAddReaction(messages, messageId, reaction) {
  return messages.map(msg => {
    if (msg.id !== messageId && msg._id !== messageId) return msg;
    const reactions = msg.reactions || [];
    if (reactions.some(r => r.user_id === reaction.user_id && r.emoji === reaction.emoji)) return msg;
    return { ...msg, reactions: [...reactions, reaction] };
  });
}

function applyRemoveReaction(messages, messageId, userId, emoji) {
  return messages.map(msg => {
    if (msg.id !== messageId && msg._id !== messageId) return msg;
    return { ...msg, reactions: (msg.reactions || []).filter(r => !(r.user_id === userId && r.emoji === emoji)) };
  });
}

function applyMarkRead(messages, messageId, readAt) {
  return messages.map(msg =>
    msg.id === messageId || msg._id === messageId
      ? { ...msg, status: 'read', read_at: readAt }
      : msg
  );
}

function applyLocalReadState(messages, userId) {
  return messages.map(msg =>
    msg.sender_id !== userId && !msg.read_at && msg.status !== 'read'
      ? { ...msg, status: 'read', read_at: new Date().toISOString() }
      : msg
  );
}

// ── Pure render helper: message content based on type ─────────────────────
function renderMessageContent(msg, isMe) {
  if (msg.message_type === 'voice') {
    return (
      <VoiceMessagePlayer
        audioUrl={msg.media_url}
        duration={msg.duration_s}
        waveform={msg.waveform}
      />
    );
  }
  if (msg.message_type === 'image') {
    return (
      <Box
        component="img"
        src={msg.media_url}
        alt="Image message"
        sx={{ maxWidth: '100%', borderRadius: 1, cursor: 'pointer', '&:hover': { opacity: 0.9 } }}
        onClick={() => window.open(msg.media_url, '_blank')}
      />
    );
  }
  if (msg.message_type === 'file') {
    return (
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
    );
  }
  return (
    <>
      {msg.forwarded_from && (
        <Box sx={{ borderLeft: 2, borderColor: isMe ? 'rgba(255,255,255,0.5)' : 'primary.main', pl: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Forwarded from {msg.forwarded_from?.name || 'Unknown'}
          </Typography>
        </Box>
      )}
      <Typography variant="body1">{msg.content}</Typography>
    </>
  );
}

// ── Sub-components extracted to reduce Chat's cognitive complexity ─────────
function ChatHeader({ recipient, inLayout, showSearch, searchQuery, onSearchChange, onSearchClose, onSearchOpen, userMenuAnchor, onUserMenuOpen, onUserMenuClose, onReport, onBlock }) {
  const navigate = useNavigate();
  if (inLayout) return null;
  return (
    <Paper elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
      <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
        <ArrowBackIcon />
      </IconButton>
      <Avatar src={recipient?.profile_picture || recipient?.profile_image} alt={recipient?.name} sx={{ mr: 2 }} />
      {showSearch ? (
        <>
          <TextField
            id="chat-search-input"
            name="chat-search-input"
            autoFocus
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ 'aria-label': 'Search messages' }}
          />
          <IconButton onClick={onSearchClose} sx={{ ml: 1 }}>
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
          <IconButton onClick={onSearchOpen} aria-label="Search messages">
            <SearchIcon />
          </IconButton>
          <IconButton onClick={onUserMenuOpen} aria-label="More options">
            <MoreVertIcon />
          </IconButton>
          <Menu anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)} onClose={onUserMenuClose}>
            <MenuItem onClick={onReport}>
              <ListItemIcon><ReportIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Report User</ListItemText>
            </MenuItem>
            <MenuItem onClick={onBlock}>
              <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Block User</ListItemText>
            </MenuItem>
          </Menu>
        </>
      )}
    </Paper>
  );
}
ChatHeader.propTypes = {
  recipient: PropTypes.shape({
    name: PropTypes.string,
    profile_picture: PropTypes.string,
    profile_image: PropTypes.string,
    is_online: PropTypes.bool,
  }),
  inLayout: PropTypes.bool,
  showSearch: PropTypes.bool,
  searchQuery: PropTypes.string,
  onSearchChange: PropTypes.func,
  onSearchClose: PropTypes.func,
  onSearchOpen: PropTypes.func,
  userMenuAnchor: PropTypes.object,
  onUserMenuOpen: PropTypes.func,
  onUserMenuClose: PropTypes.func,
  onReport: PropTypes.func,
  onBlock: PropTypes.func,
};

function ConnectionBanner({ user, isConnected, isConnecting }) {
  if (!user || isConnected) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, px: 2, py: 0.75, bgcolor: isConnecting ? 'warning.dark' : 'grey.800', color: 'white', fontSize: '0.8rem', userSelect: 'none' }}>
      {isConnecting
        ? <><CircularProgress size={13} color="inherit" sx={{ mr: 0.5 }} />Reconnecting to chat…</>
        : <><WifiOffIcon sx={{ fontSize: 16, mr: 0.5 }} />No connection — messages will retry automatically</>
      }
    </Box>
  );
}
ConnectionBanner.propTypes = {
  user: PropTypes.object,
  isConnected: PropTypes.bool,
  isConnecting: PropTypes.bool,
};

function LoadMoreSection({ hasMore, messageCount, searchQuery, onLoadMore, loading }) {
  if (!hasMore || messageCount < 50 || searchQuery) return null;
  return (
    <Box sx={{ textAlign: 'center', mb: 2 }}>
      <Button variant="outlined" size="small" onClick={onLoadMore} disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'Load Earlier Messages'}
      </Button>
    </Box>
  );
}
LoadMoreSection.propTypes = {
  hasMore: PropTypes.bool,
  messageCount: PropTypes.number,
  searchQuery: PropTypes.string,
  onLoadMore: PropTypes.func,
  loading: PropTypes.bool,
};

// S3776: cognitive complexity is inherent to a feature-rich chat component (reactions,
// voice, search, context menu, typing, forwarding, pagination). Extractions have been
// applied to the maximum extent possible without a full sub-component architecture refactor.
const Chat = ({ inLayout = false, conversationId: propConversationId }) => { // NOSONAR
  const { conversationId: urlConversationId, recipientId } = useParams(); // Should handle both URL params based on route
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages: socketMessages, sendTypingIndicator, isConnected, isConnecting } = useSocket();
  
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
  const retryQueueRef = useRef([]); // { tempId, payload } entries of failed sends
  const tempIdCounter = useRef(0);

  // ── Fetch initial chat data ──────────────────────────────────────────────
  const fetchChatData = useCallback(async () => {
    try {
      setError(null);
      let currentConvId = conversationId;

      if (!currentConvId && recipientId) {
        const convRes = await api.post('/chat/verify-conversation', { recipient_id: recipientId });
        const convData = convRes.data?.data || convRes.data;
        currentConvId = convData.conversation_id;
        if (convData.recipient) setRecipient(convData.recipient);
        if (currentConvId) {
          setActiveConversationId(currentConvId);
          navigate(`/chat/${currentConvId}`, { replace: true });
        }
      }

      if (!currentConvId) {
        setLoading(false);
        return;
      }

      setActiveConversationId(currentConvId);
      const res = await api.get(`/chat/conversations/${currentConvId}/messages?page=1&limit=50`);
      const msgData = res.data?.data || res.data;
      setMessages(msgData.messages || []);
      if (msgData.pagination) {
        setHasMore(msgData.pagination.has_more || false);
        setPage(1);
      }
      if (msgData.recipient) setRecipient(msgData.recipient);
    } catch (err) {
      console.error('Failed to load chat', err);
      setError(
        err.response?.status === 404
          ? 'User not found or unavailable'
          : err.response?.data?.error?.message || err.response?.data?.message || 'Failed to load chat'
      );
    } finally {
      setLoading(false);
    }
  }, [conversationId, recipientId, navigate]);

  useEffect(() => {
    if (user) fetchChatData();
  }, [fetchChatData, user]);

  // ── Handle socket messages (typing, reactions, read receipts, chat) ──────
  const handleSocketMessage = useCallback((lastMsg) => {
    if (lastMsg.type === 'typing_indicator' && lastMsg.conversation_id === activeConversationId) {
      setIsTyping(lastMsg.is_typing);
      if (lastMsg.is_typing) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
      return;
    }

    if (lastMsg.type === 'reaction_added' && lastMsg.conversation_id === activeConversationId) {
      setMessages(prev => applyAddReaction(prev, lastMsg.message_id, {
        user_id: lastMsg.user_id, emoji: lastMsg.emoji, created_at: lastMsg.timestamp,
      }));
      return;
    }

    if (lastMsg.type === 'reaction_removed' && lastMsg.conversation_id === activeConversationId) {
      setMessages(prev => applyRemoveReaction(prev, lastMsg.message_id, lastMsg.user_id, lastMsg.emoji));
      return;
    }

    if (lastMsg.type === 'message_read' && lastMsg.conversation_id === activeConversationId) {
      setMessages(prev => applyMarkRead(prev, lastMsg.message_id, lastMsg.read_at));
      return;
    }

    if (lastMsg.conversation_id === activeConversationId) {
      setMessages(prev => {
        const exists = prev.some(m => (m.id || m._id) === (lastMsg.id || lastMsg._id));
        if (exists) return prev;
        const messageWithStatus = lastMsg.sender_id === user?.id
          ? lastMsg
          : { ...lastMsg, status: lastMsg.status || 'delivered' };
        return [...prev, messageWithStatus];
      });
    }
  }, [activeConversationId, user?.id]);

  // Handle socket messages - both chat messages and real-time events
  useEffect(() => {
    if (socketMessages.length > 0) {
      handleSocketMessage(socketMessages[socketMessages.length - 1]);
    }
  }, [socketMessages, handleSocketMessage]);

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
  const markMessagesAsReadLocally = useCallback(() => {
    if (!activeConversationId || !user?.id) return;
    const unreadMessages = messages.filter(msg =>
      msg.sender_id !== user.id &&
      msg.status !== 'read' &&
      !msg.read_at
    );
    if (unreadMessages.length === 0) return;
    // Optimistically mark as read locally; backend marks read on fetch
    setMessages(prev => applyLocalReadState(prev, user.id));
  }, [activeConversationId, user?.id, messages]);

  useEffect(() => {
    const timer = setTimeout(markMessagesAsReadLocally, 1000);
    return () => clearTimeout(timer);
  }, [messages, markMessagesAsReadLocally]);

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

  // ── Retry a single queued message entry ──────────────────────────────────
  const retrySend = useCallback(async ({ tempId, payload }) => {
    setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, status: 'sending' } : m));
    try {
      const res = await api.post('/chat/messages', payload);
      const sentMsg = res.data?.data || res.data;
      setMessages(prev => {
        const alreadyExists = prev.some(m =>
          (m.id || m._id) === (sentMsg.id || sentMsg._id || sentMsg.message_id)
        );
        return alreadyExists
          ? prev.filter(m => m._tempId !== tempId)
          : prev.map(m => m._tempId === tempId ? { ...sentMsg, status: 'sent' } : m);
      });
    } catch {
      retryQueueRef.current.push({ tempId, payload });
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, status: 'failed' } : m));
    }
  }, []);

  // Manual retry for a failed message (tap on the error icon)
  const handleRetryFailed = useCallback((tempId) => {
    const entry = retryQueueRef.current.find(e => e.tempId === tempId);
    if (!entry) return;
    retryQueueRef.current = retryQueueRef.current.filter(e => e.tempId !== tempId);
    retrySend(entry);
  }, [retrySend]);

  // Auto-retry all queued messages when WebSocket reconnects
  useEffect(() => {
    if (!isConnected || retryQueueRef.current.length === 0) return;
    const queued = [...retryQueueRef.current];
    retryQueueRef.current = [];
    queued.forEach(entry => retrySend(entry));
  }, [isConnected, retrySend]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const receiverId = recipient?.id || recipient?._id || recipientId;
    if (!receiverId && !activeConversationId) {
      setError('Cannot send message: recipient not found');
      return;
    }

    const tempId = `temp_${Date.now()}_${++tempIdCounter.current}`;
    const payload = { receiver_id: receiverId, content: newMessage };
    const capturedText = newMessage;

    // ── Optimistic render: add message immediately with 'sending' status ──
    setMessages(prev => [...prev, {
      _tempId: tempId,
      sender_id: user?.id,
      content: capturedText,
      status: 'sending',
      created_at: new Date().toISOString(),
    }]);
    setNewMessage('');
    setSending(true);
    setError(null);

    if (sendTypingIndicator) {
      sendTypingIndicator(receiverId, false);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    }

    try {
      const res = await api.post('/chat/messages', payload);
      // Backend wraps in StandardResponse: { success, data: { message_id, sender_id, content, ... } }
      const sentMsg = res.data?.data || res.data;
      // Replace optimistic placeholder with real server response
      setMessages(prev => {
        const alreadyExists = prev.some(m =>
          (m.id || m._id) === (sentMsg.id || sentMsg._id || sentMsg.message_id)
        );
        return alreadyExists
          ? prev.filter(m => m._tempId !== tempId)
          : prev.map(m => m._tempId === tempId ? { ...sentMsg, status: 'sent' } : m);
      });
    } catch (err) {
      console.error('Failed to send message', err);
      if (err.response?.status === 429) {
        const retryAfter = err.response?.headers?.['retry-after'] || '60';
        setError(`Too many messages. Please wait ${retryAfter} seconds before sending again.`);
        setMessages(prev => prev.filter(m => m._tempId !== tempId));
      } else {
        // Mark as failed and queue for retry on reconnect
        setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, status: 'failed' } : m));
        retryQueueRef.current.push({ tempId, payload });
      }
    } finally {
      setSending(false);
    }
  };

  // Add reaction to a message
  const handleReact = async (messageId, emoji) => {
    try {
      await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
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
      await api.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
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
      <ChatHeader
        recipient={recipient}
        inLayout={inLayout}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClose={() => { setShowSearch(false); setSearchQuery(''); }}
        onSearchOpen={() => setShowSearch(true)}
        userMenuAnchor={userMenuAnchor}
        onUserMenuOpen={(e) => setUserMenuAnchor(e.currentTarget)}
        onUserMenuClose={() => setUserMenuAnchor(null)}
        onReport={handleReportUser}
        onBlock={handleBlockUser}
      />

      {/* Connection quality indicator */}
      <ConnectionBanner user={user} isConnected={isConnected} isConnecting={isConnecting} />

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
        <LoadMoreSection hasMore={hasMore} messageCount={messages.length} searchQuery={searchQuery} onLoadMore={loadMoreMessages} loading={loadingMore} />
        
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
              {/* Message content - voice / image / file / text */}
              {renderMessageContent(msg, isMe)}
              
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      {msg.status === 'read' && <DoneAllIcon sx={{ fontSize: 14, color: '#4fc3f7' }} />}
                      {msg.status === 'delivered' && <DoneAllIcon sx={{ fontSize: 14, opacity: 0.7 }} />}
                      {msg.status === 'sent' && <DoneIcon sx={{ fontSize: 14, opacity: 0.7 }} />}
                      {msg.status === 'sending' && (
                        <CircularProgress size={10} sx={{ color: 'rgba(255,255,255,0.65)' }} />
                      )}
                      {msg.status === 'failed' && (
                        <IconButton
                          size="small"
                          onClick={() => handleRetryFailed(msg._tempId)}
                          title="Send failed — tap to retry"
                          sx={{ p: 0, color: '#ff5252', '&:hover': { color: '#ff1744' } }}
                        >
                          <ReplayIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
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
              id="chat-message-input"
              name="chat-message-input"
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
              inputProps={{ 'aria-label': 'Type a message' }}
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
          contextMenu
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