import { Card, CardContent, Grid, Typography, Box, CircularProgress } from '@mui/material'
import { CheckCircle, Schedule, CalendarMonth } from '@mui/icons-material'
import PropTypes from 'prop-types'

/**
 * Dashboard stats cards showing booking statistics
 */
export default function ProfileStats({ stats }) {
  if (stats.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  const statItems = [
    {
      label: 'Total Bookings',
      value: stats.totalBookings,
      icon: <CalendarMonth color="primary" />,
      color: 'primary.main'
    },
    {
      label: 'Completed',
      value: stats.completedBookings,
      icon: <CheckCircle sx={{ color: 'success.main' }} />,
      color: 'success.main'
    },
    {
      label: 'Upcoming',
      value: stats.upcomingBookings,
      icon: <Schedule sx={{ color: 'info.main' }} />,
      color: 'info.main'
    }
  ]

  return (
    <Grid container spacing={2}>
      {statItems.map((stat) => (
        <Grid item xs={12} sm={4} key={stat.label}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ mb: 1 }}>{stat.icon}</Box>
              <Typography variant="h4" fontWeight={700} color={stat.color}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

ProfileStats.propTypes = {
  stats: PropTypes.shape({
    totalBookings: PropTypes.number.isRequired,
    completedBookings: PropTypes.number.isRequired,
    upcomingBookings: PropTypes.number.isRequired,
    loading: PropTypes.bool.isRequired
  }).isRequired
}
