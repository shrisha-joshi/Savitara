/**
 * PanchangaCalendar — Monthly calendar view for Panchanga lookup.
 *
 * Props:
 *   onDateSelect(dateStr: string) — called when the user clicks a day
 *   latitude, longitude           — user's location for API query
 *   panchangaType                 — 'lunar' | 'solar'
 *   selectedDate                  — currently highlighted date (YYYY-MM-DD)
 */
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import {
    Box,
    Chip,
    CircularProgress,
    Grid,
    IconButton,
    Paper,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material'
import {
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay, isSameDay, isToday, parseISO,
    startOfMonth
} from 'date-fns'
import PropTypes from 'prop-types'
import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const QUALITY_COLOR = {
  excellent: '#1abc9c',
  auspicious: '#2ecc71',
  good: '#58d68d',
  neutral: '#3498db',
}

export default function PanchangaCalendar({
  onDateSelect,
  latitude,
  longitude,
  panchangaType = 'lunar',
  selectedDate,
}) {
  const theme = useTheme()
  const [viewMonth, setViewMonth] = useState(() => {
    const d = selectedDate ? parseISO(selectedDate) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [monthData, setMonthData] = useState([])   // array of day summaries from backend
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadMonth = useCallback(async (year, month) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ panchanga_type: panchangaType })
      if (latitude)  params.append('latitude',  latitude)
      if (longitude) params.append('longitude', longitude)
      const res = await api.get(`/panchanga/month/${year}/${month}?${params}`)
      const days = res.data?.data?.days || []
      setMonthData(days)
    } catch {
      setError('Could not load month data')
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude, panchangaType])

  useEffect(() => {
    loadMonth(viewMonth.getFullYear(), viewMonth.getMonth() + 1)
  }, [viewMonth, loadMonth])

  const prevMonth = () =>
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () =>
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // Build day map from API data
  const dayMap = {}
  monthData.forEach((d) => { dayMap[d.date] = d })

  // Generate calendar cells including leading/trailing blanks
  const firstDay = startOfMonth(viewMonth)
  const lastDay  = endOfMonth(viewMonth)
  const daysInMonth = eachDayOfInterval({ start: firstDay, end: lastDay })
  const leadingBlanks = getDay(firstDay) // 0=Sun

  // Compute the "best choghadiya" quality for the day for background colour
  const dayQuality = (dateStr) => {
    const d = dayMap[dateStr]
    if (!d) return null
    // Use tithi name to hint quality
    if (d.is_full_moon || d.is_ekadashi) return 'auspicious'
    if (d.is_new_moon) return 'neutral'
    if (d.festivals?.length > 0) return 'excellent'
    return null
  }

  const dayBg = (dateStr) => {
    const q = dayQuality(dateStr)
    if (!q) return 'transparent'
    return QUALITY_COLOR[q] + '22'
  }

  return (
    <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        p: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'
      }}>
        <IconButton onClick={prevMonth} sx={{ color: 'white' }}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          {format(viewMonth, 'MMMM yyyy')}
        </Typography>
        <IconButton onClick={nextMonth} sx={{ color: 'white' }}>
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Weekday headers */}
      <Grid container sx={{ px: 1, pt: 1 }}>
        {WEEKDAYS.map((wd) => (
          <Grid item xs={12 / 7} key={wd} sx={{ textAlign: 'center' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              {wd}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {(() => {
        if (loading) return (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={36} />
          </Box>
        );
        if (error) return (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="error">{error}</Typography>
          </Box>
        );
        return (
        <Grid container sx={{ px: 1, pb: 1 }}>
          {/* Leading blank cells */}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <Grid item xs={12 / 7} key={`lead-blank-${leadingBlanks}-${i}`} />
          ))}

          {/* Day cells */}
          {daysInMonth.map((dayObj) => {
            const dateStr = format(dayObj, 'yyyy-MM-dd')
            const info = dayMap[dateStr]
            const isSelected = selectedDate && isSameDay(dayObj, parseISO(selectedDate))
            const isTodayDate = isToday(dayObj)

            return (
              <Grid item xs={12 / 7} key={dateStr}>
                <Tooltip
                  title={info ? (
                    <Box>
                      <Typography variant="caption" display="block">
                        {info.tithi?.name} ({info.tithi?.paksha})
                      </Typography>
                      <Typography variant="caption" display="block">
                        Nakshatra: {info.nakshatra?.name}
                      </Typography>
                      {info.festivals?.length > 0 && (
                        <Typography variant="caption" display="block">
                          🎉 {info.festivals.join(', ')}
                        </Typography>
                      )}
                      <Typography variant="caption" display="block">
                        {info.sunrise} – {info.sunset}
                      </Typography>
                    </Box>
                  ) : ''}
                  arrow
                >
                  <Box
                    onClick={() => onDateSelect?.(dateStr)}
                    sx={{
                      m: 0.3,
                      p: 0.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: (() => {
                        if (isSelected) return theme.palette.primary.main;
                        if (isTodayDate) return theme.palette.primary.light + '44';
                        return dayBg(dateStr);
                      })(),
                      border: isTodayDate ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                      '&:hover': { bgcolor: theme.palette.action.hover },
                      minHeight: 56,
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color={isSelected ? 'white' : 'text.primary'}
                      display="block"
                    >
                      {dayObj.getDate()}
                    </Typography>

                    {info && (
                      <>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.6rem',
                            color: isSelected ? 'rgba(255,255,255,0.85)' : 'text.secondary',
                            lineHeight: 1.2,
                            display: 'block',
                          }}
                        >
                          {info.tithi?.name}
                        </Typography>
                        {info.festivals?.length > 0 && (
                          <Box sx={{ mt: 0.3 }}>
                            <Chip
                              label={info.festivals[0]}
                              size="small"
                              sx={{ fontSize: '0.55rem', height: 14, px: 0.5 }}
                              color="secondary"
                            />
                          </Box>
                        )}
                        {info.is_ekadashi && (
                          <Chip label="Ekadashi" size="small"
                            sx={{ fontSize: '0.55rem', height: 14, mt: 0.3 }} color="info" />
                        )}
                        {info.is_full_moon && (
                          <Typography sx={{ fontSize: '0.7rem' }}>🌕</Typography>
                        )}
                        {info.is_new_moon && (
                          <Typography sx={{ fontSize: '0.7rem' }}>🌑</Typography>
                        )}
                      </>
                    )}
                  </Box>
                </Tooltip>
              </Grid>
            )
          })}
        </Grid>
        );
      })()} {/* end calendar body IIFE */}

      {/* Legend */}
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label="Festival" sx={{ bgcolor: QUALITY_COLOR.excellent + '33', fontSize: '0.7rem' }} />
        <Chip size="small" label="Full moon / Ekadashi" sx={{ bgcolor: QUALITY_COLOR.auspicious + '33', fontSize: '0.7rem' }} />
        <Chip size="small" label="Today" variant="outlined" color="primary" sx={{ fontSize: '0.7rem' }} />
      </Box>
    </Paper>
  )
}

PanchangaCalendar.propTypes = {
  onDateSelect:  PropTypes.func,
  latitude:      PropTypes.number,
  longitude:     PropTypes.number,
  panchangaType: PropTypes.string,
  selectedDate:  PropTypes.string,
}
