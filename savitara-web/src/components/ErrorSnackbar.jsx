import { Snackbar, Alert } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * ErrorSnackbar Component
 * 
 * Displays error messages in a Snackbar at the bottom of the screen.
 * 
 * Usage:
 * const [error, setError] = useState('');
 * ...
 * <ErrorSnackbar error={error} onClose={() => setError('')} />
 */
const ErrorSnackbar = ({ error, onClose, autoHideDuration = 6000 }) => {
  return (
    <Snackbar 
      open={Boolean(error)} 
      autoHideDuration={autoHideDuration} 
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={onClose} severity="error" variant="filled" sx={{ width: '100%' }}>
        {error}
      </Alert>
    </Snackbar>
  );
};

ErrorSnackbar.propTypes = {
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  autoHideDuration: PropTypes.number,
};

export default ErrorSnackbar;
