import { useParams } from 'react-router-dom'
import { Container, Typography } from '@mui/material'
import Layout from '../../components/Layout'

export default function AcharyaProfile() {
  const { id } = useParams()

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Acharya Profile
        </Typography>
        <Typography>Profile ID: {id}</Typography>
      </Container>
    </Layout>
  )
}
