import { useRef, useEffect, useState } from 'react'
import { Container, Box, Typography, Grid, Card, CardContent, Paper, Rating, Chip, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Star, VerifiedUser, Schedule, Payments, FormatQuote, ArrowForward } from '@mui/icons-material'
import Layout from '../components/Layout'
import HeroSection from '../components/hero/HeroSection'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../services/api'

// Default testimonials (fallback if API fails)
const defaultTestimonials = [
  {
    id: 1,
    name: 'Rajesh Sharma',
    location: 'Mumbai, Maharashtra',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    rating: 5,
    text: 'The Acharya performed our Grihapravesh pooja with such devotion. Every mantra was recited perfectly. Highly recommended!',
    service: 'Grihapravesh'
  },
  {
    id: 2,
    name: 'Priya Patel',
    location: 'Ahmedabad, Gujarat',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    rating: 5,
    text: 'Found the perfect pandit for my son\'s Namkaran ceremony. The booking process was seamless and the priest was very knowledgeable.',
    service: 'Namkaran'
  },
  {
    id: 3,
    name: 'Suresh Kumar',
    location: 'Delhi, NCR',
    avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    rating: 4,
    text: 'Excellent platform to find verified priests. The video consultation feature helped us finalize our requirements easily.',
    service: 'Vivaha'
  },
  {
    id: 4,
    name: 'Anita Reddy',
    location: 'Hyderabad, Telangana',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    rating: 5,
    text: 'The Satyanarayan Pooja conducted by the Acharya was divine. My whole family felt blessed. Thank you Savitara!',
    service: 'Satyanarayan Pooja'
  },
  {
    id: 5,
    name: 'Vikram Singh',
    location: 'Jaipur, Rajasthan',
    avatar: 'https://randomuser.me/api/portraits/men/85.jpg',
    rating: 5,
    text: 'Used Savitara for my father\'s Shraddha ceremony. The priest was compassionate and guided us through every ritual.',
    service: 'Shraddha'
  },
  {
    id: 6,
    name: 'Lakshmi Iyer',
    location: 'Chennai, Tamil Nadu',
    avatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    rating: 5,
    text: 'Wonderful experience! The Acharya explained the significance of each step during the Upanayanam. Very professional.',
    service: 'Upanayanam'
  }
]

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const scrollRef = useRef(null)
  const [testimonials, setTestimonials] = useState(defaultTestimonials)

  // Fetch testimonials from API - gracefully fallback if backend is unavailable
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const response = await api.get('/content/testimonials', { timeout: 3000 })
        if (response.data?.data && response.data.data.length > 0) {
          setTestimonials(response.data.data)
        }
      } catch (error) {
        // Silently use default testimonials when backend is unavailable
        console.warn('Failed to fetch testimonials, using defaults:', error.message)
      }
    }
    fetchTestimonials()
  }, [])

  const features = [
    {
      icon: <VerifiedUser sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Verified Acharyas',
      description: 'All priests are thoroughly verified and certified for authentic rituals',
    },
    {
      icon: <Schedule sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Easy Booking',
      description: 'Book appointments instantly with flexible scheduling options',
    },
    {
      icon: <Star sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Trusted Reviews',
      description: 'Read genuine reviews from devotees who have used our services',
    },
    {
      icon: <Payments sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Secure Payments',
      description: 'Safe and secure payment processing with multiple options',
    },
  ]

  // Auto-scroll testimonials
  useEffect(() => {
    const ref = scrollRef.current
    if (!ref) return

    let animationFrame
    let scrollDirection = 1 // 1 = right, -1 = left
    const scrollSpeed = 0.5

    const autoScroll = () => {
      if (ref) {
        const { scrollLeft, scrollWidth, clientWidth } = ref
        
        // Reverse direction at edges
        if (scrollLeft >= scrollWidth - clientWidth - 5) {
          scrollDirection = -1
        } else if (scrollLeft <= 5) {
          scrollDirection = 1
        }
        
        ref.scrollLeft += scrollSpeed * scrollDirection
      }
      animationFrame = requestAnimationFrame(autoScroll)
    }

    // Start auto-scroll after a delay
    const timeout = setTimeout(() => {
      animationFrame = requestAnimationFrame(autoScroll)
    }, 2000)

    // Pause on hover
    const handleMouseEnter = () => {
      cancelAnimationFrame(animationFrame)
    }
    const handleMouseLeave = () => {
      animationFrame = requestAnimationFrame(autoScroll)
    }

    ref.addEventListener('mouseenter', handleMouseEnter)
    ref.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(animationFrame)
      ref.removeEventListener('mouseenter', handleMouseEnter)
      ref.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <Layout>
      {/* Hero Section - Full Height excluding header */}
      <Box sx={{ mt: -4 }}> {/* Negative margin to pull it up behind transparent header if needed, or just adjust height */}
         <HeroSection height="calc(100vh - 64px)" /> 
      </Box>

      {/* Features Section - Spacing: 96px vertical */}
      <Container maxWidth="lg" component="section" sx={{ py: 12 }}>
        {/* Section Header - Clear visual hierarchy */}
        <Box textAlign="center" sx={{ mb: 10 }}>
          <Typography 
            variant="overline" 
            sx={{ 
              color: 'primary.main', 
              fontWeight: 700, 
              letterSpacing: 2,
              display: 'block',
              mb: 1
            }}
          >
            WHY CHOOSE US
          </Typography>
          <Typography 
            variant="h2" 
            component="h2"
            fontWeight={700} 
            sx={{ mb: 2 }}
          >
            Savitara Advantage
          </Typography>
          <Typography 
            variant="h6" 
            color="text.secondary"
            sx={{ 
              maxWidth: 600, 
              mx: 'auto',
              lineHeight: 1.6 
            }}
          >
            Experience trusted spiritual guidance with verified Acharyas
          </Typography>
          {/* Decorative accent line */}
          <Box 
            sx={{ 
              width: 80, 
              height: 4, 
              bgcolor: 'primary.main', 
              mx: 'auto', 
              mt: 4, 
              borderRadius: 2 
            }} 
          />
        </Box>

        {/* Feature Cards - 4-column grid on desktop */}
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  p: 4,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'default',
                  // Card uses glassmorphism from theme
                }}
              >
                {/* Icon with circular background */}
                <Box 
                  sx={{ 
                    mb: 3, 
                    p: 2, 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'white',
                    width: 80,
                    height: 80,
                    mx: 'auto',
                  }}
                  role="img"
                  aria-label={feature.title}
                >
                  {feature.icon}
                </Box>
                {/* Feature title */}
                <Typography 
                  variant="h6" 
                  component="h3"
                  gutterBottom 
                  fontWeight={600}
                  sx={{ mb: 2 }}
                >
                  {feature.title}
                </Typography>
                {/* Feature description */}
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ lineHeight: 1.6 }}
                >
                  {feature.description}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Services Section - Alternate background */}
      <Box 
        component="section"
        sx={{ 
          position: 'relative',
          py: 16, // Increased spacing: 128px
          background: isDark 
            ? 'linear-gradient(to bottom, #0C0A09 0%, #1C1917 100%)' 
            : 'linear-gradient(to bottom, #FFF8F0 0%, #FFFFFF 100%)'
        }}
      >
        <Container maxWidth="lg">
          {/* Section Header */}
          <Box textAlign="center" sx={{ mb: 12 }}>
            <Typography 
              variant="overline" 
              sx={{ 
                color: 'secondary.main', 
                fontWeight: 700, 
                letterSpacing: 2,
                display: 'block',
                mb: 1
              }}
            >
              OUR OFFERINGS
            </Typography>
            <Typography 
              variant="h2" 
              component="h2"
              fontWeight={700} 
              sx={{ mb: 2 }}
            >
              Divine <Box component="span" sx={{ color: 'primary.main' }}>Services</Box>
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary"
              sx={{ 
                maxWidth: 600, 
                mx: 'auto',
                lineHeight: 1.6 
              }}
            >
              Comprehensive spiritual services for all your sacred needs
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            {[
              { title: 'Vedic Rituals', image: 'https://images.unsplash.com/photo-1542283870-072e9dd772af?auto=format&fit=crop&w=800&q=80' },
              { title: 'Vivaha (Marriage)', image: 'https://images.unsplash.com/photo-1604904612715-47bf9d9bc664?auto=format&fit=crop&w=800&q=80' },
              { title: 'Namkaran (Naming)', image: 'https://images.unsplash.com/photo-1587271339318-2e06c27f31f3?auto=format&fit=crop&w=800&q=80' },
              { title: 'Grihapravesh', image: 'https://images.unsplash.com/photo-1590059902641-5df786720f4f?auto=format&fit=crop&w=800&q=80' },
              { title: 'Upanayanam', image: 'https://images.unsplash.com/photo-1550965378-57bd63635e95?auto=format&fit=crop&w=800&q=80' },
              { title: 'Shraddha', image: 'https://images.unsplash.com/photo-1598462725287-3475f4eb2c64?auto=format&fit=crop&w=800&q=80' },
              { title: 'Puja Services', image: 'https://images.unsplash.com/photo-1567591414240-e1752c92d53c?auto=format&fit=crop&w=800&q=80' },
              { title: 'Havan', image: 'https://images.unsplash.com/photo-1623836376842-1e9671d49265?auto=format&fit=crop&w=800&q=80' },
              { title: 'Astrology', image: 'https://images.unsplash.com/photo-1616423668832-628d01b1f630?auto=format&fit=crop&w=800&q=80' },
              { title: 'Vastu', image: 'https://images.unsplash.com/photo-1590059902641-5df786720f4f?auto=format&fit=crop&w=800&q=80' },
            ].map((service, index) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                <Paper
                  className="glass-card"
                  elevation={0}
                  sx={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: isDark ? 'rgba(30,30,30,0.6)' : 'white',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    height: '100%',
                    '&:hover': {
                      transform: 'scale(1.03)',
                      boxShadow: 'var(--shadow-xl)',
                      borderColor: 'primary.main',
                      '& .service-img': {
                        transform: 'scale(1.1)'
                      }
                    },
                  }}
                  onClick={() => navigate(`/search?service=${service.title.toLowerCase()}`)}
                >
                  <Box sx={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                     <Box 
                       component="img"
                       src={service.image}
                       alt={service.title}
                       className="service-img"
                       onError={(e) => {
                         e.target.style.display = 'none';
                         e.target.parentElement.style.background = 'linear-gradient(135deg, var(--saffron-500) 0%, var(--amber-500) 100%)';
                       }}
                       sx={{
                         width: '100%',
                         height: '100%',
                         objectFit: 'cover',
                         transition: 'transform 0.5s ease',
                       }}
                     />
                     <Box sx={{ 
                       position: 'absolute', 
                       top: 0, 
                       left: 0, 
                       right: 0, 
                       bottom: 0,
                       background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)' 
                     }} />
                     <Typography 
                       variant="h6" 
                       sx={{ 
                         position: 'absolute', 
                         bottom: 12, 
                         left: 0, 
                         right: 0, 
                         color: 'white',
                         fontWeight: 600,
                         textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                       }}
                     >
                       {service.title}
                     </Typography>
                  </Box>
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      height: '3px', 
                      background: 'linear-gradient(to right, #F97316, #F59E0B)',
                      zIndex: 2
                    }} 
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
          
          {/* CTA Button */}
          <Box textAlign="center" sx={{ mt: 10 }}>
            <Button 
              variant="outlined" 
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate('/services')}
              sx={{ 
                borderRadius: 10, 
                px: 5, 
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              View All Services
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Testimonials Section - Social proof */}
      <Box 
        component="section"
        sx={{ 
          py: 16, 
          bgcolor: isDark ? '#0C0A09' : '#FFF8F0', 
          overflow: 'hidden' 
        }}
      >
        <Container maxWidth="lg" sx={{ mb: 8 }}>
          {/* Section Header */}
          <Box textAlign="center">
            <Typography 
              variant="overline" 
              sx={{ 
                color: 'primary.main', 
                fontWeight: 700, 
                letterSpacing: 2,
                display: 'block',
                mb: 1
              }}
            >
              TESTIMONIALS
            </Typography>
            <Typography 
              variant="h2" 
              component="h2"
              fontWeight={700} 
              gutterBottom
              sx={{ mb: 2 }}
            >
              Devotee Experiences
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary"
              sx={{ 
                maxWidth: 600, 
                mx: 'auto',
                lineHeight: 1.6 
              }}
            >
              Hear from thousands of satisfied devotees across India
            </Typography>
          </Box>
        </Container>

        {/* Auto-sliding horizontal scroll */}
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            px: { xs: 2, md: 6 },
            py: 4
          }}
        >
          {/* Duplicate testimonials for seamless loop effect */}
          {[...testimonials, ...testimonials].map((testimonial, index) => (
            <Card
              key={`${testimonial.id}-${index}`}
              className="glass-card"
              sx={{
                minWidth: { xs: 300, sm: 380 },
                maxWidth: 380,
                flexShrink: 0,
                borderRadius: 4,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                border: 'none',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 20px 40px rgba(249, 115, 22, 0.1)',
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ mb: 3 }}>
                  <FormatQuote sx={{ 
                    fontSize: 40, 
                    color: 'primary.main', 
                    opacity: 0.2,
                    transform: 'rotate(180deg)'
                  }} />
                </Box>
                
                {/* Testimonial text */}
                <Typography 
                  variant="body1" 
                  sx={{ 
                    mb: 4, 
                    minHeight: 80, 
                    lineHeight: 1.8,
                    color: 'text.secondary',
                    fontStyle: 'italic',
                    fontSize: '1.05rem'
                  }}
                >
                  "{testimonial.text}"
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                   <Rating 
                    value={testimonial.rating} 
                    readOnly 
                    size="small" 
                    sx={{ color: '#F59E0B' }} 
                  />
                  <Chip 
                    label={testimonial.service} 
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(249, 115, 22, 0.1)', 
                      color: 'primary.main',
                      fontWeight: 600,
                      fontSize: '0.7rem'
                    }} 
                  />
                </Box>
                
                {/* User info */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  pt: 3,
                  borderTop: '1px solid',
                  borderColor: 'divider'
                }}>
                  {/* Avatar removed as per request */}
                  {/* <Avatar 
                    src={testimonial.avatar} 
                    sx={{ 
                      width: 48, 
                      height: 48,
                      border: '2px solid',
                      borderColor: 'primary.main'
                    }} 
                  /> */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                      {testimonial.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {testimonial.location}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      {/* CTA Section - Only show when user is NOT logged in */}
      {!user && (
        <Container 
          maxWidth="md" 
          component="section"
          sx={{ py: 16, textAlign: 'center' }}
        >
          <Box 
            sx={{ 
              p: { xs: 6, md: 10 }, 
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              color: 'white',
              borderRadius: 4,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(249, 115, 22, 0.3)'
            }}
          >
            {/* Decorative circles - visual interest */}
            <Box 
              sx={{ 
                position: 'absolute', 
                top: -50, 
                right: -50, 
                width: 200, 
                height: 200, 
                borderRadius: '50%', 
                bgcolor: 'rgba(255,255,255,0.1)',
                pointerEvents: 'none'
              }} 
            />
            <Box 
              sx={{ 
                position: 'absolute', 
                bottom: -30, 
                left: -30, 
                width: 150, 
                height: 150, 
                borderRadius: '50%', 
                bgcolor: 'rgba(255,255,255,0.1)',
                pointerEvents: 'none'
              }} 
            />
            
            {/* CTA Content */}
            <Typography 
              variant="h2" 
              component="h2"
              gutterBottom 
              fontWeight={700} 
              sx={{ position: 'relative', mb: 3 }}
            >
              Begin Your Spiritual Journey
            </Typography>
            <Typography 
              variant="h6" 
              paragraph 
              sx={{ 
                opacity: 0.95, 
                position: 'relative', 
                mb: 5,
                maxWidth: 500,
                mx: 'auto',
                lineHeight: 1.6
              }}
            >
              Join thousands of devotees who trust Savitara for their spiritual guidance and sacred ceremonies.
            </Typography>
            
            {/* Primary CTA Button */}
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              endIcon={<ArrowForward />}
              sx={{ 
                bgcolor: 'white', 
                color: 'primary.dark', 
                fontWeight: 700,
                fontSize: '1.125rem',
                px: 6,
                py: 2,
                borderRadius: 10,
                position: 'relative',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                '&:hover': { 
                  bgcolor: '#FFF8F0', 
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.2)'
                } 
              }}
            >
              Get Started Now
            </Button>
          </Box>
        </Container>
      )}
    </Layout>
  )
}
