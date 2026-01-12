import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Typography, TextField, Button, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Paper } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { toast } from 'react-toastify'

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, updateUserProfile } = useAuth()
  const [formData, setFormData] = useState({
    role: 'grihasta',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Acharya specific
    specializations: '',
    experience: '',
    languagesKnown: '',
    serviceRadius: '',
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await api.post('/users/onboarding', formData)
      updateUserProfile(response.data)
      toast.success('Profile completed successfully!')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to complete onboarding')
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Complete Your Profile
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Tell us a bit more about yourself
        </Typography>

        <form onSubmit={handleSubmit}>
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend">I am a</FormLabel>
            <RadioGroup row name="role" value={formData.role} onChange={handleChange}>
              <FormControlLabel value="grihasta" control={<Radio />} label="Grihasta (Service Seeker)" />
              <FormControlLabel value="acharya" control={<Radio />} label="Acharya (Service Provider)" />
            </RadioGroup>
          </FormControl>

          <TextField
            fullWidth
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            multiline
            rows={2}
            required
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
            />
            <TextField
              label="Pincode"
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
              required
            />
          </Box>

          {formData.role === 'acharya' && (
            <>
              <TextField
                fullWidth
                label="Specializations (comma separated)"
                name="specializations"
                value={formData.specializations}
                onChange={handleChange}
                placeholder="Puja, Vivah Sanskar, Griha Pravesh"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Years of Experience"
                name="experience"
                type="number"
                value={formData.experience}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Languages Known (comma separated)"
                name="languagesKnown"
                value={formData.languagesKnown}
                onChange={handleChange}
                placeholder="Hindi, Sanskrit, English"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Service Radius (km)"
                name="serviceRadius"
                type="number"
                value={formData.serviceRadius}
                onChange={handleChange}
                sx={{ mb: 2 }}
              />
            </>
          )}

          <Button type="submit" variant="contained" color="primary" size="large" fullWidth>
            Complete Profile
          </Button>
        </form>
      </Paper>
    </Container>
  )
}
