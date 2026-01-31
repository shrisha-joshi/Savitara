import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Paper,
  Box,
  Avatar,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  Grid,
  IconButton,
  Chip,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material'
import {
  Edit,
  Logout,
  DeleteForever,
  Save,
  Cancel,
  Email,
  Phone,
  LocationOn,
  Person,
  CalendarMonth,
  CheckCircle,
  Schedule,
  Favorite,
  Warning
} from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../services/api'
import { toast } from 'react-toastify'

export default function Profile() {
  const { user, logout, refreshUserData } = useAuth()
  const navigate = useNavigate()
  
  // Profile data state
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedBookings: 0,
    upcomingBookings: 0,
    loading: true
  })
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState({})
  const [saving, setSaving] = useState(false)
  
  // Logout confirmation dialog
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  
  // Delete account dialogs (double confirmation)
  const [deleteDialog1Open, setDeleteDialog1Open] = useState(false)
  const [deleteDialog2Open, setDeleteDialog2Open] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true)
        const response = await api.get('/users/profile')
        const userData = response.data?.data || response.data || {}
        const profile = userData.profile || {}
        
        // Merge base user data with profile data
        const mergedProfile = {
          ...userData,
          ...profile,
          role: userData.role,
          email: userData.email,
          created_at: userData.created_at
        }
        
        setProfileData(mergedProfile)
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        toast.error('Failed to load profile data')
      } finally {
        setProfileLoading(false)
      }
    }
    
    if (user) {
      fetchProfile()
    }
  }, [user])

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/bookings/my-bookings')
        const bookings = response.data?.data || response.data || []
        const now = new Date()
        
        setStats({
          totalBookings: bookings.length,
          completedBookings: bookings.filter(b => b.status === 'completed').length,
          upcomingBookings: bookings.filter(b => 
            b.status === 'confirmed' && new Date(b.booking_date) > now
          ).length,
          loading: false
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        setStats(prev => ({ ...prev, loading: false }))
      }
    }
    
    if (user) {
      fetchStats()
    }
  }, [user])

  // Handle edit mode toggle
  const handleStartEdit = () => {
    const profile = profileData || {}
    const baseData = {
      name: profile.name || '',
      phone: profile.phone || '',
      city: profile.location?.city || '',
      state: profile.location?.state || '',
      country: profile.location?.country || '',
      parampara: profile.parampara || ''
    }
    
    // Add role-specific fields
    if (profile.role === 'acharya' || user?.role === 'acharya') {
      setEditedData({
        ...baseData,
        gotra: profile.gotra || '',
        experience_years: profile.experience_years || 0,
        study_place: profile.study_place || '',
        specializations: profile.specializations || [],
        languages: profile.languages || [],
        bio: profile.bio || ''
      })
    } else {
      setEditedData(baseData)
    }
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedData({})
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      // Use role-specific endpoints
      if (user?.role === 'acharya' || profileData?.role === 'acharya') {
        await api.put('/users/acharya/profile', editedData)
      } else {
        await api.put('/users/grihasta/profile', editedData)
      }
      
      // Reload profile data
      const response = await api.get('/users/profile')
      const userData = response.data?.data || response.data || {}
      const profile = userData.profile || {}
      const mergedProfile = {
        ...userData,
        ...profile,
        role: userData.role,
        email: userData.email,
        created_at: userData.created_at
      }
      setProfileData(mergedProfile)
      
      setIsEditing(false)
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error(error.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // Handle location from browser geolocation
  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      setSaving(true)
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Use reverse geocoding API (you can use any geocoding service)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
            )
            const data = await response.json()
            
            setEditedData({
              ...editedData,
              city: data.address?.city || data.address?.town || data.address?.village || '',
              state: data.address?.state || '',
              country: data.address?.country || '',
              coordinates: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              }
            })
            toast.success('Location fetched successfully!')
          } catch (error) {
            console.error('Failed to fetch location details:', error)
            toast.error('Failed to fetch location details')
          } finally {
            setSaving(false)
          }
        },
        (error) => {
          console.error('Geolocation error:', error)
          toast.error('Failed to get location. Please enable location access.')
          setSaving(false)
        }
      )
    } else {
      toast.error('Geolocation is not supported by your browser')
    }
  }

  // Handle logout
  const handleLogoutClick = () => {
    setLogoutDialogOpen(true)
  }

  const handleLogoutConfirm = async () => {
    setLogoutDialogOpen(false)
    await logout()
  }

  // Handle delete account (double confirmation)
  const handleDeleteClick = () => {
    setDeleteDialog1Open(true)
  }

  const handleDeleteFirst = () => {
    setDeleteDialog1Open(false)
    setDeleteDialog2Open(true)
    setDeleteConfirmText('')
  }

  const handleDeleteFinal = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm')
      return
    }
    
    setDeleting(true)
    try {
      await api.delete('/users/me')
      setDeleteDialog2Open(false)
      toast.success('Account deleted successfully. We\'re sad to see you go!')
      await logout()
    } catch (error) {
      console.error('Failed to delete account:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Loading State */}
        {profileLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
        {/* Profile Card */}
        <Paper
          elevation={4}
          sx={{
            p: 4,
            borderRadius: 4,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8F0 100%)'
          }}
        >
          {/* Header Section */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 4 }}>
            <Avatar
              src={profileData?.profile_picture || user?.photo}
              sx={{
                width: 100,
                height: 100,
                mr: 3,
                border: '4px solid',
                borderColor: 'primary.main'
              }}
            >
              {profileData?.name?.charAt(0) || 'U'}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {profileData?.name || 'User'}
              </Typography>
              <Chip
                label={profileData?.role === 'acharya' || user?.role === 'acharya' ? 'Acharya' : 'Grihasta'}
                color="primary"
                size="small"
                sx={{ mt: 1 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Member since {new Date(profileData?.created_at || user?.created_at || Date.now()).toLocaleDateString()}
              </Typography>
            </Box>
            {!isEditing ? (
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={handleStartEdit}
                sx={{ borderRadius: 3 }}
              >
                Edit Profile
              </Button>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveProfile}
                  disabled={saving}
                  sx={{ borderRadius: 3 }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={handleCancelEdit}
                  sx={{ borderRadius: 3 }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Profile Details */}
          <Grid container spacing={3}>
            {/* Name */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">Full Name</Typography>
              </Box>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editedData.name}
                  onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                  size="small"
                />
              ) : (
                <Typography variant="body1">{profileData?.name || 'Not provided'}</Typography>
              )}
            </Grid>

            {/* Email (read-only) */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">Email</Typography>
              </Box>
              <Typography variant="body1">{profileData?.email || 'Not provided'}</Typography>
            </Grid>

            {/* Phone */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
              </Box>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editedData.phone}
                  onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                  size="small"
                  placeholder="+91 XXXXXXXXXX"
                />
              ) : (
                <Typography variant="body1">{profileData?.phone || 'Not provided'}</Typography>
              )}
            </Grid>

            {/* Location */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">Location</Typography>
              </Box>
              {isEditing ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField
                    fullWidth
                    value={editedData.city}
                    onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
                    size="small"
                    placeholder="City"
                  />
                  <TextField
                    fullWidth
                    value={editedData.state}
                    onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
                    size="small"
                    placeholder="State"
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleGetLocation}
                    startIcon={<LocationOn />}
                    disabled={saving}
                  >
                    {saving ? 'Fetching...' : 'Use Current Location'}
                  </Button>
                </Box>
              ) : (
                <Typography variant="body1">
                  {[profileData?.location?.city, profileData?.location?.state, profileData?.location?.country].filter(Boolean).join(', ') || 'Not provided'}
                </Typography>
              )}
            </Grid>

            {/* Parampara */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">Parampara</Typography>
              </Box>
              {isEditing ? (
                <TextField
                  fullWidth
                  value={editedData.parampara}
                  onChange={(e) => setEditedData({ ...editedData, parampara: e.target.value })}
                  size="small"
                  placeholder="Your spiritual tradition"
                />
              ) : (
                <Typography variant="body1">{profileData?.parampara || 'Not provided'}</Typography>
              )}
            </Grid>

            {/* Acharya-specific fields */}
            {(profileData?.role === 'acharya' || user?.role === 'acharya') && (
              <>
                {/* Gotra */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Gotra</Typography>
                  </Box>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={editedData.gotra}
                      onChange={(e) => setEditedData({ ...editedData, gotra: e.target.value })}
                      size="small"
                      placeholder="Your gotra"
                    />
                  ) : (
                    <Typography variant="body1">{profileData?.gotra || 'Not provided'}</Typography>
                  )}
                </Grid>

                {/* Experience Years */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Experience (Years)</Typography>
                  </Box>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      type="number"
                      value={editedData.experience_years}
                      onChange={(e) => setEditedData({ ...editedData, experience_years: parseInt(e.target.value) || 0 })}
                      size="small"
                      placeholder="Years of experience"
                    />
                  ) : (
                    <Typography variant="body1">{profileData?.experience_years || 'Not provided'} years</Typography>
                  )}
                </Grid>

                {/* Study Place */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Place of Study</Typography>
                  </Box>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={editedData.study_place}
                      onChange={(e) => setEditedData({ ...editedData, study_place: e.target.value })}
                      size="small"
                      placeholder="Where you studied"
                    />
                  ) : (
                    <Typography variant="body1">{profileData?.study_place || 'Not provided'}</Typography>
                  )}
                </Grid>

                {/* Languages */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Languages</Typography>
                  </Box>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={Array.isArray(editedData.languages) ? editedData.languages.join(', ') : ''}
                      onChange={(e) => setEditedData({ 
                        ...editedData, 
                        languages: e.target.value.split(',').map(l => l.trim()).filter(Boolean) 
                      })}
                      size="small"
                      placeholder="Languages (comma-separated)"
                      helperText="Enter languages separated by commas"
                    />
                  ) : (
                    <Typography variant="body1">
                      {Array.isArray(profileData?.languages) && profileData?.languages.length > 0 
                        ? profileData.languages.join(', ') 
                        : 'Not provided'}
                    </Typography>
                  )}
                </Grid>

                {/* Specializations */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Specializations</Typography>
                  </Box>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={Array.isArray(editedData.specializations) ? editedData.specializations.join(', ') : ''}
                      onChange={(e) => setEditedData({ 
                        ...editedData, 
                        specializations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                      })}
                      size="small"
                      placeholder="Specializations (comma-separated)"
                      helperText="Enter specializations separated by commas"
                      multiline
                      rows={2}
                    />
                  ) : (
                    <Typography variant="body1">
                      {Array.isArray(profileData?.specializations) && profileData?.specializations.length > 0 
                        ? profileData.specializations.join(', ') 
                        : 'Not provided'}
                    </Typography>
                  )}
                </Grid>

                {/* Bio */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle2" color="text.secondary">Bio</Typography>
                  </Box>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={editedData.bio}
                      onChange={(e) => setEditedData({ ...editedData, bio: e.target.value })}
                      size="small"
                      placeholder="Tell us about yourself"
                      multiline
                      rows={4}
                    />
                  ) : (
                    <Typography variant="body1">{profileData?.bio || 'Not provided'}</Typography>
                  )}
                </Grid>
              </>
            )}
          </Grid>

          <Divider sx={{ my: 4 }} />

          {/* Dashboard Stats Section */}
          <Typography variant="h6" gutterBottom fontWeight={600}>
            My Activity
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: 'linear-gradient(135deg, #E65C00 0%, #FF8533 100%)',
                  color: 'white',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
                }}
                onClick={() => navigate('/bookings')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <CalendarMonth sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h3" fontWeight={700}>
                    {stats.loading ? <CircularProgress size={30} color="inherit" /> : stats.totalBookings}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Bookings</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: 'linear-gradient(135deg, #34C759 0%, #5DD37E 100%)',
                  color: 'white',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
                }}
                onClick={() => navigate('/bookings?status=completed')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <CheckCircle sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h3" fontWeight={700}>
                    {stats.loading ? <CircularProgress size={30} color="inherit" /> : stats.completedBookings}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Completed</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: 'linear-gradient(135deg, #2B3A67 0%, #3D4F8A 100%)',
                  color: 'white',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
                }}
                onClick={() => navigate('/bookings?status=upcoming')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Schedule sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h3" fontWeight={700}>
                    {stats.loading ? <CircularProgress size={30} color="inherit" /> : stats.upcomingBookings}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>Upcoming</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Quick Links */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CalendarMonth />}
                onClick={() => navigate('/bookings')}
                sx={{ py: 1.5, borderRadius: 3 }}
              >
                My Bookings
              </Button>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Favorite />}
                onClick={() => navigate('/favorites')}
                sx={{ py: 1.5, borderRadius: 3 }}
              >
                Favorites
              </Button>
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />

          {/* Account Actions */}
          <Typography variant="h6" gutterBottom fontWeight={600} color="text.secondary">
            Account Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<Logout />}
              onClick={handleLogoutClick}
              sx={{ borderRadius: 3 }}
            >
              Logout
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForever />}
              onClick={handleDeleteClick}
              sx={{ borderRadius: 3 }}
            >
              Delete Account
            </Button>
          </Box>
        </Paper>

        {/* Logout Confirmation Dialog */}
        <Dialog
          open={logoutDialogOpen}
          onClose={() => setLogoutDialogOpen(false)}
          PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Logout color="warning" />
            Confirm Logout
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to logout from your account?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setLogoutDialogOpen(false)} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              onClick={handleLogoutConfirm}
              color="warning"
              variant="contained"
              sx={{ borderRadius: 2 }}
            >
              Yes, Logout
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Account - First Confirmation */}
        <Dialog
          open={deleteDialog1Open}
          onClose={() => setDeleteDialog1Open(false)}
          PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="error" />
            Delete Account
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              <strong>Warning:</strong> This action is permanent and cannot be undone.
              <br /><br />
              Deleting your account will:
              <ul>
                <li>Remove all your personal data</li>
                <li>Cancel all pending bookings</li>
                <li>Delete your reviews and history</li>
              </ul>
              Are you sure you want to proceed?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteDialog1Open(false)} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteFirst}
              color="error"
              variant="contained"
              sx={{ borderRadius: 2 }}
            >
              Yes, I understand
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Account - Final Confirmation */}
        <Dialog
          open={deleteDialog2Open}
          onClose={() => setDeleteDialog2Open(false)}
          PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <DeleteForever color="error" />
            Final Confirmation
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              This is your <strong>final warning</strong>. Your account will be permanently deleted.
              <br /><br />
              To confirm, please type <strong>DELETE</strong> below:
            </DialogContentText>
            <TextField
              fullWidth
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="Type DELETE to confirm"
              error={deleteConfirmText !== '' && deleteConfirmText !== 'DELETE'}
              helperText={deleteConfirmText !== '' && deleteConfirmText !== 'DELETE' ? 'Please type DELETE exactly' : ''}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setDeleteDialog2Open(false)
                setDeleteConfirmText('')
              }}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteFinal}
              color="error"
              variant="contained"
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              sx={{ borderRadius: 2 }}
            >
              {deleting ? 'Deleting...' : 'Delete My Account Forever'}
            </Button>
          </DialogActions>
        </Dialog>
        </>
        )}
      </Container>
    </Layout>
  )
}
