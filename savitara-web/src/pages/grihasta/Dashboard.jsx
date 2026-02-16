import { Container, Typography, Grid, Paper } from '@mui/material'
import Layout from '../../components/Layout'
import PanchangaWidget from '../../components/PanchangaWidget'
import { useAuth } from '../../context/AuthContext'

export default function GrihastaDashboard() {
  const { user } = useAuth()

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {user?.name}!
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <PanchangaWidget />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">My Bookings</Typography>
              <Typography variant="h3">0</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">Completed</Typography>
              <Typography variant="h3">0</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">Upcoming</Typography>
              <Typography variant="h3">0</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  )
}
