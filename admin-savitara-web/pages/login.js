import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Container, Paper, Typography, Button, Box, CircularProgress, Alert, 
  TextField, Backdrop, Stepper, Step, StepLabel, InputAdornment, IconButton,
  Divider
} from '@mui/material';
import { 
  AdminPanelSettings, Email, Lock, Visibility, VisibilityOff, 
  CheckCircle, ArrowForward
} from '@mui/icons-material';
import { useAuth, SUPER_ADMIN_EMAIL } from '../src/context/AuthContext';

export default function Login() {
  const { login, checkEmail, setupPassword, initSuperAdmin } = useAuth();
  const router = useRouter();
  
  // State
  const [step, setStep] = useState(0); // 0: email, 1: password/setup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Email check result
  const [emailStatus, setEmailStatus] = useState(null);
  
  // Initialize super admin on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initSuperAdmin();
        console.log('Super admin initialized successfully');
      } catch (err) {
        console.log('Super admin init:', err.response?.data?.message || err.message || 'Already exists');
      }
    };
    init();
  }, [initSuperAdmin]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const status = await checkEmail(email);
      setEmailStatus(status);
      
      if (!status.is_admin) {
        setError('This email is not registered as an admin. Contact the super admin.');
        return;
      }
      
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to check email');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (emailStatus?.has_password) {
        // Regular login
        await login(email, password);
        router.push('/dashboard');
      } else {
        // First-time password setup
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        
        await setupPassword(email, password, confirmPassword);
        setSuccess('Password set successfully! Logging you in...');
        
        // Auto login after setup
        setTimeout(async () => {
          await login(email, password);
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(0);
    setPassword('');
    setConfirmPassword('');
    setError('');
    setEmailStatus(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #0C0A09 0%, #1C1917 50%, #0C0A09 100%)'
          : 'linear-gradient(135deg, #FAFAF9 0%, #FFF8F0 50%, #FEF3C7 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: (theme) => theme.palette.mode === 'dark'
            ? `radial-gradient(circle at 30% 20%, rgba(249, 115, 22, 0.15) 0%, transparent 50%),
               radial-gradient(circle at 70% 80%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)`
            : `radial-gradient(circle at 30% 20%, rgba(249, 115, 22, 0.08) 0%, transparent 50%),
               radial-gradient(circle at 70% 80%, rgba(251, 191, 36, 0.08) 0%, transparent 50%)`,
          animation: 'pulse 15s ease-in-out infinite',
        },
        '@keyframes pulse': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '50%': { transform: 'scale(1.1) rotate(5deg)' },
        },
      }}
    >
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1, 
          flexDirection: 'column', 
          gap: 2,
          backdropFilter: 'blur(8px)',
          background: 'rgba(0,0,0,0.5)',
        }}
        open={loading}
      >
        <CircularProgress sx={{ color: '#F97316' }} size={48} />
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          {emailStatus?.has_password ? 'Signing in...' : 'Setting up...'}
        </Typography>
      </Backdrop>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 5 },
            textAlign: 'center',
            borderRadius: 4,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(28, 25, 23, 0.8)'
              : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 60px rgba(249, 115, 22, 0.1)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 60px rgba(249, 115, 22, 0.08)',
          }}
        >
          {/* Header */}
          <Box 
            sx={{ 
              mb: 3,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #D97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 30px rgba(249, 115, 22, 0.35)',
              }}
            >
              <AdminPanelSettings sx={{ fontSize: 44, color: '#FFFFFF' }} />
            </Box>
          </Box>
          
          <Typography 
            variant="h4" 
            gutterBottom 
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #F97316 0%, #D97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            🕉 Savitara Admin
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontWeight: 400 }}>
            {step === 0 
              ? 'Enter your admin email to continue' 
              : emailStatus?.has_password 
                ? 'Enter your password to sign in'
                : 'Set up your password for first-time access'
            }
          </Typography>

          {/* Stepper */}
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            <Step>
              <StepLabel>Email</StepLabel>
            </Step>
            <Step>
              <StepLabel>{emailStatus?.has_password ? 'Sign In' : 'Setup Password'}</StepLabel>
            </Step>
          </Stepper>

          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} icon={<CheckCircle />}>
              {success}
            </Alert>
          )}

          {/* Step 0: Email Input */}
          {step === 0 && (
            <form onSubmit={handleEmailSubmit}>
              <TextField
                fullWidth
                label="Admin Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="primary" />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || !email}
                endIcon={<ArrowForward />}
                sx={{ 
                  py: 1.5, 
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #E65C00 0%, #FF8533 100%)',
                }}
              >
                Continue
              </Button>
            </form>
          )}

          {/* Step 1: Password Input */}
          {step === 1 && (
            <form onSubmit={handlePasswordSubmit}>
              {/* Show email */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 1, 
                mb: 3,
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 2
              }}>
                <Email color="primary" fontSize="small" />
                <Typography variant="body2" fontWeight={500}>{email}</Typography>
                {emailStatus?.is_super_admin && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      bgcolor: 'primary.main', 
                      color: 'white', 
                      px: 1, 
                      py: 0.25, 
                      borderRadius: 1,
                      fontWeight: 600
                    }}
                  >
                    Super Admin
                  </Typography>
                )}
              </Box>

              <TextField
                fullWidth
                label={emailStatus?.has_password ? 'Password' : 'Create Password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="primary" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Confirm password for first-time setup */}
              {!emailStatus?.has_password && (
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Password must be at least 8 characters"
                />
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || !password || (!emailStatus?.has_password && !confirmPassword)}
                sx={{ 
                  py: 1.5, 
                  mb: 2,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #E65C00 0%, #FF8533 100%)',
                }}
              >
                {emailStatus?.has_password ? 'Sign In' : 'Set Password & Sign In'}
              </Button>

              <Button
                variant="text"
                onClick={handleBack}
                sx={{ color: 'text.secondary' }}
              >
                ← Use different email
              </Button>
            </form>
          )}

          <Divider sx={{ my: 3 }} />
          
          <Typography variant="caption" color="text.secondary">
            Only authorized administrators can access this portal.
            <br />
            Contact <strong>{SUPER_ADMIN_EMAIL}</strong> for access.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
