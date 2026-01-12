import { useState } from 'react'
import { Container, Box, Card, CardContent, Typography, Button, TextField, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

export default function Login() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('grihasta')
  const [loading, setLoading] = useState(false)

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      await loginWithGoogle(credentialResponse.credential)
    } catch (error) {
      console.error('Google login failed:', error)
    }
  }

  const handleGoogleError = () => {
    toast.error('Google login failed. Please try again.')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password)
      } else {
        await registerWithEmail({ email, password, name, role })
      }
    } catch (error) {
      // Error handled in context
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
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h3" gutterBottom fontWeight={700} color="primary">
              🕉 Savitara
            </Typography>
            <Typography variant="h5" gutterBottom>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {mode === 'login' ? 'Sign in to continue your spiritual journey' : 'Join Savitara to connect with authentic traditions'}
            </Typography>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              {mode === 'register' && (
                <>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    margin="normal"
                    required
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
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />
              
              <Button
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }}>OR</Divider>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
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
