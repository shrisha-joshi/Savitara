import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar, 
  Typography, 
  Paper, 
  Divider,
  Badge,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  Chip,
  Snackbar,
  Alert
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PushPinIcon from '@mui/icons-material/PushPin';
import ArchiveIcon from '@mui/icons-material/Archive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import ConversationSkeleton from '../../components/ConversationSkeleton';
import { getConversationTime } from '../../utils/timeFormat';

const Conversations = ({ onSelectConversation, selectedConversationId }) => {
    const navigate = useNavigate();
    const { messages } = useSocket(); // To update list when new msg arrives
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchDebounceRef = useRef(null);

    const handleSearchChange = useCallback((e) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(value);
        }, 300);
    }, []);
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedConv, setSelectedConv] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showNotification = useCallback((message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    // Fetch conversations only on mount
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                // Adjust endpoint based on backend structure
                const response = await api.get('/chat/conversations', {
                    params: { page: 1, limit: 20 }
                });
                // Backend wraps in StandardResponse: { success, data: { conversations, pagination } }
                const convData = response.data?.data?.conversations || response.data?.conversations || [];
                setConversations(convData);
            } catch (error) {
                console.error("Failed to fetch conversations", error);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, []); // Only fetch on mount

    // Update conversations locally when new socket message arrives
    useEffect(() => {
        if (messages.length === 0) return;
        
        const lastMsg = messages[messages.length - 1];
        if (!lastMsg.conversation_id) return;
        
        setConversations(prev => {
            const convIndex = prev.findIndex(c => (c.id || c._id) === lastMsg.conversation_id);
            
            if (convIndex === -1) {
                // New conversation - refetch all
                api.get('/chat/conversations').then(res => {
                    const convData = res.data?.data?.conversations || res.data?.conversations || [];
                    setConversations(convData);
                });
                return prev;
            }
            
            // Update existing conversation
            const updatedConvs = [...prev];
            const conv = updatedConvs[convIndex];
            
            updatedConvs[convIndex] = {
                ...conv,
                last_message: {
                    content: lastMsg.content,
                    timestamp: lastMsg.timestamp || lastMsg.created_at,
                    created_at: lastMsg.created_at || lastMsg.timestamp
                },
                updated_at: lastMsg.timestamp || lastMsg.created_at
            };
            
            // Move to top
            const updated = updatedConvs.splice(convIndex, 1)[0];
            return [updated, ...updatedConvs];
        });
    }, [messages]); // Update list when socket message arrives

    // Context menu handlers
    const handleContextMenu = (event, conversation) => {
        event.preventDefault();
        setSelectedConv(conversation);
        setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handlePinConversation = async () => {
        if (!selectedConv) return;
        const convId = selectedConv.id || selectedConv._id;
        try {
            await api.post(`/chat/conversations/${convId}/pin`, {
                is_pinned: !selectedConv.is_pinned
            });
            setConversations(prev => prev.map(c => 
                (c.id || c._id) === convId 
                    ? { ...c, is_pinned: !c.is_pinned } 
                    : c
            ));
            showNotification(selectedConv.is_pinned ? 'Conversation unpinned' : 'Conversation pinned');
        } catch (error) {
            console.error('Failed to pin conversation:', error);
            showNotification('Failed to pin conversation', 'error');
        }
        handleCloseContextMenu();
    };

    const handleArchiveConversation = async () => {
        if (!selectedConv) return;
        const convId = selectedConv.id || selectedConv._id;
        try {
            await api.post(`/chat/conversations/${convId}/archive`, {
                is_archived: !selectedConv.is_archived
            });
            setConversations(prev => prev.filter(c => (c.id || c._id) !== convId));
            showNotification(selectedConv.is_archived ? 'Conversation unarchived' : 'Conversation archived');
        } catch (error) {
            console.error('Failed to archive conversation:', error);
            showNotification('Failed to archive conversation', 'error');
        }
        handleCloseContextMenu();
    };

    const handleMuteConversation = async () => {
        if (!selectedConv) return;
        const convId = selectedConv.id || selectedConv._id;
        try {
            await api.patch(`/chat/conversations/${convId}/settings`, {
                is_muted: !selectedConv.is_muted
            });
            setConversations(prev => prev.map(c => 
                (c.id || c._id) === convId 
                    ? { ...c, is_muted: !c.is_muted } 
                    : c
            ));
            showNotification(selectedConv.is_muted ? 'Notifications unmuted' : 'Notifications muted');
        } catch (error) {
            console.error('Failed to mute conversation:', error);
            showNotification('Failed to update notifications', 'error');
        }
        handleCloseContextMenu();
    };

    const handleDeleteConversation = async () => {
        if (!selectedConv) return;
        if (!globalThis.confirm('Delete this conversation? This cannot be undone.')) {
            handleCloseContextMenu();
            return;
        }
        const convId = selectedConv.id || selectedConv._id;
        try {
            await api.delete(`/chat/conversations/${convId}`);
            setConversations(prev => prev.filter(c => (c.id || c._id) !== convId));
            showNotification('Conversation deleted');
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            showNotification('Failed to delete conversation', 'error');
        }
        handleCloseContextMenu();
    };

    const handleSelectConversation = (conversationId) => {
        if (onSelectConversation) {
            onSelectConversation(conversationId);
        } else {
            navigate(`/chat/${conversationId}`);
        }
    };

    // Filter conversations by search query and archive status
    const filteredConversations = useMemo(() => conversations.filter(conv => {
        // Filter by archive status
        if (showArchived && !conv.is_archived) return false;
        if (!showArchived && conv.is_archived) return false;
        
        // Filter by debounced search query
        if (!debouncedSearch.trim()) return true;
        const query = debouncedSearch.toLowerCase();
        const name = conv.other_user?.name?.toLowerCase() || '';
        const lastMsg = conv.last_message?.content?.toLowerCase() || '';
        return name.includes(query) || lastMsg.includes(query);
    }), [conversations, debouncedSearch, showArchived]);

    // Memoized archived count for the archive folder entry
    const archivedCount = useMemo(
        () => conversations.filter(c => c.is_archived).length,
        [conversations]
    );

    // Sort: pinned first, then by recent
    const sortedConversations = useMemo(() => {
        return [...filteredConversations].sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            const timeA = new Date(a.updated_at || a.last_message?.created_at || 0);
            const timeB = new Date(b.updated_at || b.last_message?.created_at || 0);
            return timeB - timeA;
        });
    }, [filteredConversations]);

    if (loading) {
        return (
            <Box sx={{ p: 2, maxWidth: 600, margin: '0 auto' }}>
                <Typography variant="h5" gutterBottom>
                    Messages
                </Typography>
                <Paper elevation={2}>
                    <ConversationSkeleton count={8} />
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2, maxWidth: 600, margin: '0 auto' }}>
            <Typography variant="h5" gutterBottom>
                Messages
            </Typography>
            
            {/* Search Bar */}
            <TextField
                fullWidth
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={handleSearchChange}
                sx={{ mb: 2 }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon />
                        </InputAdornment>
                    ),
                }}
            />
            
            <Paper elevation={2}>
                <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                    {/* Archive Folder Entry (only show if not in archived view and has archived convs) */}
                    {archivedCount > 0 && !showArchived && (
                        <>
                            <ListItem
                                onClick={() => setShowArchived(true)}
                                sx={{ 
                                    cursor: 'pointer', 
                                    '&:hover': { bgcolor: 'action.hover' },
                                    bgcolor: 'action.hover'
                                }}
                            >
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                                        <ArchiveIcon />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary="Archived"
                                    secondary={`${archivedCount} conversation${archivedCount !== 1 ? 's' : ''}`}
                                />
                            </ListItem>
                            <Divider />
                        </>
                    )}
                    
                    {/* Back from Archive button */}
                    {showArchived && (
                        <>
                            <ListItem
                                onClick={() => setShowArchived(false)}
                                sx={{ 
                                    cursor: 'pointer', 
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <ListItemAvatar>
                                    <IconButton edge="start">
                                        <ArrowBackIcon />
                                    </IconButton>
                                </ListItemAvatar>
                                <ListItemText
                                    primary="Back to Conversations"
                                />
                            </ListItem>
                            <Divider />
                        </>
                    )}
                    
                    {sortedConversations.length === 0 ? (
                        <Box 
                            p={6} 
                            textAlign="center"
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2
                            }}
                        >
                            <ChatBubbleOutlineIcon 
                                sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} 
                            />
                            <Typography variant="h6" color="textSecondary">
                                {showArchived ? 'No archived conversations' : 'No conversations yet'}
                            </Typography>
                            {!showArchived && (
                                <>
                                    <Typography variant="body2" color="textSecondary">
                                        Start a conversation with an Acharya to get spiritual guidance
                                    </Typography>
                                    <Button 
                                        variant="contained" 
                                        color="primary"
                                        onClick={() => navigate('/acharyas')}
                                        sx={{ mt: 2 }}
                                    >
                                        Browse Acharyas
                                    </Button>
                                </>
                            )}
                        </Box>
                    ) : (
                        sortedConversations.map((conv, index) => {
                            // Backend enriches with other_user object directly
                            const otherUser = conv.other_user;
                            const lastMsg = conv.last_message;
                            // Backend returns both created_at and timestamp for compatibility
                            const lastMsgTime = lastMsg?.timestamp || lastMsg?.created_at;
                            
                            return (
                                <React.Fragment key={conv.id || conv._id}>
                                    <ListItem 
                                        onClick={() => handleSelectConversation(conv.id || conv._id)}
                                        onContextMenu={(e) => handleContextMenu(e, conv)}
                                        alignItems="flex-start"
                                        secondaryAction={
                                            <IconButton 
                                                edge="end" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleContextMenu(e, conv);
                                                }}
                                            >
                                                <MoreVertIcon />
                                            </IconButton>
                                        }
                                        sx={{ 
                                            cursor: 'pointer', 
                                            '&:hover': { bgcolor: 'action.hover' },
                                            bgcolor: (selectedConversationId === (conv.id || conv._id)) ? 'action.selected' : 'transparent'
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Badge 
                                                color="success" 
                                                variant="dot" 
                                                invisible={!otherUser?.is_online}
                                                overlap="circular"
                                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            >
                                                <Avatar alt={otherUser?.name} src={otherUser?.profile_picture || otherUser?.profile_image} />
                                            </Badge>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                    <Box display="flex" alignItems="center" gap={0.5}>
                                                        {conv.is_pinned && (
                                                            <PushPinIcon fontSize="small" sx={{ color: 'primary.main', mr: 0.5 }} />
                                                        )}
                                                        <Typography variant="subtitle1" component="span" sx={{ fontWeight: conv.unread_count > 0 ? 600 : 400 }}>
                                                            {otherUser?.name || 'Unknown User'}
                                                        </Typography>
                                                    </Box>
                                                    <Box display="flex" alignItems="center" gap={0.5}>
                                                        {conv.is_muted && (
                                                            <NotificationsOffIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                        )}
                                                        {lastMsgTime && (
                                                            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
                                                                {getConversationTime(lastMsgTime)}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Box>
                                            }
                                            secondary={
                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                    <Typography
                                                        component="span"
                                                        variant="body2"
                                                        color="text.primary"
                                                        sx={{ 
                                                            display: '-webkit-box',
                                                            overflow: 'hidden',
                                                            WebkitBoxOrient: 'vertical',
                                                            WebkitLineClamp: 1,
                                                            flex: 1,
                                                            fontWeight: conv.unread_count > 0 ? 600 : 400
                                                        }}
                                                    >
                                                        {lastMsg?.content || 'No messages yet'}
                                                    </Typography>
                                                    {conv.unread_count > 0 && (
                                                        <Chip 
                                                            label={conv.unread_count} 
                                                            size="small" 
                                                            color="primary" 
                                                            sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                    {index < conversations.length - 1 && <Divider variant="inset" component="li" />}
                                </React.Fragment>
                            );
                        })
                    )}
                </List>
            </Paper>
            
            {/* Context Menu */}
            <Menu
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu.mouseY !== null && contextMenu.mouseX !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
                open={contextMenu.mouseY !== null}
                onClose={handleCloseContextMenu}
            >
                {selectedConv && (
                    [
                        <MenuItem key="pin" onClick={handlePinConversation}>
                            <ListItemIcon>
                                {selectedConv.is_pinned ? <UnarchiveIcon fontSize="small" /> : <PushPinIcon fontSize="small" />}
                            </ListItemIcon>
                            {selectedConv.is_pinned ? 'Unpin' : 'Pin'} Conversation
                        </MenuItem>,
                        <MenuItem key="archive" onClick={handleArchiveConversation}>
                            <ListItemIcon>
                                {selectedConv.is_archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                            </ListItemIcon>
                            {selectedConv.is_archived ? 'Unarchive' : 'Archive'} Conversation
                        </MenuItem>,
                        <MenuItem key="mute" onClick={handleMuteConversation}>
                            <ListItemIcon>
                                {selectedConv.is_muted ? <NotificationsIcon fontSize="small" /> : <NotificationsOffIcon fontSize="small" />}
                            </ListItemIcon>
                            {selectedConv.is_muted ? 'Unmute' : 'Mute'} Notifications
                        </MenuItem>,
                        <Divider key="divider" />,
                        <MenuItem key="delete" onClick={handleDeleteConversation} sx={{ color: 'error.main' }}>
                            <ListItemIcon>
                                <DeleteIcon fontSize="small" color="error" />
                            </ListItemIcon>
                            Delete Conversation
                        </MenuItem>
                    ]
                )}
            </Menu>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3500}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

Conversations.propTypes = {
    onSelectConversation: PropTypes.func,
    selectedConversationId: PropTypes.string
};

export default React.memo(Conversations);