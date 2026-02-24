import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Appbar,
  List,
  Avatar,
  Checkbox,
  Searchbar,
  Button,
  Text,
  Chip,
  ActivityIndicator,
  Portal,
  Dialog,
} from 'react-native-paper';
import { chatAPI } from '../../services/api';

const MAX_FORWARD_TARGETS = 50;

const ForwardMessageScreen = ({ navigation, route }) => {
  const { message } = route.params;
  const [conversations, setConversations] = useState([]);
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const response = await chatAPI.getConversations({
        limit: 100,
      });

      const convs = response.data?.data?.conversations || response.data?.conversations || [];
      // Filter out current conversation
      const filtered = convs.filter(
        (conv) => (conv.id || conv._id) !== message?.conversation_id
      );
      setConversations(filtered);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleConversation = (conversationId) => {
    setSelectedConversations((prev) => {
      if (prev.includes(conversationId)) {
        return prev.filter((id) => id !== conversationId);
      } else {
        if (prev.length >= MAX_FORWARD_TARGETS) {
          Alert.alert('Limit Reached', `Maximum ${MAX_FORWARD_TARGETS} recipients allowed`);
          return prev;
        }
        setError('');
        return [...prev, conversationId];
      }
    });
  };

  const handleForward = async () => {
    if (selectedConversations.length === 0) {
      Alert.alert('No Selection', 'Please select at least one conversation');
      return;
    }

    try {
      setIsSending(true);
      setError('');

      // Extract user IDs from selected conversations
      const selectedUsers = selectedConversations
        .map((convId) => {
          const conv = conversations.find((c) => (c.id || c._id) === convId);
          // For 1-on-1 conversations, extract the other user's ID
          if (conv?.other_user) {
            return conv.other_user.id || conv.other_user._id;
          }
          return null;
        })
        .filter(Boolean);

      if (selectedUsers.length > 0) {
        // Forward via backend POST /messages/{id}/forward
        await chatAPI.forwardMessage(message.id || message._id, {
          recipient_ids: selectedUsers,
        });
      }

      // Success
      Alert.alert('Success', 'Message forwarded successfully');
      navigation.goBack();
    } catch (err) {
      console.error('Forward failed:', err);
      let errorMessage = 'Failed to forward message';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const userName = conv.other_user?.name?.toLowerCase() || '';
    return userName.includes(query);
  });

  const getMessagePreview = () => {
    if (!message) return '';
    if (message.message_type === 'voice') return '🎤 Voice message';
    if (message.message_type === 'image') return '🖼️ Image';
    if (message.message_type === 'video') return '🎥 Video';
    if (message.message_type === 'file') return '📎 File';
    const text = message.content || '';
    return text.length > 100 ? `${text.substring(0, 100)}...` : text;
  };

  const renderConversation = ({ item }) => {
    const otherUser = item.other_user || {};
    const convId = item.id || item._id;
    const isSelected = selectedConversations.includes(convId);

    return (
      <List.Item
        title={otherUser.name || 'Unknown User'}
        description={item.last_message?.content || 'No messages yet'}
        left={() => (
          <Avatar.Image
            size={50}
            source={{
              uri:
                otherUser.profile_picture ||
                otherUser.profile_image ||
                'https://via.placeholder.com/50',
            }}
          />
        )}
        right={() => <Checkbox status={isSelected ? 'checked' : 'unchecked'} />}
        onPress={() => handleToggleConversation(convId)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Forward Message" />
        <Appbar.Action
          icon="send"
          disabled={selectedConversations.length === 0 || isSending}
          onPress={handleForward}
        />
      </Appbar.Header>

      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Forwarding:</Text>
        <Text style={styles.previewText} numberOfLines={2}>
          {getMessagePreview()}
        </Text>
      </View>

      {selectedConversations.length > 0 && (
        <View style={styles.selectedContainer}>
          <Chip icon="account-multiple" style={styles.selectedChip}>
            {selectedConversations.length} selected
          </Chip>
        </View>
      )}

      <Searchbar
        placeholder="Search conversations..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No conversations found' : 'No conversations available'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id || item._id}
        />
      )}

      <Portal>
        <Dialog visible={isSending} dismissable={false}>
          <Dialog.Content>
            <View style={styles.sendingContainer}>
              <ActivityIndicator size="large" />
              <Text style={styles.sendingText}>Forwarding message...</Text>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  previewContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: '#333',
  },
  selectedContainer: {
    padding: 8,
    alignItems: 'center',
  },
  selectedChip: {
    backgroundColor: '#e3f2fd',
  },
  searchBar: {
    margin: 8,
    elevation: 0,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  sendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sendingText: {
    fontSize: 16,
  },
});

ForwardMessageScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired,
};

export default ForwardMessageScreen;
