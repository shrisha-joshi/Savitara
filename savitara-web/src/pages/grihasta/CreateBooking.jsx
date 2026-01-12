import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function CreateBooking() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create Booking
        </Typography>
        <Typography>Booking form coming soon...</Typography>
      </Container>
    </Layout>
  )
}
