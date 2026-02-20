import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Tooltip, CircularProgress } from '@mui/material';

const MessageReactions = ({ 
  reactions = [], 
  currentUserId, 
  onReact, 
  onUnreact,
  disabled = false 
}) => {
  const [loading, setLoading] = useState(null); // Track which emoji is being processed

  // Group reactions by emoji and count
  const reactionGroups = reactions.reduce((acc, reaction) => {
    const { emoji, user_id } = reaction;
    if (!acc[emoji]) {
      acc[emoji] = {
        emoji,
        count: 0,
        reactedByMe: false,
        users: []
      };
    }
    acc[emoji].count++;
    acc[emoji].users.push(user_id);
    if (user_id === currentUserId) {
      acc[emoji].reactedByMe = true;
    }
    return acc;
  }, {});

  const reactionSummaries = Object.values(reactionGroups);

  const handleReactionClick = async (emoji, reactedByMe) => {
    if (disabled || loading) return;

    setLoading(emoji);
    try {
      if (reactedByMe) {
        await onUnreact(emoji);
      } else {
        await onReact(emoji);
      }
    } catch (error) {
      console.error('Reaction error:', error);
    } finally {
      setLoading(null);
    }
  };

  if (reactionSummaries.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {reactionSummaries.map(({ emoji, count, reactedByMe }) => (
        <Tooltip 
          key={emoji} 
          title={reactedByMe ? 'Click to remove your reaction' : 'Click to react'} 
          arrow
        >
          <Chip
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{emoji}</span>
                <span style={{ fontSize: '0.75rem' }}>{count}</span>
                {loading === emoji && (
                  <CircularProgress size={10} sx={{ ml: 0.5 }} />
                )}
              </Box>
            }
            size="small"
            onClick={() => handleReactionClick(emoji, reactedByMe)}
            disabled={disabled || loading !== null}
            sx={{
              height: 24,
              fontSize: '0.85rem',
              bgcolor: reactedByMe ? 'primary.light' : 'action.hover',
              color: reactedByMe ? 'primary.contrastText' : 'text.primary',
              border: reactedByMe ? '1px solid' : 'none',
              borderColor: reactedByMe ? 'primary.main' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: reactedByMe ? 'primary.main' : 'action.selected',
                transform: 'scale(1.1)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              }
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};

MessageReactions.propTypes = {
  reactions: PropTypes.arrayOf(
    PropTypes.shape({
      emoji: PropTypes.string.isRequired,
      user_id: PropTypes.string.isRequired,
      created_at: PropTypes.string
    })
  ),
  currentUserId: PropTypes.string.isRequired,
  onReact: PropTypes.func.isRequired,
  onUnreact: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

export default MessageReactions;
