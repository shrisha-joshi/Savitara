import { Box, Button, Grid, Typography, Divider } from '@mui/material'
import { Logout, DeleteForever, CalendarMonth, Favorite } from '@mui/icons-material'

/**
 * Quick links and account action buttons
 */
export function QuickLinks({ navigate }) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<CalendarMonth />}
          onClick={() => navigate('/bookings')}
          sx={{ py: 1.5, borderRadius: 3 }}
        >
          My Bookings
        </Button>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Favorite />}
          onClick={() => navigate('/favorites')}
          sx={{ py: 1.5, borderRadius: 3 }}
        >
          Favorites
        </Button>
      </Grid>
    </Grid>
  )
}

/**
 * Account action buttons (logout, delete)
 */
export function AccountActions({ onLogoutClick, onDeleteClick }) {
  return (
    <>
      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" gutterBottom fontWeight={600} color="text.secondary">
        Account Actions
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<Logout />}
          onClick={onLogoutClick}
          sx={{ borderRadius: 3 }}
        >
          Logout
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForever />}
          onClick={onDeleteClick}
          sx={{ borderRadius: 3 }}
        >
          Delete Account
        </Button>
      </Box>
    </>
  )
}
