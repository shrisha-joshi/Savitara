import {
    AccessTime,
    AutoAwesome,
    CalendarMonth,
    Event,
    Nightlight,
    NightsStay,
    Public,
    Star,
    Today,
    WbSunny,
    WbTwilight
} from '@mui/icons-material'
import {
    Alert,
    Box,
    Card, CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Grid,
    Paper,
    Table, TableBody, TableCell,
    TableHead, TableRow, TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material'
import { format } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import PanchangaCalendar from '../components/PanchangaCalendar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

// Quality colour map for Choghadiya
const CHOGHADIYA_COLORS = {
  excellent:    '#1abc9c',
  auspicious:   '#2ecc71',
  good:         '#58d68d',
  neutral:      '#3498db',
  caution:      '#f39c12',
  inauspicious: '#e74c3c',
}

export default function Panchanga() {
  const { user } = useAuth()
  const [panchanga, setPanchanga] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [panchangaType, setPanchangaType] = useState('lunar')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const theme = useTheme()

  const loadPanchanga = useCallback(async (dateStr, type) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ panchanga_type: type })
      if (user?.location?.latitude)  params.append('latitude',  user.location.latitude)
      if (user?.location?.longitude) params.append('longitude', user.location.longitude)

      const today = format(new Date(), 'yyyy-MM-dd')
      const endpoint = dateStr === today
        ? `/panchanga/today?${params}`
        : `/panchanga/date/${dateStr}?${params}`
      const response = await api.get(endpoint)
      const data = response.data?.data || response.data
      setPanchanga(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load Panchanga:', err)
      setError('Unable to load Panchanga data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPanchanga(selectedDate, panchangaType)
  }, [selectedDate, panchangaType, loadPanchanga])

  const handleTypeChange = (_, newType) => { if (newType) setPanchangaType(newType) }
  const handleDateChange = (e) => { if (e.target.value) setSelectedDate(e.target.value) }

  // ── helpers ────────────────────────────────────────────────────────────────
  const periodLabel = (period) =>
    period?.start && period?.end ? `${period.start} – ${period.end}` : 'N/A'

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
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <Paper
          elevation={0}
          sx={{ mb: 4, p: 4, borderRadius: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <CalendarMonth sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h3" fontWeight={700}>Panchanga</Typography>
              {panchanga && (
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  {panchanga.day_of_week_sa ? `${panchanga.day_of_week_sa} · ` : ''}
                  {panchanga.day_of_week}, {format(new Date(selectedDate + 'T12:00:00'), 'MMMM dd, yyyy')}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Controls row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
            <TextField
              type="date"
              size="small"
              value={selectedDate}
              onChange={handleDateChange}
              inputProps={{ max: '2099-12-31', min: '1900-01-01' }}
              sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1,
                input: { color: 'white' }, '& fieldset': { borderColor: 'rgba(255,255,255,0.4)' } }}
            />
            <ToggleButtonGroup
              value={panchangaType} exclusive onChange={handleTypeChange} size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1 }}
            >
              <ToggleButton value="lunar" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)',
                '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.3)', color: 'white' } }}>
                🌙 Chandramana (Lunar)
              </ToggleButton>
              <ToggleButton value="solar" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)',
                '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.3)', color: 'white' } }}>
                ☀️ Souramana (Solar)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Paper>

        {panchanga && (
          <>
            {/* ── Sankalpa Row (Era info) ──────────────────────────────────── */}
            <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                ॐ Sankalpa — Era & Season
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {panchanga.samvatsara?.name && (
                  <Chip icon={<AutoAwesome />} label={`Samvatsara: ${panchanga.samvatsara.name} (${panchanga.samvatsara.name_sa})`} color="primary" variant="outlined" />
                )}
                {panchanga.vikrama_samvat && (
                  <Chip label={`Vikrama Samvat: ${panchanga.vikrama_samvat}`} variant="outlined" />
                )}
                {panchanga.shaka_samvat && (
                  <Chip label={`Shaka Samvat: ${panchanga.shaka_samvat}`} variant="outlined" />
                )}
                {panchanga.ayana?.name && (
                  <Chip label={`${panchanga.ayana.name} (${panchanga.ayana.name_sa})`} color="warning" variant="outlined" />
                )}
                {panchanga.ritu?.name && (
                  <Chip label={`Ritu: ${panchanga.ritu.name} (${panchanga.ritu.name_sa})`} color="success" variant="outlined" />
                )}
                {(panchanga.month_name) && (
                  <Chip label={`Masa: ${panchanga.month_name} (${panchanga.month_name_sa || ''})`}
                    color="secondary" variant="outlined" />
                )}
                {panchanga.panchanga_type_name && (
                  <Chip label={panchanga.panchanga_type_name} size="small" sx={{ bgcolor: '#764ba2', color: 'white' }} />
                )}
              </Box>
            </Paper>

            {/* ── Five Elements of Panchanga ───────────────────────────────── */}
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Five Elements of Panchanga
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Tithi */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Today color="primary" />
                      <Typography variant="h6" fontWeight={600}>Tithi (Lunar Day)</Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {panchanga.tithi?.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {panchanga.tithi?.name_sa}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Paksha: {panchanga.tithi?.paksha || 'N/A'}
                      {panchanga.tithi_end_time ? ` · Ends: ${panchanga.tithi_end_time}` : ''}
                    </Typography>
                    {panchanga.tithi?.is_ekadashi && (
                      <Chip label="Ekadashi" size="small" color="secondary" sx={{ mt: 1, display: 'block', width: 'fit-content' }} />
                    )}
                    {panchanga.tithi?.is_full_moon && (
                      <Chip label="Purnima 🌕" size="small" color="primary" sx={{ mt: 1, display: 'block', width: 'fit-content' }} />
                    )}
                    {panchanga.tithi?.is_new_moon && (
                      <Chip label="Amavasya 🌑" size="small" sx={{ mt: 1, display: 'block', width: 'fit-content', bgcolor: '#2c3e50', color: 'white' }} />
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Nakshatra */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Star color="primary" />
                      <Typography variant="h6" fontWeight={600}>Nakshatra (Star)</Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {panchanga.nakshatra?.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {panchanga.nakshatra?.name_sa}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Lord: {panchanga.nakshatra?.lord || 'N/A'} · Pada: {panchanga.nakshatra?.pada || 'N/A'}
                      {panchanga.nakshatra_end_time ? ` · Ends: ${panchanga.nakshatra_end_time}` : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Yoga */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Public color="primary" />
                      <Typography variant="h6" fontWeight={600}>Yoga</Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {panchanga.yoga?.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {panchanga.yoga?.name_sa}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Sun + Moon combination
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Karana */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AccessTime color="primary" />
                      <Typography variant="h6" fontWeight={600}>Karana</Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {panchanga.karana?.name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {panchanga.karana?.name_sa}
                    </Typography>
                    {panchanga.karana?.is_bhadra && (
                      <Alert severity="warning" sx={{ mt: 1, py: 0.5, fontSize: '0.75rem' }}>
                        Bhadra — avoid auspicious activities
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Vara */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Event color="primary" />
                      <Typography variant="h6" fontWeight={600}>Vara (Weekday)</Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {panchanga.day_of_week || format(new Date(selectedDate + 'T12:00:00'), 'EEEE')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {panchanga.day_of_week_sa}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Paksha */}
              <Grid item xs={12} md={6} lg={4}>
                <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Nightlight color="primary" />
                      <Typography variant="h6" fontWeight={600}>Paksha</Typography>
                    </Box>
                    <Typography variant="h4" color="primary" fontWeight={700}>
                      {panchanga.tithi?.paksha || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {panchanga.tithi?.paksha_sa}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {panchanga.tithi?.paksha_english}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* ── Extended Elements ────────────────────────────────────────── */}
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Extended Panchanga Elements
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Ayana */}
              {panchanga.ayana && (
                <Grid item xs={12} md={6} lg={4}>
                  <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Ayana</Typography>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {panchanga.ayana.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {panchanga.ayana.name_sa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {panchanga.ayana.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Ritu */}
              {panchanga.ritu && (
                <Grid item xs={12} md={6} lg={4}>
                  <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Ritu (Season)</Typography>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {panchanga.ritu.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {panchanga.ritu.name_sa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Season {panchanga.ritu.number} of 6
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Surya Rashi */}
              {panchanga.surya_rashi && (
                <Grid item xs={12} md={6} lg={4}>
                  <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Surya Rashi (Sun Sign)</Typography>
                      <Typography variant="h5" fontWeight={700} color="error.main">
                        ☀️ {panchanga.surya_rashi.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {panchanga.surya_rashi.name_sa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {panchanga.surya_rashi.longitude}° into sign
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Chandra Rashi */}
              {panchanga.chandra_rashi && (
                <Grid item xs={12} md={6} lg={4}>
                  <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Chandra Rashi (Moon Sign)</Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        🌙 {panchanga.chandra_rashi.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {panchanga.chandra_rashi.name_sa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {panchanga.chandra_rashi.longitude}° into sign
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Moonrise / Moonset */}
              {(panchanga.moonrise || panchanga.moonset) && (
                <Grid item xs={12} md={6} lg={4}>
                  <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Moon Timings</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Moonrise</Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {panchanga.moonrise === 'N/A' ? '–' : panchanga.moonrise}
                          </Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Moonset</Typography>
                          <Typography variant="h6" fontWeight={700}>
                            {panchanga.moonset === 'N/A' ? '–' : panchanga.moonset}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Samvatsara */}
              {panchanga.samvatsara && (
                <Grid item xs={12} md={6} lg={4}>
                  <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Samvatsara (Jovian Year)</Typography>
                      <Typography variant="h5" fontWeight={700} color="secondary.main">
                        {panchanga.samvatsara.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {panchanga.samvatsara.name_sa}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Year {panchanga.samvatsara.number} of 60 · VS {panchanga.samvatsara.vikrama_samvat}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>

            {/* ── Sun & Moon Timings ───────────────────────────────────────── */}
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Sun Timings
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <Card elevation={3} sx={{ borderRadius: 3,
                  background: 'linear-gradient(135deg, #FDB99B 0%, #F76B1C 100%)', color: 'white' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <WbSunny sx={{ fontSize: 40 }} />
                      <Typography variant="h5" fontWeight={600}>Sunrise</Typography>
                    </Box>
                    <Typography variant="h3" fontWeight={700}>{panchanga.sunrise || '06:00'}</Typography>
                    <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                      Brahma Muhurta: 1.5 hours before sunrise
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card elevation={3} sx={{ borderRadius: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <WbTwilight sx={{ fontSize: 40 }} />
                      <Typography variant="h5" fontWeight={600}>Sunset</Typography>
                    </Box>
                    <Typography variant="h3" fontWeight={700}>{panchanga.sunset || '18:00'}</Typography>
                    <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                      Evening prayers and meditation time
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* ── Inauspicious Timings ─────────────────────────────────────── */}
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Inauspicious Timings (Avoid for New Activities)
            </Typography>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
              <Grid container spacing={2}>
                {panchanga.inauspicious_periods?.rahu_kalam?.start && (
                  <Grid item xs={12} md={4}>
                    <Chip
                      icon={<NightsStay />}
                      label={`Rahu Kalam: ${periodLabel(panchanga.inauspicious_periods.rahu_kalam)}`}
                      color="error" sx={{ width: '100%', py: 2, fontSize: '0.9rem' }}
                    />
                  </Grid>
                )}
                {panchanga.inauspicious_periods?.yamagandam?.start && (
                  <Grid item xs={12} md={4}>
                    <Chip
                      label={`Yamagandam: ${periodLabel(panchanga.inauspicious_periods.yamagandam)}`}
                      color="warning" sx={{ width: '100%', py: 2, fontSize: '0.9rem' }}
                    />
                  </Grid>
                )}
                {panchanga.inauspicious_periods?.gulika_kalam?.start && (
                  <Grid item xs={12} md={4}>
                    <Chip
                      label={`Gulika Kalam: ${periodLabel(panchanga.inauspicious_periods.gulika_kalam)}`}
                      color="warning" sx={{ width: '100%', py: 2, fontSize: '0.9rem' }}
                    />
                  </Grid>
                )}
                {/* Durmuhurtam */}
                {panchanga.durmuhurtam?.length > 0 && panchanga.durmuhurtam.map((d, i) => (
                  <Grid item xs={12} md={4} key={`durm-${d.start}-${i}`}>
                    <Chip
                      label={`Durmuhurtam ${i + 1}: ${d.start} – ${d.end}`}
                      color="error" variant="outlined" sx={{ width: '100%', py: 2, fontSize: '0.9rem' }}
                    />
                  </Grid>
                ))}
                {/* Varjyam */}
                {panchanga.varjyam?.start && (
                  <Grid item xs={12} md={4}>
                    <Tooltip title={`Nakshatra: ${panchanga.varjyam.nakshatra}`}>
                      <Chip
                        label={`Varjyam: ${panchanga.varjyam.start} – ${panchanga.varjyam.end}`}
                        color="error" variant="outlined" sx={{ width: '100%', py: 2, fontSize: '0.9rem' }}
                      />
                    </Tooltip>
                  </Grid>
                )}
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Avoid starting new ventures, signing contracts, or performing ceremonies during these periods.
              </Typography>
            </Paper>

            {/* ── Choghadiya ───────────────────────────────────────────────── */}
            {panchanga.choghadiya?.length > 0 && (
              <>
                <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
                  Choghadiya (Day &amp; Night Periods)
                </Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  {['day', 'night'].map((type) => (
                    <Grid item xs={12} md={6} key={type}>
                      <Paper elevation={2} sx={{ p: 2, borderRadius: 3 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                          {type === 'day' ? '☀️ Day Choghadiya' : '🌙 Night Choghadiya'}
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Period</TableCell>
                              <TableCell>Name</TableCell>
                              <TableCell>Time</TableCell>
                              <TableCell>Quality</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {panchanga.choghadiya
                              .filter((c) => c.type === type)
                              .map((c, i) => (
                              <TableRow key={`${type}-chg-${c.start}`} sx={{ bgcolor: CHOGHADIYA_COLORS[c.quality] + '22' }}>
                                <TableCell>{c.period}</TableCell>
                                <TableCell>
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">{c.name_sa}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '0.8rem' }}>{c.start}–{c.end}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={c.quality}
                                    size="small"
                                    sx={{ bgcolor: CHOGHADIYA_COLORS[c.quality], color: 'white',
                                      fontSize: '0.7rem' }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}

            {/* ── Festivals ────────────────────────────────────────────────── */}
            {panchanga.festivals?.length > 0 && (
              <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 4,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(103,126,234,0.1)' : 'rgba(103,126,234,0.05)',
                border: `1px solid ${theme.palette.primary.main}30` }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  🎉 Festivals Today
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {panchanga.festivals.map((festival) => (
                    <Chip key={festival} label={festival} color="secondary" variant="outlined" />
                  ))}
                </Box>
              </Paper>
            )}

            {/* ── Muhurat ──────────────────────────────────────────────────── */}
            {panchanga.muhurat?.length > 0 && (
              <>
                <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
                  Auspicious Muhurat
                </Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  {panchanga.muhurat.map((m) => (
                    <Grid item xs={12} md={4} key={m.name}>
                      <Card elevation={2} sx={{ borderRadius: 3,
                        border: '1px solid', borderColor: 'success.light' }}>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={700}>{m.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {m.name_sa}
                          </Typography>
                          <Typography variant="h6" color="success.main" sx={{ mt: 1 }}>
                            {m.start} – {m.end}
                          </Typography>
                          <Chip label={m.quality} size="small" color="success" sx={{ mt: 0.5 }} />
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                            {m.good_for?.join(', ')}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}

            {/* ── Monthly Calendar ─────────────────────────────────────────── */}
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Monthly Panchanga Calendar
            </Typography>
            <Box sx={{ mb: 4 }}>
              <PanchangaCalendar
                onDateSelect={(dateStr) => setSelectedDate(dateStr)}
                latitude={user?.location?.latitude}
                longitude={user?.location?.longitude}
                panchangaType={panchangaType}
                selectedDate={selectedDate}
              />
            </Box>

            {/* ── About Panchanga ──────────────────────────────────────────── */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(103,126,234,0.1)' : 'rgba(103,126,234,0.05)',
              border: `1px solid ${theme.palette.primary.main}30` }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>About Panchanga</Typography>
              <Typography variant="body1" paragraph>
                Panchanga (Sanskrit: पञ्चाङ्ग, pañcāṅga) is the traditional Hindu almanac comprising five limbs:
                Tithi (lunar day), Vara (weekday), Nakshatra (star), Yoga, and Karana. Together they define the
                cosmic quality of each moment for spiritual practice, ceremony planning, and daily life guidance.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calculations use the ephem astronomical library for precise Sun and Moon positions.
                Timezone: <strong>{panchanga.meta?.timezone || 'Asia/Kolkata'}</strong>.
                For personalised guidance, consult with a qualified Acharya on our platform.
              </Typography>
            </Paper>
          </>
        )}
      </Container>
    </Layout>
  )
}

