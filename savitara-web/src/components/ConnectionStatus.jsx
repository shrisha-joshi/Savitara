import { Box, Chip } from '@mui/material';
import { Wifi, WifiOff, SyncProblem } from '@mui/icons-material';
import PropTypes from 'prop-types';
import { useSocket } from '../context/SocketContext';

const ConnectionStatus = ({ showWhenOnline = false }) => {
  const { isConnected, isConnecting } = useSocket();

  // Don't show anything if online and showWhenOnline is false
  if (isConnected && !showWhenOnline) {
    return null;
  }

  const getStatusConfig = () => {
    if (isConnected) {
      return {
        label: 'Connected',
        color: 'success',
        icon: <Wifi />,
        bgcolor: 'success.light'
      };
    }
    
    if (isConnecting) {
      return {
        label: 'Connecting',
        color: 'warning',
        icon: <SyncProblem />,
        bgcolor: 'warning.light'
      };
    }
    
    return {
      label: 'Offline',
      color: 'error',
      icon: <WifiOff />,
      bgcolor: 'error.light'
    };
  };

  const status = getStatusConfig();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 70,
        right: 16,
        zIndex: 1300,
        animation: isConnecting ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        '@keyframes pulse': {
          '0%, 100%': {
            opacity: 1,
          },
          '50%': {
            opacity: 0.5,
          },
        },
      }}
    >
      <Chip
        icon={status.icon}
        label={status.label}
        color={status.color}
        size="small"
        sx={{
          boxShadow: 2,
          fontWeight: 'bold',
          '& .MuiChip-icon': {
            color: 'inherit',
          },
        }}
      />
    </Box>
  );
};

ConnectionStatus.propTypes = {
  showWhenOnline: PropTypes.bool,
};

export default ConnectionStatus;
