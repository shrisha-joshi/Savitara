import { useState } from 'react'
import { Container, Box, Card, CardContent, Typography, Button, TextField, Divider, ToggleButton, ToggleButtonGroup, CircularProgress, Backdrop, InputAdornment, IconButton } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useTheme } from '../context/ThemeContext'

export default function Login() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth()
  const { colors, isDark } = useTheme()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('grihasta')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [backdropMessage, setBackdropMessage] = useState('')
  const [errors, setErrors] = useState({})

  // Form Validation Logic
  const validateForm = () => {
    let tempErrors = {}
    let isValid = true

    // Email Validation
    if (!email) {
      tempErrors.email = 'Email is required'
      isValid = false
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address'
      isValid = false
    }

    // Password Validation
    if (!password) {
      tempErrors.password = 'Password is required'
      isValid = false
    } else if (mode === 'register') {
      if (password.length < 8) {
        tempErrors.password = 'Password must be at least 8 characters'
        isValid = false
      }
      // Optional: Add regex for special chars if backend requires it
      // else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/.test(password)) {
      //   tempErrors.password = 'Password must include uppercase, lowercase, number, and special char'
      //   isValid = false
      // }
    }

    // Name Validation (Register mode only)
    if (mode === 'register' && !name.trim()) {
      tempErrors.name = 'Full Name is required'
      isValid = false
    }

    setErrors(tempErrors)
    return isValid
  }

  // Handle Firebase Google Sign-In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setBackdropMessage('Connecting to Google...')
    try {
      await loginWithGoogle() // No credential needed - Firebase handles popup
      setBackdropMessage('Login successful! Redirecting...')
      // Small delay to let user see success message before redirect
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('Google login failed:', error)
      // Show the specific error message from Firebase
      toast.error(error.message || 'Google login failed. Please try again.')
    } finally {
      setGoogleLoading(false)
      setBackdropMessage('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Clear previous errors
    setErrors({})
    
    // Validate form before submitting
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password)
      } else {
        await registerWithEmail({ email, password, name, role })
      }
    } catch (error) {
      // Error is already handled and displayed by AuthContext via toast
      console.debug('Auth error handled by context:', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2 }}
          open={googleLoading || loading}
        >
          <CircularProgress color="inherit" />
          <Typography variant="h6">{backdropMessage || 'Please wait...'}</Typography>
        </Backdrop>
        <Card 
          elevation={isDark ? 4 : 2}
          sx={{ 
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 5, md: 6 }, textAlign: 'center' }}>
            {/* Om Symbol */}
            <Typography
              sx={{
                fontFamily: '"Noto Sans Devanagari", serif',
                fontSize: '2rem',
                color: 'var(--saffron-500)',
                mb: -1,
              }}
            >
              ॐ
            </Typography>
            {/* Brand Name in Sanskrit Font */}
            <Typography 
              variant="h3" 
              gutterBottom 
              sx={{
                fontFamily: '"Samarkan", "Times New Roman", serif',
                fontWeight: 400,
                letterSpacing: '3px',
                color: 'var(--saffron-500)',
                textShadow: isDark ? '2px 2px 8px rgba(255,153,51,0.3)' : '2px 2px 4px rgba(0,0,0,0.15)',
              }}
            >
              Savitara
            </Typography>
            <Typography variant="h5" gutterBottom>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {mode === 'login' ? 'Sign in to continue your spiritual journey' : 'Join Savitara to connect with authentic traditions'}
            </Typography>

            {/* Firebase Google Sign-In Button */}
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              startIcon={googleLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
              sx={{ 
                mt: 2, 
                py: 1.5,
                borderColor: '#4285f4',
                color: '#4285f4',
                '&:hover': {
                  borderColor: '#357abd',
                  backgroundColor: 'rgba(66, 133, 244, 0.04)'
                }
              }}
            >
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>

            <Divider sx={{ my: 3 }}>OR</Divider>

            <Box component="form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) setErrors({...errors, name: ''})
                    }}
                    margin="normal"
                    required
                    error={!!errors.name}
                    helperText={errors.name}
                  />
                  <ToggleButtonGroup
                    value={role}
                    exclusive
                    onChange={(e, newRole) => newRole && setRole(newRole)}
                    fullWidth
                    sx={{ mt: 2, mb: 1 }}
                  >
                    <ToggleButton value="grihasta">Grihasta</ToggleButton>
                    <ToggleButton value="acharya">Acharya</ToggleButton>
                  </ToggleButtonGroup>
                </>
              )}
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors({...errors, email: ''})
                }}
                margin="normal"
                required
                error={!!errors.email}
                helperText={errors.email}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors({...errors, password: ''})
                }}
                margin="normal"
                required
                error={!!errors.password}
                helperText={errors.password || (mode === 'register' ? 'Min. 8 characters' : '')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        size="small"
                        sx={{ color: colors.text.secondary }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading && 'Please wait...'}
                {!loading && mode === 'login' && 'Sign In'}
                {!loading && mode !== 'login' && 'Sign Up'}
              </Button>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
              By continuing, you agree to our{' '}
              <Button size="small" onClick={() => navigate('/terms')}>
                Terms of Service
              </Button>{' '}
              and{' '}
              <Button size="small" onClick={() => navigate('/privacy')}>
                Privacy Policy
              </Button>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
