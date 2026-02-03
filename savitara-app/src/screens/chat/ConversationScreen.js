import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import * as ScreenCapture from 'expo-screen-capture';
import { chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ConversationScreen = ({ route }) => {
  const { conversationId, otherUserName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const loadMessages = async () => {
    try {
      const response = await chatAPI.getMessages(conversationId, { limit: 50 });
      const messagesData = response.data.messages || [];
      
      const formattedMessages = messagesData.map((msg) => ({
        _id: msg._id,
        text: msg.content,
        createdAt: new Date(msg.sent_at),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === user._id ? user.full_name : otherUserName,
        },
      })).reverse();
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
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
      await chatAPI.sendMessage(conversationId, {
        content: message.text,
      });
      
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, newMessages)
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  }, [conversationId]);

  return (
    <View style={styles.container}>
      {/* Watermark Overlay */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        {Array(10).fill(0).map((_, i) => (
          <View key={i} style={styles.watermarkRow}>
            {Array(3).fill(0).map((_, j) => (
              <Text key={`${i}-${j}`} style={styles.watermarkText}>
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

export default ConversationScreen;
