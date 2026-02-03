import { useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next/router';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Divider,
  Tooltip,
  Avatar,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  VerifiedUser as VerifiedIcon,
  RateReview as ReviewIcon,
  Notifications as NotificationsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  Article as ContentIcon,
  History as HistoryIcon,
  LightMode,
  DarkMode,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const drawerWidth = 260;

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { user, logout, isSuperAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { text: 'Services', icon: <ContentIcon />, path: '/services' },
    { text: 'Verifications', icon: <VerifiedIcon />, path: '/verifications' },
    { text: 'KYC Verification', icon: <VerifiedIcon />, path: '/kyc-verification' },
    { text: 'Reviews', icon: <ReviewIcon />, path: '/reviews' },
    { text: 'Broadcast', icon: <NotificationsIcon />, path: '/broadcast' },
    { text: 'Content', icon: <ContentIcon />, path: '/content-management' },
    { text: 'Audit Logs', icon: <HistoryIcon />, path: '/audit-logs' },
  ];

  // Super admin only menu items
  const adminMenuItems = [
    { text: 'Admin Management', icon: <AdminIcon />, path: '/admin-management' },
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand Header */}
      <Toolbar 
        sx={{ 
          py: 2,
          px: 2.5,
          background: (theme) => theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha('#F97316', 0.15)} 0%, transparent 100%)`
            : `linear-gradient(135deg, ${alpha('#F97316', 0.08)} 0%, transparent 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar 
            sx={{ 
              width: 40, 
              height: 40,
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #D97706 100%)',
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            स
          </Avatar>
          <Box>
            <Typography 
              variant="h6" 
              component="div"
              sx={{ 
                fontWeight: 700,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, #FB923C 0%, #FBBF24 100%)'
                  : 'linear-gradient(135deg, #F97316 0%, #D97706 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Savitara
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Admin Portal
            </Typography>
          </Box>
        </Box>
      </Toolbar>
      
      <Divider sx={{ opacity: 0.6 }} />
      
      {/* Navigation Items */}
      <Box sx={{ flex: 1, py: 2, px: 1 }}>
        <Typography 
          variant="caption" 
          sx={{ 
            px: 2, 
            py: 1, 
            display: 'block',
            color: 'text.secondary',
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Main Menu
        </Typography>
        <List sx={{ py: 0.5 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ py: 0.25 }}>
              <ListItemButton
                selected={router.pathname === item.path}
                onClick={() => router.push(item.path)}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  py: 1.25,
                  '&.Mui-selected': {
                    background: (theme) => theme.palette.mode === 'dark'
                      ? alpha('#F97316', 0.2)
                      : alpha('#F97316', 0.12),
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: '60%',
                      background: 'linear-gradient(180deg, #F97316 0%, #D97706 100%)',
                      borderRadius: '0 3px 3px 0',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ 
                    fontWeight: router.pathname === item.path ? 600 : 500,
                    fontSize: '0.9rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      
      {/* Super Admin Section */}
      {isSuperAdmin && (
        <Box sx={{ px: 1, pb: 2 }}>
          <Divider sx={{ mb: 2, opacity: 0.6 }} />
          <Typography 
            variant="caption" 
            sx={{ 
              px: 2, 
              display: 'block',
              color: 'primary.main',
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Super Admin
          </Typography>
          <List sx={{ py: 0.5 }}>
            {adminMenuItems.map((item) => (
              <ListItem key={item.text} disablePadding sx={{ py: 0.25 }}>
                <ListItemButton
                  selected={router.pathname === item.path}
                  onClick={() => router.push(item.path)}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    py: 1.25,
                    background: (theme) => alpha(theme.palette.primary.main, 0.05),
                    '&.Mui-selected': {
                      background: (theme) => alpha(theme.palette.primary.main, 0.15),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>{item.icon}</ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{ 
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: 'primary.main',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: (theme) => theme.palette.background.header,
          backdropFilter: 'blur(12px)',
          borderBottom: (theme) => `1px solid ${alpha('#FFFFFF', theme.palette.mode === 'dark' ? 0.1 : 0.2)}`,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { sm: 'none' },
              '&:hover': {
                background: alpha('#FFFFFF', 0.1),
              },
            }}
          >
            <MenuIcon />
          </IconButton>
          
          {/* Page Title */}
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            Admin Panel
          </Typography>
          
          {/* User Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box 
              sx={{ 
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 0.75,
                borderRadius: 2,
                background: alpha('#FFFFFF', 0.1),
                backdropFilter: 'blur(4px)',
              }}
            >
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32,
                  background: alpha('#FFFFFF', 0.2),
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {user?.full_name?.charAt(0) || 'A'}
              </Avatar>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500,
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.full_name}
              </Typography>
            </Box>
            
            {/* Theme Toggle */}
            <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton 
                color="inherit" 
                onClick={toggleTheme} 
                sx={{ 
                  ml: 0.5,
                  background: alpha('#FFFFFF', 0.1),
                  '&:hover': {
                    background: alpha('#FFFFFF', 0.2),
                    transform: 'rotate(15deg)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                {isDark ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
            
            {/* Logout */}
            <Tooltip title="Logout">
              <IconButton 
                color="inherit" 
                onClick={logout}
                sx={{ 
                  background: alpha('#FFFFFF', 0.1),
                  '&:hover': {
                    background: alpha('#EF4444', 0.8),
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: (theme) => `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            background: (theme) => theme.palette.background.sidebar,
            backgroundImage: (theme) => theme.palette.mode === 'dark'
              ? `linear-gradient(180deg, ${alpha('#F97316', 0.08)} 0%, transparent 30%)`
              : `linear-gradient(180deg, ${alpha('#F97316', 0.04)} 0%, transparent 30%)`,
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: (theme) => theme.palette.background.sidebar,
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, sm: 3 },
          minHeight: '100vh',
          background: (theme) => theme.palette.background.gradient,
          backgroundAttachment: 'fixed',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }} />
        {children}
      </Box>
    </Box>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};
