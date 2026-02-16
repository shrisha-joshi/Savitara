import { Container, Typography, Paper, Box, Grid, Card, CardContent } from '@mui/material'
import { 
  SelfImprovement, 
  Diversity3, 
  TrendingUp, 
  Security,
  VerifiedUser,
  LocalLibrary,
  Stars,
  Handshake
} from '@mui/icons-material'
import Layout from '../components/Layout'

export default function About() {
  const features = [
    {
      icon: <SelfImprovement sx={{ fontSize: 40 }} />,
      title: 'Spiritual Guidance',
      description: 'Connect with experienced Acharyas for personalized spiritual consultation and guidance.'
    },
    {
      icon: <Diversity3 sx={{ fontSize: 40 }} />,
      title: 'Diverse Services',
      description: 'Access a wide range of spiritual services including poojas, consultations, and ceremonies.'
    },
    {
      icon: <VerifiedUser sx={{ fontSize: 40 }} />,
      title: 'Verified Acharyas',
      description: 'All Acharyas are carefully verified and authenticated to ensure quality and authenticity.'
    },
    {
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      title: 'Easy Booking',
      description: 'Simple and intuitive booking process with flexible scheduling and payment options.'
    },
    {
      icon: <Security sx={{ fontSize: 40 }} />,
      title: 'Secure Platform',
      description: 'Your data and transactions are protected with enterprise-grade security measures.'
    },
    {
      icon: <LocalLibrary sx={{ fontSize: 40 }} />,
      title: 'Panchanga Access',
      description: 'Access daily Panchanga information for auspicious timing and Vedic calendar insights.'
    },
    {
      icon: <Stars sx={{ fontSize: 40 }} />,
      title: 'Reviews & Ratings',
      description: 'Make informed decisions with transparent reviews and ratings from the community.'
    },
    {
      icon: <Handshake sx={{ fontSize: 40 }} />,
      title: 'Trusted Community',
      description: 'Join a growing community of seekers and spiritual guides on their journey.'
    }
  ]

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Hero Section */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: 6, 
            mb: 4, 
            background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
            color: 'white',
            textAlign: 'center'
          }}
        >
          <Typography variant="h2" gutterBottom fontWeight="bold">
            About Savitara
          </Typography>
          <Typography variant="h6" sx={{ mt: 2, maxWidth: 800, mx: 'auto' }}>
            Bridging the ancient wisdom of Vedic traditions with modern technology, 
            connecting spiritual seekers with authentic Acharyas.
          </Typography>
        </Paper>

        {/* Mission Section */}
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" gutterBottom color="primary">
            Our Mission
          </Typography>
          <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}>
            Savitara is dedicated to preserving and promoting Hindu spiritual practices by creating 
            a trusted platform that connects Grihastas (householders) with qualified Acharyas 
            (spiritual guides). We believe that authentic spiritual guidance should be accessible 
            to everyone, regardless of geographical boundaries.
          </Typography>
          <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}>
            Our platform ensures that traditional rituals, consultations, and spiritual services 
            are performed with authenticity and devotion, while providing the convenience and 
            transparency that modern seekers deserve.
          </Typography>
        </Paper>

        {/* What We Offer Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom color="primary" sx={{ mb: 3 }}>
            What We Offer
          </Typography>
          <Grid container spacing={3}>
            {features.map((feature) => (
              <Grid item xs={12} sm={6} md={3} key={feature.title}>
                <Card 
                  elevation={2} 
                  sx={{ 
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
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
        </Box>

        {/* How It Works Section */}
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" gutterBottom color="primary">
            How It Works
          </Typography>
          <Grid container spacing={4} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    margin: '0 auto 16px'
                  }}
                >
                  1
                </Box>
                <Typography variant="h6" gutterBottom>
                  Browse & Search
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Explore our directory of verified Acharyas based on specialization, 
                  location, language, and ratings.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    margin: '0 auto 16px'
                  }}
                >
                  2
                </Box>
                <Typography variant="h6" gutterBottom>
                  Book Service
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select a service, choose a convenient date and time, and submit 
                  your booking request or instant booking.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    margin: '0 auto 16px'
                  }}
                >
                  3
                </Box>
                <Typography variant="h6" gutterBottom>
                  Connect & Experience
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Receive confirmation, complete payment if required, and connect 
                  with your Acharya for your spiritual service.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Values Section */}
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom color="primary">
            Our Values
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary.dark">
                🙏 Authenticity
              </Typography>
              <Typography variant="body1" paragraph>
                We are committed to preserving the authenticity of Vedic traditions and ensuring 
                that all services are performed according to proper rituals and procedures.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary.dark">
                🔒 Trust & Safety
              </Typography>
              <Typography variant="body1" paragraph>
                Every Acharya undergoes thorough verification, and we maintain strict standards 
                to ensure a safe and trustworthy environment for all users.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary.dark">
                🌟 Excellence
              </Typography>
              <Typography variant="body1" paragraph>
                We strive for excellence in every aspect of our platform, from user experience 
                to service quality, ensuring the best possible outcomes for our community.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary.dark">
                🤝 Community
              </Typography>
              <Typography variant="body1" paragraph>
                We foster a supportive community where spiritual growth is encouraged, 
                knowledge is shared, and meaningful connections are made.
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Footer Call to Action */}
        <Box sx={{ textAlign: 'center', mt: 6, mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            Ready to Begin Your Spiritual Journey?
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Join thousands of seekers who have found guidance and peace through Savitara.
          </Typography>
        </Box>
      </Container>
    </Layout>
  )
}
