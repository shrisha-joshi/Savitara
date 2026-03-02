import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  IconButton,
  Stack,
  Divider,
  Alert,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import {
  Warning,
  Visibility,
  Block,
  CheckCircle,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';
import { format } from 'date-fns';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function FraudAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [stats, setStats] = useState({
    total_alerts: 0,
    pending: 0,
    investigating: 0,
    confirmed_fraud: 0,
    false_positive: 0,
    avg_confidence: 0,
  });

  useEffect(() => {
    fetchAlerts();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidenceFilter, statusFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (confidenceFilter !== 'all') {
        params.min_confidence = Number.parseInt(confidenceFilter, 10);
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      const response = await adminAPI.get('/trust/admin/fraud-alerts', { params });
      setAlerts(response.data);
    } catch (error) {
      console.error('Error loading fraud alerts:', error);
      showSnackbar('Failed to load fraud alerts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await adminAPI.get('/trust/admin/fraud-alerts/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load fraud alert stats:', error);
    }
  };

  const handleViewAlert = async (alertId) => {
    try {
      const response = await adminAPI.get(`/trust/admin/fraud-alerts/${alertId}`);
      setSelectedAlert(response.data);
      setViewDialog(true);
    } catch (error) {
      console.error('Error loading alert details:', error);
      showSnackbar('Failed to load alert details', 'error');
    }
  };

  const handleTakeAction = (alert) => {
    setSelectedAlert(alert);
    setActionDialog(true);
  };

  const submitAction = async (action) => {
    try {
      await adminAPI.post(`/trust/admin/fraud-alerts/${selectedAlert._id}/action`, {
        action,
        notes: `Admin action: ${action}`,
      });
      showSnackbar(`Action "${action}" executed successfully`, 'success');
      setActionDialog(false);
      fetchAlerts();
      fetchStats();
    } catch (error) {
      console.error('Failed to execute fraud alert action:', error);
      showSnackbar(error.response?.data?.message || 'Failed to execute action', 'error');
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 90) return 'error';
    if (confidence >= 70) return 'warning';
    return 'default';
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending: { color: 'warning', label: 'Pending Review' },
      investigating: { color: 'info', label: 'Investigating' },
      confirmed_fraud: { color: 'error', label: 'Confirmed Fraud' },
      false_positive: { color: 'success', label: 'False Positive' },
      resolved: { color: 'default', label: 'Resolved' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const closeSnackbar = () => setSnackbar({ ...snackbar, open: false });

  return (
    <Layout>
      <Head>
        <title>Fraud Alerts - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning /> Fraud Detection & Alerts
        </Typography>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Alerts
                </Typography>
                <Typography variant="h4">{stats.total_alerts}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Pending Review
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.pending}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Investigating
                </Typography>
                <Typography variant="h4" color="info.main">
                  {stats.investigating}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Confirmed Fraud
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.confirmed_fraud}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Avg Confidence
                </Typography>
                <Typography variant="h4">{stats.avg_confidence?.toFixed(1)}%</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                label="Status Filter"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="pending">Pending Review</MenuItem>
                <MenuItem value="investigating">Investigating</MenuItem>
                <MenuItem value="confirmed_fraud">Confirmed Fraud</MenuItem>
                <MenuItem value="false_positive">False Positive</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Confidence Filter</InputLabel>
              <Select
                value={confidenceFilter}
                label="Confidence Filter"
                onChange={(e) => setConfidenceFilter(e.target.value)}
              >
                <MenuItem value="all">All Confidence Levels</MenuItem>
                <MenuItem value="90">≥ 90% (Very High)</MenuItem>
                <MenuItem value="70">≥ 70% (High)</MenuItem>
                <MenuItem value="50">≥ 50% (Medium)</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<Refresh />} onClick={fetchAlerts}>
              Refresh
            </Button>
          </Stack>
        </Paper>

        {/* Alerts Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Alert ID</TableCell>
                <TableCell>Booking ID</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Fraud Confidence</TableCell>
                <TableCell>Signals</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Detected</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {!loading && alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No fraud alerts found
                  </TableCell>
                </TableRow>
              )}
              {!loading && alerts.length > 0 && (
                alerts.map((alert) => (
                  <TableRow key={alert._id}>
                    <TableCell>{alert._id.slice(-8)}</TableCell>
                    <TableCell>{alert.booking_id.slice(-8)}</TableCell>
                    <TableCell>{alert.user_name || 'N/A'}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Chip
                          label={`${alert.fraud_confidence}%`}
                          color={getConfidenceColor(alert.fraud_confidence)}
                          size="small"
                        />
                        <LinearProgress
                          variant="determinate"
                          value={alert.fraud_confidence}
                          color={getConfidenceColor(alert.fraud_confidence)}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${alert.fraud_signals?.length || 0} signals`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{getStatusChip(alert.investigation_status)}</TableCell>
                    <TableCell>
                      {format(new Date(alert.detected_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewAlert(alert._id)}
                        >
                          <Visibility />
                        </IconButton>
                        {alert.investigation_status === 'pending' && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleTakeAction(alert)}
                          >
                            Review
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* View Alert Dialog */}
        <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Fraud Alert Details</DialogTitle>
          <DialogContent>
            {selectedAlert && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Alert ID
                    </Typography>
                    <Typography variant="body1">{selectedAlert._id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Fraud Confidence
                    </Typography>
                    <Chip
                      label={`${selectedAlert.fraud_confidence}%`}
                      color={getConfidenceColor(selectedAlert.fraud_confidence)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Fraud Signals ({selectedAlert.fraud_signals?.length || 0})
                    </Typography>
                    <Stack spacing={1}>
                      {selectedAlert.fraud_signals?.map((signal) => (
                        <Alert key={signal.signal || signal.description} severity="warning" icon={<Warning />}>
                          <strong>{signal.signal}:</strong> {signal.description}
                        </Alert>
                      ))}
                    </Stack>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Evidence
                    </Typography>
                    {selectedAlert.evidence && (
                      <Box>
                        {Object.entries(selectedAlert.evidence).map(([key, value]) => (
                          <Typography key={key} variant="body2">
                            <strong>{key}:</strong> {JSON.stringify(value)}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Recommendation
                    </Typography>
                    <Alert severity={selectedAlert.investigation_recommended ? 'error' : 'info'}>
                      {selectedAlert.investigation_recommended
                        ? 'Manual investigation recommended (confidence ≥ 70%)'
                        : 'Low confidence - may be false positive'}
                    </Alert>
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Action Dialog */}
        <Dialog open={actionDialog} onClose={() => setActionDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Review Fraud Alert</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                Fraud Confidence: <strong>{selectedAlert?.fraud_confidence}%</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Number of Signals: {selectedAlert?.fraud_signals?.length || 0}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                What action would you like to take?
              </Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="info"
                  startIcon={<TrendingUp />}
                  onClick={() => submitAction('investigating')}
                >
                  Start Investigation
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<Block />}
                  onClick={() => submitAction('confirmed_fraud')}
                >
                  Confirm Fraud & Block User
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="success"
                  startIcon={<CheckCircle />}
                  onClick={() => submitAction('false_positive')}
                >
                  Mark as False Positive
                </Button>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActionDialog(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

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

export default withAuth(FraudAlerts, { requireAdmin: true });
