import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function Reviews() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Reviews
        </Typography>
        <Typography>No reviews yet...</Typography>
      </Container>
    </Layout>
  )
}
