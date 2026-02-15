import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Avatar, 
  IconButton,
  CircularProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const Chat = () => {
  const { conversationId, recipientId } = useParams(); // Should handle both URL params based on route
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected, messages: socketMessages, sendMessage: sendSocketMessage } = useSocket();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchChatData = async () => {
      try {
        let endpoint = '';
        if (conversationId) {
          endpoint = `/chat/conversations/${conversationId}/messages`;
        } else if (recipientId) {
          // If starting new chat with verify user via recipientId
          // This usually requires creating conversation first or fetching existing one
          const convRes = await api.post('/chat/verify-conversation', { recipient_id: recipientId });
          if(convRes.data.conversation_id) {
             // Redirect to conversation view to keep logic simple
             navigate(`/chat/${convRes.data.conversation_id}`, { replace: true });
             return;
          }
          // Otherwise handle new conversation logic here (less likely for this MVP step)
        }

        if (endpoint) {
          const res = await api.get(endpoint);
          setMessages(res.data.messages);
          setRecipient(res.data.recipient); // Assuming backend returns recipient info
        }
      } catch (err) {
        console.error("Failed to load chat", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchChatData();
    }
  }, [conversationId, recipientId, user, navigate]);

  // Listen for real-time messages
  useEffect(() => {
    if (socketMessages.length > 0) {
      const lastMsg = socketMessages[socketMessages.length - 1];
      // Check if message belongs to current conversation
      if (lastMsg.conversation_id === conversationId || lastMsg.sender_id === recipient?._id) {
         setMessages(prev => [...prev, lastMsg]);
      }
    }
  }, [socketMessages, conversationId, recipient]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !recipient) return;

    try {
      // Send via REST API for persistence
      const payload = {
        receiver_id: recipient._id,
        content: newMessage
      };
      
      const res = await api.post('/chat/messages', payload);
      
      // Optimistically add to UI
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
      
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Container maxWidth="md" sx={{ mt: 2, height: '85vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Avatar src={recipient?.profile_image} alt={recipient?.name} sx={{ mr: 2 }} />
        <Box>
           <Typography variant="h6">{recipient?.name || 'Loading...'}</Typography>
           <Typography variant="caption" color={recipient?.is_online ? 'success.main' : 'text.secondary'}>
             {recipient?.is_online ? 'Online' : 'Offline'}
           </Typography>
        </Box>
      </Paper>

      {/* Messages Area */}
      <Paper elevation={0} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === user.id;
          return (
            <Box 
              key={idx} 
              sx={{ 
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '70%',
                mb: 1.5,
                p: 1.5,
                bgcolor: isMe ? 'primary.main' : 'white',
                color: isMe ? 'white' : 'text.primary',
                borderRadius: 2,
                boxShadow: 1
              }}
            >
              <Typography variant="body1">{msg.content}</Typography>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, opacity: 0.7 }}>
                 {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          );
        })}
        <div ref={messagesEndRef} />
      </Paper>

      {/* Input Area */}
      <Paper elevation={3} sx={{ p: 2, mt: 2, display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
              }
          }}
          disabled={!isConnected}
          size="small"
        />
        <Button 
           variant="contained" 
           color="primary" 
           endIcon={<SendIcon />} 
           onClick={handleSend}
           sx={{ ml: 2, height: 40 }}
           disabled={!newMessage.trim() || !isConnected}
        >
          Send
        </Button>
      </Paper>
    </Container>
  );
};

export default Chat;