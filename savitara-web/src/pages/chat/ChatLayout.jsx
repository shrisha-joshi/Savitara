import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Paper,
  useMediaQuery,
  useTheme
} from '@mui/material';
import Conversations from './Conversations';
import Chat from './Chat';
import ChatErrorBoundary from '../../components/ChatErrorBoundary';
import ConnectionStatus from '../../components/ConnectionStatus';

const ChatLayout = () => {
  const { conversationId, recipientId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedConversationId, setSelectedConversationId] = useState(conversationId || null);

  useEffect(() => {
    if (conversationId) {
      setSelectedConversationId(conversationId);
    }
  }, [conversationId]);

  const handleSelectConversation = (convId) => {
    setSelectedConversationId(convId);
    if (isMobile) {
      // On mobile, navigate to chat view
      navigate(`/chat/${convId}`);
    } else {
      // On desktop, update URL without navigation
      navigate(`/chat/${convId}`, { replace: true });
    }
  };

  const handleStartNewChat = (recipientId) => {
    if (isMobile) {
      navigate(`/chat/u/${recipientId}`);
    } else {
      // For desktop, we could handle this differently
      navigate(`/chat/u/${recipientId}`, { replace: true });
    }
  };

  if (isMobile) {
    // On mobile, show either conversations or chat based on route
    if (conversationId || recipientId) {
      return (
        <ChatErrorBoundary>
          <ConnectionStatus />
          <Chat />
        </ChatErrorBoundary>
      );
    } else {
      return (
        <ChatErrorBoundary>
          <ConnectionStatus />
          <Conversations onSelectConversation={handleSelectConversation} />
        </ChatErrorBoundary>
      );
    }
  }

  // Desktop layout: side by side
  return (
    <ChatErrorBoundary>
      <ConnectionStatus />
      <Container maxWidth="xl" sx={{ height: '85vh', mt: 2 }}>
        <Paper elevation={2} sx={{ height: '100%', display: 'flex' }}>
          <Grid container sx={{ height: '100%' }}>
            {/* Conversations Sidebar */}
            <Grid item xs={12} md={4} lg={3} sx={{
              borderRight: 1,
              borderColor: 'divider',
              height: '100%',
              overflow: 'hidden'
            }}>
              <Conversations
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversationId}
              />
            </Grid>

            {/* Chat Area */}
            <Grid item xs={12} md={8} lg={9} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {selectedConversationId ? (
                <Chat inLayout={true} conversationId={selectedConversationId} />
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    bgcolor: '#f5f5f5'
                  }}
                >
                  <Box textAlign="center">
                    <img
                      src="/chat-placeholder.svg"
                      alt="Select conversation"
                      style={{ width: 120, height: 120, opacity: 0.5, marginBottom: 16 }}
                    />
                    <h3 style={{ color: '#666', margin: 0 }}>Select a conversation</h3>
                    <p style={{ color: '#999', margin: 8 }}>Choose from your existing conversations or start a new chat</p>
                  </Box>
                </Box>
              )}
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </ChatErrorBoundary>
  );
};

export default ChatLayout;