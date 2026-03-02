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
  TextField,
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
} from '@mui/material';
import {
  Gavel,
  Visibility,
  Refresh,
  AttachFile,
} from '@mui/icons-material';
import { format } from 'date-fns';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function DisputeManagement() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [resolveDialog, setResolveDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refundPercentage, setRefundPercentage] = useState(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [stats, setStats] = useState({
    total: 0,
    mediation: 0,
    arbitration: 0,
    resolved: 0,
    avg_resolution_days: 0,
  });

  useEffect(() => {
    fetchDisputes();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const response = await adminAPI.get('/trust/admin/disputes', { params });
      setDisputes(response.data);
    } catch (error) {
      console.error('Error loading disputes:', error);
      showSnackbar('Failed to load disputes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await adminAPI.get('/trust/admin/disputes/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleViewDispute = async (disputeId) => {
    try {
      const response = await adminAPI.get(`/trust/disputes/${disputeId}`);
      setSelectedDispute(response.data);
      setViewDialog(true);
    } catch (error) {
      console.error('Error loading dispute details:', error);
      showSnackbar('Failed to load dispute details', 'error');
    }
  };

  const handleResolve = (dispute) => {
    setSelectedDispute(dispute);
    setRefundPercentage(0);
    setAdminNotes('');
    setResolveDialog(true);
  };

  const submitResolution = async () => {
    try {
      await adminAPI.post(`/trust/admin/disputes/${selectedDispute._id}/resolve`, {
        resolution: 'arbitration_refund',
        refund_percentage: refundPercentage,
        admin_notes: adminNotes,
      });
      showSnackbar('Dispute resolved successfully', 'success');
      setResolveDialog(false);
      fetchDisputes();
      fetchStats();
    } catch (error) {
      console.error('Error resolving dispute:', error);
      showSnackbar('Failed to resolve dispute', 'error');
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      mediation: { color: 'warning', label: 'Mediation' },
      arbitration: { color: 'error', label: 'Arbitration' },
      resolved: { color: 'success', label: 'Resolved' },
      closed: { color: 'default', label: 'Closed' },
    };
    const config = statusConfig[status] || statusConfig.mediation;
    return <Chip label={config.label} color={config.color} size="small" />;
  };

  const getCategoryChip = (category) => {
    const categoryConfig = {
      service_quality: { color: 'primary', label: 'Service Quality' },
      payment: { color: 'secondary', label: 'Payment' },
      cancellation: { color: 'warning', label: 'Cancellation' },
      harassment: { color: 'error', label: 'Harassment' },
      other: { color: 'default', label: 'Other' },
    };
    const config = categoryConfig[category] || categoryConfig.other;
    return <Chip label={config.label} color={config.color} size="small" variant="outlined" />;
  };

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const closeSnackbar = () => setSnackbar({ ...snackbar, open: false });

  return (
    <Layout>
      <Head>
        <title>Dispute Management - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Gavel /> Dispute Management
        </Typography>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Disputes
                </Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Mediation
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.mediation}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Arbitration
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.arbitration}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Resolved
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.resolved}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Avg Resolution (days)
                </Typography>
                <Typography variant="h4">{stats.avg_resolution_days || 0}</Typography>
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
                <MenuItem value="all">All Disputes</MenuItem>
                <MenuItem value="mediation">Mediation</MenuItem>
                <MenuItem value="arbitration">Arbitration</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchDisputes}
            >
              Refresh
            </Button>
          </Stack>
        </Paper>

        {/* Disputes Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Dispute ID</TableCell>
                <TableCell>Booking ID</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Complainant</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Filed On</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {!loading && disputes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No disputes found
                  </TableCell>
                </TableRow>
              )}
              {!loading && disputes.length > 0 && (
                disputes.map((dispute) => (
                  <TableRow key={dispute._id}>
                    <TableCell>{dispute._id.slice(-8)}</TableCell>
                    <TableCell>{dispute.booking_id.slice(-8)}</TableCell>
                    <TableCell>{getCategoryChip(dispute.category)}</TableCell>
                    <TableCell>{dispute.complainant_name || 'N/A'}</TableCell>
                    <TableCell>{getStatusChip(dispute.status)}</TableCell>
                    <TableCell>
                      {format(new Date(dispute.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewDispute(dispute._id)}
                        >
                          <Visibility />
                        </IconButton>
                        {dispute.status !== 'resolved' && dispute.status !== 'closed' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleResolve(dispute)}
                          >
                            Resolve
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

        {/* View Dispute Dialog */}
        <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Dispute Details</DialogTitle>
          <DialogContent>
            {selectedDispute && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Dispute ID
                    </Typography>
                    <Typography variant="body1">{selectedDispute._id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Status
                    </Typography>
                    {getStatusChip(selectedDispute.status)}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Category
                    </Typography>
                    {getCategoryChip(selectedDispute.category)}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Filed On
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(selectedDispute.created_at), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Description
                    </Typography>
                    <Typography variant="body1">{selectedDispute.description}</Typography>
                  </Grid>
                  {selectedDispute.evidence && selectedDispute.evidence.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Evidence ({selectedDispute.evidence.length} files)
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {selectedDispute.evidence.map((file, idx) => (
                          <Chip
                            key={file}
                            icon={<AttachFile />}
                            label={file.filename || `File ${idx + 1}`}
                            clickable
                            component="a"
                            href={file.url}
                            target="_blank"
                          />
                        ))}
                      </Stack>
                    </Grid>
                  )}
                  {selectedDispute.resolution_details && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Resolution Details
                      </Typography>
                      <Typography variant="body1">
                        {selectedDispute.resolution_details}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Resolve Dispute Dialog */}
        <Dialog
          open={resolveDialog}
          onClose={() => setResolveDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Resolve Dispute</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Refund Percentage (0-100%)
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={refundPercentage}
                onChange={(e) => setRefundPercentage(Math.min(100, Math.max(0, e.target.value)))}
                inputProps={{ min: 0, max: 100 }}
                sx={{ mb: 2 }}
              />
              <Typography variant="subtitle2" gutterBottom>
                Admin Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter resolution notes..."
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResolveDialog(false)}>Cancel</Button>
            <Button variant="contained" color="success" onClick={submitResolution}>
              Resolve & Refund
            </Button>
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

export default withAuth(DisputeManagement, { requireAdmin: true });
