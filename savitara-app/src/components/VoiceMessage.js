/**
 * Voice Message Component (React Native)
 * 
 * Displays a voice message with playback controls.
 * 
 * Features:
 * - Play/pause controls
 * - Duration display
 * - Playback progress
 * - Download option
 * - Delete option (for sender)
 * - Waveform visualization (optional)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import api from '../services/api';

export default function VoiceMessage({
  messageId,
  mediaUrl,
  duration,
  waveform,
  createdAt,
  isSender,
  onDelete,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState(mediaUrl);

  const soundRef = useRef(null);

  /**
   * Fetch playback URL if not provided
   */
  const fetchPlaybackUrl = useCallback(async () => {
    if (playbackUrl) return;

    try {
      setIsLoading(true);
      const response = await api.get(`/messages/${messageId}/media`);
      setPlaybackUrl(response.data.url);
    } catch (error) {
      console.error('Failed to fetch playback URL:', error);
      Alert.alert('Error', 'Failed to load audio file.');
    } finally {
      setIsLoading(false);
    }
  }, [messageId, playbackUrl]);

  /**
   * Initialize playback URL
   */
  useEffect(() => {
    if (!playbackUrl) {
      fetchPlaybackUrl();
    }
  }, [fetchPlaybackUrl, playbackUrl]);

  /**
   * Play/pause voice message
   */
  const togglePlayback = useCallback(async () => {
    if (!playbackUrl) {
      await fetchPlaybackUrl();
      return;
    }

    try {
      if (isPlaying) {
        // Pause
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
      } else {
        // Play
        if (soundRef.current) {
          // Resume existing sound
          await soundRef.current.playAsync();
        } else {
          // Create new sound
          const { sound } = await Audio.Sound.createAsync(
            { uri: playbackUrl },
            { shouldPlay: true },
            (status) => {
              if (status.isLoaded) {
                setCurrentPosition(status.positionMillis);

                if (status.didJustFinish) {
                  setIsPlaying(false);
                  setCurrentPosition(0);
                }
              }
            }
          );

          soundRef.current = sound;

          // Track playback analytics
          try {
            await api.post(`/messages/${messageId}/playback`);
          } catch {
            // Silent fail - analytics not critical
          }
        }

        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Failed to toggle playback:', error);
      Alert.alert('Error', 'Failed to play audio.');
    }
  }, [playbackUrl, isPlaying, messageId, fetchPlaybackUrl]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Voice Message',
      'Are you sure you want to delete this voice message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { void (async () => {
            if (soundRef.current) {
              await soundRef.current.stopAsync();
              await soundRef.current.unloadAsync();
              soundRef.current = null;
            }
            if (onDelete) {
              onDelete(messageId);
            }
          })(); },
        },
      ]
    );
  }, [messageId, onDelete]);

  /**
   * Format time display
   */
  const formatTime = (ms) => {
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
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  /**
   * Calculate playback progress percentage
   */
  const progressPercent = duration ? (currentPosition / (duration * 1000)) * 100 : 0;

  return (
    <View
      style={[
        styles.container,
        isSender ? styles.senderContainer : styles.receiverContainer,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Voice message, ${formatTime(duration * 1000)}`}
    >
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={togglePlayback}
        disabled={isLoading}
        activeOpacity={0.7}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isSender ? '#fff' : '#4A90E2'} />
        ) : (
          <MaterialIcons
            name={isPlaying ? 'pause' : 'play-arrow'}
            size={28}
            color={isSender ? '#fff' : '#4A90E2'}
          />
        )}
      </TouchableOpacity>

      {/* Waveform / Progress */}
      <View style={styles.waveformContainer}>
        {waveform && waveform.length > 0 ? (
          <View style={styles.waveform}>
            {waveform.slice(0, 30).map((amplitude, index) => {
              const height = Math.max(4, amplitude * 40);
              const played = (index / waveform.length) * 100 < progressPercent;
              
              const barColor = played
                ? (isSender ? '#fff' : '#4A90E2')
                : (isSender ? 'rgba(255, 255, 255, 0.4)' : 'rgba(74, 144, 226, 0.4)');
              return (
                <View
                  key={`bar-${index}`}
                  style={[
                    styles.waveformBar,
                    {
                      height,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: isSender ? '#fff' : '#4A90E2',
                },
              ]}
            />
          </View>
        )}

        {/* Duration */}
        <Text
          style={[
            styles.durationText,
            isSender ? styles.senderText : styles.receiverText,
          ]}
        >
          {isPlaying ? formatTime(currentPosition) : formatTime(duration * 1000)}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isSender && onDelete && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDelete}
            activeOpacity={0.7}
            accessibilityLabel="Delete voice message"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="delete"
              size={20}
              color={isSender ? 'rgba(255, 255, 255, 0.8)' : '#999'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

VoiceMessage.propTypes = {
  messageId: PropTypes.string.isRequired,
  mediaUrl: PropTypes.string,
  duration: PropTypes.number.isRequired,
  waveform: PropTypes.arrayOf(PropTypes.number),
  createdAt: PropTypes.string,
  isSender: PropTypes.bool,
  onDelete: PropTypes.func,
};

VoiceMessage.defaultProps = {
  mediaUrl: null,
  waveform: null,
  createdAt: null,
  isSender: false,
  onDelete: null,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 10,
    minWidth: 200,
    maxWidth: 320,
  },
  senderContainer: {
    backgroundColor: '#4A90E2',
    alignSelf: 'flex-end',
  },
  receiverContainer: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    gap: 4,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 40,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  senderText: {
    color: '#fff',
  },
  receiverText: {
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 4,
  },
});
