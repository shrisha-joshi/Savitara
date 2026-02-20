/**
 * Voice Recorder Component (React Native)
 * 
 * Mobile voice message recorder using Expo AV.
 * 
 * Features:
 * - Audio recording with Expo AV
 * - 90-second max duration
 * - Real-time duration display
 * - Record, preview, cancel, send flow
 * - Microphone permission handling
 * - Audio quality presets
 * - iOS and Android support
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';

const MAX_DURATION_MS = 90000; // 90 seconds
const UPDATE_INTERVAL_MS = 100;

export default function VoiceRecorder({ conversationId, onSend, onCancel }) {
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | preview | uploading
  const [durationMs, setDurationMs] = useState(0);
  const [audioUri, setAudioUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const recordingRef = useRef(null);
  const soundRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /**
   * Request microphone permissions
   */
  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionStatus(status);
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request permissions:', error);
      Alert.alert('Error', 'Failed to request microphone permissions');
      return false;
    }
  }, []);

  /**
   * Configure audio mode for recording
   */
  const configureAudioMode = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to configure audio mode:', error);
    }
  }, []);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      // Check permissions
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Microphone access is required to record voice messages.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Configure audio mode
      await configureAudioMode();

      // Create recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY, // AAC, 44.1kHz
        (status) => {
          if (status.isRecording) {
            setDurationMs(status.durationMillis);

            // Auto-stop at max duration
            if (status.durationMillis >= MAX_DURATION_MS) {
              stopRecording();
            }
          }
        },
        UPDATE_INTERVAL_MS
      );

      recordingRef.current = recording;
      setRecordingState('recording');
      setDurationMs(0);

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }, [requestPermissions, configureAudioMode, pulseAnim]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      setAudioUri(uri);
      setRecordingState('preview');

      // Stop pulse animation
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  }, [pulseAnim]);

  /**
   * Cancel recording
   */
  const handleCancel = useCallback(async () => {
    try {
      // Stop any playback
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Stop any active recording
      if (recordingRef.current && recordingState === 'recording') {
        await recordingRef.current.stopAndUnloadAsync();
      }

      recordingRef.current = null;
      setRecordingState('idle');
      setDurationMs(0);
      setAudioUri(null);
      setIsPlaying(false);

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (onCancel) {
        onCancel();
      }
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }, [recordingState, onCancel]);

  /**
   * Play preview
   */
  const playPreview = useCallback(async () => {
    if (!audioUri) return;

    try {
      if (isPlaying) {
        // Stop playback
        await soundRef.current?.stopAsync();
        setIsPlaying(false);
      } else {
        // Start playback
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        );

        soundRef.current = sound;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Failed to play preview:', error);
      Alert.alert('Error', 'Failed to play recording.');
    }
  }, [audioUri, isPlaying]);

  /**
   * Send voice message
   */
  const handleSend = useCallback(async () => {
    if (!audioUri) return;

    try {
      setRecordingState('uploading');

      // Stop any playback
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Convert to blob for upload (using expo-file-system if needed)
      const response = await fetch(audioUri);
      const blob = await response.blob();

      // Calculate duration in seconds
      const durationSeconds = Math.round(durationMs / 1000);

      // Call parent's send handler
      if (onSend) {
        await onSend({
          audioBlob: blob,
          audioUri,
          duration: durationSeconds,
          mimeType: 'audio/aac',
          conversationId,
        });
      }

      // Reset state
      setRecordingState('idle');
      setDurationMs(0);
      setAudioUri(null);
      setIsPlaying(false);

    } catch (error) {
      console.error('Failed to send voice message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
      setRecordingState('preview');
    }
  }, [audioUri, durationMs, conversationId, onSend]);

  /**
   * Format duration display
   */
  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Render based on state
  return (
    <View style={styles.container}>
      {/* Idle State - Show record button */}
      {recordingState === 'idle' && (
        <TouchableOpacity
          style={styles.recordButton}
          onPress={startRecording}
          activeOpacity={0.7}
          accessibilityLabel="Record voice message"
          accessibilityRole="button"
        >
          <MaterialIcons name="mic" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Recording State */}
      {recordingState === 'recording' && (
        <View style={styles.recordingContainer}>
          <Animated.View
            style={[
              styles.recordingIndicator,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={styles.recordingDot} />
          </Animated.View>

          <Text style={styles.durationText} accessibilityLabel={`Recording duration: ${formatDuration(durationMs)}`}>
            {formatDuration(durationMs)}
          </Text>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopRecording}
            activeOpacity={0.7}
            accessibilityLabel="Stop recording"
            accessibilityRole="button"
          >
            <View style={styles.stopIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.7}
            accessibilityLabel="Cancel recording"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* Preview State */}
      {recordingState === 'preview' && (
        <View style={styles.previewContainer}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={playPreview}
            activeOpacity={0.7}
            accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={28}
              color="#4A90E2"
            />
          </TouchableOpacity>

          <View style={styles.previewInfo}>
            <MaterialIcons name="mic" size={20} color="#666" />
            <Text style={styles.previewDuration}>{formatDuration(durationMs)}</Text>
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewCancelButton}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityLabel="Delete recording"
              accessibilityRole="button"
            >
              <MaterialIcons name="delete" size={24} color="#E74C3C" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              activeOpacity={0.7}
              accessibilityLabel="Send voice message"
              accessibilityRole="button"
            >
              <MaterialIcons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Uploading State */}
      {recordingState === 'uploading' && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.uploadingText}>Sending...</Text>
        </View>
      )}
    </View>
  );
}

VoiceRecorder.propTypes = {
  conversationId: PropTypes.string.isRequired,
  onSend: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingIndicator: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
  },
  durationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    minWidth: 60,
  },
  stopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  cancelButton: {
    padding: 8,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewDuration: {
    fontSize: 16,
    color: '#666',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  previewCancelButton: {
    padding: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadingText: {
    fontSize: 16,
    color: '#666',
  },
});
