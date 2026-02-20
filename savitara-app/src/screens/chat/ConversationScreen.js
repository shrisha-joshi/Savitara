import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, Text } from 'react-native';
import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import * as ScreenCapture from 'expo-screen-capture';
import * as Haptics from 'expo-haptics';
import { chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import EmojiPicker from '../../components/EmojiPicker';
import MessageReactions from '../../components/MessageReactions';
import { useSocket } from '../../context/SocketContext';

function BubbleRenderer({ currentMessage, reactions, currentUserId, onAddReaction, onRemoveReaction, ...props }) {
  return (
    <View>
      <Bubble
        currentMessage={currentMessage}
        {...props}
        wrapperStyle={{
          left: { backgroundColor: '#F0F0F0' },
          right: { backgroundColor: '#FF6B35' },
        }}
      />
      {reactions.length > 0 && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
          messageId={currentMessage._id}
          compact
        />
      )}
    </View>
  );
}
BubbleRenderer.propTypes = {
  currentMessage: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
  reactions: PropTypes.array.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onAddReaction: PropTypes.func.isRequired,
  onRemoveReaction: PropTypes.func.isRequired,
};

const ConversationScreen = ({ route }) => {
  const { conversationId, otherUserId, otherUserName } = route.params;
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [messageReactions, setMessageReactions] = useState({}); // messageId -> reactions array

  // Prevent screen capture on mount, allow on unmount
  useEffect(() => {
    const activateProtection = async () => {
      await ScreenCapture.preventScreenCaptureAsync();
    };
    activateProtection();
    
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    loadMessages();
    markAsRead();
    
    // WebSocket listeners for real-time reactions
    if (socket) {
      socket.on('reaction_added', handleReactionUpdate);
      socket.on('reaction_removed', handleReactionUpdate);
      
      return () => {
        socket.off('reaction_added', handleReactionUpdate);
        socket.off('reaction_removed', handleReactionUpdate);
      };
    }
  }, [socket]);

  const loadMessages = async () => {
    try {
      const response = await chatAPI.getMessages(conversationId, { limit: 50 });
      // Use new backend response structure
      const messagesData = response.data.data?.messages || response.data.messages || [];
      const formattedMessages = messagesData.map((msg) => ({
        _id: msg._id || msg.id,
        text: msg.content,
        createdAt: new Date(msg.created_at || msg.timestamp),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === user._id ? user.full_name : otherUserName,
        },
      })).reverse();
      setMessages(formattedMessages);
      
      // Load reactions for all messages
      await loadReactionsForMessages(messagesData.map(m => m._id || m.id));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadReactionsForMessages = async (messageIds) => {
    try {
      const reactionsMap = {};
      
      // Load reactions for each message (batch if possible in future)
      for (const messageId of messageIds) {
        try {
          const response = await chatAPI.getReactions(messageId);
          reactionsMap[messageId] = response.data.data || [];
        } catch (error) {
          console.error(`Failed to load reactions for message ${messageId}:`, error);
          reactionsMap[messageId] = [];
        }
      }
      
      setMessageReactions(reactionsMap);
    } catch (error) {
      console.error('Failed to load reactions:', error);
    }
  };

  const handleReactionUpdate = (data) => {
    if (data.message_id) {
      setMessageReactions((prev) => ({
        ...prev,
        [data.message_id]: data.reactions || [],
      }));
    }
  };

  const markAsRead = async () => {
    try {
      await chatAPI.markAsRead(conversationId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const onSend = useCallback(async (newMessages = []) => {
    const message = newMessages[0];
    try {
      // Use correct backend endpoint: POST /chat/messages with receiver_id
      await chatAPI.sendMessage({ receiver_id: otherUserId, content: message.text });
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, newMessages)
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  }, [conversationId]);

  const handleLongPress = (context, message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessageId(message._id);
    setEmojiPickerVisible(true);
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      await chatAPI.addReaction(messageId, emoji);
      // Optimistic update
      const response = await chatAPI.getReactions(messageId);
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: response.data.data || [],
      }));
    } catch (error) {
      console.error('Failed to add reaction:', error);
      alert('Failed to add reaction');
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      await chatAPI.removeReaction(messageId, emoji);
      // Optimistic update
      const response = await chatAPI.getReactions(messageId);
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: response.data.data || [],
      }));
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      alert('Failed to remove reaction');
    }
  };

  const renderBubble = (props) => {
    const reactions = messageReactions[props.currentMessage._id] || [];
    return (
      <BubbleRenderer
        {...props}
        reactions={reactions}
        currentUserId={user._id}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Watermark Overlay */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        {new Array(10).fill(0).map((_, i) => (
          <View key={`${user._id}-row-${i}`} style={styles.watermarkRow}>
            {new Array(3).fill(0).map((_, j) => (
              <Text key={`${user._id}-cell-${i}-${j}`} style={styles.watermarkText}>
                {user._id}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <GiftedChat
        messages={messages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: user._id,
          name: user.full_name,
        }}
        renderUsernameOnMessage
        showUserAvatar
        renderBubble={renderBubble}
        onLongPress={handleLongPress}
      />
      
      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onSelectEmoji={handleAddReaction}
        messageId={selectedMessageId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
    opacity: 0.05, // Very faint
    zIndex: 1000,
    overflow: 'hidden',
  },
  watermarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    transform: [{ rotate: '-45deg' }],
  },
  watermarkText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});

ConversationScreen.propTypes = {
  route: PropTypes.object.isRequired,
};

export default ConversationScreen;
