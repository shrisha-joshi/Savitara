/**
 * Call Button Component
 * Initiates masked voice calls between users
 */
import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { FaPhone } from 'react-icons/fa';
import api from '../../services/api';
import PropTypes from 'prop-types';

/**
 * CallButton Component
 * @param {Object} props
 * @param {string} props.bookingId - ID of the booking for the call
 * @param {string} props.buttonText - Text to display on button
 * @param {string} props.variant - MUI button variant
 * @param {boolean} props.fullWidth - Full width button
 * @param {Object} props.sx - MUI sx prop for styling
 */
export default function CallButton({ 
  bookingId, 
  buttonText = 'Call',
  variant = 'contained',
  fullWidth = false,
  sx = {}
}) {
  const [isInitiating, setIsInitiating] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const handleInitiateCall = async () => {
    setIsInitiating(true);

    try {
      const response = await api.post(`/calls/voice/initiate`, null, {
        params: { booking_id: bookingId }
      });

      if (response.data.success) {
        setToast({
          open: true,
          message: 'Call initiated! You will receive a call shortly from our platform number.',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      
      let errorMessage = 'Failed to initiate call. Please try again.';
      
      if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to call this user.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Booking not found.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      setToast({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setIsInitiating(false);
    }
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  return (
    <>
      <Button
        variant={variant}
        color="primary"
        fullWidth={fullWidth}
        startIcon={isInitiating ? <CircularProgress size={16} color="inherit" /> : <FaPhone />}
        onClick={handleInitiateCall}
        disabled={isInitiating}
        sx={{
          py: 1.5,
          ...sx
        }}
      >
        {isInitiating ? 'Connecting...' : buttonText}
      </Button>

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseToast} 
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}
CallButton.propTypes = {
  bookingId: PropTypes.string.isRequired,
  buttonText: PropTypes.string,
  variant: PropTypes.string,
  fullWidth: PropTypes.bool,
  sx: PropTypes.object,
};