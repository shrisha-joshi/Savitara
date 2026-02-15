import { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Box,
  Divider,
  Grid,
  Typography,
  CircularProgress
} from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../services/api'
import { toast } from 'react-toastify'
import GamificationDashboard from '../components/GamificationDashboard'
import {
  ProfileHeader,
  ProfileStats,
  LogoutDialog,
  DeleteAccountDialog1,
  DeleteAccountDialog2
} from '../components/profile'
import { CommonProfileFields, AcharyaProfileFields } from '../components/profile/ProfileFields'
import { QuickLinks, AccountActions } from '../components/profile/AccountActions'

export default function Profile() {
  const { user, logout } = useAuth()
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
        const response = await api.get('/bookings')
        const rawBookings = response.data?.data || response.data || []
        const bookings = Array.isArray(rawBookings) ? rawBookings : []
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

  const isAcharya = profileData?.role === 'acharya' || user?.role === 'acharya'

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {profileLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Paper
              elevation={4}
              sx={{
                p: 4,
                borderRadius: 4,
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8F0 100%)'
              }}
            >
              <ProfileHeader
                profileData={profileData}
                user={user}
                isEditing={isEditing}
                saving={saving}
                onStartEdit={handleStartEdit}
                onSave={handleSaveProfile}
                onCancel={handleCancelEdit}
              />

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={3}>
                <CommonProfileFields
                  profileData={profileData}
                  editedData={editedData}
                  isEditing={isEditing}
                  setEditedData={setEditedData}
                  onGetLocation={handleGetLocation}
                  saving={saving}
                />
                {isAcharya && (
                  <AcharyaProfileFields
                    profileData={profileData}
                    editedData={editedData}
                    isEditing={isEditing}
                    setEditedData={setEditedData}
                  />
                )}
              </Grid>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" gutterBottom fontWeight={600}>
                My Activity
              </Typography>
              <ProfileStats stats={stats} />

              <Box sx={{ mt: 3 }} />
              <QuickLinks navigate={navigate} />
              <AccountActions
                onLogoutClick={handleLogoutClick}
                onDeleteClick={handleDeleteClick}
              />
            </Paper>

            <LogoutDialog
              open={logoutDialogOpen}
              onClose={() => setLogoutDialogOpen(false)}
              onConfirm={handleLogoutConfirm}
            />
            <DeleteAccountDialog1
              open={deleteDialog1Open}
              onClose={() => setDeleteDialog1Open(false)}
              onConfirm={handleDeleteFirst}
            />
            <DeleteAccountDialog2
              open={deleteDialog2Open}
              onClose={() => setDeleteDialog2Open(false)}
              confirmText={deleteConfirmText}
              onConfirmTextChange={setDeleteConfirmText}
              onDelete={handleDeleteFinal}
              deleting={deleting}
            />
          </>
        )}

        {user && (
          <Box sx={{ mt: 4 }}>
            <GamificationDashboard />
          </Box>
        )}
      </Container>
    </Layout>
  )
}
