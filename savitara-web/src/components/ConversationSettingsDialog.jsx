import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    List,
    ListItem,
    ListItemText,
    Menu,
    MenuItem,
    Switch,
    Typography,
} from '@mui/material';
import { addDays, addHours, addWeeks } from 'date-fns';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const MUTE_DURATION_OPTIONS = [
  { label: '1 hour', getValue: () => addHours(new Date(), 1).toISOString() },
  { label: '8 hours', getValue: () => addHours(new Date(), 8).toISOString() },
  { label: '1 day', getValue: () => addDays(new Date(), 1).toISOString() },
  { label: '1 week', getValue: () => addWeeks(new Date(), 1).toISOString() },
  { label: 'Indefinitely', getValue: () => null },
];

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
  const [muteMenuAnchor, setMuteMenuAnchor] = useState(null);

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
          muted_until: conv.muted_until || null,
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
    if (!settings) return;
    if (!settings.is_muted) {
      // Open duration picker instead of toggling directly
      return; // handled by button click opening menu
    }
    // Unmute directly
    try {
      setUpdating(true);
      setError('');
      await api.patch(`/chat/conversations/${conversationId}/settings`, {
        is_muted: false,
        muted_until: null,
      });
      setSettings((prev) => ({ ...prev, is_muted: false, muted_until: null }));
    } catch (err) {
      console.error('Failed to unmute conversation:', err);
      setError('Failed to update notification settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleMuteWithDuration = async (option) => {
    setMuteMenuAnchor(null);
    try {
      setUpdating(true);
      setError('');
      const mutedUntil = option.getValue();
      await api.patch(`/chat/conversations/${conversationId}/settings`, {
        is_muted: true,
        muted_until: mutedUntil,
      });
      setSettings((prev) => ({ ...prev, is_muted: true, muted_until: mutedUntil }));
    } catch (err) {
      console.error('Failed to mute conversation:', err);
      setError('Failed to mute conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleTogglePin = async () => {
    if (!settings) return;
    try {
      setUpdating(true);
      setError('');
      await api.post(`/chat/conversations/${conversationId}/pin`);
      setSettings((prev) => ({ ...prev, is_pinned: !prev.is_pinned }));
    } catch (err) {
      console.error('Failed to pin/unpin conversation:', err);
      setError('Failed to pin/unpin conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!settings) return;
    try {
      setUpdating(true);
      setError('');
      await api.post(`/chat/conversations/${conversationId}/archive`);
      setSettings((prev) => ({ ...prev, is_archived: !prev.is_archived }));
    } catch (err) {
      console.error('Failed to archive/unarchive conversation:', err);
      setError('Failed to archive/unarchive conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!globalThis.confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      return;
    }

    try {
      setUpdating(true);
      setError('');
      await api.delete(`/chat/conversations/${conversationId}`);
      onClose(true); // Pass true to indicate successful deletion
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation');
      setUpdating(false);
    }
  };

  const getMuteStatusLabel = () => {
    if (!settings?.is_muted) return 'Notifications are enabled';
    if (settings?.muted_until) {
      return `Muted until ${new Date(settings.muted_until).toLocaleString()}`;
    }
    return 'Muted indefinitely';
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
                  secondary={getMuteStatusLabel()}
                />
                {settings?.is_muted ? (
                  <Switch
                    checked
                    onChange={() => { void handleToggleMute(); }}
                    disabled={updating}
                    inputProps={{ 'aria-label': 'unmute notifications' }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => setMuteMenuAnchor(e.currentTarget)}
                    disabled={updating}
                    aria-haspopup="true"
                    aria-expanded={Boolean(muteMenuAnchor)}
                  >
                    Mute
                  </Button>
                )}
              </ListItem>

              {/* Mute duration picker */}
              <Menu
                anchorEl={muteMenuAnchor}
                open={Boolean(muteMenuAnchor)}
                onClose={() => setMuteMenuAnchor(null)}
              >
                {MUTE_DURATION_OPTIONS.map((option) => (
                  <MenuItem key={option.label} onClick={() => { void handleMuteWithDuration(option); }}>
                    {option.label}
                  </MenuItem>
                ))}
              </Menu>

              <ListItem>
                <ListItemText
                  primary="Pin Conversation"
                  secondary={settings?.is_pinned ? 'Conversation is pinned' : 'Pin to top of list'}
                />
                <Switch
                  checked={settings?.is_pinned || false}
                  onChange={() => { void handleTogglePin(); }}
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
                  onChange={() => { void handleToggleArchive(); }}
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
                onClick={() => { void handleDeleteConversation(); }}
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
