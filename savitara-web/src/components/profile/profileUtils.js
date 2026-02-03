import api from '../../services/api'
import { toast } from 'react-toastify'

/**
 * Fetch user profile data
 */
export async function fetchProfileData() {
  const response = await api.get('/users/profile')
  const userData = response.data?.data || response.data || {}
  const profile = userData.profile || {}
  
  // Merge base user data with profile data
  return {
    ...userData,
    ...profile,
    role: userData.role,
    email: userData.email,
    created_at: userData.created_at
  }
}

/**
 * Fetch booking statistics
 */
export async function fetchBookingStats() {
  const response = await api.get('/bookings/my-bookings')
  const bookings = response.data?.data || response.data || []
  const now = new Date()
  
  return {
    totalBookings: bookings.length,
    completedBookings: bookings.filter(b => b.status === 'completed').length,
    upcomingBookings: bookings.filter(b => 
      b.status === 'confirmed' && new Date(b.booking_date) > now
    ).length,
    loading: false
  }
}

/**
 * Update user profile
 */
export async function updateProfile(userRole, profileRole, editedData) {
  const isAcharya = userRole === 'acharya' || profileRole === 'acharya'
  const endpoint = isAcharya ? '/users/acharya/profile' : '/users/grihasta/profile'
  await api.put(endpoint, editedData)
  return fetchProfileData()
}

/**
 * Delete user account
 */
export async function deleteAccount() {
  await api.delete('/users/me')
}

/**
 * Prepare edit data from profile
 */
export function prepareEditData(profileData, userRole) {
  const profile = profileData || {}
  const baseData = {
    name: profile.name || '',
    phone: profile.phone || '',
    city: profile.location?.city || '',
    state: profile.location?.state || '',
    country: profile.location?.country || '',
    parampara: profile.parampara || ''
  }
  
  // Add role-specific fields for Acharya
  if (profile.role === 'acharya' || userRole === 'acharya') {
    return {
      ...baseData,
      gotra: profile.gotra || '',
      experience_years: profile.experience_years || 0,
      study_place: profile.study_place || '',
      specializations: profile.specializations || [],
      languages: profile.languages || [],
      bio: profile.bio || ''
    }
  }
  
  return baseData
}

/**
 * Get location from browser geolocation
 */
export async function getLocationFromBrowser() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          )
          const data = await response.json()
          
          resolve({
            city: data.address?.city || data.address?.town || data.address?.village || '',
            state: data.address?.state || '',
            country: data.address?.country || '',
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          })
        } catch (error) {
          reject(new Error('Failed to fetch location details'))
        }
      },
      () => {
        reject(new Error('Failed to get location. Please enable location access.'))
      }
    )
  })
}
