import { Container, Typography, Paper, Box } from '@mui/material'
import Layout from '../components/Layout'

export default function Terms() {
  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h3" gutterBottom>
            Terms of Service
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last updated: {new Date().toLocaleDateString()}
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body1" paragraph>
              By accessing and using Savitara, you accept and agree to be bound by the terms and 
              provision of this agreement.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              2. Use of Service
            </Typography>
            <Typography variant="body1" paragraph>
              Savitara provides a platform to connect Grihastas (service seekers) with Acharyas 
              (service providers) for Hindu religious ceremonies and rituals. You agree to use 
              the service only for lawful purposes.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              3. User Accounts
            </Typography>
            <Typography variant="body1" paragraph>
              You are responsible for maintaining the confidentiality of your account credentials 
              and for all activities that occur under your account.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              4. Bookings and Payments
            </Typography>
            <Typography variant="body1" paragraph>
              All bookings made through Savitara are subject to availability and confirmation. 
              Payment terms and cancellation policies will be clearly displayed before booking.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              5. User Conduct
            </Typography>
            <Typography variant="body1" paragraph>
              You agree not to use the service to transmit any unlawful, harassing, defamatory, 
              abusive, threatening, or harmful content. Respect and professionalism are expected 
              from all users.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              6. Service Providers (Acharyas)
            </Typography>
            <Typography variant="body1" paragraph>
              Acharyas are independent service providers. Savitara acts as a platform facilitator 
              and is not responsible for the quality or outcome of services provided.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              7. Limitation of Liability
            </Typography>
            <Typography variant="body1" paragraph>
              Savitara shall not be liable for any indirect, incidental, special, consequential, 
              or punitive damages resulting from your use of or inability to use the service.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              8. Modifications to Terms
            </Typography>
            <Typography variant="body1" paragraph>
              We reserve the right to modify these terms at any time. Continued use of the service 
              after changes constitutes acceptance of the modified terms.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              9. Contact Information
            </Typography>
            <Typography variant="body1" paragraph>
              For questions about these Terms of Service, please contact us at support@savitara.com
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  )
}
