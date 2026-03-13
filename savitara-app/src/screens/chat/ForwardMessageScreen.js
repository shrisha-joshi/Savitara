import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Avatar,
    Checkbox,
    Chip,
    Dialog,
    List,
    Portal,
    Searchbar,
    Text
} from 'react-native-paper';
import { getAvatarColor, getInitials } from '../../constants/avatars';
import { BRAND } from '../../constants/theme';
import { chatAPI } from '../../services/api';

const MAX_FORWARD_TARGETS = 5; // Max per spec

const renderForwardAvatar = (otherUser) => {
  const AvatarRenderer = (props) => {
    const avatarUri = otherUser.profile_picture || otherUser.profile_image;
    if (avatarUri) {
      return (
        <Avatar.Image
          {...props}
          size={50}
          source={{ uri: avatarUri }}
        />
      );
    }

    return (
      <Avatar.Text
        {...props}
        size={50}
        label={getInitials(otherUser.name)}
        style={{ backgroundColor: getAvatarColor(otherUser.id || otherUser._id) }}
      />
    );
  };
  AvatarRenderer.displayName = 'ForwardAvatar';
  return AvatarRenderer;
};

const renderForwardCheckbox = (isSelected) => {
  const CheckboxRenderer = () => {
    let status = 'unchecked';
    if (isSelected) {
      status = 'checked';
    }

    return <Checkbox status={status} />;
  };
  CheckboxRenderer.displayName = 'ForwardCheckbox';
  return CheckboxRenderer;
};

const getMessagePreview = (message) => {
  if (!message) return '';
  if (message.message_type === 'voice') return '🎤 Voice message';
  if (message.message_type === 'image') return '🖼️ Image';
  if (message.message_type === 'video') return '🎥 Video';
  if (message.message_type === 'file') return '📎 File';
  const text = message.content || '';
  if (text.length > 100) {
    return `${text.substring(0, 100)}...`;
  }
  return text;
};

function ForwardConversationItem({ item, isSelected, onToggle }) {
  const otherUser = item.other_user || {};
  const convId = item.id || item._id;

  return (
    <List.Item
      title={otherUser.name || 'Unknown User'}
      description={item.last_message?.content || 'No messages yet'}
      left={renderForwardAvatar(otherUser)}
      right={renderForwardCheckbox(isSelected)}
      onPress={() => onToggle(convId)}
    />
  );
}

ForwardConversationItem.propTypes = {
  item: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

const ForwardMessageScreen = ({ navigation, route }) => {
  const { message } = route.params;
  const [conversations, setConversations] = useState([]);
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

    const loadConversations = useCallback(async () => {
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
  }, [message]);

    useEffect(() => {
      loadConversations();
    }, [loadConversations]);

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

        if (selectedUsers.length === 0) {
          Alert.alert('No Valid Recipients', 'No valid recipients selected. Please select valid conversations.');
          return;
      }

        // Forward via backend POST /messages/{id}/forward
        await chatAPI.forwardMessage(message.id || message._id, {
          recipient_ids: selectedUsers,
        });

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

  const messagePreview = getMessagePreview(message);
  let emptyLabel = 'No conversations available';
  if (searchQuery) {
    emptyLabel = 'No conversations found';
  }

  let listContent = null;
  if (isLoading) {
    listContent = (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  } else if (filteredConversations.length === 0) {
    listContent = (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {emptyLabel}
        </Text>
      </View>
    );
  } else {
    listContent = (
      <FlatList
        data={filteredConversations}
        renderItem={({ item }) => (
          <ForwardConversationItem
            item={item}
            isSelected={selectedConversations.includes(item.id || item._id)}
            onToggle={handleToggleConversation}
          />
        )}
        keyExtractor={(item) => item.id || item._id}
      />
    );
  }

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
          {messagePreview}
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

      {Boolean(error) && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {listContent}

      <Portal>
        <Dialog visible={isSending} dismissable={false}>
          <Dialog.Content>
            <View style={styles.sendingContainer}>
              <ActivityIndicator size="large" color={BRAND.primary} />
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
    backgroundColor: '#fff',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  previewContainer: {
    backgroundColor: '#f5f5f5',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    padding: 16,
  },
  previewLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  previewText: {
    color: '#333',
    fontSize: 14,
  },
  searchBar: {
    elevation: 0,
    margin: 8,
  },
  selectedChip: {
    backgroundColor: '#e3f2fd',
  },
  selectedContainer: {
    alignItems: 'center',
    padding: 8,
  },
  sendingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
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
