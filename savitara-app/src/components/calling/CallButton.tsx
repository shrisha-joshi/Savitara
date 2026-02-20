/**
 * Call Button Component - React Native
 * Initiates masked voice calls between users
 */
import { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Alert as RNAlert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

interface CallButtonProps {
  bookingId: string;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'outlined';
  fullWidth?: boolean;
  disabled?: boolean;
  style?: any;
}

/**
 * CallButton Component
 * Initiates masked voice call through platform
 */
export default function CallButton({
  bookingId,
  buttonText = 'Call',
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  style = {},
}: Readonly<CallButtonProps>) {
  const [isInitiating, setIsInitiating] = useState(false);

  const handleInitiateCall = async () => {
    // Show confirmation dialog
    RNAlert.alert(
      'Initiate Call',
      'The platform will call you first. When you answer, you will be connected to the other party. Neither of you will see each other\'s phone number.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Call',
          onPress: () => { void (async () => {
            setIsInitiating(true);

            try {
              const response = await api.post(
                `/calls/voice/initiate`,
                null,
                {
                  params: { booking_id: bookingId },
                }
              );

              if (response.data.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Call Initiated',
                  text2: 'You will receive a call shortly from our platform number.',
                  position: 'top',
                  visibilityTime: 5000,
                });
              }
            } catch (error: any) {
              console.error('Error initiating call:', error);

              let errorMessage = 'Failed to initiate call. Please try again.';

              if (error.response?.status === 403) {
                errorMessage = 'You do not have permission to call this user.';
              } else if (error.response?.status === 404) {
                errorMessage = 'Booking not found.';
              } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
              }

              Toast.show({
                type: 'error',
                text1: 'Call Failed',
                text2: errorMessage,
                position: 'top',
                visibilityTime: 4000,
              });
            } finally {
              setIsInitiating(false);
            }
          })(); },
        },
      ]
    );
  };

  const getButtonStyle = () => {
    const baseStyle: any[] = [styles.button];

    if (fullWidth) {
      baseStyle.push(styles.fullWidth);
    }

    if (variant === 'primary') {
      baseStyle.push(styles.primaryButton);
    } else if (variant === 'secondary') {
      baseStyle.push(styles.secondaryButton);
    } else if (variant === 'outlined') {
      baseStyle.push(styles.outlinedButton);
    }

    if (disabled || isInitiating) {
      baseStyle.push(styles.disabledButton);
    }

    return [...baseStyle, style];
  };

  const getTextStyle = () => {
    if (variant === 'outlined') {
      return [styles.buttonText, styles.outlinedButtonText];
    }
    return styles.buttonText;
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handleInitiateCall}
      disabled={disabled || isInitiating}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        {isInitiating ? (
          <ActivityIndicator
            color={variant === 'outlined' ? '#2563EB' : '#FFFFFF'}
            size="small"
            style={styles.icon}
          />
        ) : (
          <Text style={[styles.icon, getTextStyle()]}>📞</Text>
        )}
        <Text style={getTextStyle()}>
          {isInitiating ? 'Connecting...' : buttonText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  fullWidth: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  secondaryButton: {
    backgroundColor: '#10B981',
  },
  outlinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlinedButtonText: {
    color: '#2563EB',
  },
  icon: {
    marginRight: 8,
    fontSize: 16,
  },
});
