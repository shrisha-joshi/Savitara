// Application constants

export const USER_ROLES = {
  GRIHASTA: 'grihasta',
  ACHARYA: 'acharya',
  ADMIN: 'admin',
}

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
}

export const ATTENDANCE_STATUS = {
  PENDING: 'pending',
  CONFIRMED_BY_ACHARYA: 'confirmed_by_acharya',
  CONFIRMED_BY_GRIHASTA: 'confirmed_by_grihasta',
  BOTH_CONFIRMED: 'both_confirmed',
  DISPUTED: 'disputed',
}

export const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const SPECIALIZATIONS = [
  'Vedic Rituals',
  'Vivaha (Marriage)',
  'Namkaran (Naming Ceremony)',
  'Grihapravesh (Housewarming)',
  'Upanayanam (Sacred Thread)',
  'Shraddha (Memorial)',
  'Puja',
  'Havan',
  'Astrology',
  'Vastu Consultation',
  'Other',
]

export const LANGUAGES = [
  'Hindi',
  'English',
  'Sanskrit',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Other',
]

export const STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
]

export const PRICE_RANGES = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
  { label: '₹2000 - ₹5000', min: 2000, max: 5000 },
  { label: 'Above ₹5000', min: 5000, max: 999999 },
]

export const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

export const DATE_FORMAT = 'dd MMM yyyy'
export const TIME_FORMAT = 'hh:mm a'
export const DATETIME_FORMAT = 'dd MMM yyyy, hh:mm a'
