import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, FlatList } from 'react-native';
import { List, Avatar, Badge, Text } from 'react-native-paper';
import { chatAPI } from '../../services/api';

const ChatListScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations();
      // Backend wraps in StandardResponse: { success, data: { conversations } }
      setConversations(response.data?.data?.conversations || response.data?.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderConversation = ({ item }) => {
    // Use new backend fields for user and message
    const otherUser = item.other_user || {};
    const lastMsg = item.last_message || {};
    return (
      <List.Item
        title={otherUser.name || 'Unknown User'}
        description={lastMsg.content || 'No messages yet'}
        left={() => <Avatar.Image 
          size={50} 
          source={{ uri: otherUser.profile_picture || otherUser.profile_image || 'https://via.placeholder.com/50' }} 
        />}
          conversationId: item.id || item._id,
          otherUserName: otherUser.name || 'Unknown User',
        })}
      />
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <Text style={styles.centerText}>Loading...</Text>
      ) : conversations.length === 0 ? (
        <Text style={styles.centerText}>No conversations yet</Text>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  centerText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
});

ChatListScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
};

export default ChatListScreen;
