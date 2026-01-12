import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function Settings() {
  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>
        <Typography>Settings panel coming soon...</Typography>
      </Container>
    </Layout>
  )
}
