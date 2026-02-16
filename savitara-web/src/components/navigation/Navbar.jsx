import { useState, useEffect } from 'react';
import { 
  AppBar, Toolbar, Box, Button, IconButton, Drawer, List, ListItem, 
  ListItemIcon, ListItemText, Container, Avatar, Menu, MenuItem, 
  Badge, Divider, Typography, useScrollTrigger, Tooltip
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaBars, FaTimes, FaHome, FaSearch, FaCalendarAlt, FaUser, 
  FaBell, FaSignOutAlt, FaHeart, FaSun, FaMoon
} from 'react-icons/fa';
import SavitaraBrand from '../branding/SavitaraBrand';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleTheme, isDark, colors } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 50,
  });

  const navItems = [
    { label: 'Home', path: '/', icon: <FaHome /> },
    { label: 'Find Acharya', path: '/search', icon: <FaSearch /> },
    { label: 'Services', path: '/services', icon: <FaCalendarAlt /> },
  ];

  const isActive = (path) => location.pathname === path;
  const isHomePage = location.pathname === '/';

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleNotificationOpen = (event) => setNotificationAnchor(event.currentTarget);
  const handleNotificationClose = () => setNotificationAnchor(null);

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/');
  };

  // Drawer content for mobile
  const drawer = (
    <Box sx={{ width: 280, height: '100%', backgroundColor: colors.background.paper }}>
      <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${colors.border.light}` }}>
        <SavitaraBrand variant="default" size="small" />
      </Box>
      <List sx={{ p: 2 }}>
        {navItems.map((item) => (
          <ListItem
            key={item.path}
            onClick={() => {
              navigate(item.path);
              handleDrawerToggle();
            }}
            sx={{
              borderRadius: 2,
              mb: 1,
              backgroundColor: isActive(item.path) ? `${colors.accent.saffron}20` : 'transparent',
              '&:hover': { backgroundColor: `${colors.accent.saffron}10` },
            }}
          >
            <ListItemIcon sx={{ color: isActive(item.path) ? colors.accent.saffron : colors.text.secondary, minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontWeight: isActive(item.path) ? 600 : 400,
                color: isActive(item.path) ? colors.accent.saffron : colors.text.primary,
              }}
            />
          </ListItem>
        ))}
        
        {/* Theme Toggle in Mobile Menu */}
        <ListItem
          onClick={toggleTheme}
          sx={{
            borderRadius: 2,
            mb: 1,
            backgroundColor: 'transparent',
            '&:hover': { backgroundColor: `${colors.accent.saffron}10` },
            cursor: 'pointer',
          }}
        >
          <ListItemIcon sx={{ color: colors.accent.gold, minWidth: 40 }}>
            {isDark ? <FaSun /> : <FaMoon />}
          </ListItemIcon>
          <ListItemText
            primary={isDark ? 'Light Mode' : 'Dark Mode'}
            primaryTypographyProps={{
              fontWeight: 400,
              color: colors.text.primary,
            }}
          />
        </ListItem>
      </List>
      <Divider sx={{ mx: 2, borderColor: colors.border.light }} />
      <Box sx={{ p: 2 }}>
        {user ? (
          <>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => { navigate('/profile'); handleDrawerToggle(); }}
              sx={{ mb: 1, borderColor: colors.secondary.main, color: colors.secondary.main }}
            >
              My Profile
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleLogout}
              sx={{
                background: `linear-gradient(135deg, ${colors.accent.saffron} 0%, ${colors.accent.gold} 100%)`,
                color: isDark ? '#1A1A1A' : '#1A2233',
              }}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => { navigate('/login'); handleDrawerToggle(); }}
              sx={{ mb: 1, borderColor: colors.accent.saffron, color: colors.accent.saffron }}
            >
              Login
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={() => { navigate('/login'); handleDrawerToggle(); }}
              sx={{
                background: `linear-gradient(135deg, ${colors.accent.saffron} 0%, ${colors.accent.gold} 100%)`,
                color: isDark ? '#1A1A1A' : '#1A2233',
              }}
            >
              Get Started
            </Button>
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar
        position="fixed"
        elevation={scrolled ? 4 : 0}
        sx={{
          backgroundColor: scrolled || !isHomePage 
            ? colors.background.navbar 
            : 'transparent',
          backdropFilter: scrolled ? 'blur(10px)' : 'none',
          transition: 'all 0.3s ease',
          borderBottom: scrolled ? `1px solid ${colors.border.light}` : 'none',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
            {/* Logo */}
            <Box
              onClick={() => navigate('/')}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {/* Om Symbol */}
              <Typography
                sx={{
                  fontFamily: '"Noto Sans Devanagari", serif',
                  fontSize: { xs: '1.2rem', md: '1.5rem' },
                  color: scrolled || !isHomePage ? colors.accent.gold : '#FFD700',
                  textShadow: scrolled || !isHomePage 
                    ? 'none' 
                    : '0 0 10px rgba(255, 215, 0, 0.5)',
                }}
              >
                ॐ
              </Typography>
              {/* Brand Name */}
              <Typography
                className="savitara-brand"
                sx={{
                  fontFamily: '"Samarkan", "Noto Sans Devanagari", "Times New Roman", serif !important',
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  fontWeight: 400,
                  color: scrolled || !isHomePage ? colors.accent.saffron : '#FFFFFF',
                  letterSpacing: '3px',
                  textShadow: scrolled || !isHomePage 
                    ? isDark ? '1px 1px 4px rgba(0,0,0,0.3)' : '1px 1px 2px rgba(0,0,0,0.1)' 
                    : '2px 2px 4px rgba(0, 0, 0, 0.4)',
                  transition: 'all 0.3s ease',
                }}
              >
                Savitara
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    color: isActive(item.path) 
                      ? colors.accent.saffron 
                      : scrolled || !isHomePage ? colors.text.primary : '#FFFFFF',
                    fontWeight: isActive(item.path) ? 600 : 400,
                    px: 2,
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: isActive(item.path) ? '60%' : '0%',
                      height: 3,
                      backgroundColor: colors.accent.gold,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    },
                    '&:hover::after': {
                      width: '60%',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>

            {/* Right Section */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Theme Toggle Button - Desktop */}
              <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                <IconButton
                  onClick={toggleTheme}
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    color: scrolled || !isHomePage ? colors.accent.gold : '#FFFFFF',
                    backgroundColor: scrolled || !isHomePage 
                      ? isDark ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 153, 51, 0.1)' 
                      : 'rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      backgroundColor: scrolled || !isHomePage 
                        ? isDark ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 153, 51, 0.2)' 
                        : 'rgba(255, 255, 255, 0.2)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
                </IconButton>
              </Tooltip>

              {user ? (
                <>
                  {/* Notifications */}
                  <IconButton
                    onClick={handleNotificationOpen}
                    sx={{
                      color: scrolled || !isHomePage ? colors.text.primary : '#FFFFFF',
                    }}
                  >
                    <Badge badgeContent={3} color="error">
                      <FaBell size={20} />
                    </Badge>
                  </IconButton>

                  {/* User Menu */}
                  <IconButton onClick={handleMenuOpen}>
                    <Avatar
                      src={user.profileImage}
                      sx={{
                        width: 36,
                        height: 36,
                        border: `2px solid ${colors.accent.gold}`,
                      }}
                    >
                      {user.name?.charAt(0) || 'U'}
                    </Avatar>
                  </IconButton>

                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    PaperProps={{
                      sx: {
                        mt: 1.5,
                        borderRadius: 3,
                        minWidth: 200,
                        boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.12)',
                        backgroundColor: colors.background.paper,
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border.light}` }}>
                      <Typography variant="subtitle2" fontWeight={600} color={colors.text.primary}>
                        {user.name}
                      </Typography>
                      <Typography variant="caption" color={colors.text.secondary}>
                        {user.email}
                      </Typography>
                    </Box>
                    <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }} sx={{ color: colors.text.primary }}>
                      <ListItemIcon sx={{ color: colors.text.secondary }}><FaUser size={16} /></ListItemIcon>
                      My Profile
                    </MenuItem>
                    <MenuItem onClick={() => { navigate('/bookings'); handleMenuClose(); }} sx={{ color: colors.text.primary }}>
                      <ListItemIcon sx={{ color: colors.text.secondary }}><FaCalendarAlt size={16} /></ListItemIcon>
                      My Bookings
                    </MenuItem>
                    <MenuItem onClick={() => { navigate('/favorites'); handleMenuClose(); }} sx={{ color: colors.text.primary }}>
                      <ListItemIcon sx={{ color: colors.text.secondary }}><FaHeart size={16} /></ListItemIcon>
                      Favorites
                    </MenuItem>
                    <Divider sx={{ borderColor: colors.border.light }} />
                    <MenuItem onClick={handleLogout} sx={{ color: '#DC143C' }}>
                      <ListItemIcon><FaSignOutAlt size={16} color="#DC143C" /></ListItemIcon>
                      Logout
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/login')}
                    sx={{
                      display: { xs: 'none', sm: 'flex' },
                      borderColor: scrolled || !isHomePage ? colors.accent.saffron : '#FFFFFF',
                      color: scrolled || !isHomePage ? colors.accent.saffron : '#FFFFFF',
                      '&:hover': {
                        borderColor: colors.accent.gold,
                        backgroundColor: `${colors.accent.saffron}15`,
                      },
                    }}
                  >
                    Login
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/login')}
                    sx={{
                      display: { xs: 'none', sm: 'flex' },
                      background: `linear-gradient(135deg, ${colors.accent.saffron} 0%, ${colors.accent.gold} 100%)`,
                      color: isDark ? '#1A1A1A' : '#1A2233',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #FFD700 0%, #FF9933 100%)',
                      },
                    }}
                  >
                    Get Started
                  </Button>
                </>
              )}

              {/* Mobile Menu Button */}
              <IconButton
                onClick={handleDrawerToggle}
                sx={{
                  display: { md: 'none' },
                  color: scrolled || !isHomePage ? colors.text.primary : '#FFFFFF',
                }}
              >
                <FaBars size={24} />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', backgroundColor: colors.background.paper },
        }}
      >
        <IconButton
          onClick={handleDrawerToggle}
          sx={{ position: 'absolute', right: 8, top: 8, color: colors.text.primary }}
        >
          <FaTimes />
        </IconButton>
        {drawer}
      </Drawer>

      {/* Toolbar spacer - only for non-home pages or when scrolled */}
      {(!isHomePage || scrolled) && <Toolbar />}
    </>
  );
};

export default Navbar;