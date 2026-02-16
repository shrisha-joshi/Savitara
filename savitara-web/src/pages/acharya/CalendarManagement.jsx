import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  alpha,
  Switch,
  FormControlLabel,
  List,
  ListItem
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Add,
  Block,
  Delete,
  CheckCircle,
  EventBusy
} from '@mui/icons-material';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function CalendarManagement() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockDatesDialog, setBlockDatesDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [isDayBlocked, setIsDayBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '18:00' });
  const [slots, setSlots] = useState([]);
  const [blockDates, setBlockDates] = useState([]);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    fetchSchedule();
  }, [currentDate]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const response = await api.get(`/calendar/acharya/${user._id}/schedule`, {
        params: { year, month }
      });

      if (response.data.success) {
        setSchedule(response.data.data.schedules || []);
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const getScheduleForDate = (day) => {
    if (!day) return null;
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    return schedule.find(s => s.date?.startsWith(dateStr));
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    if (!day) return;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    
    const existingSchedule = getScheduleForDate(day);
    if (existingSchedule) {
      setIsDayBlocked(existingSchedule.is_day_blocked || false);
      setBlockedReason(existingSchedule.blocked_reason || '');
      setWorkingHours(existingSchedule.working_hours || { start: '09:00', end: '18:00' });
      setSlots(existingSchedule.slots || []);
    } else {
      // Reset to defaults
      setIsDayBlocked(false);
      setBlockedReason('');
      setWorkingHours({ start: '09:00', end: '18:00' });
      setSlots([]);
    }
    
    setDialogOpen(true);
  };

  const handleAddSlot = () => {
    const newSlot = {
      start_time: workingHours.start,
      end_time: workingHours.end,
      status: 'available',
      booking_id: null
    };
    setSlots([...slots, newSlot]);
  };

  const handleRemoveSlot = (index) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index, field, value) => {
    const updatedSlots = [...slots];
    updatedSlots[index][field] = value;
    setSlots(updatedSlots);
  };

  const handleSaveSchedule = async () => {
    try {
      setLoading(true);
      setError('');

      const scheduleData = {
        date: selectedDate.toISOString(),
        working_hours: workingHours,
        is_day_blocked: isDayBlocked,
        blocked_reason: blockedReason,
        slots: slots.map(slot => ({
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: slot.status,
          booking_id: slot.booking_id
        }))
      };

      const response = await api.post(
        `/calendar/acharya/${user._id}/schedule`,
        scheduleData
      );

      if (response.data.success) {
        setSuccess('Schedule updated successfully!');
        setDialogOpen(false);
        fetchSchedule();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setError(error.response?.data?.detail || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockMultipleDates = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.post(
        `/calendar/acharya/${user._id}/block-dates`,
        {
          dates: blockDates.map(d => new Date(d).toISOString()),
          reason: blockReason
        }
      );

      if (response.data.success) {
        setSuccess(`Successfully blocked ${blockDates.length} dates!`);
        setBlockDatesDialog(false);
        setBlockDates([]);
        setBlockReason('');
        fetchSchedule();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Failed to block dates:', error);
      setError(error.response?.data?.detail || 'Failed to block dates');
    } finally {
      setLoading(false);
    }
  };

  const getDayColor = (day) => {
    const daySchedule = getScheduleForDate(day);
    if (!daySchedule) return 'transparent';
    if (daySchedule.is_day_blocked) return alpha('#f44336', 0.1); // Red for blocked
    if (daySchedule.slots && daySchedule.slots.length > 0) {
      const availableSlots = daySchedule.slots.filter(s => s.status === 'available');
      if (availableSlots.length > 0) return alpha('#4caf50', 0.1); // Green for available
      return alpha('#ff9800', 0.1); // Orange for all booked
    }
    return 'transparent';
  };

  const getDayIcon = (day) => {
    const daySchedule = getScheduleForDate(day);
    if (!daySchedule) return null;
    if (daySchedule.is_day_blocked) return <EventBusy fontSize="small" color="error" />;
    if (daySchedule.slots && daySchedule.slots.length > 0) {
      const availableSlots = daySchedule.slots.filter(s => s.status === 'available');
      if (availableSlots.length > 0) return <CheckCircle fontSize="small" color="success" />;
      return <Block fontSize="small" color="warning" />;
    }
    return null;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Calendar Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your availability and schedule bookings
          </Typography>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Action Buttons */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<EventBusy />}
            onClick={() => setBlockDatesDialog(true)}
          >
            Block Multiple Dates
          </Button>
        </Box>

        {/* Calendar */}
        <Paper sx={{ p: 3 }}>
          {/* Month Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={handlePreviousMonth}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="h5" fontWeight={600}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Typography>
            <IconButton onClick={handleNextMonth}>
              <ChevronRight />
            </IconButton>
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle fontSize="small" color="success" />
              <Typography variant="caption">Available</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Block fontSize="small" color="warning" />
              <Typography variant="caption">Fully Booked</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventBusy fontSize="small" color="error" />
              <Typography variant="caption">Blocked</Typography>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={1}>
              {/* Day headers */}
              {dayNames.map(day => (
                <Grid item xs={12 / 7} key={day}>
                  <Box sx={{ textAlign: 'center', fontWeight: 600, py: 1 }}>
                    {day}
                  </Box>
                </Grid>
              ))}

              {/* Calendar days */}
              {getDaysInMonth().map((day, index) => (
                <Grid item xs={12 / 7} key={day ? `day-${day}` : `empty-${index}`}>
                  <Paper
                    sx={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: day ? 'pointer' : 'default',
                      bgcolor: day ? getDayColor(day) : 'transparent',
                      border: day ? '1px solid' : 'none',
                      borderColor: 'divider',
                      transition: 'all 0.2s',
                      '&:hover': day ? {
                        bgcolor: alpha('#FF6B35', 0.1),
                        transform: 'scale(1.05)',
                        boxShadow: 2
                      } : {}
                    }}
                    onClick={() => handleDateClick(day)}
                  >
                    {day && (
                      <>
                        <Typography variant="body2" fontWeight={600}>
                          {day}
                        </Typography>
                        {getDayIcon(day)}
                      </>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Edit Schedule Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Manage Schedule for {selectedDate?.toLocaleDateString('en-IN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {/* Block Day Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={isDayBlocked}
                    onChange={(e) => setIsDayBlocked(e.target.checked)}
                    color="error"
                  />
                }
                label="Block this day"
              />

              {isDayBlocked && (
                <TextField
                  fullWidth
                  label="Reason for blocking"
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                  multiline
                  rows={2}
                  sx={{ mt: 2, mb: 3 }}
                />
              )}

              {!isDayBlocked && (
                <>
                  {/* Working Hours */}
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 3, mb: 2 }}>
                    Working Hours
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="time"
                        label="Start Time"
                        value={workingHours.start}
                        onChange={(e) => setWorkingHours({ ...workingHours, start: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="time"
                        label="End Time"
                        value={workingHours.end}
                        onChange={(e) => setWorkingHours({ ...workingHours, end: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>

                  {/* Time Slots */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Time Slots
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Add />}
                      onClick={handleAddSlot}
                    >
                      Add Slot
                    </Button>
                  </Box>

                  {slots.length === 0 ? (
                    <Alert severity="info">
                      No slots added. Click "Add Slot" to create availability windows.
                    </Alert>
                  ) : (
                    <List>
                      {slots.map((slot, index) => (
                        <ListItem
                          key={index}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1
                          }}
                        >
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={4}>
                              <TextField
                                fullWidth
                                type="time"
                                size="small"
                                value={slot.start_time}
                                onChange={(e) => handleSlotChange(index, 'start_time', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={4}>
                              <TextField
                                fullWidth
                                type="time"
                                size="small"
                                value={slot.end_time}
                                onChange={(e) => handleSlotChange(index, 'end_time', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={3}>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={slot.status}
                                  onChange={(e) => handleSlotChange(index, 'status', e.target.value)}
                                >
                                  <MenuItem value="available">Available</MenuItem>
                                  <MenuItem value="booked">Booked</MenuItem>
                                  <MenuItem value="blocked">Blocked</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={1}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveSlot(index)}
                              >
                                <Delete />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSaveSchedule}
              disabled={loading}
              startIcon={loading && <CircularProgress size={16} />}
            >
              Save Schedule
            </Button>
          </DialogActions>
        </Dialog>

        {/* Block Multiple Dates Dialog */}
        <Dialog open={blockDatesDialog} onClose={() => setBlockDatesDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Block Multiple Dates</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter dates to block (one per line in YYYY-MM-DD format)
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Dates (e.g., 2026-03-15)"
              placeholder="2026-03-15&#10;2026-03-16&#10;2026-03-17"
              value={blockDates.join('\n')}
              onChange={(e) => setBlockDates(e.target.value.split('\n').filter(d => d.trim()))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Reason for blocking"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              multiline
              rows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBlockDatesDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleBlockMultipleDates}
              disabled={loading || blockDates.length === 0}
              startIcon={loading && <CircularProgress size={16} />}
            >
              Block {blockDates.length} Dates
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
