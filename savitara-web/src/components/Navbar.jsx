import { AppBar, Toolbar, Typography, Button, IconButton, Box, Avatar, Menu, MenuItem, Container } from '@mui/material'
import { Menu as MenuIcon, AccountCircle, Logout, Dashboard, Person } from '@mui/icons-material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInitials, generateAvatarColor } from '../utils/helpers'

export default function Navbar() {
  const [anchorEl, setAnchorEl] = useState(null)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
    <AppBar position="sticky">
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 700 }}
            onClick={() => navigate('/')}
          >
            🕉 Savitara
          </Typography>

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                color="inherit"
                startIcon={<Dashboard />}
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>

              {user.role === 'grihasta' && (
                <>
                  <Button color="inherit" onClick={() => navigate('/search')}>
                    Find Acharyas
                  </Button>
                  <Button color="inherit" onClick={() => navigate('/bookings')}>
                    My Bookings
                  </Button>
                </>
              )}

              {user.role === 'acharya' && (
                <>
                  <Button color="inherit" onClick={() => navigate('/bookings')}>
                    Bookings
                  </Button>
                  <Button color="inherit" onClick={() => navigate('/earnings')}>
                    Earnings
                  </Button>
                </>
              )}

              <Button color="inherit" onClick={() => navigate('/chat')}>
                Chat
              </Button>

              <IconButton
                size="large"
                onClick={handleMenu}
                color="inherit"
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: generateAvatarColor(user.full_name),
                  }}
                >
                  {getInitials(user.full_name)}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>
                  <Person sx={{ mr: 1 }} /> Profile
                </MenuItem>
                {user.role === 'acharya' && (
                  <MenuItem onClick={() => { navigate('/settings'); handleClose(); }}>
                    <Dashboard sx={{ mr: 1 }} /> Settings
                  </MenuItem>
                )}
                <MenuItem onClick={handleLogout}>
                  <Logout sx={{ mr: 1 }} /> Logout
                </MenuItem>
              </Menu>
            </Box>
          )}

          {!user && (
            <Button color="inherit" onClick={() => navigate('/login')}>
              Login
            </Button>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  )
}
