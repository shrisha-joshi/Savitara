/**
 * Block/Unblock User Button Component - React Native
 * Allows users to block or unblock another user
 */
import { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ViewStyle,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

interface BlockUserButtonProps {
  userId: string;
  userName: string;
  isBlocked?: boolean;
  onBlockChange?: (isBlocked: boolean, data?: any) => void;
  style?: ViewStyle;
  variant?: 'primary' | 'danger' | 'outline';
}

type ApiError = { response?: { data?: { error?: { message?: string } } } };

/**
 * BlockUserButton Component
 */
export default function BlockUserButton({
  userId,
  userName,
  isBlocked: initialBlocked = false,
  onBlockChange,
  style,
  variant = 'danger',
}: Readonly<BlockUserButtonProps>) {
  const [isBlocked, setIsBlocked] = useState(initialBlocked);
  const [isLoading, setIsLoading] = useState(false);

  const handleBlock = async () => {
    setIsLoading(true);
    
    try {
      const response = await api.post(`/moderation/block/${userId}`, {
        reason: 'User blocked via mobile app',
      });

      if (response.data.success) {
        setIsBlocked(true);

        const isMutual = response.data.data?.is_mutual;
        if (isMutual) {
          Toast.show({
            type: 'success',
            text1: 'User Blocked',
            text2: `${userName} blocked. Mutual block detected.`,
            position: 'top',
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'User Blocked',
            text2: `${userName} has been blocked`,
            position: 'top',
            visibilityTime: 3000,
          });
        }

        if (onBlockChange) {
          onBlockChange(true, response.data.data);
        }
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      const err = error as ApiError;
      Toast.show({
        type: 'error',
        text1: 'Block Failed',
        text2: err.response?.data?.error?.message || 'Failed to block user. Please try again.',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async () => {
    setIsLoading(true);
    
    try {
      const response = await api.delete(`/moderation/block/${userId}`);

      if (response.data.success) {
        setIsBlocked(false);
        Toast.show({
          type: 'success',
          text1: 'User Unblocked',
          text2: `${userName} has been unblocked`,
          position: 'top',
        });

        if (onBlockChange) {
          onBlockChange(false, null);
        }
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      const err = error as ApiError;
      Toast.show({
        type: 'error',
        text1: 'Unblock Failed',
        text2: err.response?.data?.error?.message || 'Failed to unblock user. Please try again.',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName}? They won't be able to message you, and you won't see their messages.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => { void handleBlock(); },
        },
      ],
      { cancelable: true }
    );
  };

  const confirmUnblock = () => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${userName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unblock',
          onPress: () => { void handleUnblock(); },
        },
      ],
      { cancelable: true }
    );
  };

  const getButtonStyle = () => {
    if (isBlocked) {
      return variant === 'outline' ? styles.buttonOutline : styles.buttonPrimary;
    }
    return variant === 'outline' ? styles.buttonOutlineDanger : styles.buttonDanger;
  };

  const getTextStyle = () => {
    if (isBlocked) {
      return variant === 'outline' ? styles.textOutline : styles.textWhite;
    }
    return variant === 'outline' ? styles.textDanger : styles.textWhite;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style, isLoading && styles.buttonDisabled]}
      onPress={isBlocked ? confirmUnblock : confirmBlock}
      disabled={isLoading}
      accessibilityLabel={isBlocked ? `Unblock ${userName}` : `Block ${userName}`}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' ? '#FF6B35' : '#FFFFFF'} />
      ) : (
        <Text style={getTextStyle()}>
          {isBlocked ? 'Unblock' : 'Block User'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonPrimary: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // iOS touch target
  },
  buttonDanger: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonOutlineDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  textWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textOutline: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  textDanger: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
