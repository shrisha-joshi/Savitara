import React, { useState, useEffect } from 'react';
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
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderConversation = ({ item }) => (
    <List.Item
      title={item.other_user_name}
      description={item.last_message?.content || 'No messages yet'}
      left={() => (
        <Avatar.Image 
          size={50} 
          source={{ uri: item.other_user_picture || 'https://via.placeholder.com/50' }} 
        />
      )}
      right={() => (
        <>
          {item.unread_count > 0 && (
            <Badge style={styles.badge}>{item.unread_count}</Badge>
          )}
        </>
      )}
      onPress={() => navigation.navigate('Conversation', { 
        conversationId: item._id,
        otherUserName: item.other_user_name 
      })}
    />
  );

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

export default ChatListScreen;
