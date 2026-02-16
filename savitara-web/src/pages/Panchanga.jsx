import { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Alert,
  useTheme
} from '@mui/material'
import {
  CalendarMonth,
  WbSunny,
  Nightlight,
  Star,
  Public,
  AccessTime,
  Event,
  Today
} from '@mui/icons-material'
import Layout from '../components/Layout'
import api from '../services/api'
import { format } from 'date-fns'

export default function Panchanga() {
  const [panchanga, setPanchanga] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const theme = useTheme()

  useEffect(() => {
    loadPanchanga()
  }, [])

  const loadPanchanga = async () => {
    try {
      setLoading(true)
      const response = await api.get('/panchanga/today')
      const data = response.data?.data || response.data
      setPanchanga(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load Panchanga:', err)
      setError('Unable to load Panchanga data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress size={60} />
          </Box>
        </Container>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        </Container>
      </Layout>
    )
  }

  const today = new Date()

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Page Header */}
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: 4,
            borderRadius: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CalendarMonth sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h3" fontWeight={700}>
                Today's Panchanga
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                {format(today, 'EEEE, MMMM dd, yyyy')}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body1" sx={{ opacity: 0.9, mt: 2 }}>
            Panchanga is an ancient Vedic calendar system that provides important astronomical and astrological information for the day.
          </Typography>
        </Paper>

        {/* Main Panchanga Information */}
        {panchanga && (
          <>
            {/* Five Elements (Panchangam) */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                  Five Elements of Panchanga
                </Typography>
              </Grid>

              {/* Tithi */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Today color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Tithi (Lunar Day)
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                      {typeof panchanga.tithi === 'object' ? (panchanga.tithi?.name_sanskrit || panchanga.tithi?.name_english || 'N/A') : (panchanga.tithi || 'N/A')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The lunar day based on the angle between Sun and Moon
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Nakshatra */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Star color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Nakshatra (Star)
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                      {typeof panchanga.nakshatra === 'object' ? (panchanga.nakshatra?.name_sanskrit || panchanga.nakshatra?.name_english || 'N/A') : (panchanga.nakshatra || 'N/A')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The lunar mansion or constellation of the Moon
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Yoga */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Public color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Yoga
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                      {typeof panchanga.yoga === 'object' ? (panchanga.yoga?.name || 'N/A') : (panchanga.yoga || 'N/A')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Auspicious combination of Sun and Moon positions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Karana */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AccessTime color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Karana
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                      {typeof panchanga.karana === 'object' ? (panchanga.karana?.name || 'N/A') : (panchanga.karana || 'N/A')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Half of a Tithi, important for timing activities
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Vara (Weekday) */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Event color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Vara (Weekday)
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                      {panchanga.day_of_week || panchanga.vara || format(today, 'EEEE')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The day of the week in Vedic calendar
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Paksha */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Nightlight color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        Paksha (Lunar Phase)
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
                      {panchanga.tithi?.paksha || panchanga.paksha || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Shukla (Waxing) or Krishna (Waning) moon phase
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Sunrise & Sunset */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                  Sun Timings
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card 
                  elevation={3} 
                  sx={{ 
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #FDB99B 0%, #F76B1C 100%)',
                    color: 'white'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <WbSunny sx={{ fontSize: 40 }} />
                      <Typography variant="h5" fontWeight={600}>
                        Sunrise
                      </Typography>
                    </Box>
                    <Typography variant="h3" fontWeight={700}>
                      {panchanga.sunrise || '06:00 AM'}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                      Brahma Muhurta: 1.5 hours before sunrise
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card 
                  elevation={3} 
                  sx={{ 
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Nightlight sx={{ fontSize: 40 }} />
                      <Typography variant="h5" fontWeight={600}>
                        Sunset
                      </Typography>
                    </Box>
                    <Typography variant="h3" fontWeight={700}>
                      {panchanga.sunset || '06:00 PM'}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                      Evening prayers and meditation time
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Auspicious Timings */}
            {(panchanga.rahukala || panchanga.yamagandam || panchanga.gulika) && (
              <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
                <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                  Inauspicious Timings (To Be Avoided)
                </Typography>
                <Grid container spacing={2}>
                  {panchanga.rahukala && (
                    <Grid item xs={12} md={4}>
                      <Chip 
                        label={`Rahu Kala: ${panchanga.rahukala}`}
                        color="error"
                        sx={{ width: '100%', py: 2, fontSize: '1rem' }}
                      />
                    </Grid>
                  )}
                  {panchanga.yamagandam && (
                    <Grid item xs={12} md={4}>
                      <Chip 
                        label={`Yama Gandam: ${panchanga.yamagandam}`}
                        color="warning"
                        sx={{ width: '100%', py: 2, fontSize: '1rem' }}
                      />
                    </Grid>
                  )}
                  {panchanga.gulika && (
                    <Grid item xs={12} md={4}>
                      <Chip 
                        label={`Gulika: ${panchanga.gulika}`}
                        color="warning"
                        sx={{ width: '100%', py: 2, fontSize: '1rem' }}
                      />
                    </Grid>
                  )}
                </Grid>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  These are periods considered inauspicious for starting new ventures or important activities
                </Typography>
              </Paper>
            )}

            {/* Information Box */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                borderRadius: 3,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(103, 126, 234, 0.1)' : 'rgba(103, 126, 234, 0.05)',
                border: `1px solid ${theme.palette.primary.main}30`
              }}
            >
              <Typography variant="h6" fontWeight={600} gutterBottom>
                About Panchanga
              </Typography>
              <Typography variant="body1" paragraph>
                Panchanga is a Hindu calendar and almanac which follows traditional units of Hindu timekeeping. 
                It is used extensively in Vedic astrology to determine auspicious times (muhurta) for various activities 
                like weddings, religious ceremonies, business ventures, and other significant events.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The information presented here is based on Vedic astronomical calculations and should be used as a reference 
                for spiritual and cultural purposes. For personalized guidance, please consult with a qualified Acharya.
              </Typography>
            </Paper>
          </>
        )}
      </Container>
    </Layout>
  )
}
