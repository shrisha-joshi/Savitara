import { AppBar, Toolbar, Typography, Button, IconButton, Box, Avatar, Menu, MenuItem, Container, Tooltip, useTheme as useMuiTheme, alpha, ListItemIcon, ListItemText, Chip } from '@mui/material'
import { Logout, Dashboard, Person, Search as SearchIcon, Event as EventIcon, Wallet as WalletIcon, Chat as ChatIcon, MoreVert, CalendarMonth, Category, Info, Handshake, MonetizationOn } from '@mui/icons-material'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../services/api'
// Make getInitials, generateAvatarColor optional or mock if missing, assuming they exist
import { getInitials, generateAvatarColor } from '../utils/helpers'

export default function Navbar() {
  const [anchorEl, setAnchorEl] = useState(null)
  const [moreAnchorEl, setMoreAnchorEl] = useState(null)
  const [coinBalance, setCoinBalance] = useState(0)
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const muiTheme = useMuiTheme()

  // Fetch coin balance when user is logged in
  useEffect(() => {
    if (user) {
      api.get('/gamification/coins/balance')
        .then(res => setCoinBalance(res.data?.balance || res.data?.data?.balance || 0))
        .catch(err => console.error('Failed to fetch coin balance:', err))
    }
  }, [user])

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleMoreMenu = (event) => {
    setMoreAnchorEl(event.currentTarget)
  }

  const handleMoreClose = () => {
    setMoreAnchorEl(null)
  }

  const handleLogout = async () => {
    await logout()
    handleClose()
  }

  return (
    <AppBar 
      position="sticky" 
      className="glass-nav"
      elevation={0}
      sx={{ 
        borderBottom: `1px solid ${alpha(muiTheme.palette.common.white, 0.1)}`,
        zIndex: (theme) => theme.zIndex.drawer + 1
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 } }}>
          {/* Logo / Brand */}
          <Typography
            variant="h4"
            noWrap
            component="div"
            className="savitara-brand glow"
            onClick={() => navigate('/')}
            sx={{ 
              flexGrow: { xs: 1, md: 0 }, 
              mr: { md: 4 },
              cursor: 'pointer',
              color: 'common.white',
              fontSize: { xs: '1.8rem', md: '2.2rem' }
            }}
          >
            Savitara
          </Typography>

          {/* Spacer for desktop layout */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }} />

          {/* Desktop Navigation */}
          {user && (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
              {user.role === 'grihasta' && (
                <>
                  <Button 
                    color="inherit" 
                    startIcon={<SearchIcon />}
                    onClick={() => navigate('/search')}
                    sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
                  >
                    Find Acharyas
                  </Button>
                  <Button 
                    color="inherit" 
                    startIcon={<EventIcon />}
                    onClick={() => navigate('/bookings')}
                    sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
                  >
                    Bookings
                  </Button>
                </>
              )}

              {user.role === 'acharya' && (
                <>
                  <Button 
                    color="inherit" 
                    startIcon={<EventIcon />}
                    onClick={() => navigate('/bookings')}
                    sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
                  >
                    Bookings
                  </Button>
                  <Button 
                    color="inherit" 
                    startIcon={<WalletIcon />}
                    onClick={() => navigate('/earnings')}
                    sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
                  >
                    Earnings
                  </Button>
                </>
              )}

              <Button 
                color="inherit" 
                startIcon={<ChatIcon />}
                onClick={() => navigate('/chat')}
                sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
              >
                Chat
              </Button>
              
              {/* More Menu - Desktop */}
              <Button 
                color="inherit" 
                startIcon={<MoreVert />}
                onClick={handleMoreMenu}
                sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
              >
                More
              </Button>
              <Menu
                anchorEl={moreAnchorEl}
                open={Boolean(moreAnchorEl)}
                onClose={handleMoreClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    bgcolor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    minWidth: 200
                  },
                }}
              >
                <MenuItem onClick={() => { navigate('/services'); handleMoreClose(); }}>
                  <ListItemIcon><Category fontSize="small" /></ListItemIcon>
                  <ListItemText>Services</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { navigate('/panchanga'); handleMoreClose(); }}>
                  <ListItemIcon><CalendarMonth fontSize="small" /></ListItemIcon>
                  <ListItemText>Panchanga</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { navigate('/about'); handleMoreClose(); }}>
                  <ListItemIcon><Info fontSize="small" /></ListItemIcon>
                  <ListItemText>About Us</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { navigate('/privacy'); handleMoreClose(); }}>
                  <ListItemIcon><Handshake fontSize="small" /></ListItemIcon>
                  <ListItemText>Privacy Policy</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          )}

          {/* Right Side Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2 }}>

            {/* Coin Balance Widget */}
            {user && (
              <Tooltip title="Your Savitara Coins - Earn & redeem for discounts!">
                <Chip 
                  icon={<MonetizationOn sx={{ color: '#000 !important' }} />}
                  label={`${coinBalance.toLocaleString()} Coins`}
                  onClick={() => navigate('/rewards')}
                  sx={{ 
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    px: 0.5,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #FFA500 0%, #FFD700 100%)',
                      transform: 'scale(1.05)',
                      boxShadow: '0 4px 12px rgba(255, 215, 0, 0.5)',
                    },
                    '& .MuiChip-icon': {
                      color: '#000'
                    }
                  }}
                />
              </Tooltip>
            )}

            {/* User Menu */}
            {user ? (
              <>
                <Tooltip title="Account settings">
                  <IconButton
                    onClick={handleMenu}
                    sx={{ p: 0.5, border: `2px solid ${alpha(muiTheme.palette.common.white, 0.3)}` }}
                  >
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: generateAvatarColor ? generateAvatarColor(user.full_name) : 'primary.main',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {getInitials ? getInitials(user.full_name) : user.full_name?.charAt(0)}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    elevation: 0,
                    sx: {
                      overflow: 'visible',
                      filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                      mt: 1.5,
                      bgcolor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      '& .MuiAvatar-root': {
                        width: 32,
                        height: 32,
                        ml: -0.5,
                        mr: 1,
                      },
                      '&:before': {
                        content: '""',
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        right: 14,
                        width: 10,
                        height: 10,
                        bgcolor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        transform: 'translateY(-50%) rotate(45deg)',
                        zIndex: 0,
                      },
                    },
                  }}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>
                    <Person sx={{ mr: 2, color: 'primary.main' }} /> Profile
                  </MenuItem>
                  {user.role === 'acharya' && (
                    <MenuItem onClick={() => { navigate('/settings'); handleClose(); }}>
                      <Dashboard sx={{ mr: 2, color: 'primary.main' }} /> Settings
                    </MenuItem>
                  )}
                  <MenuItem onClick={handleLogout}>
                    <Logout sx={{ mr: 2, color: 'error.main' }} /> Logout
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button 
                variant="contained" 
                size="large"
                onClick={() => navigate('/login')}
                sx={{ 
                  borderRadius: 10, // Design system: 10px for buttons
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  fontSize: '1rem',
                  // Gradient and shadow handled by theme
                }}
              >
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
