import * as Haptics from 'expo-haptics';
import * as ScreenCapture from 'expo-screen-capture';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Bubble, GiftedChat } from 'react-native-gifted-chat';
import EmojiPicker from '../../components/EmojiPicker';
import MessageReactions from '../../components/MessageReactions';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { chatAPI } from '../../services/api';

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
  const { conversationId, otherUserName } = route.params;
  const [receiverId, setReceiverId] = useState(route.params.otherUserId || null);
  const { user } = useAuth();
  const { chatMessages } = useSocket();
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
  }, []);

  // Listen for real-time messages from SocketContext
  useEffect(() => {
    if (chatMessages.length === 0) return;
    
    const lastMsg = chatMessages[chatMessages.length - 1];
    
    // Handle reaction events
    if (lastMsg.type === 'reaction_added' || lastMsg.type === 'reaction_removed') {
      if (lastMsg.message_id) {
        handleReactionUpdate(lastMsg);
      }
      return;
    }
    
    // Handle new messages for this conversation
    if (lastMsg.conversation_id === conversationId && lastMsg.content) {
      const formattedMsg = {
        _id: lastMsg._id || lastMsg.id,
        text: lastMsg.content,
        createdAt: new Date(lastMsg.created_at || lastMsg.timestamp || Date.now()),
        user: {
          _id: lastMsg.sender_id,
          name: lastMsg.sender_id === (user._id || user.id) ? user.full_name : otherUserName,
        },
      };
      
      // Deduplicate — don't add if already exists
      setMessages(prev => {
        const exists = prev.some(m => m._id === formattedMsg._id);
        if (exists) return prev;
        return GiftedChat.append(prev, [formattedMsg]);
      });
    }
  }, [chatMessages]);

  const loadMessages = async () => {
    try {
      const response = await chatAPI.getMessages(conversationId, { limit: 50 });
      // Use new backend response structure
      const msgData = response.data.data || response.data;
      const messagesData = msgData?.messages || [];
      const currentUserId = user._id || user.id;
      
      // If otherUserId wasn't passed, try to extract from recipient or messages
      if (!receiverId) {
        const recipientFromBackend = msgData?.recipient;
        if (recipientFromBackend) {
          setReceiverId(recipientFromBackend.id || recipientFromBackend._id);
        } else {
          // Fallback: find a message from someone else
          const otherMsg = messagesData.find(m => m.sender_id !== currentUserId);
          if (otherMsg) {
            setReceiverId(otherMsg.sender_id);
          }
        }
      }
      
      const formattedMessages = messagesData.map((msg) => ({
        _id: msg._id || msg.id,
        text: msg.content,
        createdAt: new Date(msg.created_at || msg.timestamp),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === currentUserId ? user.full_name || user.name : otherUserName,
        },
      })).reverse();
      setMessages(formattedMessages);

      // Seed reactions from loaded messages so they display before any WS events
      const reactionsMap = {};
      messagesData.forEach((msg) => {
        const id = msg._id || msg.id;
        if (id && Array.isArray(msg.reactions) && msg.reactions.length > 0) {
          reactionsMap[id] = msg.reactions;
        }
      });
      setMessageReactions(reactionsMap);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleReactionUpdate = (data) => {
    if (!data.message_id) return;
    const { message_id, type, user_id, emoji } = data;
    setMessageReactions((prev) => {
      const current = prev[message_id] || [];
      let updated;
      if (type === 'reaction_added') {
        const alreadyExists = current.some(
          (r) => r.user_id === user_id && r.emoji === emoji
        );
        updated = alreadyExists
          ? current
          : [...current, { user_id, emoji, created_at: new Date().toISOString() }];
      } else {
        // reaction_removed
        updated = current.filter(
          (r) => !(r.user_id === user_id && r.emoji === emoji)
        );
      }
      return { ...prev, [message_id]: updated };
    });
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
      await chatAPI.sendMessage({ receiver_id: receiverId, content: message.text });
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, newMessages)
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  }, [conversationId, receiverId]);

  const handleLongPress = (context, message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessageId(message._id);
    setEmojiPickerVisible(true);
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      await chatAPI.addReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      await chatAPI.removeReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  const currentUserId = user._id || user.id;
  
  const renderBubble = (props) => {
    const reactions = messageReactions[props.currentMessage._id] || [];
    return (
      <BubbleRenderer
        {...props}
        reactions={reactions}
        currentUserId={currentUserId}
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
          <View key={`${currentUserId}-row-${i}`} style={styles.watermarkRow}>
            {new Array(3).fill(0).map((_, j) => (
              <Text key={`${currentUserId}-cell-${i}-${j}`} style={styles.watermarkText}>
                {currentUserId}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <GiftedChat
        messages={messages}
        onSend={(msgs) => onSend(msgs)}
        user={{
          _id: currentUserId,
          name: user.full_name || user.name,
        }}
        renderUsernameOnMessage
        showUserAvatar
        renderBubble={renderBubble}
        onLongPress={handleLongPress}
      />
      
      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onSelectEmoji={(emoji, msgId) => handleAddReaction(msgId, emoji)}
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
  route: PropTypes.shape({
    params: PropTypes.shape({
      conversationId: PropTypes.string.isRequired,
      otherUserName: PropTypes.string,
      otherUserId: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

export default ConversationScreen;
