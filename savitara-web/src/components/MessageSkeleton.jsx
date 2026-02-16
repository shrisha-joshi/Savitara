import { Box, Skeleton } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * MessageSkeleton - Loading skeleton for chat messages
 * Shows animated placeholders while messages are loading
 */
const MessageSkeleton = ({ count = 5, align = 'left' }) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={`skeleton-${align}-${Date.now()}-${index}`}
          sx={{
            alignSelf: align === 'left' ? 'flex-start' : 'flex-end',
            maxWidth: '70%',
            mb: 1.5,
            p: 1.5,
            bgcolor: align === 'left' ? 'white' : 'primary.light',
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          <Skeleton 
            variant="text" 
            width={`${60 + Math.random() * 40}%`} 
            height={20} 
            sx={{ bgcolor: align === 'left' ? 'grey.300' : 'primary.dark' }}
          />
          <Skeleton 
            variant="text" 
            width="30%" 
            height={14} 
            sx={{ 
              mt: 0.5,
              bgcolor: align === 'left' ? 'grey.300' : 'primary.dark',
              opacity: 0.5
            }}
          />
        </Box>
      ))}
    </>
  );
};

MessageSkeleton.propTypes = {
  count: PropTypes.number,
  align: PropTypes.oneOf(['left', 'right'])
};

export default MessageSkeleton;
