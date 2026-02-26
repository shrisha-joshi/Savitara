import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Grid, Card, CardContent, Typography, Box,
  CircularProgress, Select, MenuItem, FormControl,
  InputLabel, Button, Chip, Avatar, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, LinearProgress, Tab, Tabs, alpha, useTheme
} from '@mui/material';
import {
  TrendingUp, TrendingDown, People, Star, Refresh, Download,
  AccountBalance, EventAvailable, LocationOn, AccessTime,
  ShowChart, Payment, Psychology
} from '@mui/icons-material';
import {
  BarChart, Bar, PieChart, Pie,
  AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import api from '../src/services/api';

// Modern Saffron-based color palette
const CHART_COLORS = ['#F97316', '#FB923C', '#FBBF24', '#22C55E', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6'];
const SAFFRON = '#F97316';
const GOLD = '#FBBF24';
const AMBER = '#D97706';
const PURPLE = '#8B5CF6';

/**
 * Helper function to determine chip color based on value thresholds
 */
const getChipColorByThreshold = (value, highThreshold, mediumThreshold) => {
  if (value > highThreshold) return 'success';
  if (value > mediumThreshold) return 'warning';
  return 'error';
};

/**
 * Helper function to get rank chip color
 */
const getRankChipColor = (index) => {
  if (index === 0) return 'warning';
  if (index < 3) return 'primary';
  return 'default';
};

/**
 * Modern Stat card component with glassmorphism effect
 */
const StatCard = ({ title, value, icon, growth, color, subtitle }) => (
  <Card 
    elevation={0} 
    sx={{ 
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      background: (theme) => theme.palette.mode === 'dark' 
        ? 'rgba(28, 25, 23, 0.6)'
        : 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: (theme) => theme.palette.mode === 'dark'
          ? `0 20px 40px -10px ${alpha(SAFFRON, 0.2)}`
          : `0 20px 40px -10px ${alpha(SAFFRON, 0.15)}`,
      },
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: `linear-gradient(90deg, ${color || SAFFRON} 0%, ${GOLD} 100%)`,
      },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <Typography 
            color="textSecondary" 
            gutterBottom 
            variant="body2"
            sx={{ 
              fontWeight: 500, 
              letterSpacing: '0.025em',
              textTransform: 'uppercase',
              fontSize: '0.7rem',
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h3" 
            component="div" 
            sx={{ 
              fontWeight: 700,
              background: (theme) => theme.palette.mode === 'dark'
                ? `linear-gradient(135deg, #FAFAF9 0%, #A8A29E 100%)`
                : `linear-gradient(135deg, #1C1917 0%, #57534E 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary" mt={0.5} sx={{ fontSize: '0.8rem' }}>
              {subtitle}
            </Typography>
          )}
          {growth !== undefined && (
            <Box 
              display="flex" 
              alignItems="center" 
              mt={1.5}
              sx={(theme) => {
                const isPositive = growth >= 0;
                const alphaOpacity = theme.palette.mode === 'dark' ? 0.15 : 0.1;
                const avatarBg = isPositive
                  ? alpha('#22C55E', alphaOpacity)
                  : alpha('#EF4444', alphaOpacity);
                return {
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  display: 'inline-flex',
                  background: avatarBg
                };
              }}
            >
              {growth >= 0 ? (
                <TrendingUp sx={{ color: '#22C55E', fontSize: 18, mr: 0.5 }} />
              ) : (
                <TrendingDown sx={{ color: '#EF4444', fontSize: 18, mr: 0.5 }} />
              )}
              <Typography
                variant="body2"
                sx={{ 
                  color: growth >= 0 ? '#22C55E' : '#EF4444',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}
              >
                {Math.abs(growth)}% vs last period
              </Typography>
            </Box>
          )}
        </Box>
        <Avatar 
          sx={{ 
            width: 60, 
            height: 60,
            background: `linear-gradient(135deg, ${color || SAFFRON} 0%, ${AMBER} 100%)`,
            boxShadow: `0 8px 20px ${alpha(color || SAFFRON, 0.35)}`,
          }}
        >
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node.isRequired,
  growth: PropTypes.number,
  color: PropTypes.string,
  subtitle: PropTypes.string
};

StatCard.defaultProps = {
  growth: undefined,
  color: SAFFRON,
  subtitle: undefined
};

/**
 * Tab panel component for tabbed content
 */
const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 24 }}>
    {value === index && children}
  </div>
);

TabPanel.propTypes = {
  children: PropTypes.node.isRequired,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired
};

const Dashboard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30days');
  const [activeTab, setActiveTab] = useState(0);
  
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
  const [geographicData, setGeographicData] = useState([]);
  const [hourlyActivityData, setHourlyActivityData] = useState([]);
  const [conversionFunnelData, setConversionFunnelData] = useState([]);
  const [paymentMethodsData, setPaymentMethodsData] = useState([]);
  const [retentionData, setRetentionData] = useState([]);
  const [acharyaPerformanceData, setAcharyaPerformanceData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchDashboardData, timeRange]);

  const fetchDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const [
        statsResponse,
        revenueResponse,
        userGrowthResponse,
        bookingsResponse,
        topAcharyasResponse,
        servicesResponse,
        geoResponse,
        hourlyResponse,
        funnelResponse,
        paymentResponse,
        retentionResponse,
        performanceResponse
      ] = await Promise.all([
        api.get(`/analytics/overview?time_range=${timeRange}`),
        api.get(`/analytics/revenue?time_range=${timeRange}`),
        api.get(`/analytics/user-growth?time_range=${timeRange}`),
        api.get(`/analytics/booking-status?time_range=${timeRange}`),
        api.get(`/analytics/top-acharyas?limit=10`),
        api.get(`/analytics/popular-services?limit=6`),
        api.get(`/analytics/geographic?group_by=city`),
        api.get(`/analytics/hourly-activity?time_range=${timeRange}`),
        api.get(`/analytics/conversion-funnel?time_range=${timeRange}`),
        api.get(`/analytics/payment-methods?time_range=${timeRange}`),
        api.get(`/analytics/retention`),
        api.get(`/analytics/acharya-performance`)
      ]);

      console.log('Analytics Overview Response:', statsResponse.data);
      console.log('Stats Data:', statsResponse.data.data);
      setError(null);
      setStats(statsResponse.data.data);
      setRevenueData(revenueResponse.data.data);
      setUserGrowthData(userGrowthResponse.data.data);
      setBookingStatusData(bookingsResponse.data.data);
      setTopAcharyasData(topAcharyasResponse.data.data);
      setPopularServicesData(servicesResponse.data.data);
      setGeographicData(geoResponse.data.data);
      setHourlyActivityData(hourlyResponse.data.data);
      setConversionFunnelData(funnelResponse.data.data);
      setPaymentMethodsData(paymentResponse.data.data);
      setRetentionData(retentionResponse.data.data);
      setAcharyaPerformanceData(performanceResponse.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [timeRange]);

  const exportData = () => {
    const dataToExport = {
      stats,
      revenue: revenueData,
      userGrowth: userGrowthData,
      bookingStatus: bookingStatusData,
      topAcharyas: topAcharyasData,
      popularServices: popularServicesData,
      geographic: geographicData,
      hourlyActivity: hourlyActivityData,
      conversionFunnel: conversionFunnelData,
      paymentMethods: paymentMethodsData,
      retention: retentionData,
      acharyaPerformance: acharyaPerformanceData,
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
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
          <CircularProgress size={60} sx={{ color: SAFFRON }} />
        </Box>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh" flexDirection="column" gap={2}>
          <Typography color="error" variant="h6">{error}</Typography>
          <Button variant="contained" onClick={() => fetchDashboardData()} sx={{ bgcolor: SAFFRON }}>
            Retry
          </Button>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" color={PURPLE}>
              Analytics Dashboard
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Real-time insights for Savitara platform
            </Typography>
          </Box>
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
              sx={{ bgcolor: SAFFRON, '&:hover': { bgcolor: '#E56000' } }}
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
              color={SAFFRON}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={stats.totalUsers}
              icon={<People />}
              growth={stats.userGrowth}
              color={theme.palette.success.main}
              subtitle={`${stats.activeUsers} active`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Bookings"
              value={stats.totalBookings}
              icon={<EventAvailable />}
              growth={stats.bookingGrowth}
              color={theme.palette.warning.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Average Rating"
              value={stats.averageRating.toFixed(1)}
              icon={<Star />}
              color={GOLD}
              subtitle={`${stats.totalAcharyas} acharyas`}
            />
          </Grid>
        </Grid>

        {/* Navigation Tabs */}
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab icon={<ShowChart />} label="Overview" iconPosition="start" />
          <Tab icon={<People />} label="Users" iconPosition="start" />
          <Tab icon={<Psychology />} label="Acharyas" iconPosition="start" />
          <Tab icon={<Payment />} label="Payments" iconPosition="start" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
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
                        <stop offset="5%" stopColor={SAFFRON} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={SAFFRON} stopOpacity={0} />
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
                      stroke={SAFFRON}
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
                      {bookingStatusData.map((entry) => (
                        <Cell key={`booking-status-${entry.name}`} fill={CHART_COLORS[bookingStatusData.indexOf(entry) % CHART_COLORS.length]} />
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
                    <Bar dataKey="acharyas" fill={SAFFRON} name="Acharyas" />
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
                    <Bar dataKey="bookings" fill={PURPLE} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        </TabPanel>

        {/* Users Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            {/* Geographic Distribution */}
            <Grid item xs={12} lg={6}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Geographic Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={geographicData.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="location" type="category" width={100} />
                      <RechartsTooltip formatter={(value) => [value, 'Users']} />
                      <Bar dataKey="users" fill={PURPLE}>
                        {geographicData.slice(0, 10).map((entry) => (
                          <Cell key={`geo-${entry.location}`} fill={CHART_COLORS[geographicData.indexOf(entry) % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Conversion Funnel */}
            <Grid item xs={12} lg={6}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Conversion Funnel
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    {conversionFunnelData.map((stage, index) => (
                      <Box key={stage.stage} sx={{ mb: 3 }}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body1" fontWeight="medium">
                            {stage.stage}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {stage.users} users ({stage.rate}%)
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={stage.rate} 
                          sx={{ 
                            height: 20, 
                            borderRadius: 2,
                            bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: CHART_COLORS[index % CHART_COLORS.length]
                            }
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Retention Cohorts */}
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    User Retention by Cohort
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Cohort</strong></TableCell>
                          <TableCell align="right"><strong>Total Users</strong></TableCell>
                          <TableCell align="right"><strong>Active</strong></TableCell>
                          <TableCell align="right"><strong>Retention Rate</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {retentionData.map((cohort) => (
                          <TableRow key={cohort.cohort}>
                            <TableCell>
                              {cohort.cohort ? format(new Date(cohort.cohort + '-01'), 'MMM yyyy') : 'N/A'}
                            </TableCell>
                            <TableCell align="right">{cohort.totalUsers}</TableCell>
                            <TableCell align="right">{cohort.activeUsers}</TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={`${cohort.retentionRate}%`}
                                size="small"
                                color={getChipColorByThreshold(cohort.retentionRate, 50, 25)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Acharyas Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
        {/* Top Performers */}
        <Grid item xs={12}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Top Performing Acharyas
            </Typography>
            <Grid container spacing={2}>
              {topAcharyasData.map((acharya, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={acharya.id}>
                  <Card variant="outlined" sx={{ 
                    borderColor: index < 3 ? GOLD : 'divider',
                    borderWidth: index < 3 ? 2 : 1
                  }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Chip
                          label={`#${index + 1}`}
                          color={getRankChipColor(index)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Avatar src={acharya.avatar} sx={{ width: 48, height: 48, mr: 2 }}>
                          {acharya.name?.charAt(0)}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {acharya.name}
                          </Typography>
                          <Box display="flex" alignItems="center">
                            <Star sx={{ fontSize: 16, color: GOLD, mr: 0.5 }} />
                            <Typography variant="body2" color="textSecondary">
                              {acharya.rating?.toFixed(1) || 'N/A'}
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
                          ₹{((acharya.revenue || 0) / 1000).toFixed(1)}k
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Acharya Performance Metrics
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Acharya ID</strong></TableCell>
                      <TableCell align="right"><strong>Total Bookings</strong></TableCell>
                      <TableCell align="right"><strong>Completed</strong></TableCell>
                      <TableCell align="right"><strong>Cancelled</strong></TableCell>
                      <TableCell align="right"><strong>Completion Rate</strong></TableCell>
                      <TableCell align="right"><strong>Revenue</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {acharyaPerformanceData.slice(0, 10).map((perf) => (
                      <TableRow key={perf.acharyaId}>
                        <TableCell>{perf.acharyaId?.substring(0, 8)}...</TableCell>
                        <TableCell align="right">{perf.totalBookings}</TableCell>
                        <TableCell align="right">{perf.completed}</TableCell>
                        <TableCell align="right">{perf.cancelled}</TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            <LinearProgress 
                              variant="determinate" 
                              value={perf.completionRate}
                              sx={{ width: 60, mr: 1, height: 8, borderRadius: 4 }}
                              color={getChipColorByThreshold(perf.completionRate, 80, 50)}
                            />
                            {perf.completionRate}%
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          ₹{(perf.totalRevenue / 1000).toFixed(1)}k
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
          </Grid>
        </TabPanel>

        {/* Payments Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            {/* Payment Methods */}
            <Grid item xs={12} lg={6}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Payment Method Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="transactions"
                        label={({ method, percent }) => `${method}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {paymentMethodsData.map((entry) => (
                          <Cell key={`payment-${entry.method}`} fill={CHART_COLORS[paymentMethodsData.indexOf(entry) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value, _name, tooltipProps) => {
                          const payload = tooltipProps?.payload || {};
                          const amount = payload.amount || 0;
                          const method = payload.method || 'Unknown';
                          return [
                            `${value} transactions (₹${(amount / 1000).toFixed(1)}k)`,
                            method
                          ];
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Hourly Activity */}
            <Grid item xs={12} lg={6}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    <AccessTime sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Hourly Booking Activity
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" interval={3} />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value) => [value, 'Bookings']}
                        labelFormatter={(label) => `Time: ${label}`}
                      />
                      <Bar dataKey="bookings" fill={GOLD}>
                        {hourlyActivityData.map((entry) => (
                          <Cell 
                            key={`hourly-${entry.label}`} 
                            fill={entry.bookings > 5 ? SAFFRON : GOLD} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Payment Methods Table */}
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Payment Methods Breakdown
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Payment Method</strong></TableCell>
                          <TableCell align="right"><strong>Transactions</strong></TableCell>
                          <TableCell align="right"><strong>Total Amount</strong></TableCell>
                          <TableCell align="right"><strong>Avg. Transaction</strong></TableCell>
                          <TableCell align="right"><strong>Share</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paymentMethodsData.map((method, index) => {
                          const totalTxns = paymentMethodsData.reduce((sum, m) => sum + m.transactions, 0);
                          const share = totalTxns > 0 ? ((method.transactions / totalTxns) * 100).toFixed(1) : 0;
                          const avgTxn = method.transactions > 0 ? method.amount / method.transactions : 0;
                          
                          return (
                            <TableRow key={method.method}>
                              <TableCell>
                                <Box display="flex" alignItems="center">
                                  <Box 
                                    sx={{ 
                                      width: 12, 
                                      height: 12, 
                                      borderRadius: '50%', 
                                      bgcolor: CHART_COLORS[index % CHART_COLORS.length],
                                      mr: 1 
                                    }} 
                                  />
                                  {method.method}
                                </Box>
                              </TableCell>
                              <TableCell align="right">{method.transactions}</TableCell>
                              <TableCell align="right">₹{(method.amount / 1000).toFixed(1)}k</TableCell>
                              <TableCell align="right">₹{avgTxn.toFixed(0)}</TableCell>
                              <TableCell align="right">{share}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Layout>
  );
};

export default withAuth(Dashboard);
