import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  useTheme,
  alpha,
  ButtonGroup,
  Button
} from '@mui/material';
import {
  People,
  AccountBalance,
  EventAvailable,
  Star,
  VerifiedUser,
  Assessment,
  Refresh,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const TIME_RANGES = [
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: '90 Days', value: '90days' },
  { label: '1 Year', value: '1year' }
];

const COLORS = ['#FF6B35', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30days');
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [overview, setOverview] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [bookingStatus, setBookingStatus] = useState([]);
  const [topAcharyas, setTopAcharyas] = useState([]);
  const [popularServices, setPopularServices] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');

      const [overviewRes, revenueRes, userGrowthRes, bookingStatusRes, acharyasRes, servicesRes] = await Promise.all([
        api.get('/analytics/overview', { params: { time_range: timeRange } }),
        api.get('/analytics/revenue-trends', { params: { time_range: timeRange } }),
        api.get('/analytics/user-growth', { params: { time_range: timeRange } }),
        api.get('/analytics/booking-status', { params: { time_range: timeRange } }),
        api.get('/analytics/top-acharyas', { params: { limit: 10 } }),
        api.get('/analytics/popular-services', { params: { limit: 10 } })
      ]);

      if (overviewRes.data.success) setOverview(overviewRes.data.data);
      if (revenueRes.data.success) setRevenueTrends(revenueRes.data.data);
      if (userGrowthRes.data.success) setUserGrowth(userGrowthRes.data.data);
      if (bookingStatusRes.data.success) setBookingStatus(bookingStatusRes.data.data);
      if (acharyasRes.data.success) setTopAcharyas(acharyasRes.data.data);
      if (servicesRes.data.success) setPopularServices(servicesRes.data.data);

    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-IN').format(value);
  };

  const renderGrowthIndicator = (growth) => {
    if (!growth) return null;
    const isPositive = growth >= 0;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {isPositive ? (
          <ArrowUpward sx={{ fontSize: 16, color: 'success.main' }} />
        ) : (
          <ArrowDownward sx={{ fontSize: 16, color: 'error.main' }} />
        )}
        <Typography
          variant="body2"
          fontWeight={600}
          color={isPositive ? 'success.main' : 'error.main'}
        >
          {Math.abs(growth).toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  if (user?.role !== 'admin') {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Alert severity="error">
            Access Denied. This page is only accessible to administrators.
          </Alert>
        </Container>
      </Layout>
    );
  }

  if (loading && !overview) {
    return (
      <Layout>
        <Container maxWidth="xl" sx={{ py: 8 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={60} />
          </Box>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Analytics Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Platform performance and insights
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ButtonGroup variant="outlined" size="small">
              {TIME_RANGES.map((range) => (
                <Button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  variant={timeRange === range.value ? 'contained' : 'outlined'}
                >
                  {range.label}
                </Button>
              ))}
            </ButtonGroup>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Key Metrics Cards */}
        {overview && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Total Revenue */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: `linear-gradient(135deg, ${alpha('#FF6B35', 0.9)} 0%, ${alpha('#FF8C42', 0.9)} 100%)`,
                  color: '#fff',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 24px ${alpha('#FF6B35', 0.3)}`
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AccountBalance sx={{ fontSize: 40, mr: 1.5 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Total Revenue
                    </Typography>
                  </Box>
                  <Typography variant="h3" fontWeight={800} gutterBottom>
                    {formatCurrency(overview.totalRevenue || 0)}
                  </Typography>
                  {renderGrowthIndicator(overview.revenueGrowth)}
                </CardContent>
              </Card>
            </Grid>

            {/* Total Users */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: `linear-gradient(135deg, ${alpha('#4ECDC4', 0.9)} 0%, ${alpha('#44A08D', 0.9)} 100%)`,
                  color: '#fff',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 24px ${alpha('#4ECDC4', 0.3)}`
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <People sx={{ fontSize: 40, mr: 1.5 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Total Users
                    </Typography>
                  </Box>
                  <Typography variant="h3" fontWeight={800} gutterBottom>
                    {formatNumber(overview.totalUsers || 0)}
                  </Typography>
                  {renderGrowthIndicator(overview.userGrowth)}
                </CardContent>
              </Card>
            </Grid>

            {/* Total Bookings */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: `linear-gradient(135deg, ${alpha('#667EEA', 0.9)} 0%, ${alpha('#764BA2', 0.9)} 100%)`,
                  color: '#fff',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 24px ${alpha('#667EEA', 0.3)}`
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <EventAvailable sx={{ fontSize: 40, mr: 1.5 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Total Bookings
                    </Typography>
                  </Box>
                  <Typography variant="h3" fontWeight={800} gutterBottom>
                    {formatNumber(overview.totalBookings || 0)}
                  </Typography>
                  {renderGrowthIndicator(overview.bookingGrowth)}
                </CardContent>
              </Card>
            </Grid>

            {/* Average Rating */}
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  background: `linear-gradient(135deg, ${alpha('#F7DC6F', 0.9)} 0%, ${alpha('#F39C12', 0.9)} 100%)`,
                  color: '#000',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 24px ${alpha('#F7DC6F', 0.3)}`
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Star sx={{ fontSize: 40, mr: 1.5 }} />
                    <Typography variant="h6" fontWeight={700}>
                      Avg Rating
                    </Typography>
                  </Box>
                  <Typography variant="h3" fontWeight={800} gutterBottom>
                    {(overview.averageRating || 0).toFixed(1)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Out of 5.0
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Additional Metrics */}
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <People sx={{ fontSize: 32, mr: 1.5, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Active Users
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  {formatNumber(overview.activeUsers || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Users with recent activity
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Assessment sx={{ fontSize: 32, mr: 1.5, color: 'secondary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Acharyas
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight={700} color="secondary.main">
                  {formatNumber(overview.totalAcharyas || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Total registered acharyas
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <VerifiedUser sx={{ fontSize: 32, mr: 1.5, color: 'warning.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Pending Verifications
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight={700} color="warning.main">
                  {formatNumber(overview.pendingVerifications || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Awaiting admin approval
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Revenue Trends Chart */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Revenue Trends
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Daily revenue and booking counts over the selected period
          </Typography>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={revenueTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
              <XAxis
                dataKey="date"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                  borderRadius: 8
                }}
                formatter={(value, name) => {
                  if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                  return [value, 'Bookings'];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#FF6B35"
                strokeWidth={3}
                dot={{ fill: '#FF6B35', r: 4 }}
                activeDot={{ r: 6 }}
                name="Revenue"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bookings"
                stroke="#4ECDC4"
                strokeWidth={3}
                dot={{ fill: '#4ECDC4', r: 4 }}
                activeDot={{ r: 6 }}
                name="Bookings"
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* User Growth Chart */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                User Growth
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Monthly growth of users and acharyas
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: alpha(theme.palette.background.paper, 0.95),
                      border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                      borderRadius: 8
                    }}
                  />
                  <Legend />
                  <Bar dataKey="users" fill="#4ECDC4" name="Grihastas" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="acharyas" fill="#667EEA" name="Acharyas" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Booking Status Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Booking Status
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Distribution of booking statuses
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={bookingStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {bookingStatus.map((entry, index) => (
                      <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: alpha(theme.palette.background.paper, 0.95),
                      border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                      borderRadius: 8
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* Popular Services Chart */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Popular Services
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Most booked pooja services with revenue
          </Typography>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={popularServices} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
              <XAxis type="number" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
              <YAxis
                dataKey="service"
                type="category"
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                  borderRadius: 8
                }}
                formatter={(value, name) => {
                  if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                  return [value, 'Bookings'];
                }}
              />
              <Legend />
              <Bar dataKey="bookings" fill="#FF6B35" name="Bookings" radius={[0, 8, 8, 0]} />
              <Bar dataKey="revenue" fill="#4ECDC4" name="Revenue" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>

        {/* Top Performing Acharyas */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Top Performing Acharyas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Ranked by total revenue generated
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Acharya</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell align="right">Bookings</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topAcharyas.map((acharya, index) => (
                  <TableRow key={acharya.id} hover>
                    <TableCell>
                      <Chip
                        label={`#${index + 1}`}
                        size="small"
                        color={index === 0 ? 'primary' : index === 1 ? 'secondary' : 'default'}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          src={acharya.avatar}
                          alt={acharya.name}
                          sx={{
                            width: 40,
                            height: 40,
                            border: index < 3 ? `2px solid ${COLORS[index]}` : 'none'
                          }}
                        >
                          {acharya.name?.charAt(0) || 'A'}
                        </Avatar>
                        <Typography variant="body1" fontWeight={600}>
                          {acharya.name || 'Unknown Acharya'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Star sx={{ fontSize: 18, color: '#F7DC6F' }} />
                        <Typography variant="body2" fontWeight={600}>
                          {(acharya.rating || 0).toFixed(1)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatNumber(acharya.bookings || 0)}
                        size="small"
                        sx={{ bgcolor: alpha('#4ECDC4', 0.2), color: '#4ECDC4', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" fontWeight={700} color="primary.main">
                        {formatCurrency(acharya.revenue || 0)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* CSS Animation for Refresh Icon */}
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </Container>
    </Layout>
  );
}
