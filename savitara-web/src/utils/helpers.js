import { format, formatDistance, formatRelative } from 'date-fns'

// Format date
export const formatDate = (date, formatStr = 'dd MMM yyyy') => {
  if (!date) return ''
  try {
    return format(new Date(date), formatStr)
  } catch (error) {
    console.error('Date formatting error:', error)
    return ''
  }
}

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (date) => {
  if (!date) return ''
  try {
    return formatDistance(new Date(date), new Date(), { addSuffix: true })
  } catch (error) {
    console.error('Relative time formatting error:', error)
    return ''
  }
}

// Format currency
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0'
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

// Format phone number
export const formatPhone = (phone) => {
  if (!phone) return ''
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  // Format as +91 XXXXX XXXXX
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  return phone
}

// Truncate text
export const truncateText = (text, maxLength = 100) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

// Generate initials from name
export const getInitials = (name) => {
  if (!name) return ''
  const parts = name.trim().split(' ')
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

// Validate email
export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

// Validate phone number (Indian format)
export const isValidPhone = (phone) => {
  const re = /^[+]?[0-9]{10,15}$/
  return re.test(phone.replace(/\s/g, ''))
}

// Calculate average rating
export const calculateAverageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
  return (sum / reviews.length).toFixed(1)
}

// Get rating color
export const getRatingColor = (rating) => {
  if (rating >= 4.5) return '#4CAF50' // Green
  if (rating >= 3.5) return '#8BC34A' // Light green
  if (rating >= 2.5) return '#FFC107' // Yellow
  if (rating >= 1.5) return '#FF9800' // Orange
  return '#F44336' // Red
}

// Get status color
export const getStatusColor = (status) => {
  const colors = {
    pending: '#FF9800',
    confirmed: '#2196F3',
    started: '#9C27B0',
    completed: '#4CAF50',
    cancelled: '#F44336',
    approved: '#4CAF50',
    rejected: '#F44336',
  }
  return colors[status] || '#757575'
}

// Debounce function
export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Generate random color for avatar
export const generateAvatarColor = (str) => {
  if (!str) return '#757575'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFC107', '#FF9800', '#FF5722', '#795548',
  ]
  return colors[Math.abs(hash) % colors.length]
}

// Parse error message from API response
export const parseErrorMessage = (error) => {
  if (error.response?.data?.detail) {
    if (typeof error.response.data.detail === 'string') {
      return error.response.data.detail
    }
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail[0]?.msg || 'An error occurred'
    }
  }
  return error.message || 'An unexpected error occurred'
}

// Check if date is in the past
export const isPastDate = (date) => {
  return new Date(date) < new Date()
}

// Check if time slot is available
export const isTimeSlotAvailable = (startTime, endTime, bookedSlots) => {
  const start = new Date(startTime)
  const end = new Date(endTime)
  
  for (const slot of bookedSlots) {
    const slotStart = new Date(slot.start_time)
    const slotEnd = new Date(slot.end_time)
    
    // Check for overlap
    if (
      (start >= slotStart && start < slotEnd) ||
      (end > slotStart && end <= slotEnd) ||
      (start <= slotStart && end >= slotEnd)
    ) {
      return false
    }
  }
  
  return true
}
