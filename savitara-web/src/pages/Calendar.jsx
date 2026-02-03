import { useState, useEffect } from 'react'
import { Container, Typography, Box, Button, TextField, Card, Grid, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel } from '@mui/material'
import { Add, Delete, Edit, Event, AccessTime, Refresh } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { toast } from 'react-toastify'
import './Calendar.css'

export default function Calendar() {
  const { user } = useAuth()
  const [availability, setAvailability] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  
  const [newSlot, setNewSlot] = useState({
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '17:00',
    is_recurring: true,
    max_bookings: 5
  })

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  }

  useEffect(() => {
    if (user?.role === 'acharya') {
      fetchAvailability()
    }
  }, [user])

  const fetchAvailability = async () => {
    try {
      setLoading(true)
      const response = await api.get('/calendar/availability')
      
      if (response.data.success) {
        setAvailability(response.data.data.availability || [])
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      toast.error('Failed to load availability schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSlot = async () => {
    try {
      const response = await api.post('/calendar/availability', newSlot)
      
      if (response.data.success) {
        toast.success('Availability slot added')
        setShowAddModal(false)
        setNewSlot({
          day_of_week: 'monday',
          start_time: '09:00',
          end_time: '17:00',
          is_recurring: true,
          max_bookings: 5
        })
        fetchAvailability()
      }
    } catch (error) {
      console.error('Error adding slot:', error)
      toast.error('Failed to add availability slot')
    }
  }

  const handleUpdateSlot = async () => {
    try {
      const response = await api.put(`/calendar/availability/${editingSlot._id}`, editingSlot)
      
      if (response.data.success) {
        toast.success('Availability updated')
        setEditingSlot(null)
        fetchAvailability()
      }
    } catch (error) {
      console.error('Error updating slot:', error)
      toast.error('Failed to update availability')
    }
  }

  const handleDeleteSlot = async (slotId) => {
    if (!confirm('Are you sure you want to delete this availability slot?')) {
      return
    }
    
    try {
      await api.delete(`/calendar/availability/${slotId}`)
      toast.success('Availability slot deleted')
      fetchAvailability()
    } catch (error) {
      console.error('Error deleting slot:', error)
      toast.error('Failed to delete availability slot')
    }
  }

  const groupByDay = () => {
    const grouped = {}
    daysOfWeek.forEach(day => {
      grouped[day] = availability.filter(slot => slot.day_of_week === day)
    })
    return grouped
  }

  const groupedAvailability = groupByDay()

  if (user?.role !== 'acharya') {
    return (
      <Container>
        <Typography variant="h5" sx={{ mt: 4 }}>
          This feature is only available for Acharyas
        </Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            📅 My Availability
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your weekly schedule for consultations
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchAvailability}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowAddModal(true)}
          >
            Add Slot
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <Typography>Loading availability...</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {daysOfWeek.map(day => (
            <Grid item xs={12} md={6} key={day}>
              <Card className="day-card">
                <Box className="day-header">
                  <Typography variant="h6">
                    {dayLabels[day]}
                  </Typography>
                  <Chip 
                    label={`${groupedAvailability[day].length} slot(s)`}
                    size="small"
                    color={groupedAvailability[day].length > 0 ? 'success' : 'default'}
                  />
                </Box>

                {groupedAvailability[day].length === 0 ? (
                  <Box className="no-slots">
                    <Typography variant="body2" color="text.secondary">
                      No availability set for this day
                    </Typography>
                  </Box>
                ) : (
                  <Box className="slots-list">
                    {groupedAvailability[day].map(slot => (
                      <Box key={slot._id} className="slot-item">
                        <Box className="slot-time">
                          <AccessTime fontSize="small" />
                          <Typography>
                            {slot.start_time} - {slot.end_time}
                          </Typography>
                        </Box>
                        <Box className="slot-details">
                          {slot.is_recurring && (
                            <Chip label="Recurring" size="small" color="primary" variant="outlined" />
                          )}
                          <Typography variant="caption">
                            Max: {slot.max_bookings} bookings
                          </Typography>
                        </Box>
                        <Box className="slot-actions">
                          <IconButton 
                            size="small" 
                            onClick={() => setEditingSlot(slot)}
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteSlot(slot._id)}
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Slot Modal */}
      <Dialog open={showAddModal} onClose={() => setShowAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Availability Slot</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Day of Week</InputLabel>
              <Select
                value={newSlot.day_of_week}
                onChange={(e) => setNewSlot({ ...newSlot, day_of_week: e.target.value })}
                label="Day of Week"
              >
                {daysOfWeek.map(day => (
                  <MenuItem key={day} value={day}>{dayLabels[day]}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Start Time"
              type="time"
              value={newSlot.start_time}
              onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="End Time"
              type="time"
              value={newSlot.end_time}
              onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Maximum Bookings"
              type="number"
              value={newSlot.max_bookings}
              onChange={(e) => setNewSlot({ ...newSlot, max_bookings: parseInt(e.target.value) })}
              fullWidth
              inputProps={{ min: 1, max: 20 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={newSlot.is_recurring}
                  onChange={(e) => setNewSlot({ ...newSlot, is_recurring: e.target.checked })}
                />
              }
              label="Recurring (every week)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSlot}>Add Slot</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Slot Modal */}
      <Dialog open={!!editingSlot} onClose={() => setEditingSlot(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Availability Slot</DialogTitle>
        <DialogContent>
          {editingSlot && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Day of Week</InputLabel>
                <Select
                  value={editingSlot.day_of_week}
                  onChange={(e) => setEditingSlot({ ...editingSlot, day_of_week: e.target.value })}
                  label="Day of Week"
                >
                  {daysOfWeek.map(day => (
                    <MenuItem key={day} value={day}>{dayLabels[day]}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Start Time"
                type="time"
                value={editingSlot.start_time}
                onChange={(e) => setEditingSlot({ ...editingSlot, start_time: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <TextField
                label="End Time"
                type="time"
                value={editingSlot.end_time}
                onChange={(e) => setEditingSlot({ ...editingSlot, end_time: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <TextField
                label="Maximum Bookings"
                type="number"
                value={editingSlot.max_bookings}
                onChange={(e) => setEditingSlot({ ...editingSlot, max_bookings: parseInt(e.target.value) })}
                fullWidth
                inputProps={{ min: 1, max: 20 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={editingSlot.is_recurring}
                    onChange={(e) => setEditingSlot({ ...editingSlot, is_recurring: e.target.checked })}
                  />
                }
                label="Recurring (every week)"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingSlot(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateSlot}>Update</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
