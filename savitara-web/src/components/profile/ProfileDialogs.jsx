import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Box
} from '@mui/material'
import { Logout, DeleteForever, Warning } from '@mui/icons-material'
import PropTypes from 'prop-types'

/**
 * Logout confirmation dialog
 */
export function LogoutDialog({ open, onClose, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Logout color="primary" />
        Confirm Logout
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to logout? You'll need to sign in again to access your account.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          variant="contained"
          sx={{ borderRadius: 2 }}
        >
          Logout
        </Button>
      </DialogActions>
    </Dialog>
  )
}

LogoutDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired
}

/**
 * First delete account confirmation dialog
 */
export function DeleteAccountDialog1({ open, onClose, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
        <Warning color="warning" />
        Delete Account?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          <strong>Warning:</strong> This action cannot be undone. Deleting your account will:
          <Box component="ul" sx={{ mt: 1, mb: 0 }}>
            <li>Remove all your profile data</li>
            <li>Cancel any pending bookings</li>
            <li>Delete your chat history</li>
            <li>Remove all reviews you've written</li>
          </Box>
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>
          Keep My Account
        </Button>
        <Button
          onClick={onConfirm}
          color="warning"
          variant="contained"
          sx={{ borderRadius: 2 }}
        >
          Yes, Delete My Account
        </Button>
      </DialogActions>
    </Dialog>
  )
}

DeleteAccountDialog1.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired
}

/**
 * Final delete account confirmation dialog with text input
 */
export function DeleteAccountDialog2({
  open,
  onClose,
  confirmText,
  onConfirmTextChange,
  onDelete,
  deleting
}) {
  const isValidText = confirmText === 'DELETE'
  const showError = confirmText !== '' && !isValidText

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
        <DeleteForever color="error" />
        Final Confirmation
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          This is your <strong>final warning</strong>. Your account will be permanently deleted.
          <br /><br />
          To confirm, please type <strong>DELETE</strong> below:
        </DialogContentText>
        <TextField
          fullWidth
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value.toUpperCase())}
          placeholder="Type DELETE to confirm"
          error={showError}
          helperText={showError ? 'Please type DELETE exactly' : ''}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={() => {
            onClose()
            onConfirmTextChange('')
          }}
          sx={{ borderRadius: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={onDelete}
          color="error"
          variant="contained"
          disabled={!isValidText || deleting}
          sx={{ borderRadius: 2 }}
        >
          {deleting ? 'Deleting...' : 'Delete My Account Forever'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

DeleteAccountDialog2.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  confirmText: PropTypes.string.isRequired,
  onConfirmTextChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  deleting: PropTypes.bool.isRequired
}
