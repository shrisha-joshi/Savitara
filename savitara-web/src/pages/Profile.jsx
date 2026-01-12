import { Container, Typography, Paper, Box, Avatar, Button } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

export default function Profile() {
  const { user } = useAuth()

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar src={user?.photo} sx={{ width: 80, height: 80, mr: 2 }} />
            <Box>
              <Typography variant="h4">{user?.name}</Typography>
              <Typography variant="body1" color="text.secondary">
                {user?.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Role: {user?.role}
              </Typography>
            </Box>
          </Box>
          <Button variant="outlined">Edit Profile</Button>
        </Paper>
      </Container>
    </Layout>
  )
}
