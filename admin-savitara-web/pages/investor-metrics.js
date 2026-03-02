import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  Paper,
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Snackbar,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  TrendingUp,
  MonetizationOn,
  People,
  Repeat,
  ShowChart,
  Refresh,
  Download,
} from '@mui/icons-material';
import { format, subDays } from 'date-fns';
import {
  LineChart,
  Line,
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

function InvestorMetrics() {
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [dashboard, setDashboard] = useState(null);
  const [gmvTrends, setGmvTrends] = useState([]);
  const [cacData, setCacData] = useState(null);
  const [ltvData, setLtvData] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchDashboard();
    fetchTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDays]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.get(`/metrics/dashboard?days=${periodDays}`);
      setDashboard(response.data);
      
      // Fetch CAC for the period
      const period_end = new Date().toISOString();
      const period_start = subDays(new Date(), periodDays).toISOString();
      
      const cacResponse = await adminAPI.post('/metrics/cac', {
        period_start,
        period_end,
        marketing_spend: {
          google_ads: 50000,
          facebook: 30000,
          referral: 10000,
          organic: 0,
        },
      });
      setCacData(cacResponse.data);
      
      // Fetch LTV for current month's cohort
      const cohort_month = format(new Date(), 'yyyy-MM');
      const ltvResponse = await adminAPI.get(`/metrics/ltv/${cohort_month}`);
      setLtvData(ltvResponse.data);
      
    } catch (error) {
      console.error('Failed to load investor metrics:', error);
      showSnackbar(error.response?.data?.message || 'Failed to load investor metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const response = await adminAPI.get('/metrics/trends?metric=gmv&months=6');
      setGmvTrends(response.data.trends);
    } catch (error) {
      console.error('Failed to load trends:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const getHealthColor = (indicator) => {
    const colorMap = {
      growing: 'success.main',
      strong: 'success.main',
      stable: 'success.main',
      excellent: 'success.main',
      declining: 'error.main',
      developing: 'warning.main',
      at_risk: 'error.main',
    };
    return colorMap[indicator] || 'text.secondary';
  };

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const closeSnackbar = () => setSnackbar({ ...snackbar, open: false });

  const handleExportReport = () => {
    // Generate CSV report
    const csvData = [
      ['Savitara Investor Metrics Report'],
      ['Period', `Last ${periodDays} days`],
      ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')],
      [],
      ['Key Metrics'],
      ['GMV', dashboard?.gmv?.total || 0],
      ['Platform Revenue', dashboard?.gmv?.platform_revenue || 0],
      ['GMV Growth Rate', `${dashboard?.gmv?.growth_rate || 0}%`],
      [],
      ['Repeat Bookings'],
      ['Repeat Rate', `${dashboard?.repeat_bookings?.repeat_rate || 0}%`],
      ['Total Users', dashboard?.repeat_bookings?.total_users || 0],
      ['Repeat Users', dashboard?.repeat_bookings?.repeat_users || 0],
      [],
      ['Supply Health'],
      ['Total Acharyas', dashboard?.supply_health?.total_acharyas || 0],
      ['Active Acharyas', dashboard?.supply_health?.active_acharyas || 0],
      ['Churn Rate', `${dashboard?.supply_health?.churn_rate || 0}%`],
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `savitara-investor-metrics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <Head>
        <title>Investor Metrics - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChart /> Investor Metrics Dashboard
          </Typography>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={periodDays}
                label="Period"
                onChange={(e) => setPeriodDays(e.target.value)}
              >
                <MenuItem value={7}>Last 7 days</MenuItem>
                <MenuItem value={30}>Last 30 days</MenuItem>
                <MenuItem value={90}>Last 90 days</MenuItem>
                <MenuItem value={180}>Last 6 months</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchDashboard}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleExportReport}
              disabled={!dashboard}
            >
              Export Report
            </Button>
          </Stack>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* GMV Metrics */}
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Gross Merchandise Value (GMV)
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Total GMV
                        </Typography>
                        <Typography variant="h5">
                          {formatCurrency(dashboard?.gmv?.total || 0)}
                        </Typography>
                      </Box>
                      <MonetizationOn color="primary" sx={{ fontSize: 40 }} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Platform Revenue
                        </Typography>
                        <Typography variant="h5">
                          {formatCurrency(dashboard?.gmv?.platform_revenue || 0)}
                        </Typography>
                      </Box>
                      <MonetizationOn color="success" sx={{ fontSize: 40 }} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Growth Rate
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{ color: getHealthColor(dashboard?.health_indicators?.gmv_growth) }}
                        >
                          {formatPercentage(dashboard?.gmv?.growth_rate || 0)}
                        </Typography>
                      </Box>
                      <TrendingUp
                        sx={{
                          fontSize: 40,
                          color: getHealthColor(dashboard?.health_indicators?.gmv_growth),
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Avg Booking Value
                        </Typography>
                        <Typography variant="h5">
                          {formatCurrency(dashboard?.gmv?.avg_booking_value || 0)}
                        </Typography>
                      </Box>
                      <MonetizationOn color="info" sx={{ fontSize: 40 }} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* LTV & CAC Metrics */}
            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Customer Metrics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Lifetime Value (LTV)
                    </Typography>
                    <Typography variant="h4">
                      {ltvData ? formatCurrency(ltvData.summary.ltv) : '-'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Current month cohort
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Customer Acquisition Cost (CAC)
                    </Typography>
                    <Typography variant="h4">
                      {cacData ? formatCurrency(cacData.summary.blended_cac) : '-'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Blended across all channels
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      LTV:CAC Ratio
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{ color: getHealthColor(ltvData?.summary?.status) }}
                    >
                      {ltvData?.summary?.ltv_cac_ratio?.toFixed(2) || '-'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Target: ≥ 3.0 (Excellent)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Repeat Bookings & Churn */}
            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
              Engagement & Retention
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Repeat Booking Rate
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            color: getHealthColor(dashboard?.health_indicators?.pmf_strength),
                          }}
                        >
                          {formatPercentage(dashboard?.repeat_bookings?.repeat_rate || 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Target: ≥ 40% (Strong PMF)
                        </Typography>
                      </Box>
                      <Repeat
                        sx={{
                          fontSize: 40,
                          color: getHealthColor(dashboard?.health_indicators?.pmf_strength),
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Total Users
                        </Typography>
                        <Typography variant="h5">
                          {dashboard?.repeat_bookings?.total_users || 0}
                        </Typography>
                      </Box>
                      <People color="primary" sx={{ fontSize: 40 }} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Acharya Churn Rate
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            color: getHealthColor(dashboard?.health_indicators?.supply_stability),
                          }}
                        >
                          {formatPercentage(dashboard?.supply_health?.churn_rate || 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Target: &lt; 5% (Healthy)
                        </Typography>
                      </Box>
                      <People
                        sx={{
                          fontSize: 40,
                          color: getHealthColor(dashboard?.health_indicators?.supply_stability),
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          Active Acharyas
                        </Typography>
                        <Typography variant="h5">
                          {dashboard?.supply_health?.active_acharyas || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          of {dashboard?.supply_health?.total_acharyas || 0} total
                        </Typography>
                      </Box>
                      <People color="success" sx={{ fontSize: 40 }} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* GMV Trend Chart */}
            <Paper sx={{ p: 3, mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                GMV Trend (Last 6 Months)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gmvTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#1976d2"
                    strokeWidth={2}
                    name="GMV"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            {/* CAC Breakdown Table */}
            {cacData && (
              <Paper sx={{ p: 3, mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Customer Acquisition Cost by Channel
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Channel</TableCell>
                        <TableCell align="right">CAC</TableCell>
                        <TableCell align="right">Users</TableCell>
                        <TableCell align="right">Spend</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(cacData.cac.cac_by_channel || {}).map(([channel, cac]) => (
                        <TableRow key={channel}>
                          <TableCell>{channel.replace('_', ' ').toUpperCase()}</TableCell>
                          <TableCell align="right">{formatCurrency(cac)}</TableCell>
                          <TableCell align="right">-</TableCell>
                          <TableCell align="right">-</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        <TableCell>
                          <strong>Blended CAC</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{formatCurrency(cacData.summary.blended_cac)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{cacData.summary.total_users}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{formatCurrency(cacData.summary.total_spend)}</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {/* Health Indicators Summary */}
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Business Health Indicators
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2" color="text.secondary">
                        GMV Growth
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: getHealthColor(dashboard?.health_indicators?.gmv_growth),
                          textTransform: 'capitalize',
                        }}
                      >
                        {dashboard?.health_indicators?.gmv_growth || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Product-Market Fit
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: getHealthColor(dashboard?.health_indicators?.pmf_strength),
                          textTransform: 'capitalize',
                        }}
                      >
                        {dashboard?.health_indicators?.pmf_strength || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Supply Stability
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: getHealthColor(dashboard?.health_indicators?.supply_stability),
                          textTransform: 'capitalize',
                        }}
                      >
                        {dashboard?.health_indicators?.supply_stability || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2" color="text.secondary">
                        LTV:CAC Ratio
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: getHealthColor(
                            dashboard?.health_indicators?.ltv_cac_ratio >= 3
                              ? 'excellent'
                              : 'developing'
                          ),
                        }}
                      >
                        {dashboard?.health_indicators?.ltv_cac_ratio?.toFixed(2) || '-'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </>
        )}

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={closeSnackbar}>
          <Alert onClose={closeSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
}

export default withAuth(InvestorMetrics, { requireAdmin: true });
