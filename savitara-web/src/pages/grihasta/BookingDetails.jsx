import { useParams } from 'react-router-dom'
import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function BookingDetails() {
  const { id } = useParams()

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Booking Details
        </Typography>
        <Typography>Booking ID: {id}</Typography>
      </Container>
    </Layout>
  )
}
