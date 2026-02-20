import { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  IconButton, 
  Popover, 
  Box,
  Typography,
  Tooltip
} from '@mui/material';
import AddReactionIcon from '@mui/icons-material/AddReaction';

// Common emoji categories (200 total from backend whitelist)
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',  '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴'],
  'Emotions': ['😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬'],
  'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  'Faces & Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎'],
  'Animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪲', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳'],
  'Objects': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂']
};

const EmojiPickerButton = ({ onSelect, size = 'small', disabled = false }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiSelect = (emoji) => {
    onSelect(emoji);
    handleClose();
  };

  const open = Boolean(anchorEl);
  const id = open ? 'emoji-picker-popover' : undefined;

  return (
    <>
      <Tooltip title="Add reaction">
        <IconButton 
          aria-describedby={id}
          size={size} 
          onClick={handleClick}
          disabled={disabled}
          sx={{ 
            opacity: 0.7,
            '&:hover': { opacity: 1 }
          }}
        >
          <AddReactionIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 350, maxHeight: 400, overflow: 'auto' }}>
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <Box key={category} sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {category}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {emojis.map((emoji) => (
                  <IconButton
                    key={emoji}
                    size="small"
                    onClick={() => handleEmojiSelect(emoji)}
                    sx={{
                      fontSize: 24,
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    {emoji}
                  </IconButton>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
};

EmojiPickerButton.propTypes = {
  onSelect: PropTypes.func.isRequired,
  size: PropTypes.string,
  disabled: PropTypes.bool
};

export default EmojiPickerButton;
