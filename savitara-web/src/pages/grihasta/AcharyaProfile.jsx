import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container,
  Typography,
  Grid,
  Box,
  Avatar,
  Chip,
  Button,
  Tab,
  Tabs,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Rating
} from '@mui/material'
import { 
  FaStar, 
  FaMapMarkerAlt, 
  FaLanguage, 
  FaGraduationCap, 
  FaUserClock,
  FaCheckCircle 
} from 'react-icons/fa'
import Layout from '../../components/Layout'
import api from '../../services/api'
import ServiceCard from '../../components/cards/ServiceCard'
// We might not have ReviewCard, so we will inline a simple one if needed or create one.

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function AcharyaProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [poojas, setPoojas] = useState([])
  const [reviews, setReviews] = useState([])
  const [tabValue, setTabValue] = useState(0)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await api.get(`/users/acharyas/${id}`)
        if (response.data.success) {
          setProfile(response.data.data.profile)
          setPoojas(response.data.data.poojas || [])
          setReviews(response.data.data.reviews || [])
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
        setError('Failed to load Acharya profile. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchProfile()
    }
  }, [id])

  const handleBookPooja = (poojaId) => {
    navigate(`/booking/create/${id}?poojaId=${poojaId}`)
  }

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error || !profile) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Profile not found'}</Alert>
          <Button sx={{ mt: 2 }} onClick={() => navigate(-1)}>Go Back</Button>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box sx={{ backgroundColor: '#f8f9fa', minHeight: '100vh', pb: 8 }}>
        {/* Header / Hero Section */}
        <Paper 
          elevation={0}
          sx={{ 
            background: 'linear-gradient(135deg, #1A2233 0%, #2C3E50 100%)',
            color: 'white',
            pt: 8,
            pb: 4,
            borderRadius: '0 0 24px 24px',
            mb: 4
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={3} sx={{ textAlign: 'center' }}>
                <Avatar
                  src={profile.profile_picture}
                  alt={profile.name}
                  sx={{ 
                    width: 180, 
                    height: 180, 
                    border: '4px solid white',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    mx: 'auto'
                  }}
                />
              </Grid>
              <Grid item xs={12} md={9}>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <Typography variant="h3" fontWeight="bold">
                    {profile.name}
                  </Typography>
                  {profile.verification_status === 'active' && (
                    <Chip 
                      icon={<FaCheckCircle size={14} />} 
                      label="Verified Acharya" 
                      color="secondary" 
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>
                
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Box display="flex" alignItems="center" color="#FFD700">
                    <FaStar />
                    <Typography fontWeight="bold" ml={0.5}>
                      {profile.rating?.toFixed(1) || 'NEW'}
                    </Typography>
                  </Box>
                  <Typography color="rgba(255,255,255,0.7)">•</Typography>
                  <Typography>{profile.total_bookings} bookings</Typography>
                  <Typography color="rgba(255,255,255,0.7)">•</Typography>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <FaMapMarkerAlt size={14} color="rgba(255,255,255,0.7)" />
                    <Typography>{profile.location?.city || 'India'}, {profile.location?.state}</Typography>
                  </Box>
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap">
                  {profile.specializations?.map((spec, index) => (
                    <Chip 
                      key={index} 
                      label={spec} 
                      sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.1)', 
                        color: 'white',
                        backdropFilter: 'blur(4px)'
                      }} 
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Paper>

        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {/* Left Column: Details */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={(e, val) => setTabValue(val)}
                  textColor="primary"
                  indicatorColor="primary"
                  variant="fullWidth"
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab label="Services (Poojas)" />
                  <Tab label="About Acharya" />
                  <Tab label={`Reviews (${reviews.length})`} />
                </Tabs>

                <Box sx={{ p: 3 }}>
                  {/* Services Tab */}
                  <CustomTabPanel value={tabValue} index={0}>
                    <Typography variant="h6" gutterBottom>Available Poojas</Typography>
                    {poojas.length > 0 ? (
                      <Grid container spacing={3}>
                        {poojas.map((pooja) => (
                          <Grid item xs={12} key={pooja._id || pooja.id}>
                            <ServiceCard 
                              service={pooja} 
                              onBook={() => handleBookPooja(pooja._id || pooja.id)}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Alert severity="info" action={
                        <Button color="inherit" size="small" onClick={() => navigate('/booking/create/' + id)}>
                         Request Custom Booking
                        </Button>
                      }>
                        No specific poojas listed. You can still request a custom booking.
                      </Alert>
                    )}
                  </CustomTabPanel>

                  {/* About Tab */}
                  <CustomTabPanel value={tabValue} index={1}>
                    <Typography variant="h6" gutterBottom>Biography</Typography>
                    <Typography paragraph color="text.secondary">
                      {profile.bio || "No biography provided."}
                    </Typography>
                    
                    <Divider sx={{ my: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Box display="flex" gap={2}>
                          <Avatar sx={{ bgcolor: 'orange' }}><FaGraduationCap /></Avatar>
                          <Box>
                            <Typography variant="subtitle2">Education & Parampara</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {profile.parampara || 'N/A'} • {profile.study_place || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box display="flex" gap={2}>
                          <Avatar sx={{ bgcolor: 'blue' }}><FaLanguage /></Avatar>
                          <Box>
                            <Typography variant="subtitle2">Languages Spoken</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {profile.languages?.join(', ') || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box display="flex" gap={2}>
                          <Avatar sx={{ bgcolor: 'green' }}><FaUserClock /></Avatar>
                          <Box>
                            <Typography variant="subtitle2">Experience</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {profile.experience_years}+ Years
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </CustomTabPanel>

                  {/* Reviews Tab */}
                  <CustomTabPanel value={tabValue} index={2}>
                    <Box display="flex" alignItems="center" mb={4}>
                      <Typography variant="h3" fontWeight="bold" mr={2}>
                        {profile.rating?.toFixed(1)}
                      </Typography>
                      <Box>
                        <Rating value={profile.rating || 0} readOnly precision={0.5} />
                        <Typography variant="body2" color="text.secondary">
                          Based on {reviews.length} reviews
                        </Typography>
                      </Box>
                    </Box>

                    {reviews.map((review) => (
                      <Paper key={review._id} elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2, borderRadius: 2 }}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography fontWeight="bold">{review.user_name || 'Anonymous'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(review.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Rating value={review.rating} readOnly size="small" />
                        <Typography variant="body2" mt={1}>
                          {review.comment}
                        </Typography>
                      </Paper>
                    ))}
                    
                    {reviews.length === 0 && (
                      <Typography color="text.secondary" align="center" py={4}>
                        No reviews yet. Be the first to review!
                      </Typography>
                    )}
                  </CustomTabPanel>
                </Box>
              </Paper>
            </Grid>

            {/* Right Column: Sticky Booking Card */}
            <Grid item xs={12} md={4}>
              <Box sx={{ position: 'sticky', top: 100 }}>
                <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e0e0e0' }}>
                  <Typography variant="h6" gutterBottom>
                    Book Consultation
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Select a pooja from the services list or request a general consultation.
                  </Typography>
                  
                  <Button 
                    variant="contained" 
                    fullWidth 
                    size="large"
                    sx={{ mb: 2, bgcolor: 'var(--saffron-main)' }}
                    onClick={() => navigate(`/booking/create/${id}`)}
                  >
                    Book General Session
                  </Button>
                  
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<FaCheckCircle />}
                  >
                    Check Availability
                  </Button>
                  
                  <Box mt={3} p={2} bgcolor="#e3f2fd" borderRadius={2}>
                    <Typography variant="caption" color="primary.main">
                      <FaCheckCircle style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      Verified background check
                    </Typography>
                    <br />
                    <Typography variant="caption" color="primary.main">
                      <FaCheckCircle style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      Satisfaction guaranteed
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Layout>
  )
}
