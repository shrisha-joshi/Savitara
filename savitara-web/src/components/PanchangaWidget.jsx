import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  Star as StarIcon,
  Brightness5 as SunIcon,
} from '@mui/icons-material';
import api from '../services/api';

export default function PanchangaWidget() {
  const [panchanga, setPanchanga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPanchanga();
  }, []);

  const loadPanchanga = async () => {
    try {
      setLoading(true);
      const response = await api.get('/panchanga/today');
      const data = response.data?.data || response.data;
      setPanchanga(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load Panchanga:', err);
      setError('Unable to load Panchanga');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={32} />
        </CardContent>
      </Card>
    );
  }

  if (error || !panchanga) {
    return null; // Silently fail if panchanga unavailable
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card 
      sx={{ 
        mb: 2,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <CalendarIcon />
            <Typography variant="h6" fontWeight="bold">
              Panchanga
            </Typography>
          </Box>
          <IconButton
            onClick={() => setExpanded(!expanded)}
            sx={{ 
              color: 'white',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s',
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
          {today}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Chip
            label={`Tithi: ${panchanga.tithi?.name || 'N/A'}`}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
            size="small"
          />
          <Chip
            label={`Nakshatra: ${panchanga.nakshatra?.name || 'N/A'}`}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
            size="small"
          />
        </Stack>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
          
          <Stack spacing={2}>
            {panchanga.yoga && (
              <Box>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Yoga
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {panchanga.yoga.name}
                </Typography>
              </Box>
            )}

            {panchanga.karana && (
              <Box>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Karana
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {panchanga.karana.name}
                </Typography>
              </Box>
            )}

            {panchanga.paksha && (
              <Box>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Paksha
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {panchanga.paksha}
                </Typography>
              </Box>
            )}

            {panchanga.sunrise && (
              <Box>
                <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <SunIcon fontSize="small" />
                  Sunrise & Sunset
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Sunrise: {panchanga.sunrise} | Sunset: {panchanga.sunset}
                </Typography>
              </Box>
            )}

            {panchanga.festivals && panchanga.festivals.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarIcon fontSize="small" />
                  Festivals
                </Typography>
                <Stack spacing={0.5}>
                  {panchanga.festivals.map((festival, idx) => (
                    <Chip
                      key={idx}
                      label={festival}
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.3)', 
                        color: 'white',
                        alignSelf: 'flex-start',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}
