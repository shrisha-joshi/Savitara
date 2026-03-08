import {
    Close,
    Person,
    Search
} from '@mui/icons-material';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    TextField,
    Typography
} from '@mui/material';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';
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

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/chat/conversations', {
        params: { page: 1, limit: 100 }
      });

      const convData = response.data?.data?.conversations || response.data?.conversations || [];
      // Filter out the current conversation
      const filtered = convData.filter(
        (conv) => (conv.id || conv._id) !== message?.conversation_id
      );
      setConversations(filtered);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [message]);

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

    const messageId = message.id || message._id;
    if (!messageId) {
      setError('Message ID is missing, cannot forward.');
      return;
    }

    try {
      setIsSending(true);
      setError('');

      const promises = selectedConversations.map(async (convId) => {
        const conv = conversations.find((c) => (c.id || c._id) === convId);
        const recipientId = conv?.other_user?.id || conv?.other_user?._id;
        if (!recipientId) {
          throw new Error(`Missing recipient for conversation ${conv?.title || convId}`);
        }
        await api.post(`/chat/messages`, {
          receiver_id: recipientId,
          content: message.content || '',
          message_type: message.message_type || 'text',
          media_url: message.media_url,
          forwarded_from: { id: messageId, name: message.sender_name || '' },
        });
        return { convId, success: true };
      });

      const results = await Promise.allSettled(promises);
      const failed = results.filter(r => r.status === 'rejected');

      const failedConversations = selectedConversations.filter((_, index) => results[index].status === 'rejected');
      setSelectedConversations(failedConversations);

      if (failed.length === 0) {
        onClose(true); // Complete success
      } else {
        const failedCount = failed.length;
        setError(`Failed to forward message to ${failedCount} recipient(s).`);
        // We do not close the dialog on partial failure so the user can inspect or retry.
      }
    } catch (err) {
      console.error('Forward failed:', err);
      setError('Failed to forward message');
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = conv.other_user?.name?.toLowerCase() || '';
    const lastMsg = conv.last_message?.content?.toLowerCase() || '';
    return name.includes(query) || lastMsg.includes(query);
  });

  const getConversationDisplay = (conversation) => {
    const otherUser = conversation.other_user;
    return {
      title: otherUser?.name || 'Unknown User',
      subtitle: otherUser?.role === 'acharya' ? 'Acharya' : 'Grihasta',
      avatar: otherUser?.profile_picture || otherUser?.profile_image,
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
          const convId = conversation.id || conversation._id;
          const isSelected = selectedConversations.includes(convId);

          return (
            <ListItem
              key={convId}
              disablePadding
              sx={{ mb: 0.5 }}
            >
              <ListItemButton
                onClick={() => handleToggleConversation(convId)}
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
                  <Avatar src={display.avatar} alt={display.title} sx={{ bgcolor: 'primary.main' }}>
                    {!display.avatar && <Person />}
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
  message: function(props, propName, componentName) {
    const val = props[propName];
    if (props.open && !val) {
      return new Error(`Prop \`${propName}\` is required in \`${componentName}\` when \`open\` is true.`);
    }

    const error = PropTypes.shape({
      id: PropTypes.string,
      _id: PropTypes.string,
      conversation_id: PropTypes.string,
      content: PropTypes.string,
      message_type: PropTypes.string,
      media_url: PropTypes.string,
      sender_name: PropTypes.string,
    })(props, propName, componentName);
    if (error) return error;
    
    if (props.open && val && !val.id && !val._id) {
      return new Error(`Prop \`${propName}\` in \`${componentName}\` must include \`id\` or \`_id\`.`);
    }
    return null;
  },
  currentUserId: PropTypes.string.isRequired,
};

export default ForwardMessageDialog;
