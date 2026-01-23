import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Typography, TextField, Button, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Paper, Chip, IconButton, CircularProgress } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { toast } from 'react-toastify'

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState(user?.role || 'grihasta')
  
  // Common fields
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    city: '',
    state: '',
    country: 'India',
    parampara: '',
    // Grihasta specific
    preferences: {},
    referral_code: '',
    // Acharya specific
    gotra: '',
    experience_years: '',
    study_place: '',
    bio: '',
  })

  // For array fields (Acharya)
  const [specializations, setSpecializations] = useState([])
  const [languages, setLanguages] = useState([])
  const [newSpec, setNewSpec] = useState('')
  const [newLang, setNewLang] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const addSpecialization = () => {
    if (newSpec.trim() && !specializations.includes(newSpec.trim())) {
      setSpecializations([...specializations, newSpec.trim()])
      setNewSpec('')
    }
  }

  const addLanguage = () => {
    if (newLang.trim() && !languages.includes(newLang.trim())) {
      setLanguages([...languages, newLang.trim()])
      setNewLang('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Determine endpoint based on role
      const endpoint = role === 'grihasta' 
        ? '/users/grihasta/onboarding' 
        : '/users/acharya/onboarding'
      
      // Build request body based on role
      let requestBody
      
      if (role === 'grihasta') {
        requestBody = {
          name: formData.name,
          phone: formData.phone || null,
          location: {
            city: formData.city,
            state: formData.state,
            country: formData.country || 'India'
          },
          parampara: formData.parampara,
          preferences: formData.preferences || {},
          referral_code: formData.referral_code || null
        }
      } else {
        // Acharya
        requestBody = {
          name: formData.name,
          phone: formData.phone || null,
          parampara: formData.parampara,
          gotra: formData.gotra,
          experience_years: parseInt(formData.experience_years) || 0,
          study_place: formData.study_place,
          specializations: specializations.length > 0 ? specializations : ['General'],
          languages: languages.length > 0 ? languages : ['Hindi'],
          location: {
            city: formData.city,
            state: formData.state,
            country: formData.country || 'India'
          },
          bio: formData.bio || null,
          referral_code: formData.referral_code || null
        }
      }
      
      const response = await api.post(endpoint, requestBody)
      const responseData = response.data.data || response.data
      const userData = responseData.user || responseData
      
      if (updateUser && userData) {
        updateUser(userData)
      }
      
      toast.success('Profile completed successfully!')
      navigate('/dashboard')
    } catch (error) {
      console.error('Onboarding error:', error.response?.data || error)
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Failed to complete onboarding')
    } finally {
      setLoading(false)
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
            <RadioGroup row name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <FormControlLabel value="grihasta" control={<Radio />} label="Grihasta (Service Seeker)" />
              <FormControlLabel value="acharya" control={<Radio />} label="Acharya (Service Provider)" />
            </RadioGroup>
          </FormControl>

          <TextField
            fullWidth
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            autoComplete="name"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+919876543210"
            autoComplete="tel"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Parampara (Spiritual Tradition)"
            name="parampara"
            value={formData.parampara}
            onChange={handleChange}
            placeholder="e.g., Shaiva, Vaishnava, Shakta, Smarta"
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
              autoComplete="address-level2"
            />
            <TextField
              fullWidth
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              autoComplete="address-level1"
            />
          </Box>

          <TextField
            fullWidth
            label="Referral Code (Optional)"
            name="referral_code"
            value={formData.referral_code}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          {role === 'acharya' && (
            <>
              <TextField
                fullWidth
                label="Gotra"
                name="gotra"
                value={formData.gotra}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Years of Experience"
                name="experience_years"
                type="number"
                value={formData.experience_years}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Place of Study"
                name="study_place"
                value={formData.study_place}
                onChange={handleChange}
                placeholder="e.g., Varanasi Sanskrit University"
                required
                sx={{ mb: 2 }}
              />

              {/* Specializations */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Specializations *</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add specialization"
                    value={newSpec}
                    onChange={(e) => setNewSpec(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                  />
                  <IconButton onClick={addSpecialization} color="primary"><AddIcon /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {specializations.map((s, i) => (
                    <Chip key={i} label={s} onDelete={() => setSpecializations(specializations.filter((_, idx) => idx !== i))} />
                  ))}
                </Box>
              </Box>

              {/* Languages */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Languages Known *</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add language"
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                  />
                  <IconButton onClick={addLanguage} color="primary"><AddIcon /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {languages.map((l, i) => (
                    <Chip key={i} label={l} onDelete={() => setLanguages(languages.filter((_, idx) => idx !== i))} />
                  ))}
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Bio (Optional)"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                multiline
                rows={3}
                placeholder="Tell seekers about your background and experience"
                sx={{ mb: 2 }}
              />
            </>
          )}

          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            size="large" 
            fullWidth
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Completing...' : 'Complete Profile'}
          </Button>
        </form>
      </Paper>
    </Container>
  )
}
