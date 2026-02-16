import React, { useState, useEffect } from 'react';
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
  Button
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import ConversationSkeleton from '../../components/ConversationSkeleton';
import { getConversationTime } from '../../utils/timeFormat';

const Conversations = ({ onSelectConversation, selectedConversationId }) => {
    const navigate = useNavigate();
    const { messages } = useSocket(); // To update list when new msg arrives
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch conversations only on mount
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                // Adjust endpoint based on backend structure
                const response = await api.get('/chat/conversations');
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

    const handleSelectConversation = (conversationId) => {
        if (onSelectConversation) {
            onSelectConversation(conversationId);
        } else {
            navigate(`/chat/${conversationId}`);
        }
    };

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
            <Paper elevation={2}>
                <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                    {conversations.length === 0 ? (
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
                                No conversations yet
                            </Typography>
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
                        </Box>
                    ) : (
                        conversations.map((conv, index) => {
                            // Backend enriches with other_user object directly
                            const otherUser = conv.other_user;
                            const lastMsg = conv.last_message;
                            // Backend returns both created_at and timestamp for compatibility
                            const lastMsgTime = lastMsg?.timestamp || lastMsg?.created_at;
                            
                            return (
                                <React.Fragment key={conv.id || conv._id}>
                                    <ListItem 
                                        onClick={() => handleSelectConversation(conv.id || conv._id)}
                                        alignItems="flex-start"
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
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="subtitle1" component="span">
                                                        {otherUser?.name || 'Unknown User'}
                                                    </Typography>
                                                    {lastMsgTime && (
                                                        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
                                                            {getConversationTime(lastMsgTime)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <Typography
                                                    component="span"
                                                    variant="body2"
                                                    color="text.primary"
                                                    sx={{ 
                                                        display: '-webkit-box',
                                                        overflow: 'hidden',
                                                        WebkitBoxOrient: 'vertical',
                                                        WebkitLineClamp: 1
                                                    }}
                                                >
                                                    {lastMsg?.content || 'No messages yet'}
                                                </Typography>
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
        </Box>
    );
};

export default Conversations;

Conversations.propTypes = {
    onSelectConversation: PropTypes.func,
    selectedConversationId: PropTypes.string
};