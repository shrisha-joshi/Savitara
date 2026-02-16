import { Box, Paper, Skeleton, Stack } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * ConversationSkeleton - Loading skeleton for conversation list items
 * Shows animated placeholders while conversations are loading
 */
const ConversationSkeleton = ({ count = 8 }) => {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Paper
          key={`conversation-skeleton-${Date.now()}-${index}`}
          elevation={0}
          sx={{
            p: 2,
            mb: 1,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            cursor: 'default'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Avatar skeleton */}
            <Skeleton variant="circular" width={48} height={48} />
            
            {/* Content skeleton */}
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="50%" height={24} />
              <Skeleton variant="text" width="80%" height={20} sx={{ mt: 0.5 }} />
            </Box>
            
            {/* Time+badge skeleton */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <Skeleton variant="text" width={40} height={16} />
              {index % 3 === 0 && <Skeleton variant="circular" width={20} height={20} />}
            </Box>
          </Stack>
        </Paper>
      ))}
    </>
  );
};

ConversationSkeleton.propTypes = {
  count: PropTypes.number
};

export default ConversationSkeleton;
