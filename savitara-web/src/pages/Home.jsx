import { Container, Box, Typography, Button, Grid, Card, CardContent, Paper } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Star, VerifiedUser, Schedule, Payments } from '@mui/icons-material'
import Layout from '../components/Layout'

export default function Home() {
  const navigate = useNavigate()

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

  return (
    <Layout>
      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: 'primary.light',
          color: 'white',
          py: 12,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" component="h1" gutterBottom fontWeight={700}>
            Welcome to Savitara
          </Typography>
          <Typography variant="h5" paragraph>
            Connect with Verified Hindu Priests for Traditional Rituals
          </Typography>
          <Typography variant="body1" paragraph sx={{ mb: 4 }}>
            Book authentic poojas, vedic rituals, and spiritual services with experienced and verified Acharyas
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
              onClick={() => navigate('/search')}
            >
              Find An Acharya
            </Button>
            <Button
              variant="outlined"
              size="large"
              sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'grey.300', bgcolor: 'rgba(255,255,255,0.1)' } }}
              onClick={() => navigate('/login')}
            >
              Get Started
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ my: 8 }}>
        <Typography variant="h3" align="center" gutterBottom fontWeight={600}>
          Why Choose Savitara?
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" paragraph sx={{ mb: 6 }}>
          Experience the best spiritual services with our platform
        </Typography>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  transition: 'transform 0.3s',
                  '&:hover': { transform: 'translateY(-8px)' },
                }}
              >
                <CardContent sx={{ py: 4 }}>
                  <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Services Section */}
      <Box sx={{ bgcolor: 'background.default', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" gutterBottom fontWeight={600}>
            Our Services
          </Typography>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {[
              'Vedic Rituals',
              'Vivaha (Marriage)',
              'Namkaran (Naming)',
              'Grihapravesh',
              'Upanayanam',
              'Shraddha',
              'Puja Services',
              'Havan',
              'Astrology',
              'Vastu Consultation',
            ].map((service, index) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                <Paper
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      bgcolor: 'primary.light',
                      color: 'white',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <Typography variant="h6">{service}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Container maxWidth="md" sx={{ my: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 6, bgcolor: 'secondary.main', color: 'white' }}>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Ready to Get Started?
          </Typography>
          <Typography variant="body1" paragraph>
            Join thousands of devotees who trust Savitara for their spiritual needs
          </Typography>
          <Button
            variant="contained"
            size="large"
            sx={{ bgcolor: 'white', color: 'secondary.main', '&:hover': { bgcolor: 'grey.100' } }}
            onClick={() => navigate('/login')}
          >
            Sign Up Now
          </Button>
        </Paper>
      </Container>
    </Layout>
  )
}
