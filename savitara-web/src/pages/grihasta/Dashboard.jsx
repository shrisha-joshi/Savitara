import { useMemo, useState, useEffect } from 'react'
import { Container, Typography, Grid, Paper, CircularProgress, Box, Button, Chip, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import PanchangaWidget from '../../components/PanchangaWidget'
import { useAuth } from '../../context/AuthContext'
import useSWRApi from '../../hooks/useSWRApi'
import { getTimeBasedGreeting, getContextualGreeting, getMilestoneMessage } from '../../utils/personalization'
import ConfettiCelebration from '../../components/ConfettiCelebration'
import StreakDisplay from '../../components/StreakDisplay'
import api from '../../services/api'

export default function GrihastaDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [streakDays, setStreakDays] = useState(0)
  
  // Use SWR for automatic caching and revalidation
  const { data, isLoading: loading } = useSWRApi('/bookings/my?limit=50')
  
  // Fetch streak data
  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const response = await api.get('/gamification/streak')
        setStreakDays(response.data?.streak_days || 0)
      } catch (error) {
        console.error('Failed to fetch streak:', error)
      }
    }
    fetchStreak()
  }, [])
  
  // Compute stats and recent bookings from cached/fresh data
  const { stats, recentBookings } = useMemo(() => {
    const bookings = data?.data?.bookings || data?.bookings || []
    return {
      stats: {
        total: bookings.length,
        completed: bookings.filter(b => b.status === 'completed').length,
        upcoming: bookings.filter(b => ['confirmed', 'requested', 'pending_payment'].includes(b.status)).length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
      },
      recentBookings: bookings.slice(0, 5),
    }
  }, [data])

  const statCards = [
    { label: 'My Bookings', value: stats.total, color: '#FF6B35' },
    { label: 'Completed', value: stats.completed, color: '#22C55E' },
    { label: 'Upcoming', value: stats.upcoming, color: '#3B82F6' },
  ]

  // Personalization
  const greeting = getTimeBasedGreeting(user?.full_name || user?.name)
  const contextMessage = getContextualGreeting({ 
    total_bookings: stats.total, 
    role: user?.role,
    last_booking_date: recentBookings[0]?.created_at
  })
  const milestone = getMilestoneMessage(stats.total)

  return (
    <Layout>
      {milestone && <ConfettiCelebration trigger={true} type="success" duration={3000} />}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          {greeting.greeting}
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          {contextMessage}
        </Typography>

        {/* Milestone Achievement */}
        {milestone && (
          <Alert severity="success" icon={<span style={{ fontSize: 24 }}>🎉</span>} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600}>{milestone.message}</Typography>
            <Chip label={milestone.badge} size="small" color="success" sx={{ mt: 1 }} />
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <PanchangaWidget />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <StreakDisplay streak={streakDays} goal={30} variant="full" />
          </Grid>

          {loading ? (
            <Grid item xs={12}><Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box></Grid>
          ) : statCards.map(sc => (
            <Grid item xs={12} md={4} key={sc.label}>
              <Paper sx={{ p: 3, borderLeft: `4px solid ${sc.color}`, cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
                <Typography variant="h6" color="text.secondary">{sc.label}</Typography>
                <Typography variant="h3" sx={{ color: sc.color, fontWeight: 700 }}>{sc.value}</Typography>
              </Paper>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Bookings</Typography>
                <Button size="small" onClick={() => navigate('/bookings')}>View All</Button>
              </Box>
              {recentBookings.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <Typography color="text.secondary">No bookings yet.</Typography>
                  <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/search')}>
                    Find an Acharya
                  </Button>
                </Box>
              ) : (
                recentBookings.map(b => (
                  <Box key={b._id || b.id} display="flex" justifyContent="space-between" alignItems="center"
                    py={1} borderBottom="1px solid #f0f0f0" sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/booking/${b._id || b.id}`)}>
                    <Typography variant="body2">{b.service_name || b.pooja_name || 'Booking'}</Typography>
                    <Chip label={b.status} size="small" color={getStatusColor(b.status)} />
                  </Box>
                ))
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  )
}
