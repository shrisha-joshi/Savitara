import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const EMOJI_CATEGORIES = {
  smileys: {
    name: 'Smileys & People',
    icon: 'mood',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    ],
  },
  gestures: {
    name: 'Gestures',
    icon: 'pan-tool',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤝', '👏',
      '🙌', '👐', '🤲', '🙏', '💪', '🦾', '🦵', '🦿',
    ],
  },
  hearts: {
    name: 'Hearts',
    icon: 'favorite',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
    ],
  },
  animals: {
    name: 'Animals',
    icon: 'pets',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
      '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
    ],
  },
  food: {
    name: 'Food & Drink',
    icon: 'restaurant',
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒',
      '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞',
    ],
  },
  travel: {
    name: 'Travel & Places',
    icon: 'flight',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐',
      '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔',
      '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '✈️',
    ],
  },
  objects: {
    name: 'Objects',
    icon: 'lightbulb',
    emojis: [
      '⌚', '📱', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜',
      '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞',
      '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭',
    ],
  },
  symbols: {
    name: 'Symbols',
    icon: 'star',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    ],
  },
};

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

const EmojiPicker = ({ visible, onClose, onSelectEmoji, messageId }) => {
  const [selectedCategory, setSelectedCategory] = React.useState('smileys');

  const handleEmojiSelect = (emoji) => {
    onSelectEmoji(emoji, messageId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Reaction</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Quick Reactions */}
          <View style={styles.quickReactions}>
            <Text style={styles.sectionTitle}>Quick Reactions</Text>
            <View style={styles.quickReactionsGrid}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.quickReactionButton}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.categoryTab,
                  selectedCategory === key && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(key)}
              >
                <MaterialIcons
                  name={category.icon}
                  size={20}
                  color={selectedCategory === key ? '#FF6B35' : '#999'}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Emoji Grid */}
          <ScrollView style={styles.emojiGrid} showsVerticalScrollIndicator={false}>
            <View style={styles.emojiGridContent}>
              {EMOJI_CATEGORIES[selectedCategory].emojis.map((emoji, index) => (
                <TouchableOpacity
                  key={`${emoji}-${index}`}
                  style={styles.emojiButton}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  quickReactions: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  quickReactionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickReactionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickReactionEmoji: {
    fontSize: 28,
  },
  categoryTabs: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  categoryTabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  categoryTab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  categoryTabActive: {
    backgroundColor: '#FFE8E0',
  },
  emojiGrid: {
    flex: 1,
  },
  emojiGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  emojiButton: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emojiText: {
    fontSize: 28,
  },
});

EmojiPicker.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectEmoji: PropTypes.func.isRequired,
  messageId: PropTypes.string,
};

export default EmojiPicker;
