import * as Haptics from 'expo-haptics';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Button, Divider, IconButton, List, Menu, Portal, Searchbar, Text } from 'react-native-paper';
import { getAvatarColor, getInitials } from '../../constants/avatars';
import { BRAND } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../services/api';
import { getRelativeTime } from '../../utils/dateTime';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level sub-components (avoids S6478 nested component definitions)

const renderConversationAvatar = (otherUser) => (props) => {
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
      label={getInitials(otherUser.name || 'U')}
      style={{ backgroundColor: getAvatarColor(otherUser.id || otherUser._id) }}
    />
  );
};

const renderConversationMeta = (item, userTimezone, openMenu) => () => {
  const lastMsg = item.last_message || {};

  return (
    <View style={styles.rightContainer}>
      <Text style={styles.timestamp}>
        {getRelativeTime(item.updated_at || lastMsg.created_at, userTimezone)}
      </Text>
      <View style={styles.rightBottom}>
        {item.unread_count > 0 && (
          <Badge style={styles.badge} size={24}>{item.unread_count}</Badge>
        )}
        <IconButton
          icon="dots-vertical"
          size={20}
          onPress={(e) => openMenu(item, e)}
        />
      </View>
    </View>
  );
};

function ConversationItem({
  item,
  userTimezone,
  onNavigate,
  openMenu,
  menuVisible,
  menuAnchor,
  closeMenu,
  handlePin,
  handleArchive,
  handleMute,
  handleDelete,
}) {
  const otherUser = item.other_user || {};
  const convId = item.id || item._id;
  return (
    <View>
      <List.Item
        title={otherUser.name || 'Unknown User'}
        description={item.last_message?.content || 'No messages yet'}
        left={renderConversationAvatar(otherUser)}
        right={renderConversationMeta(item, userTimezone, openMenu)}
        titleStyle={item.unread_count > 0 ? styles.unreadTitle : undefined}
        descriptionStyle={item.unread_count > 0 ? styles.unreadDescription : undefined}
        onPress={() => onNavigate(convId, otherUser)}
        onLongPress={(e) => openMenu(item, e)}
      />
      {menuVisible === convId && (
        <Portal>
          <Menu
            visible={menuVisible === convId}
            onDismiss={closeMenu}
            anchor={menuAnchor}
          >
            <Menu.Item
              onPress={handlePin}
              leadingIcon={item.is_pinned ? 'pin-off' : 'pin'}
              title={item.is_pinned ? 'Unpin' : 'Pin'}
            />
            <Menu.Item
              onPress={handleArchive}
              leadingIcon={item.is_archived ? 'package-up' : 'package-down'}
              title={item.is_archived ? 'Unarchive' : 'Archive'}
            />
            <Menu.Item
              onPress={handleMute}
              leadingIcon={item.is_muted ? 'bell' : 'bell-off'}
              title={item.is_muted ? 'Unmute' : 'Mute'}
            />
            <Divider />
            <Menu.Item
              onPress={handleDelete}
              leadingIcon="delete"
              title="Delete"
              titleStyle={{ color: '#d32f2f' }}
            />
          </Menu>
        </Portal>
      )}
    </View>
  );
}

ConversationItem.propTypes = {
  item: PropTypes.object.isRequired,
  userTimezone: PropTypes.string,
  onNavigate: PropTypes.func.isRequired,
  openMenu: PropTypes.func.isRequired,
  menuVisible: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  menuAnchor: PropTypes.object,
  closeMenu: PropTypes.func.isRequired,
  handlePin: PropTypes.func.isRequired,
  handleArchive: PropTypes.func.isRequired,
  handleMute: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
};

ConversationItem.defaultProps = {
  userTimezone: undefined,
  menuVisible: null,
  menuAnchor: undefined,
};

// ─────────────────────────────────────────────────────────────────────────────

const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const userTimezone = user?.location?.timezone;
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounceRef = useRef(null);

  // Debounced search - avoids filtering on every keystroke
  const handleSearchChange = useCallback((query) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(query);
    }, 250);
    // Update visible text immediately (uncontrolled value pattern for RN Searchbar)
  }, []);
  const [menuVisible, setMenuVisible] = useState(null); // conversation id for menu
  const [selectedConv, setSelectedConv] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    // Filter conversations based on search query
    if (searchQuery.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => {
        const userName = conv.other_user?.name || '';
        const lastMsg = conv.last_message?.content || '';
        return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
               lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredConversations(filtered);
    }
  }, [searchQuery, conversations]);

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations();
      // Backend wraps in StandardResponse: { success, data: { conversations } }
      const convs = response.data?.data?.conversations || response.data?.conversations || [];
      // Sort: pinned first, then by updated_at
      const sorted = convs.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      setConversations(sorted);
      setFilteredConversations(sorted);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const openMenu = (conv, event) => {
    setSelectedConv(conv);
    setMenuVisible(conv.id || conv._id);
    if (event?.nativeEvent) {
      setMenuAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    }
  };

  const closeMenu = () => {
    setMenuVisible(null);
    setSelectedConv(null);
  };

  const handlePin = async () => {
    closeMenu();
    if (!selectedConv) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await chatAPI.pinConversation(selectedConv.id || selectedConv._id);
      loadConversations();
    } catch (error) {
      console.error('Failed to pin conversation:', error);
      Alert.alert('Error', 'Failed to pin conversation');
    }
  };

  const handleArchive = async () => {
    closeMenu();
    if (!selectedConv) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await chatAPI.archiveConversation(selectedConv.id || selectedConv._id);
      loadConversations();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      Alert.alert('Error', 'Failed to archive conversation');
    }
  };

  const handleMute = async () => {
    closeMenu();
    if (!selectedConv) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await chatAPI.muteConversation(selectedConv.id || selectedConv._id, { is_muted: !selectedConv.is_muted });
      loadConversations();
    } catch (error) {
      console.error('Failed to mute conversation:', error);
      Alert.alert('Error', 'Failed to mute conversation');
    }
  };

  const handleDelete = async () => {
    closeMenu();
    if (!selectedConv) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await chatAPI.deleteConversation(selectedConv.id || selectedConv._id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                loadConversations();
              } catch (deleteError) {
                console.error('Failed to delete conversation:', deleteError);
                Alert.alert('Error', 'Failed to delete conversation');
              }
            })();
          }
        }
      ]
    );
  };

  const handleConversationNavigate = useCallback((convId, otherUser) => {
    navigation.navigate('Conversation', {
      conversationId: convId,
      otherUserName: otherUser.name || 'Unknown User',
      otherUserId: otherUser.id || otherUser._id,
    });
  }, [navigation]);

  const renderConversationItem = useCallback(({ item }) => (
    <ConversationItem
      item={item}
      userTimezone={userTimezone}
      onNavigate={handleConversationNavigate}
      openMenu={openMenu}
      menuVisible={menuVisible}
      menuAnchor={menuAnchor}
      closeMenu={closeMenu}
      handlePin={handlePin}
      handleArchive={handleArchive}
      handleMute={handleMute}
      handleDelete={handleDelete}
    />
  ), [userTimezone, handleConversationNavigate, openMenu, menuVisible, menuAnchor, closeMenu, handlePin, handleArchive, handleMute, handleDelete]);

  let listContent;
  if (loading) {
    listContent = <ActivityIndicator animating size="large" color={BRAND.primary} style={styles.loadingIndicator} />;
  } else if (filteredConversations.length === 0) {
    listContent = (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>
          {searchQuery ? 'No conversations found' : 'No conversations yet'}
        </Text>
        {!searchQuery && (
          <>
            <Text style={styles.emptySubtitle}>Find an Acharya and start a conversation</Text>
            <Button
              mode="contained"
              icon="magnify"
              onPress={() => navigation.navigate('Home')}
              style={styles.emptyButton}
              buttonColor={BRAND.primary}
            >
              Find an Acharya
            </Button>
          </>
        )}
      </View>
    );
  } else {
    listContent = (
      <FlatList
        data={filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id || item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search conversations..."
        onChangeText={handleSearchChange}
        style={styles.searchBar}
      />
      {listContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBar: {
    margin: 8,
    elevation: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
  },
  unreadTitle: {
    fontWeight: '600',
  },
  pinIcon: {
    marginRight: 4,
    fontSize: 12,
  },
  muteIcon: {
    marginLeft: 4,
    fontSize: 12,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  description: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadDescription: {
    fontWeight: '600',
    color: '#333',
  },
  // Right column: timestamp on top, badge+menu button below
  rightContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 64,
  },
  rightBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginRight: 4,
    marginTop: 4,
  },
  badge: {
    marginRight: 4,
  },
  avatarText: {
    backgroundColor: BRAND.primary,
  },
  loadingIndicator: {
    marginTop: 50,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 24,
    paddingHorizontal: 8,
  },
});

ChatListScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
};

export default React.memo(ChatListScreen);
