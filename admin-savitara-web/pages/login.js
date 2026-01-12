import { useRouter } from 'next/router';
import { Container, Paper, Typography, Button } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuth } from '../src/context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    // In production, integrate Google Sign-In SDK
    alert('Google Sign-In integration pending. For demo, please use backend API.');
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Savitara Admin
        </Typography>
        <Typography variant="body1" gutterBottom sx={{ mb: 4 }}>
          Sign in with your admin account
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleLogin}
          fullWidth
        >
          Sign in with Google
        </Button>
      </Paper>
    </Container>
  );
}
