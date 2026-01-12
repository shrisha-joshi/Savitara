import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function Earnings() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Earnings
        </Typography>
        <Typography>No earnings data yet...</Typography>
      </Container>
    </Layout>
  )
}
