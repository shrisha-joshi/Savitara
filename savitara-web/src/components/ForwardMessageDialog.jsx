import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  Typography,
  Box,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
  IconButton
} from '@mui/material';
import {
  Search,
  Close,
  Person,
  Group
} from '@mui/icons-material';
import api from '../services/api';

const MAX_FORWARD_TARGETS = 50; // Maximum recipients per forward

/**
 * ForwardMessageDialog Component
 * 
 * Allows users to forward messages to multiple conversations.
 * 
 * Features:
 * - Search and filter conversations
 * - Multi-select recipients (max 50)
 * - Message preview
 * - Privacy validation
 * - Accessible with ARIA labels
 * - Block status checking
 */
const ForwardMessageDialog = ({ open, onClose, message, currentUserId }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadConversations();
    } else {
      // Reset on close
      setSelectedConversations([]);
      setSearchQuery('');
      setError('');
    }
  }, [open, loadConversations]);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/conversations', {
        params: {
          limit: 100,
          include_blocked: false,
        }
      });

      if (response.data.success) {
        // Filter out the current conversation
        const filtered = response.data.data.conversations.filter(
          (conv) => conv.id !== message?.conversation_id
        );
        setConversations(filtered);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [message]);

  const handleToggleConversation = (conversationId) => {
    setSelectedConversations((prev) => {
      if (prev.includes(conversationId)) {
        return prev.filter((id) => id !== conversationId);
      } else {
        if (prev.length >= MAX_FORWARD_TARGETS) {
          setError(`Maximum ${MAX_FORWARD_TARGETS} recipients allowed`);
          return prev;
        }
        setError('');
        return [...prev, conversationId];
      }
    });
  };

  const handleForward = async () => {
    if (selectedConversations.length === 0) {
      setError('Please select at least one conversation');
      return;
    }

    try {
      setIsSending(true);
      setError('');

      // Determine if forwarding to users or conversations
      const selectedUsers = selectedConversations
        .map((convId) => {
          const conv = conversations.find((c) => c.id === convId);
          // For 1-on-1 conversations, extract the other user's ID
          if (conv?.participants?.length === 2) {
            return conv.participants.find((p) => p.id !== currentUserId)?.id;
          }
          return null;
        })
        .filter(Boolean);

      const groupConversations = selectedConversations.filter((convId) => {
        const conv = conversations.find((c) => c.id === convId);
        return conv?.participants?.length > 2;
      });

      // Forward to users (1-on-1 conversations)
      if (selectedUsers.length > 0) {
        await api.post(`/messages/${message.id}/forward`, {
          recipient_ids: selectedUsers,
          include_original_context: true,
        });
      }

      // Forward to group conversations
      for (const conversationId of groupConversations) {
        await api.post(`/messages/${message.id}/forward/conversation`, {
          conversation_id: conversationId,
          include_original_context: true,
        });
      }

      // Success - close dialog
      onClose(true); // Pass true to indicate success

    } catch (err) {
      console.error('Forward failed:', err);
      
      let errorMessage = 'Failed to forward message';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = 'You don\'t have permission to forward this message';
      } else if (err.response?.status === 404) {
        errorMessage = 'Message not found';
      }
      
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    
    // Search by conversation name (for group chats)
    if (conv.name?.toLowerCase().includes(query)) {
      return true;
    }

    // Search by participant names
    if (conv.participants) {
      return conv.participants.some(
        (p) => p.name?.toLowerCase().includes(query)
      );
    }

    return false;
  });

  const getConversationDisplay = (conversation) => {
    if (conversation.name) {
      return {
        title: conversation.name,
        subtitle: `${conversation.participants?.length || 0} members`,
        isGroup: true,
      };
    }

    // For 1-on-1 conversations, show the other user
    const otherUser = conversation.participants?.find(
      (p) => p.id !== currentUserId
    );

    if (otherUser) {
      return {
        title: otherUser.name || 'Unknown User',
        subtitle: otherUser.role === 'acharya' ? 'Acharya' : 'Grihasta',
        isGroup: false,
      };
    }

    return {
      title: 'Unknown Conversation',
      subtitle: '',
      isGroup: false,
    };
  };

  const getMessagePreview = () => {
    if (!message) return '';

    if (message.message_type === 'voice') {
      return '🎤 Voice message';
    } else if (message.message_type === 'image') {
      return '🖼️ Image';
    } else if (message.message_type === 'video') {
      return '🎥 Video';
    } else if (message.message_type === 'file') {
      return '📎 File';
    }

    // Text message - truncate if needed
    const text = message.content || '';
    return text.length > 100 ? `${text.substring(0, 100)}...` : text;
  };

  const renderConversationList = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    if (filteredConversations.length === 0) {
      return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'No conversations found' : 'No conversations available'}
          </Typography>
        </Box>
      );
    }
    return (
      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
        {filteredConversations.map((conversation) => {
          const display = getConversationDisplay(conversation);
          const isSelected = selectedConversations.includes(conversation.id);

          return (
            <ListItem
              key={conversation.id}
              disablePadding
              sx={{ mb: 0.5 }}
            >
              <ListItemButton
                onClick={() => handleToggleConversation(conversation.id)}
                sx={{
                  borderRadius: 1,
                  bgcolor: isSelected ? 'primary.light' : 'transparent',
                  '&:hover': {
                    bgcolor: isSelected ? 'primary.light' : 'action.hover',
                  },
                  opacity: (!isSelected && selectedConversations.length >= MAX_FORWARD_TARGETS) ? 0.5 : 1,
                }}
              >
                <Checkbox
                  checked={isSelected}
                  tabIndex={-1}
                  disableRipple
                  disabled={!isSelected && selectedConversations.length >= MAX_FORWARD_TARGETS}
                  inputProps={{
                    'aria-label': `Select ${display.title}`,
                  }}
                />
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: display.isGroup ? 'secondary.main' : 'primary.main' }}>
                    {display.isGroup ? <Group /> : <Person />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={display.title}
                  secondary={display.subtitle}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isSending && onClose(false)}
      maxWidth="sm"
      fullWidth
      aria-labelledby="forward-message-dialog-title"
    >
      <DialogTitle id="forward-message-dialog-title">
        Forward Message
        <IconButton
          aria-label="Close"
          onClick={() => onClose(false)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
          disabled={isSending}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Message Preview */}
        {message && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Message:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {getMessagePreview()}
            </Typography>
          </Box>
        )}

        {/* Selected Count */}
        {selectedConversations.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${selectedConversations.length} selected`}
              color="primary"
              size="small"
            />
            {selectedConversations.length >= MAX_FORWARD_TARGETS && (
              <Chip
                label={`Maximum ${MAX_FORWARD_TARGETS} reached`}
                color="warning"
                size="small"
              />
            )}
          </Box>
        )}

        {/* Search Field */}
        <TextField
          fullWidth
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          aria-label="Search conversations"
        />

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Conversation List */}
        {renderConversationList()}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={isSending}>
          Cancel
        </Button>
        <Button
          onClick={handleForward}
          variant="contained"
          disabled={selectedConversations.length === 0 || isSending}
          startIcon={isSending ? <CircularProgress size={16} /> : null}
        >
          {isSending ? 'Forwarding...' : `Forward to ${selectedConversations.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ForwardMessageDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    conversation_id: PropTypes.string,
    content: PropTypes.string,
    message_type: PropTypes.string,
  }),
  currentUserId: PropTypes.string.isRequired,
};

export default ForwardMessageDialog;
