import { Container, Typography, Paper, Box } from '@mui/material'
import Layout from '../components/Layout'

export default function Privacy() {
  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h3" gutterBottom>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last updated: {new Date().toLocaleDateString()}
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              1. Information We Collect
            </Typography>
            <Typography variant="body1" paragraph>
              We collect information you provide directly to us, including your name, email address, 
              phone number, and location when you create an account or use our services.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              2. How We Use Your Information
            </Typography>
            <Typography variant="body1" paragraph>
              We use the information we collect to provide, maintain, and improve our services, 
              to communicate with you, and to facilitate bookings between Grihastas and Acharyas.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              3. Information Sharing
            </Typography>
            <Typography variant="body1" paragraph>
              We share your information with Acharyas when you make a booking, and as required by law. 
              We do not sell your personal information to third parties.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              4. Data Security
            </Typography>
            <Typography variant="body1" paragraph>
              We implement appropriate technical and organizational measures to protect your personal 
              information against unauthorized access, alteration, disclosure, or destruction.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              5. Your Rights
            </Typography>
            <Typography variant="body1" paragraph>
              You have the right to access, update, or delete your personal information at any time. 
              You can do this through your account settings or by contacting us.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              6. Contact Us
            </Typography>
            <Typography variant="body1" paragraph>
              If you have any questions about this Privacy Policy, please contact us at support@savitara.com
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  )
}
