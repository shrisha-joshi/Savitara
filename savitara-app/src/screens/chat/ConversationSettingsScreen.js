import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Avatar,
    Button,
    Divider,
    List,
    Switch,
    Text,
} from 'react-native-paper';
import { chatAPI } from '../../services/api';
import { getInitials, getAvatarColor } from '../../constants/avatars';
import { BRAND } from '../../constants/theme';

const ConversationSettingsScreen = ({ navigation, route }) => {
  const { conversationId, otherUserName, otherUserAvatar, otherUserId } = route.params;
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Direct lookup — avoids fetching all conversations and filtering client-side
      const response = await chatAPI.getConversation(conversationId);
      const conv = response.data?.data?.conversation || response.data?.conversation;

      if (conv) {
        setSettings({
          is_muted: conv.is_muted || false,
          is_pinned: conv.is_pinned || false,
          is_archived: conv.is_archived || false,
        });
      } else {
        // Fallback: default to all-off if conversation not found
        setSettings({ is_muted: false, is_pinned: false, is_archived: false });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load conversation settings');
      setSettings({ is_muted: false, is_pinned: false, is_archived: false });
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
      console.error('Failed to toggle mute:', error);
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
      console.error('Failed to toggle pin:', error);
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
      console.error('Failed to toggle archive:', error);
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
            } catch (deleteError) {
              console.error('Failed to delete conversation:', deleteError);
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    if (!otherUserId) {
      Alert.alert('Error', 'Cannot identify user to block');
      return;
    }
    Alert.alert(
      `Block ${otherUserName || 'this user'}?`,
      'They will not be able to message you and you will not see their messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.blockUser(otherUserId);
              Alert.alert('Blocked', `${otherUserName || 'User'} has been blocked.`);
              navigation.navigate('ChatList');
            } catch (err) {
              console.error('Failed to block user:', err);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    if (!otherUserId) {
      Alert.alert('Error', 'Cannot identify user to report');
      return;
    }
    Alert.alert(
      `Report ${otherUserName || 'this user'}?`,
      'Our team will review this report. Thank you for helping keep Savitara safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.reportUser(otherUserId, 'Inappropriate behavior via chat');
              Alert.alert('Reported', 'Thank you. Our team will review your report.');
            } catch (err) {
              console.error('Failed to report user:', err);
              Alert.alert('Error', 'Failed to submit report. Please try again.');
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
          {otherUserAvatar ? (
            <Avatar.Image size={80} source={{ uri: otherUserAvatar }} />
          ) : (
            <Avatar.Text
              size={80}
              label={getInitials(otherUserName)}
              style={{ backgroundColor: getAvatarColor(otherUserId) }}
            />
          )}
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
              icon="account-cancel"
              onPress={handleBlockUser}
              textColor="#d32f2f"
              style={[styles.dangerButton, { marginBottom: 12 }]}
            >
              Block {otherUserName || 'User'}
            </Button>
            <Button
              mode="outlined"
              icon="flag"
              onPress={handleReportUser}
              textColor="#e65100"
              style={[styles.dangerButton, { marginBottom: 12 }]}
            >
              Report {otherUserName || 'User'}
            </Button>
            <Button
              mode="outlined"
              icon="delete"
              onPress={handleDeleteConversation}
              textColor="#d32f2f"
              style={styles.dangerButton}
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
  dangerButton: {
    borderColor: '#d32f2f',
  },
  avatarText: {
    backgroundColor: BRAND.primary,
  },
});

ConversationSettingsScreen.propTypes = {
  navigation: PropTypes.object.isRequired,
  route: PropTypes.object.isRequired,
};

export default ConversationSettingsScreen;
