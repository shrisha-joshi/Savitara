import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function Conversations() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Conversations
        </Typography>
        <Typography>No conversations yet...</Typography>
      </Container>
    </Layout>
  )
}
