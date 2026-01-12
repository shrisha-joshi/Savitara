import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function SubmitReview() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Submit Review
        </Typography>
        <Typography>Review form coming soon...</Typography>
      </Container>
    </Layout>
  )
}
