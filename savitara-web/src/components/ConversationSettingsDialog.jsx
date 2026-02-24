import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Switch,
  Avatar,
  Typography,
  Box,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

/**
 * ConversationSettingsDialog Component
 * 
 * Allows users to view and modify conversation-specific settings.
 * 
 * Features:
 * - Mute/unmute notifications
 * - Pin/unpin conversation
 * - Archive/unarchive conversation
 * - Delete conversation
 */
const ConversationSettingsDialog = ({ open, onClose, conversationId, otherUser }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/chat/conversations', { params: { limit: 100 } });
      const convs = response.data?.data?.conversations || response.data?.conversations || [];
      const conv = convs.find((c) => (c.id || c._id) === conversationId);
      
      if (conv) {
        setSettings({
          is_muted: conv.is_muted || false,
          is_pinned: conv.is_pinned || false,
          is_archived: conv.is_archived || false,
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load conversation settings');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open && conversationId) {
      loadSettings();
    }
  }, [open, conversationId, loadSettings]);

  const handleToggleMute = async () => {
    try {
      setUpdating(true);
      setError('');
      await api.patch(`/chat/conversations/${conversationId}/settings`, {
        is_muted: !settings.is_muted,
      });
      setSettings((prev) => ({ ...prev, is_muted: !prev.is_muted }));
    } catch (err) {
      setError('Failed to update notification settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      setUpdating(true);
      setError('');
      await api.post(`/chat/conversations/${conversationId}/pin`);
      setSettings((prev) => ({ ...prev, is_pinned: !prev.is_pinned }));
    } catch (err) {
      setError('Failed to pin/unpin conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleArchive = async () => {
    try {
      setUpdating(true);
      setError('');
      await api.post(`/chat/conversations/${conversationId}/archive`);
      setSettings((prev) => ({ ...prev, is_archived: !prev.is_archived }));
    } catch (err) {
      setError('Failed to archive/unarchive conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!window.confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await api.delete(`/chat/conversations/${conversationId}`);
      onClose(true); // Pass true to indicate successful deletion
    } catch (err) {
      setError('Failed to delete conversation');
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Conversation Settings</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* User Info */}
            <Box display="flex" flexDirection="column" alignItems="center" py={2} mb={2}>
              <Avatar
                src={otherUser?.profile_picture || otherUser?.profile_image}
                alt={otherUser?.name}
                sx={{ width: 80, height: 80, mb: 2 }}
              />
              <Typography variant="h6">{otherUser?.name || 'Unknown User'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {otherUser?.role === 'acharya' ? 'Acharya' : 'Grihasta'}
              </Typography>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Settings List */}
            <List>
              <ListItem>
                <ListItemText
                  primary="Mute Notifications"
                  secondary={settings?.is_muted ? 'Notifications are muted' : 'Notifications are enabled'}
                />
                <Switch
                  checked={settings?.is_muted || false}
                  onChange={handleToggleMute}
                  disabled={updating}
                />
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Pin Conversation"
                  secondary={settings?.is_pinned ? 'Conversation is pinned' : 'Pin to top of list'}
                />
                <Switch
                  checked={settings?.is_pinned || false}
                  onChange={handleTogglePin}
                  disabled={updating}
                />
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Archive Conversation"
                  secondary={settings?.is_archived ? 'Conversation is archived' : 'Move to archive'}
                />
                <Switch
                  checked={settings?.is_archived || false}
                  onChange={handleToggleArchive}
                  disabled={updating}
                />
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            {/* Danger Zone */}
            <Box>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Danger Zone
              </Typography>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={handleDeleteConversation}
                disabled={updating}
              >
                Delete Conversation
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={updating}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConversationSettingsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  conversationId: PropTypes.string,
  otherUser: PropTypes.object,
};

export default ConversationSettingsDialog;
