import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Container, Grid, Paper, Typography, Card, CardContent } from '@mui/material';
import {
  People as PeopleIcon,
  Person as PersonIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Dashboard() {
  const [stats, setStats] = useState({
    total_users: 0,
    total_grihastas: 0,
    total_acharyas: 0,
    verified_acharyas: 0,
    total_bookings: 0,
    completed_bookings: 0,
    total_revenue: 0,
    pending_verifications: 0,
    pending_reviews: 0,
  });
  const [userGrowth, setUserGrowth] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const dashboardRes = await adminAPI.getDashboard();
      
      // Extract data from StandardResponse format
      const data = dashboardRes.data?.data || dashboardRes.data;
      
      setStats({
        total_users: data?.overview?.total_users || 0,
        total_grihastas: data?.overview?.total_grihastas || 0,
        total_acharyas: data?.overview?.total_acharyas || 0,
        verified_acharyas: data?.overview?.active_acharyas || 0,
        total_bookings: data?.overview?.total_bookings || 0,
        completed_bookings: data?.overview?.completed_bookings || 0,
        total_revenue: data?.revenue?.total_revenue || 0,
        pending_verifications: data?.overview?.pending_verifications || 0,
        pending_reviews: data?.overview?.pending_reviews || 0,
      });
      
      // Set user growth from the analytics data
      setUserGrowth(data?.user_growth || []);
      setRevenueData(data?.revenue_trend || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <Card>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <div style={{ color, fontSize: 40 }}>{icon}</div>
          </Grid>
          <Grid item xs>
            <Typography variant="h4">{value}</Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <Typography>Loading...</Typography>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Dashboard - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={stats.total_users}
              icon={<PeopleIcon />}
              color="#1976d2"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Grihastas"
              value={stats.total_grihastas}
              icon={<PersonIcon />}
              color="#2e7d32"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Acharyas"
              value={stats.total_acharyas}
              icon={<PersonIcon />}
              color="#ed6c02"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Verified Acharyas"
              value={stats.verified_acharyas}
              icon={<PersonIcon />}
              color="#9c27b0"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Bookings"
              value={stats.total_bookings}
              icon={<EventIcon />}
              color="#0288d1"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Completed"
              value={stats.completed_bookings}
              icon={<EventIcon />}
              color="#388e3c"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Revenue"
              value={`₹${stats.total_revenue}`}
              icon={<MoneyIcon />}
              color="#d32f2f"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Pending Reviews"
              value={stats.pending_reviews}
              icon={<PeopleIcon />}
              color="#f57c00"
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                User Growth
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="users" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Revenue Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#FF6B35" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
}

export default withAuth(Dashboard);
