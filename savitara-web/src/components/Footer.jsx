import { Box, Container, Typography, Grid, Link, IconButton } from '@mui/material'
import { Facebook, Twitter, Instagram, LinkedIn, Email, Phone } from '@mui/icons-material'

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'primary.dark',
        color: 'white',
        py: 6,
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom fontWeight={700}>
              🕉 Savitara
            </Typography>
            <Typography variant="body2" color="inherit" paragraph>
              Connecting devotees with verified Hindu priests for authentic traditional rituals and spiritual services.
            </Typography>
            <Box>
              <IconButton color="inherit" href="https://facebook.com" target="_blank">
                <Facebook />
              </IconButton>
              <IconButton color="inherit" href="https://twitter.com" target="_blank">
                <Twitter />
              </IconButton>
              <IconButton color="inherit" href="https://instagram.com" target="_blank">
                <Instagram />
              </IconButton>
              <IconButton color="inherit" href="https://linkedin.com" target="_blank">
                <LinkedIn />
              </IconButton>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" gutterBottom>
              Services
            </Typography>
            <Link href="/search" color="inherit" display="block" sx={{ mb: 1 }}>
              Find Acharyas
            </Link>
            <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
              Book Pooja
            </Link>
            <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
              Astrology
            </Link>
            <Link href="#" color="inherit" display="block">
              Vastu
            </Link>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="h6" gutterBottom>
              Company
            </Typography>
            <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
              About Us
            </Link>
            <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
              Careers
            </Link>
            <Link href="#" color="inherit" display="block" sx={{ mb: 1 }}>
              Blog
            </Link>
            <Link href="#" color="inherit" display="block">
              Contact
            </Link>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Contact Us
            </Typography>
            <Box display="flex" alignItems="center" mb={1}>
              <Email sx={{ mr: 1 }} />
              <Typography variant="body2">support@savitara.com</Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Phone sx={{ mr: 1 }} />
              <Typography variant="body2">+91 1800 123 4567</Typography>
            </Box>
          </Grid>
        </Grid>

        <Box mt={4} pt={4} borderTop={1} borderColor="rgba(255, 255, 255, 0.2)">
          <Typography variant="body2" align="center">
            © {new Date().getFullYear()} Savitara. All rights reserved.
            {' | '}
            <Link href="#" color="inherit">Privacy Policy</Link>
            {' | '}
            <Link href="#" color="inherit">Terms of Service</Link>
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}
