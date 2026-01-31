import { AppBar, Toolbar, Typography, Button, IconButton, Box, Avatar, Menu, MenuItem, Container, Tooltip, useTheme as useMuiTheme, alpha } from '@mui/material'
import { Menu as MenuIcon, AccountCircle, Logout, Dashboard, Person, LightMode, DarkMode, Search as SearchIcon, Event as EventIcon, Wallet as WalletIcon, Chat as ChatIcon } from '@mui/icons-material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
// Make getInitials, generateAvatarColor optional or mock if missing, assuming they exist
import { getInitials, generateAvatarColor } from '../utils/helpers'

export default function Navbar() {
  const [anchorEl, setAnchorEl] = useState(null)
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const muiTheme = useMuiTheme()

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
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
              <Button
                color="inherit"
                startIcon={<Dashboard />}
                onClick={() => navigate('/dashboard')}
                sx={{ borderRadius: 'var(--radius-lg)', textTransform: 'none', fontSize: '1rem' }}
              >
                Dashboard
              </Button>

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
            </Box>
          )}

          {/* Right Side Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2 }}>
            
            {/* Theme Toggle */}
            <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton 
                onClick={toggleTheme} 
                sx={{ 
                  color: 'common.white',
                  bgcolor: alpha(muiTheme.palette.common.white, 0.1),
                  '&:hover': { bgcolor: alpha(muiTheme.palette.common.white, 0.2) }
                }}
              >
                {isDark ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>

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
                color="secondary"
                onClick={() => navigate('/login')}
                sx={{ 
                  borderRadius: 'var(--radius-full)',
                  px: 3,
                  fontWeight: 600,
                  boxShadow: 'var(--shadow-glow)'
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
