import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function Payment() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Payment
        </Typography>
        <Typography>Payment processing coming soon...</Typography>
      </Container>
    </Layout>
  )
}
