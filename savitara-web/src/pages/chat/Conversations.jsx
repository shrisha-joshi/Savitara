import React, { useState, useEffect } from 'react';
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
  CircularProgress
} from '@mui/material';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
// date-fns is available in package.json
import { formatDistanceToNow } from 'date-fns';

const Conversations = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { messages } = useSocket(); // To update list when new msg arrives
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                // Adjust endpoint based on backend structure
                const response = await api.get('/chat/conversations');
                setConversations(response.data);
            } catch (error) {
                console.error("Failed to fetch conversations", error);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [messages]); // Refetch when new socket message arrives

    const handleSelectConversation = (conversationId) => {
        navigate(`/chat/${conversationId}`);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
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
                        <Box p={3} textAlign="center">
                            <Typography color="textSecondary">
                                No conversations yet.
                            </Typography>
                        </Box>
                    ) : (
                        conversations.map((conv, index) => {
                            const otherUser = conv.participants.find(p => p._id !== user.id) || conv.other_user;
                            const lastMsg = conv.last_message;
                            
                            return (
                                <React.Fragment key={conv._id}>
                                    <ListItem 
                                        button 
                                        onClick={() => handleSelectConversation(conv._id)}
                                        alignItems="flex-start"
                                    >
                                        <ListItemAvatar>
                                            <Badge 
                                                color="success" 
                                                variant="dot" 
                                                invisible={!otherUser?.is_online}
                                                overlap="circular"
                                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            >
                                                <Avatar alt={otherUser?.name} src={otherUser?.profile_image} />
                                            </Badge>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="subtitle1" component="span">
                                                        {otherUser?.name || 'Unknown User'}
                                                    </Typography>
                                                    {lastMsg?.timestamp && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            {formatDistanceToNow(new Date(lastMsg.timestamp), { addSuffix: true })}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                            secondary={
                                                <React.Fragment>
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
                                                </React.Fragment>
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