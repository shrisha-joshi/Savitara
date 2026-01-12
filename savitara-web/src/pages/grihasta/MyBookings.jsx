import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function MyBookings() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Bookings
        </Typography>
        <Typography>No bookings yet...</Typography>
      </Container>
    </Layout>
  )
}
