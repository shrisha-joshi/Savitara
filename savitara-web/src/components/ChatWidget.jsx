import { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, TextField, Button, Typography, Avatar,
  List, ListItem, ListItemAvatar,
  IconButton, Badge, CircularProgress
} from '@mui/material';
import {
  Send, Close,
  Check, DoneAll, AccessTime
} from '@mui/icons-material';
import { format, isToday, isYesterday } from 'date-fns';

const ChatWidget = ({ 
  isOpen, 
  onClose, 
  conversationId, 
  currentUser, 
  recipientUser 
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen && conversationId) {
      initializeWebSocket();
      loadMessages();
    }

    return () => {
      if (ws) {
        ws.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isOpen, conversationId]);

  const initializeWebSocket = () => {
    const websocket = new WebSocket(
      `${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}/ws/${currentUser.id}`
    );

    websocket.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    websocket.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      // Attempt reconnection
      setTimeout(() => {
        if (isOpen) {
          initializeWebSocket();
        }
      }, 3000);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    setWs(websocket);
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'new_message':
        if (message.conversation_id === conversationId) {
          setMessages(prev => [...prev, message.data]);
          scrollToBottom();
        }
        break;
      
      case 'typing_indicator':
        if (message.conversation_id === conversationId && message.user_id !== currentUser.id) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
        break;
      
      case 'message_read':
        if (message.conversation_id === conversationId) {
          setMessages(prev => prev.map(msg =>
            msg.id === message.message_id
              ? { ...msg, read: true, read_at: message.read_at }
              : msg
          ));
        }
        break;
      
      default:
        break;
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/v1/chat/conversations/${conversationId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data.messages || []);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !ws || !isConnected) return;

    const messageData = {
      type: 'send_message',
      conversation_id: conversationId,
      content: newMessage,
      timestamp: new Date().toISOString()
    };

    try {
      ws.send(JSON.stringify(messageData));
      
      // Optimistically add to UI
      const tempMessage = {
        id: `temp-${Date.now()}`,
        sender_id: currentUser.id,
        content: newMessage,
        created_at: new Date().toISOString(),
        read: false,
        sending: true
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const sendTypingIndicator = () => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'typing_indicator',
        conversation_id: conversationId,
        user_id: currentUser.id
      }));
    }
  };

  const markAsRead = (messageId) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'mark_read',
        conversation_id: conversationId,
        message_id: messageId
      }));
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd, HH:mm');
    }
  };

  const getMessageStatus = (message) => {
    if (message.sending) {
      return <AccessTime fontSize="small" sx={{ color: 'text.disabled' }} />;
    }
    if (message.read) {
      return <DoneAll fontSize="small" sx={{ color: 'primary.main' }} />;
    }
    return <Check fontSize="small" sx={{ color: 'text.disabled' }} />;
  };

  if (!isOpen) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: { xs: '100%', sm: 400 },
        maxWidth: '100%',
        height: { xs: '100vh', sm: 600 },
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1300,
        borderRadius: { xs: 0, sm: 2 }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: { xs: 0, sm: 8 },
          borderTopRightRadius: { xs: 0, sm: 8 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant="dot"
            color={isConnected ? 'success' : 'error'}
          >
            <Avatar src={recipientUser?.avatar} alt={recipientUser?.name}>
              {recipientUser?.name?.charAt(0)}
            </Avatar>
          </Badge>
          <Box sx={{ ml: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {recipientUser?.name || 'Chat'}
            </Typography>
            <Typography variant="caption">
              {isTyping ? 'typing...' : (isConnected ? 'Online' : 'Connecting...')}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.50',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>No messages yet</Typography>
            <Typography variant="body2">Start the conversation!</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {messages.map((message, index) => {
              const isOwn = message.sender_id === currentUser.id;
              const showAvatar = index === 0 || 
                messages[index - 1].sender_id !== message.sender_id;

              return (
                <ListItem
                  key={message.id}
                  sx={{
                    display: 'flex',
                    flexDirection: isOwn ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    px: 0,
                    py: 0.5
                  }}
                >
                  {showAvatar && !isOwn && (
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar
                        src={recipientUser?.avatar}
                        sx={{ width: 32, height: 32 }}
                      >
                        {recipientUser?.name?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                  )}
                  {!showAvatar && !isOwn && <Box sx={{ width: 40 }} />}
                  
                  <Box
                    sx={{
                      maxWidth: '70%',
                      bgcolor: isOwn ? 'primary.main' : 'white',
                      color: isOwn ? 'white' : 'text.primary',
                      borderRadius: 2,
                      p: 1.5,
                      boxShadow: 1
                    }}
                  >
                    <Typography variant="body2">{message.content}</Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 0.5,
                        mt: 0.5
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.7,
                          fontSize: '0.7rem'
                        }}
                      >
                        {formatMessageTime(message.created_at)}
                      </Typography>
                      {isOwn && getMessageStatus(message)}
                    </Box>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'white',
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end'
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            sendTypingIndicator();
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message..."
          disabled={!isConnected}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3
            }
          }}
        />
        <Button
          variant="contained"
          onClick={sendMessage}
          disabled={!newMessage.trim() || !isConnected}
          sx={{
            minWidth: 48,
            height: 40,
            borderRadius: 3
          }}
        >
          <Send />
        </Button>
      </Box>
    </Paper>
  );
};

export default ChatWidget;
