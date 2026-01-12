import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function SearchAcharyas() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Search Acharyas
        </Typography>
        <Typography>Search functionality coming soon...</Typography>
      </Container>
    </Layout>
  )
}
