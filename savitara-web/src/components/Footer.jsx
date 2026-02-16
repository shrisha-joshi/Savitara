import { Box, Container, Typography, Grid, Link, IconButton, Divider } from '@mui/material'
import { Facebook, Twitter, Instagram, LinkedIn, Email, Phone, LocationOn } from '@mui/icons-material'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

export default function Footer() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const iconSx = {
    color: 'common.white',
    bgcolor: 'rgba(255,255,255,0.1)',
    transition: 'all 0.3s ease',
    '&:hover': {
      bgcolor: 'primary.main',
      transform: 'translateY(-3px)'
    }
  }

  const linkSx = {
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    display: 'block',
    mb: 1.5,
    transition: 'color 0.2s',
    '&:hover': {
      color: 'primary.main',
      pl: 0.5
    }
  }

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: isDark ? '#0F0F0F' : '#111827',
        color: 'white',
        pt: 8,
        pb: 4,
        mt: 'auto',
        borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background decoration */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: 'linear-gradient(90deg, #F97316, #F59E0B, #F97316)',
        boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)'
      }} />

      <Container maxWidth="xl">
        <Grid container spacing={6}>
          {/* Brand Column */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Typography
                className="glow"
                sx={{
                  fontFamily: '"Noto Sans Devanagari", serif',
                  fontSize: '2rem',
                  color: 'primary.main',
                }}
              >
                ॐ
              </Typography>
              <Typography 
                className="savitara-brand"
                variant="h4" 
                sx={{ 
                  color: 'common.white',
                  fontSize: '2.5rem'
                }}
              >
                Savitara
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3, lineHeight: 1.8, maxWidth: '300px' }}>
              Bridging the gap between timeless Vedic traditions and modern convenience. Connect with authentic Acharyas instantly.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {[
                { Icon: Facebook, url: '#' },
                { Icon: Twitter, url: '#' },
                { Icon: Instagram, url: '#' },
                { Icon: LinkedIn, url: '#' }
              ].map(({ Icon, url }, index) => (
                <IconButton key={index} href={url} size="small" sx={iconSx}>
                  <Icon fontSize="small" />
                </IconButton>
              ))}
            </Box>
          </Grid>

          {/* Quick Links */}
          <Grid item xs={6} md={2}>
            <Typography variant="h6" sx={{ color: 'common.white', fontWeight: 600, mb: 3 }}>
              Platform
            </Typography>
            <Link href="/" sx={linkSx}>Home</Link>
            <Link href="/search" sx={linkSx}>Find Acharyas</Link>
            <Link href="/services" sx={linkSx}>Services</Link>
            <Link href="/articles" sx={linkSx}>Knowledge Base</Link>
          </Grid>

          {/* Company */}
          <Grid item xs={6} md={2}>
            <Typography variant="h6" sx={{ color: 'common.white', fontWeight: 600, mb: 3 }}>
              Company
            </Typography>
            <Link href="/about" sx={linkSx}>About Us</Link>
            <Link href="/contact" sx={linkSx}>Contact</Link>
            <Link href="/careers" sx={linkSx}>Join as Acharya</Link>
            <Link href="/privacy" sx={linkSx}>Privacy Policy</Link>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ color: 'common.white', fontWeight: 600, mb: 3 }}>
              Contact Us
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <LocationOn sx={{ color: 'primary.main', mt: 0.5 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                123 Vedic Center, Spiritual Way<br />
                Bangalore, Karnataka 560001
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
              <Phone sx={{ color: 'primary.main' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                +91 98765 43210
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Email sx={{ color: 'primary.main' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                namaste@savitara.com
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} Savitara. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Link href="/terms" sx={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
              Terms of Service
            </Link>
            <Link href="/privacy" sx={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
              Privacy Policy
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
