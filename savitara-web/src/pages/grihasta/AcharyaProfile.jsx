import ChatIcon from '@mui/icons-material/Chat';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Rating,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import {
  FaCheckCircle,
  FaComment,
  FaGraduationCap,
  FaLanguage,
  FaMapMarkerAlt,
  FaStar,
  FaUserClock
} from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import ServiceCard from '../../components/cards/ServiceCard';
import Layout from '../../components/Layout';
import TrustBadge, { TrustBadgeGroup } from '../../components/TrustBadge';
import api from '../../services/api';
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

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired
};

export default function AcharyaProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [poojas, setPoojas] = useState([])
  const [reviews, setReviews] = useState([])
  const [tabValue, setTabValue] = useState(0)


  const formatLocation = (loc) => {
    if (!loc) return 'Location not available';
    if (typeof loc === 'string') return loc;
    // Remove leading/trailing commas and spaces
    return `${loc.city || ''}, ${loc.state || ''}`.replaceAll(/^, /g, '').replaceAll(/, $/g, '');
  };

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
    const acharyaProfileId = profile?._id || profile?.id || id
    navigate(`/booking/create/${acharyaProfileId}?poojaId=${poojaId}`)
  }

  const handleChatNow = async () => {
    try {
      const userId = profile.user_id || profile.userId || profile.account_id || id
      const response = await api.post('/chat/verify-conversation', {
        recipient_id: userId
      })
      // Backend wraps in StandardResponse: { success, data: { conversation_id, recipient } }
      const convData = response.data?.data || response.data
      if (convData?.conversation_id) {
        navigate(`/chat/${convData.conversation_id}`)
      }
    } catch (err) {
      console.error('Failed to start chat:', err)
      setError('Unable to start chat. Please try again.')
    }
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

  const acharyaProfileId = profile._id || profile.id || id
  const acharyaUserId = profile.user_id || profile.userId || profile.account_id || acharyaProfileId

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
                    <TrustBadge type="verified" size="medium" showTooltip />
                  )}
                  {profile.kyc_verified && (
                    <TrustBadge type="kyc-verified" size="medium" showTooltip />
                  )}
                  {profile.rating >= 4.5 && profile.total_bookings >= 50 && (
                    <TrustBadge type="top-rated" size="medium" showTooltip />
                  )}
                  {profile.total_bookings >= 100 && profile.rating >= 4.8 && (
                    <TrustBadge type="elite-acharya" size="medium" showTooltip />
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
                    <Typography>{formatLocation(profile.location)}</Typography>
                  </Box>
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap">
                  {profile.specializations?.map((spec) => (
                    <Chip 
                      key={spec} 
                      label={spec} 
                      sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.1)', 
                        color: 'white',
                        backdropFilter: 'blur(4px)'
                      }} 
                    />
                  ))}
                </Box>
                
                <Box mt={3}>
                  <Button 
                    variant="contained" 
                    color="secondary" 
                    startIcon={<FaComment />}
                    onClick={() => navigate(`/chat/u/${acharyaUserId}`)}
                    sx={{ borderRadius: 20, px: 4 }}
                  >
                    Chat with Acharya
                  </Button>
                  
                  {/* Privacy & Security Trust Signal */}
                  <Box mt={2}>
                    <TrustBadgeGroup 
                      badges={['privacy-protected', 'secure']} 
                      size="small" 
                      variant="inline"
                      spacing={2}
                    />
                  </Box>
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
                        <Button color="inherit" size="small" onClick={() => navigate('/booking/create/' + acharyaProfileId)}>
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
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button 
                      variant="contained" 
                      fullWidth 
                      size="large"
                      sx={{ bgcolor: 'var(--saffron-main)' }}
                      onClick={() => navigate(`/booking/create/${acharyaProfileId}`)}
                    >
                      Book Session
                    </Button>

                    <Button 
                      variant="outlined" 
                      color="primary"
                      fullWidth 
                      size="large"
                      startIcon={<ChatIcon />}
                      onClick={handleChatNow}
                    >
                      Chat Now
                    </Button>
                  </Box>
                  
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
