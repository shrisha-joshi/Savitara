import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { List, Avatar, Badge, Text, Searchbar, FAB, IconButton, Menu, Divider, Portal, Dialog, Button } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { chatAPI } from '../../services/api';

const ChatListScreen = ({ navigation }) => {
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

  const openMenu = (conv) => {
    setSelectedConv(conv);
    setMenuVisible(conv.id || conv._id);
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
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await chatAPI.deleteConversation(selectedConv.id || selectedConv._id);
              loadConversations();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete conversation');
            }
          }
        }
      ]
    );
  };

  const renderConversation = ({ item }) => {
    // Use new backend fields for user and message
    const otherUser = item.other_user || {};
    const lastMsg = item.last_message || {};
    const convId = item.id || item._id;
    
    return (
      <View>
        <List.Item
          title={() => (
            <View style={styles.titleRow}>
              {item.is_pinned && <Text style={styles.pinIcon}>📌</Text>}
              <Text style={[styles.title, item.unread_count > 0 && styles.unreadTitle]}>
                {otherUser.name || 'Unknown User'}
              </Text>
              {item.is_muted && <Text style={styles.muteIcon}>🔕</Text>}
            </View>
          )}
          description={() => (
            <View style={styles.descriptionRow}>
              <Text style={[styles.description, item.unread_count > 0 && styles.unreadDescription]} numberOfLines={1}>
                {lastMsg.content || 'No messages yet'}
              </Text>
            </View>
          )}
          left={() => (
            <Avatar.Image 
              size={50} 
              source={{ uri: otherUser.profile_picture || otherUser.profile_image || 'https://via.placeholder.com/50' }} 
            />
          )}
          right={() => (
            <View style={styles.rightContainer}>
              {item.unread_count > 0 && (
                <Badge style={styles.badge} size={24}>{item.unread_count}</Badge>
              )}
              <IconButton
                icon="dots-vertical"
                size={20}
                onPress={() => openMenu(item)}
              />
            </View>
          )}
          onPress={() => navigation.navigate('Chat', {
            conversationId: convId,
            otherUserName: otherUser.name || 'Unknown User',
          })}
          onLongPress={() => openMenu(item)}
        />
        
        {menuVisible === convId && (
          <Portal>
            <Menu
              visible={menuVisible === convId}
              onDismiss={closeMenu}
              anchor={{ x: 300, y: 200 }}
            >
              <Menu.Item
                onPress={handlePin}
                leadingIcon={item.is_pinned ? "pin-off" : "pin"}
                title={item.is_pinned ? "Unpin" : "Pin"}
              />
              <Menu.Item
                onPress={handleArchive}
                leadingIcon={item.is_archived ? "package-up" : "package-down"}
                title={item.is_archived ? "Unarchive" : "Archive"}
              />
              <Menu.Item
                onPress={handleMute}
                leadingIcon={item.is_muted ? "bell" : "bell-off"}
                title={item.is_muted ? "Unmute" : "Mute"}
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
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search conversations..."
        onChangeText={handleSearchChange}
        style={styles.searchBar}
      />
      {loading ? (
        <Text style={styles.centerText}>Loading...</Text>
      ) : filteredConversations.length === 0 ? (
        <Text style={styles.centerText}>
          {searchQuery ? 'No conversations found' : 'No conversations yet'}
        </Text>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id || item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    marginRight: 8,
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

export default React.memo(ChatListScreen);
