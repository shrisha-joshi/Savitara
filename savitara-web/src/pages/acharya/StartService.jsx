import { useParams } from 'react-router-dom'
import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function StartService() {
  const { bookingId } = useParams()

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Start Service
        </Typography>
        <Typography>Service ID: {bookingId}</Typography>
      </Container>
    </Layout>
  )
}
