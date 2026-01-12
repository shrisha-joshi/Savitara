import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box,
  CircularProgress, Select, MenuItem, FormControl,
  InputLabel, Button, Chip, Avatar, IconButton, Tooltip
} from '@mui/material';
import {
  TrendingUp, TrendingDown, People, Star,
  AccountBalance, EventAvailable, Refresh, Download
} from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import api from '../src/services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30days');
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAcharyas: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeUsers: 0,
    pendingVerifications: 0,
    averageRating: 0,
    revenueGrowth: 0,
    userGrowth: 0,
    bookingGrowth: 0
  });

  const [revenueData, setRevenueData] = useState([]);
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [bookingStatusData, setBookingStatusData] = useState([]);
  const [topAcharyasData, setTopAcharyasData] = useState([]);
  const [popularServicesData, setPopularServicesData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const [
        statsResponse,
        revenueResponse,
        userGrowthResponse,
        bookingsResponse,
        topAcharyasResponse,
        servicesResponse
      ] = await Promise.all([
        api.get(`/analytics/overview?time_range=${timeRange}`),
        api.get(`/analytics/revenue?time_range=${timeRange}`),
        api.get(`/analytics/user-growth?time_range=${timeRange}`),
        api.get(`/analytics/booking-status?time_range=${timeRange}`),
        api.get(`/analytics/top-acharyas?limit=10`),
        api.get(`/analytics/popular-services?limit=6`)
      ]);

      setStats(statsResponse.data.data);
      setRevenueData(revenueResponse.data.data);
      setUserGrowthData(userGrowthResponse.data.data);
      setBookingStatusData(bookingsResponse.data.data);
      setTopAcharyasData(topAcharyasResponse.data.data);
      setPopularServicesData(servicesResponse.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const exportData = () => {
    const dataToExport = {
      stats,
      revenue: revenueData,
      userGrowth: userGrowthData,
      bookingStatus: bookingStatusData,
      topAcharyas: topAcharyasData,
      popularServices: popularServicesData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ title, value, icon, growth, color }) => (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {growth !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {growth >= 0 ? (
                  <TrendingUp sx={{ color: 'success.main', fontSize: 20, mr: 0.5 }} />
                ) : (
                  <TrendingDown sx={{ color: 'error.main', fontSize: 20, mr: 0.5 }} />
                )}
                <Typography
                  variant="body2"
                  color={growth >= 0 ? 'success.main' : 'error.main'}
                  fontWeight="medium"
                >
                  {Math.abs(growth)}% vs last period
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
          <CircularProgress size={60} />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight="bold">
            Dashboard
          </Typography>
          <Box display="flex" gap={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="7days">Last 7 Days</MenuItem>
                <MenuItem value="30days">Last 30 Days</MenuItem>
                <MenuItem value="90days">Last 90 Days</MenuItem>
                <MenuItem value="1year">Last Year</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh data">
              <IconButton onClick={() => fetchDashboardData()}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={exportData}
            >
              Export
            </Button>
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Revenue"
              value={`₹${(stats.totalRevenue / 1000).toFixed(1)}k`}
              icon={<AccountBalance />}
              growth={stats.revenueGrowth}
              color="primary.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={stats.totalUsers}
              icon={<People />}
              growth={stats.userGrowth}
              color="success.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Bookings"
              value={stats.totalBookings}
              icon={<EventAvailable />}
              growth={stats.bookingGrowth}
              color="warning.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Average Rating"
              value={stats.averageRating.toFixed(1)}
              icon={<Star />}
              color="info.main"
            />
          </Grid>
        </Grid>

        {/* Charts Row 1 */}
        <Grid container spacing={3} mb={3}>
          {/* Revenue Trend */}
          <Grid item xs={12} lg={8}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  Revenue Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                    />
                    <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                    <RechartsTooltip
                      formatter={(value) => [`₹${value}`, 'Revenue']}
                      labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#1976d2"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Booking Status Distribution */}
          <Grid item xs={12} lg={4}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  Booking Status
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={bookingStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {bookingStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Row 2 */}
        <Grid container spacing={3} mb={3}>
          {/* User Growth */}
          <Grid item xs={12} lg={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  User Growth
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(month) => format(new Date(month), 'MMM yyyy')}
                    />
                    <YAxis />
                    <RechartsTooltip
                      labelFormatter={(month) => format(new Date(month), 'MMMM yyyy')}
                    />
                    <Legend />
                    <Bar dataKey="users" fill="#4caf50" name="Users" />
                    <Bar dataKey="acharyas" fill="#ff9800" name="Acharyas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Popular Services */}
          <Grid item xs={12} lg={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  Popular Services
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={popularServicesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="service" type="category" width={100} />
                    <RechartsTooltip />
                    <Bar dataKey="bookings" fill="#9c27b0" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Top Performers */}
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Top Performing Acharyas
            </Typography>
            <Grid container spacing={2}>
              {topAcharyasData.map((acharya, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={acharya.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Chip
                          label={`#${index + 1}`}
                          color="primary"
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Avatar src={acharya.avatar} sx={{ width: 48, height: 48, mr: 2 }}>
                          {acharya.name.charAt(0)}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {acharya.name}
                          </Typography>
                          <Box display="flex" alignItems="center">
                            <Star sx={{ fontSize: 16, color: 'warning.main', mr: 0.5 }} />
                            <Typography variant="body2" color="textSecondary">
                              {acharya.rating.toFixed(1)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          Bookings:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {acharya.bookings}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Revenue:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium" color="success.main">
                          ₹{(acharya.revenue / 1000).toFixed(1)}k
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
};

export default withAuth(Dashboard);
