import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenCapture from 'expo-screen-capture';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bubble, GiftedChat, Send } from 'react-native-gifted-chat';
import { useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';
import EmojiPicker from '../../components/EmojiPicker';
import MessageReactions from '../../components/MessageReactions';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { chatAPI } from '../../services/api';

/** Format seconds as "0:05", "1:23" etc. — module-level helper */
function formatDurationStatic(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ─── Voice Message Bubble ──────────────────────────────────────────────────
function VoiceMessageBubble({ message, isMine }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const soundRef = useRef(null);
  const duration = message.media_duration_s || 0;

  const togglePlay = async () => {
    if (!message.media_url) return;
    try {
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
      } else if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      } else {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: message.media_url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setProgress(status.durationMillis ? status.positionMillis / status.durationMillis : 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setProgress(0);
                soundRef.current = null;
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Voice playback error:', err);
    }
  };

  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);

  const bg = isMine ? '#FF6B35' : '#F0F0F0';
  const textColor = isMine ? '#fff' : '#333';
  return (
    <View style={[voiceStyles.container, { backgroundColor: bg }]}>
      <TouchableOpacity onPress={togglePlay} style={voiceStyles.playBtn} activeOpacity={0.7}>
        <Text style={[voiceStyles.playIcon, { color: textColor }]}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <View style={voiceStyles.waveformContainer}>
        <View style={voiceStyles.progressTrack}>
          <View
            style={[
              voiceStyles.progressFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: isMine ? 'rgba(255,255,255,0.55)' : '#FF6B3566' },
            ]}
          />
        </View>
        <Text style={[voiceStyles.duration, { color: textColor }]}>{formatDurationStatic(duration)}</Text>
      </View>
    </View>
  );
}
VoiceMessageBubble.propTypes = { message: PropTypes.object.isRequired, isMine: PropTypes.bool.isRequired };

// ─── Image Message Bubble ──────────────────────────────────────────────────
function ImageMessageBubble({ message, isMine, onPress }) {
  const borderRadius = isMine
    ? { borderTopLeftRadius: 12, borderTopRightRadius: 4, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }
    : { borderTopLeftRadius: 4, borderTopRightRadius: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 };
  return (
    <TouchableOpacity onPress={() => message.media_url && onPress(message.media_url)} activeOpacity={0.9}>
      <Image source={{ uri: message.media_url }} style={[imageStyles.thumbnail, borderRadius]} resizeMode="cover" />
    </TouchableOpacity>
  );
}
ImageMessageBubble.propTypes = {
  message: PropTypes.object.isRequired,
  isMine: PropTypes.bool.isRequired,
  onPress: PropTypes.func.isRequired,
};

// ─── File Message Bubble ───────────────────────────────────────────────────
function FileMessageBubble({ message, isMine }) {
  let sizeStr = '';
  if (message.file_size) {
    const mb = message.file_size / 1_048_576;
    sizeStr = message.file_size > 1_048_576
      ? `${mb.toFixed(1)} MB`
      : `${Math.ceil(message.file_size / 1024)} KB`;
  }
  const bg = isMine ? '#FF6B35' : '#F0F0F0';
  const textColor = isMine ? '#fff' : '#333';
  return (
    <TouchableOpacity
      style={[fileStyles.container, { backgroundColor: bg }]}
      activeOpacity={0.75}
      onPress={() => message.media_url && Linking.openURL(message.media_url)}
    >
      <Text style={fileStyles.fileIcon}>📎</Text>
      <View style={fileStyles.info}>
        <Text style={[fileStyles.name, { color: textColor }]} numberOfLines={2}>{message.file_name || 'File'}</Text>
        {sizeStr ? <Text style={[fileStyles.size, { color: textColor, opacity: 0.75 }]}>{sizeStr}</Text> : null}
      </View>
      <Text style={[fileStyles.downloadIcon, { color: textColor }]}>⬇</Text>
    </TouchableOpacity>
  );
}
FileMessageBubble.propTypes = { message: PropTypes.object.isRequired, isMine: PropTypes.bool.isRequired };

// Component-level StyleSheet objects (used by the above components)
const voiceStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, minWidth: 180, maxWidth: 260 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  playIcon: { fontSize: 16 },
  waveformContainer: { flex: 1 },
  progressTrack: { height: 4, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 4, borderRadius: 2 },
  duration: { fontSize: 11, textAlign: 'right', opacity: 0.85 },
});
const imageStyles = StyleSheet.create({
  thumbnail: { width: 220, height: 160, borderRadius: 12 },
});
const fileStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, minWidth: 180, maxWidth: 260 },
  fileIcon: { fontSize: 24, marginRight: 8 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  size: { fontSize: 11 },
  downloadIcon: { fontSize: 20, marginLeft: 8 },
});

// Delivery status icon — single tick (sent), double tick (delivered), blue double tick (read)
function DeliveryStatus({ status }) {
  if (!status) return null;
  if (status === 'read') {
    return <Text style={styles.tickRead}>✓✓</Text>;
  }
  if (status === 'delivered') {
    return <Text style={styles.tickDelivered}>✓✓</Text>;
  }
  // 'sent'
  return <Text style={styles.tickSent}>✓</Text>;
}
DeliveryStatus.propTypes = {
  status: PropTypes.oneOf(['sent', 'delivered', 'read']),
};
DeliveryStatus.defaultProps = { status: null };

// Animated "..." typing indicator
function TypingDots({ anim }) {
  const opacity1 = anim;
  const opacity2 = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] });
  const opacity3 = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] });
  return (
    <View style={styles.typingDots}>
      <Animated.Text style={[styles.typingDot, { opacity: opacity1 }]}>•</Animated.Text>
      <Animated.Text style={[styles.typingDot, { opacity: opacity2 }]}>•</Animated.Text>
      <Animated.Text style={[styles.typingDot, { opacity: opacity3 }]}>•</Animated.Text>
    </View>
  );
}
TypingDots.propTypes = { anim: PropTypes.object.isRequired };

function BubbleRenderer({ currentMessage, reactions, currentUserId, onAddReaction, onRemoveReaction, deliveryStatus, onImagePress, ...props }) {
  const isMine = currentMessage.user?._id === currentUserId;
  const msgType = currentMessage.message_type || 'text';

  let mediaContent = null;
  if (msgType === 'voice') {
    mediaContent = <VoiceMessageBubble message={currentMessage} isMine={isMine} />;
  } else if (msgType === 'image') {
    mediaContent = <ImageMessageBubble message={currentMessage} isMine={isMine} onPress={onImagePress} />;
  } else if (msgType === 'file') {
    mediaContent = <FileMessageBubble message={currentMessage} isMine={isMine} />;
  }

  return (
    <View>
      {mediaContent || (
        <Bubble
          currentMessage={currentMessage}
          {...props}
          wrapperStyle={{
            left: { backgroundColor: '#F0F0F0' },
            right: { backgroundColor: '#FF6B35' },
          }}
        />
      )}
      {deliveryStatus && (
        <View style={styles.deliveryStatusRow}>
          <DeliveryStatus status={deliveryStatus} />
        </View>
      )}
      {reactions.length > 0 && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
          messageId={currentMessage._id}
          compact
        />
      )}
    </View>
  );
}
BubbleRenderer.propTypes = {
  currentMessage: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    message_type: PropTypes.string,
    user: PropTypes.shape({
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  }).isRequired,
  reactions: PropTypes.array.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onAddReaction: PropTypes.func.isRequired,
  onRemoveReaction: PropTypes.func.isRequired,
  deliveryStatus: PropTypes.oneOf(['sent', 'delivered', 'read']),
  onImagePress: PropTypes.func,
};
BubbleRenderer.defaultProps = { deliveryStatus: null, onImagePress: null };

const ConversationScreen = ({ route }) => {
  const { conversationId, otherUserName } = route.params;
  const [receiverId, setReceiverId] = useState(route.params.otherUserId || null);
  const { user } = useAuth();
  const { chatMessages, sendMessage: sendWsMessage, typingUsers, connectionStatus } = useSocket();
  const [messages, setMessages] = useState([]);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [messageReactions, setMessageReactions] = useState({}); // messageId -> reactions array
  // messageId -> 'sent' | 'delivered' | 'read'
  const [messageStatuses, setMessageStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingObj, setRecordingObj] = useState(null);
  const recordingTimerRef = useRef(null);

  // Attachment preview (before send)
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);

  // Fullscreen image viewer
  const [fullscreenImage, setFullscreenImage] = useState(null);
  
  // Screenshot protection state (Prompt 2)
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);

  // Typing indicator state
  const typingDebounceRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const typingDotAnim = useRef(new Animated.Value(0)).current;
  
  const isFocused = useIsFocused();

  const currentUserId = user._id || user.id;

  // Check if the other user is typing in this conversation
  const otherUserId = receiverId;
  const isOtherUserTyping = otherUserId
    ? Boolean(typingUsers[otherUserId])
    : false;

  // Animate the typing dots
  useEffect(() => {
    if (isOtherUserTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingDotAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typingDotAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingDotAnim.stopAnimation();
      typingDotAnim.setValue(0);
    }
  }, [isOtherUserTyping, typingDotAnim]);

  // ═══ Prompt 2: Screenshot Protection & Blur Overlay ═══
  // 1. Prevent screen capture when focused, allow when not focused
  useEffect(() => {
    if (isFocused) {
      ScreenCapture.preventScreenCaptureAsync('chat-screen-protection').catch(err => {
        console.warn('Failed to prevent screen capture:', err);
      });
    } else {
      ScreenCapture.allowScreenCaptureAsync('chat-screen-protection').catch(err => {
        console.warn('Failed to allow screen capture:', err);
      });
    }
  }, [isFocused]);

  // 2. iOS Fallback: Blur overlay when app goes to background/inactive
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        setShowBlurOverlay(true);
      } else if (nextAppState === 'active') {
        setShowBlurOverlay(false);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // 3. Screenshot event listener with Toast alert
  useEffect(() => {
    const screenshotSubscription = ScreenCapture.addScreenshotListener(() => {
      Toast.show({
        type: 'error',
        text1: 'Screenshots Prohibited',
        text2: 'Screenshots are not allowed for privacy and security reasons.',
        position: 'top',
        visibilityTime: 4000,
      });
    });

    return () => {
      screenshotSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    loadMessages();
  }, []);

  // Handles an incoming chat message from WebSocket context
  const handleIncomingMessage = useCallback((msg) => {
    if (msg.conversation_id !== conversationId || !msg.content) return;
    const formattedMsg = {
      _id: msg._id || msg.id,
      text: msg.content || '',
      createdAt: new Date(msg.created_at || msg.timestamp || Date.now()),
      user: {
        _id: msg.sender_id,
        name: msg.sender_id === currentUserId ? user.full_name : otherUserName,
      },
      message_type: msg.message_type || 'text',
      media_url: msg.media_url || null,
      media_duration_s: msg.media_duration_s || null,
      file_name: msg.file_name || null,
      file_size: msg.file_size || null,
    };
    setMessages(prev => {
      if (prev.some(m => m._id === formattedMsg._id)) return prev;
      return GiftedChat.append(prev, [formattedMsg]);
    });
    if (msg.sender_id !== currentUserId) {
      chatAPI.markConversationRead(conversationId).catch(() => {});
    }
  }, [conversationId, currentUserId, user.full_name, otherUserName]);

  // Listen for real-time messages from SocketContext
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];

    if (lastMsg.type === 'reaction_added' || lastMsg.type === 'reaction_removed') {
      if (lastMsg.message_id) handleReactionUpdate(lastMsg);
      return;
    }
    if (lastMsg.type === 'message_read' && lastMsg.conversation_id === conversationId) {
      setMessageStatuses(prev =>
        Object.fromEntries(Object.keys(prev).map(id => [id, 'read']))
      );
      return;
    }
    if (lastMsg.type === 'message_sent' && lastMsg.conversation_id === conversationId) {
      const msgId = lastMsg._id || lastMsg.id;
      if (msgId) {
        setMessageStatuses(prev => ({ ...prev, [msgId]: lastMsg.delivery_status || 'delivered' }));
      }
      return;
    }
    handleIncomingMessage(lastMsg);
  }, [chatMessages, conversationId, handleIncomingMessage]);

  const loadMessages = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await chatAPI.getMessages(conversationId, { limit: 50 });
      const msgData = response.data.data || response.data;
      const messagesData = msgData?.messages || [];

      if (!receiverId) {
        const recipientFromBackend = msgData?.recipient;
        if (recipientFromBackend) {
          setReceiverId(recipientFromBackend.id || recipientFromBackend._id);
        } else {
          const otherMsg = messagesData.find(m => m.sender_id !== currentUserId);
          if (otherMsg) {
            setReceiverId(otherMsg.sender_id);
          }
        }
      }

      const formattedMessages = messagesData.map((msg) => ({
        _id: msg._id || msg.id,
        text: msg.content || '',
        createdAt: new Date(msg.created_at || msg.timestamp),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === currentUserId ? user.full_name || user.name : otherUserName,
        },
        // Media fields for custom bubble renderers
        message_type: msg.message_type || 'text',
        media_url: msg.media_url || null,
        media_duration_s: msg.media_duration_s || null,
        file_name: msg.file_name || null,
        file_size: msg.file_size || null,
        media_mime: msg.media_mime || null,
      })).reverse();
      setMessages(formattedMessages);

      // Seed reactions from loaded messages so they display before any WS events
      const reactionsMap = {};
      messagesData.forEach((msg) => {
        const id = msg._id || msg.id;
        if (id && Array.isArray(msg.reactions) && msg.reactions.length > 0) {
          reactionsMap[id] = msg.reactions;
        }
      });
      setMessageReactions(reactionsMap);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setLoadError('Could not load messages. Tap to retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactionUpdate = (data) => {
    if (!data.message_id) return;
    const { message_id, type, user_id, emoji } = data;
    setMessageReactions((prev) => {
      const current = prev[message_id] || [];
      let updated;
      if (type === 'reaction_added') {
        const alreadyExists = current.some(
          (r) => r.user_id === user_id && r.emoji === emoji
        );
        updated = alreadyExists
          ? current
          : [...current, { user_id, emoji, created_at: new Date().toISOString() }];
      } else {
        updated = current.filter(
          (r) => !(r.user_id === user_id && r.emoji === emoji)
        );
      }
      return { ...prev, [message_id]: updated };
    });
  };

  const onSend = useCallback(async (newMessages = []) => {
    const message = newMessages[0];
    // Optimistically add with 'sent' status
    const tempId = message._id;
    setMessageStatuses(prev => ({ ...prev, [tempId]: 'sent' }));
    try {
      const res = await chatAPI.sendMessage({ receiver_id: receiverId, content: message.text });
      const saved = res.data?.data || res.data;
      const savedId = saved?.message_id || saved?.id || saved?._id;
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, newMessages)
      );
      // Remap temp ID to server ID, mark as delivered
      if (savedId && savedId !== tempId) {
        setMessageStatuses(prev => {
          const next = { ...prev };
          delete next[tempId];
          next[savedId] = 'delivered';
          return next;
        });
      } else if (savedId) {
        setMessageStatuses(prev => ({ ...prev, [savedId]: 'delivered' }));
      }
      // Stop typing indicator on send
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      sendWsMessage({
        type: 'typing_indicator',
        conversation_id: conversationId,
        receiver_id: receiverId,
        is_typing: false,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  }, [conversationId, receiverId, sendWsMessage]);

  /**
   * Send typing indicator with debounce:
   * - Fire "typing: true" at most once every 3 seconds while actively typing
   * - Fire "typing: false" 3 seconds after the last keystroke
   */
  const handleInputTextChanged = useCallback((text) => {
    if (!receiverId || !text) return;

    const now = Date.now();
    // Send "typing: true" only if we haven't sent one in the last 3 s
    if (now - lastTypingSentRef.current > 3000) {
      lastTypingSentRef.current = now;
      sendWsMessage({
        type: 'typing_indicator',
        conversation_id: conversationId,
        receiver_id: receiverId,
        is_typing: true,
      });
    }

    // Reset the "typing: false" debounce timer
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    typingDebounceRef.current = setTimeout(() => {
      sendWsMessage({
        type: 'typing_indicator',
        conversation_id: conversationId,
        receiver_id: receiverId,
        is_typing: false,
      });
    }, 3000);
  }, [conversationId, receiverId, sendWsMessage]);

  // Clean up typing timer on unmount and send "stopped typing"
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      if (receiverId) {
        sendWsMessage({
          type: 'typing_indicator',
          conversation_id: conversationId,
          receiver_id: receiverId,
          is_typing: false,
        });
      }
    };
  }, [conversationId, receiverId, sendWsMessage]);

  const handleLongPress = (context, message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessageId(message._id);
    setEmojiPickerVisible(true);
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      await chatAPI.addReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      await chatAPI.removeReaction(messageId, emoji);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  // ─── Voice Recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Microphone access is required to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecordingObj(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    const duration = recordingDuration;
    const rec = recordingObj;
    setRecordingObj(null);
    setRecordingDuration(0);
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (uri && duration > 0) {
        setAttachmentPreview({ uri, type: 'voice', name: `voice_${Date.now()}.m4a`, size: 0, mimeType: 'audio/m4a', durationSeconds: duration });
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  };

  // ─── File & Image Picking ──────────────────────────────────────────────────
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Media library access is required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 }); // eslint-disable-line
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setAttachmentPreview({ uri: asset.uri, type: 'image', name: asset.fileName || `image_${Date.now()}.jpg`, size: asset.fileSize || 0, mimeType: asset.mimeType || 'image/jpeg' });
      }
    } catch (err) { console.error('Failed to pick image:', err); Alert.alert('Error', 'Could not open image picker.'); }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setAttachmentPreview({ uri: asset.uri, type: 'file', name: asset.name, size: asset.size || 0, mimeType: asset.mimeType || 'application/octet-stream' });
      }
    } catch (err) { console.error('Failed to pick file:', err); Alert.alert('Error', 'Could not open file picker.'); }
  };

  const showAttachmentMenu = () => {
    Alert.alert('Attach', 'Choose attachment type', [
      { text: '🖼️  Image', onPress: () => void pickImage() },
      { text: '📎  File', onPress: () => void pickFile() },
      { text: 'Cancel', style: 'cancel' },
    ], { cancelable: true });
  };

  // ─── Send Media ────────────────────────────────────────────────────────────
  const sendMediaAttachment = async (attachment) => {
    if (isSendingMedia) return;
    setIsSendingMedia(true);
    setAttachmentPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', { uri: attachment.uri, name: attachment.name, type: attachment.mimeType });
      formData.append('receiver_id', receiverId || '');
      formData.append('message_type', attachment.type);
      if (attachment.durationSeconds != null) formData.append('duration_seconds', String(attachment.durationSeconds));
      const res = await chatAPI.sendMediaMessage(formData);
      const saved = res.data?.data || res.data;
      const newMsg = {
        _id: saved?.message_id || saved?.id || `media_${Date.now()}`,
        text: '',
        createdAt: new Date(saved?.created_at || Date.now()),
        user: { _id: currentUserId, name: user.full_name || user.name },
        message_type: attachment.type,
        media_url: saved?.media_url || attachment.uri,
        media_duration_s: attachment.durationSeconds || null,
        file_name: attachment.name,
        file_size: attachment.size,
      };
      setMessages((prev) => GiftedChat.append(prev, [newMsg]));
    } catch (err) {
      console.error('Failed to send media:', err);
      Alert.alert('Error', 'Failed to send attachment. Please try again.');
    } finally { setIsSendingMedia(false); }
  };

  // ─── Toolbar Renderers ─────────────────────────────────────────────────────
  const renderActions = () => (
    <TouchableOpacity style={styles.actionBtn} onPress={showAttachmentMenu} disabled={isSendingMedia} activeOpacity={0.7}>
      <Text style={styles.actionIcon}>📎</Text>
    </TouchableOpacity>
  );

  const renderSend = (sendProps) => {
    const hasText = (sendProps.text || '').trim().length > 0;
    const isOffline = connectionStatus !== 'connected';
    return (
      <View style={styles.sendRow}>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineIcon}>⚠</Text>
          </View>
        )}
        {hasText ? (
          <Send {...sendProps} containerStyle={styles.sendContainer}>
            <View style={styles.sendBtn}><Text style={styles.sendIcon}>➤</Text></View>
          </Send>
        ) : (
          <Pressable
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={({ pressed }) => [styles.micBtn, pressed && styles.micBtnActive]}
            disabled={isSendingMedia}
          >
            <Text style={styles.micIcon}>🎤</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderChatFooter = () => {
    if (isRecording) {
      return (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingBarText}>Recording… {formatDurationStatic(recordingDuration)} — Release to send</Text>
        </View>
      );
    }
    if (attachmentPreview) {
      const previewImg = attachmentPreview.type === 'image'
        ? <Image source={{ uri: attachmentPreview.uri }} style={styles.attachThumb} />
        : null;
      const previewEmoji = attachmentPreview.type !== 'image'
        ? <Text style={styles.attachFileEmoji}>{attachmentPreview.type === 'voice' ? '🎤' : '📎'}</Text>
        : null;
      const sendBtn = isSendingMedia
        ? <ActivityIndicator size="small" color="#fff" />
        : <Text style={styles.attachSendText}>Send</Text>;
      return (
        <View style={styles.attachPreviewBar}>
          {previewImg}{previewEmoji}
          <Text style={styles.attachName} numberOfLines={1}>{attachmentPreview.name}</Text>
          <TouchableOpacity onPress={() => setAttachmentPreview(null)} style={styles.attachCancelBtn}>
            <Text style={styles.attachCancelText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => sendMediaAttachment(attachmentPreview)}
            style={styles.attachSendBtn}
            disabled={isSendingMedia}
          >
            {sendBtn}
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const renderFooterEl = useCallback(() =>
    isOtherUserTyping ? (
      <View style={styles.typingContainer}>
        <Text style={styles.typingName}>{otherUserName}</Text>
        <TypingDots anim={typingDotAnim} />
      </View>
    ) : null
  , [isOtherUserTyping, otherUserName, typingDotAnim]);

  const renderBubble = useCallback((props) => {
    const { currentMessage } = props;
    const reactions = messageReactions[currentMessage._id] || [];
    const status = messageStatuses[currentMessage._id];
    const isMine = currentMessage.user._id === currentUserId;
    return (
      <BubbleRenderer
        {...props}
        reactions={reactions}
        currentUserId={currentUserId}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
        deliveryStatus={isMine ? status : undefined}
        onImagePress={setFullscreenImage}
      />
    );
  }, [messageReactions, messageStatuses, currentUserId, handleAddReaction, handleRemoveReaction]);

  return (
    <View style={styles.container}>
      {/* Watermark Overlay */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        {[0,1,2,3,4,5,6,7,8,9].map((i) => (
          <View key={`wm-row-${i}`} style={styles.watermarkRow}>
            {[0,1,2].map((j) => (
              <Text key={`wm-cell-${i}-${j}`} style={styles.watermarkText}>
                {user.full_name || user.name || currentUserId}
              </Text>
            ))}
          </View>
        ))}
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      )}
      {!isLoading && loadError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={loadMessages} style={styles.retryButton}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isLoading && !loadError && (
        <GiftedChat
          messages={messages}
          onSend={(msgs) => onSend(msgs)}
          onInputTextChanged={handleInputTextChanged}
          user={{
            _id: currentUserId,
            name: user.full_name || user.name,
          }}
          renderUsernameOnMessage
          showUserAvatar
          renderBubble={renderBubble}
          onLongPress={handleLongPress}
          scrollToBottom
          scrollToBottomComponent={ScrollToBottomBtn}
          renderFooter={renderFooterEl}
          renderActions={renderActions}
          renderSend={renderSend}
          renderChatFooter={renderChatFooter}
        />
      )}

      <EmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onSelectEmoji={(emoji, msgId) => handleAddReaction(msgId, emoji)}
        messageId={selectedMessageId}
      />

      {/* Fullscreen image viewer */}
      {fullscreenImage ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setFullscreenImage(null)}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={styles.imgModalOverlay}
            activeOpacity={1}
            onPress={() => setFullscreenImage(null)}
          >
            <Image source={{ uri: fullscreenImage }} style={styles.imgModalImage} resizeMode="contain" />
            <View style={styles.imgModalCloseBtn}>
              <Text style={styles.imgModalCloseIcon}>✕</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
      
      {/* Prompt 2: iOS Blur Overlay for app switcher privacy */}
      {showBlurOverlay && Platform.OS === 'ios' && (
        <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
    opacity: 0.05,
    zIndex: 1000,
    overflow: 'hidden',
  },
  watermarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    transform: [{ rotate: '-45deg' }],
  },
  watermarkText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 4,
  },
  typingName: {
    fontSize: 12,
    color: '#888',
    marginRight: 4,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    fontSize: 18,
    color: '#FF6B35',
    marginHorizontal: 1,
    lineHeight: 20,
  },
  // Delivery status ticks
  deliveryStatusRow: {
    alignItems: 'flex-end',
    paddingRight: 8,
    marginTop: -4,
    marginBottom: 2,
  },
  tickSent: {
    fontSize: 11,
    color: '#999',
  },
  tickDelivered: {
    fontSize: 11,
    color: '#999',
  },
  tickRead: {
    fontSize: 11,
    color: '#4FC3F7', // blue — matches WhatsApp/web DoneAll style
  },
  // Loading overlay
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Error + retry
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#FF6B35',
    borderRadius: 24,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Scroll-to-bottom button inside GiftedChat
  scrollToBottomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  scrollToBottomIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Media toolbar
  actionBtn: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center', paddingBottom: 4 },
  actionIcon: { fontSize: 22 },
  sendRow: { flexDirection: 'row', alignItems: 'center' },
  offlineBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F57F17', justifyContent: 'center', alignItems: 'center', marginRight: 2, marginBottom: 4 },
  offlineIcon: { fontSize: 13, color: '#fff' },
  sendContainer: { justifyContent: 'center', alignItems: 'center', marginRight: 4, marginBottom: 4 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center' },
  sendIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },
  micBtn: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 4, marginBottom: 4 },
  micBtnActive: { opacity: 0.55 },
  micIcon: { fontSize: 22 },
  // Recording bar
  recordingBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3EE', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#FF6B3533' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E53935', marginRight: 8 },
  recordingBarText: { fontSize: 13, color: '#555', flex: 1 },
  // Attachment preview bar
  attachPreviewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  attachThumb: { width: 44, height: 44, borderRadius: 6, marginRight: 8 },
  attachFileEmoji: { fontSize: 28, marginRight: 8 },
  attachName: { flex: 1, fontSize: 13, color: '#333', marginRight: 8 },
  attachCancelBtn: { padding: 6 },
  attachCancelText: { fontSize: 16, color: '#888', fontWeight: '600' },
  attachSendBtn: { backgroundColor: '#FF6B35', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginLeft: 4, minWidth: 56, alignItems: 'center' },
  attachSendText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  // Fullscreen modal
  imgModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  imgModalImage: { width: '100%', height: '100%' },
  imgModalCloseBtn: { position: 'absolute', top: 48, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  imgModalCloseIcon: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

ConversationScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      conversationId: PropTypes.string.isRequired,
      otherUserName: PropTypes.string,
      otherUserId: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

function ScrollToBottomBtn() {
  return (
    <View style={styles.scrollToBottomBtn}>
      <Text style={styles.scrollToBottomIcon}>↓</Text>
    </View>
  );
}

export default ConversationScreen;
