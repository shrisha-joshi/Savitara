import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const MessageReactions = ({
  reactions = [],
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  messageId,
  compact = false,
}) => {
  const [loadingEmojis, setLoadingEmojis] = React.useState(new Set());

  // Group reactions by emoji
  const groupedReactions = React.useMemo(() => {
    const groups = {};
    reactions.forEach((reaction) => {
      if (!groups[reaction.emoji]) {
        groups[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          reactedByCurrentUser: false,
        };
      }
      groups[reaction.emoji].count += 1;
      groups[reaction.emoji].users.push(reaction.user_id);
      if (reaction.user_id === currentUserId) {
        groups[reaction.emoji].reactedByCurrentUser = true;
      }
    });
    return Object.values(groups);
  }, [reactions, currentUserId]);

  const handleReactionPress = async (emoji) => {
    const reacted = groupedReactions.find((r) => r.emoji === emoji)?.reactedByCurrentUser;

    // Optimistic UI update
    setLoadingEmojis((prev) => new Set(prev).add(emoji));

    try {
      if (reacted) {
        await onRemoveReaction(messageId, emoji);
      } else {
        await onAddReaction(messageId, emoji);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    } finally {
      setLoadingEmojis((prev) => {
        const newSet = new Set(prev);
        newSet.delete(emoji);
        return newSet;
      });
    }
  };

  if (!reactions || reactions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {groupedReactions.map((reaction) => {
        const isLoading = loadingEmojis.has(reaction.emoji);
        const reacted = reaction.reactedByCurrentUser;

        return (
          <TouchableOpacity
            key={reaction.emoji}
            style={[
              styles.reactionChip,
              reacted && styles.reactionChipReacted,
              compact && styles.reactionChipCompact,
            ]}
            onPress={() => handleReactionPress(reaction.emoji)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={reacted ? '#FF6B35' : '#999'} />
            ) : (
              <>
                <Text style={[styles.reactionEmoji, compact && styles.reactionEmojiCompact]}>
                  {reaction.emoji}
                </Text>
                <Text style={[styles.reactionCount, reacted && styles.reactionCountReacted]}>
                  {reaction.count}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 2,
  },
  containerCompact: {
    marginTop: 2,
    marginBottom: 0,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 44,
    justifyContent: 'center',
  },
  reactionChipReacted: {
    backgroundColor: '#FFE8E0',
    borderColor: '#FF6B35',
  },
  reactionChipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
    minWidth: 38,
  },
  reactionEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  reactionEmojiCompact: {
    fontSize: 14,
    marginRight: 2,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  reactionCountReacted: {
    color: '#FF6B35',
  },
});

MessageReactions.propTypes = {
  reactions: PropTypes.array,
  currentUserId: PropTypes.string.isRequired,
  onAddReaction: PropTypes.func.isRequired,
  onRemoveReaction: PropTypes.func.isRequired,
  messageId: PropTypes.string.isRequired,
  compact: PropTypes.bool,
};

export default MessageReactions;
