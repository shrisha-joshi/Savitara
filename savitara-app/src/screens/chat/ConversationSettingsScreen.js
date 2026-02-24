import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Appbar,
  List,
  Switch,
  Divider,
  Button,
  Avatar,
  Text,
  ActivityIndicator,
} from 'react-native-paper';
import { chatAPI } from '../../services/api';

const ConversationSettingsScreen = ({ navigation, route }) => {
  const { conversationId, otherUserName, otherUserAvatar } = route.params;
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getConversations({ limit: 100 });
      const convs = response.data?.data?.conversations || response.data?.conversations || [];
      const conv = convs.find((c) => (c.id || c._id) === conversationId);
      
      if (conv) {
        setSettings({
          is_muted: conv.is_muted || false,
          is_pinned: conv.is_pinned || false,
          is_archived: conv.is_archived || false,
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load conversation settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMute = async () => {
    try {
      setUpdating(true);
      await chatAPI.muteConversation(conversationId, {
        is_muted: !settings.is_muted,
      });
      setSettings((prev) => ({ ...prev, is_muted: !prev.is_muted }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      setUpdating(true);
      await chatAPI.pinConversation(conversationId);
      setSettings((prev) => ({ ...prev, is_pinned: !prev.is_pinned }));
    } catch (error) {
      Alert.alert('Error', 'Failed to pin/unpin conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleArchive = async () => {
    try {
      setUpdating(true);
      await chatAPI.archiveConversation(conversationId);
      setSettings((prev) => ({ ...prev, is_archived: !prev.is_archived }));
    } catch (error) {
      Alert.alert('Error', 'Failed to archive/unarchive conversation');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteConversation = () => {
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
              await chatAPI.deleteConversation(conversationId);
              Alert.alert('Success', 'Conversation deleted');
              navigation.navigate('ChatList');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Conversation Settings" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Conversation Settings" />
      </Appbar.Header>

      <ScrollView>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Avatar.Image
            size={80}
            source={{
              uri: otherUserAvatar || 'https://via.placeholder.com/80',
            }}
          />
          <Text style={styles.userName}>{otherUserName || 'Unknown User'}</Text>
        </View>

        <Divider />

        {/* Notification Settings */}
        <List.Section>
          <List.Subheader>Notifications</List.Subheader>
          <List.Item
            title="Mute Notifications"
            description={settings?.is_muted ? 'Notifications are muted' : 'Notifications are enabled'}
            left={(props) => <List.Icon {...props} icon="bell-off" />}
            right={() => (
              <Switch
                value={settings?.is_muted || false}
                onValueChange={handleToggleMute}
                disabled={updating}
              />
            )}
          />
        </List.Section>

        <Divider />

        {/* Conversation Options */}
        <List.Section>
          <List.Subheader>Options</List.Subheader>
          <List.Item
            title="Pin Conversation"
            description={settings?.is_pinned ? 'Conversation is pinned' : 'Pin to top of list'}
            left={(props) => <List.Icon {...props} icon="pin" />}
            right={() => (
              <Switch
                value={settings?.is_pinned || false}
                onValueChange={handleTogglePin}
                disabled={updating}
              />
            )}
          />
          <List.Item
            title="Archive Conversation"
            description={settings?.is_archived ? 'Conversation is archived' : 'Move to archive'}
            left={(props) => <List.Icon {...props} icon="package-down" />}
            right={() => (
              <Switch
                value={settings?.is_archived || false}
                onValueChange={handleToggleArchive}
                disabled={updating}
              />
            )}
          />
        </List.Section>

        <Divider />

        {/* Danger Zone */}
        <List.Section>
          <List.Subheader>Danger Zone</List.Subheader>
          <View style={styles.dangerZone}>
            <Button
              mode="outlined"
              icon="delete"
              onPress={handleDeleteConversation}
              textColor="#d32f2f"
              style={styles.deleteButton}
            >
              Delete Conversation
            </Button>
          </View>
        </List.Section>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'center',
    padding: 24,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  dangerZone: {
    padding: 16,
  },
  deleteButton: {
    borderColor: '#d32f2f',
  },
});

ConversationSettingsScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired,
};

export default ConversationSettingsScreen;
