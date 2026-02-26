import { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  Pagination,
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Refresh,
  FilterList,
} from '@mui/icons-material';
import { format } from 'date-fns';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  });

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
      };
      
      if (statusFilter) params.status_filter = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await adminAPI.getBookings(params);
      const data = response.data?.data || response.data;
      
      setBookings(data.bookings || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (error) {
      console.error('Failed to load bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, startDate, endDate]);

  const calculateStats = useCallback(() => {
    setStats({
      total: pagination.total,
      pending: bookings.filter(b => b.status === 'pending' || b.status === 'requested').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
    });
  }, [bookings, pagination.total]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking);
    setViewDialog(true);
  };

  const handleApproveBooking = async (bookingId) => {
    try {
      await adminAPI.updateBookingStatus(bookingId, { 
        status: 'confirmed',
        admin_notes: 'Approved by admin' 
      });
      alert('Booking approved successfully');
      loadBookings();
    } catch (error) {
      alert('Failed to approve booking: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRejectBooking = async (bookingId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await adminAPI.updateBookingStatus(bookingId, { 
        status: 'cancelled',
        admin_notes: reason 
      });
      alert('Booking rejected');
      loadBookings();
    } catch (error) {
      alert('Failed to reject booking: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      requested: 'info',
      confirmed: 'success',
      completed: 'primary',
      cancelled: 'error',
      'in-progress': 'info',
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <HourglassEmpty />,
      requested: <HourglassEmpty />,
      confirmed: <CheckCircle />,
      cancelled: <Cancel />,
    };
    return icons[status] || null;
  };

  const formatDateTime = (dateStr, timeStr) => {
    try {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      const formattedDate = format(date, 'MMM dd, yyyy');
      return timeStr ? `${formattedDate} ${timeStr}` : formattedDate;
    } catch {
      return dateStr;
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <Layout>
      <Head>
        <title>Booking Management - Savitara Admin</title>
      </Head>
      
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Booking Management
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={loadBookings} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Bookings
                </Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Pending
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
                <Typography color="textSecondary" gutterBottom>
                  Confirmed
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.confirmed}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Completed
                </Typography>
                <Typography variant="h4" color="primary.main">
                  {stats.completed}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Cancelled
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.cancelled}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status Filter"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="requested">Requested</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                startIcon={<FilterList />}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Bookings Table */}
        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Booking ID</TableCell>
                      <TableCell>Grihasta</TableCell>
                      <TableCell>Acharya</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Date & Time</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bookings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          <Typography variant="body2" color="textSecondary">
                            No bookings found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      bookings.map((booking) => (
                        <TableRow key={booking._id || booking.id}>
                          <TableCell>
                            {(booking._id || booking.id).slice(-8).toUpperCase()}
                          </TableCell>
                          <TableCell>
                            {booking.grihasta?.full_name || booking.grihasta?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {booking.acharya?.full_name || booking.acharya?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {booking.pooja_name || booking.service_name || 'Custom Service'}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(booking.date, booking.time)}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={booking.booking_type || 'N/A'} 
                              size="small" 
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={booking.booking_mode || 'instant'} 
                              size="small" 
                              color={booking.booking_mode === 'request' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={getStatusIcon(booking.status)}
                              label={booking.status}
                              color={getStatusColor(booking.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => handleViewBooking(booking)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            {(booking.status === 'pending' || booking.status === 'requested') && (
                              <>
                                <Tooltip title="Approve">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleApproveBooking(booking._id || booking.id)}
                                  >
                                    <CheckCircle />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRejectBooking(booking._id || booking.id)}
                                  >
                                    <Cancel />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Pagination */}
              {pagination.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <Pagination
                    count={pagination.pages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </Paper>

        {/* View Dialog */}
        <Dialog
          open={viewDialog}
          onClose={() => setViewDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Booking Details</DialogTitle>
          <DialogContent>
            {selectedBooking && (
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Booking ID
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {(selectedBooking._id || selectedBooking.id).slice(-12).toUpperCase()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Status
                    </Typography>
                    <Chip
                      icon={getStatusIcon(selectedBooking.status)}
                      label={selectedBooking.status}
                      color={getStatusColor(selectedBooking.status)}
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Grihasta
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedBooking.grihasta?.full_name || selectedBooking.grihasta?.name || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {selectedBooking.grihasta?.email || ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Acharya
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedBooking.acharya?.full_name || selectedBooking.acharya?.name || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {selectedBooking.acharya?.email || ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Service
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedBooking.pooja_name || selectedBooking.service_name || 'Custom Service'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Date & Time
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {formatDateTime(selectedBooking.date, selectedBooking.time)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Booking Type
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedBooking.booking_type || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Booking Mode
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedBooking.booking_mode || 'instant'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Total Amount
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      ₹{selectedBooking.total_amount || 0}
                    </Typography>
                  </Grid>
                  {selectedBooking.requirements && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Requirements
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {selectedBooking.requirements}
                      </Typography>
                    </Grid>
                  )}
                  {selectedBooking.notes && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Notes
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {selectedBooking.notes}
                      </Typography>
                    </Grid>
                  )}
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Created At
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedBooking.created_at ? format(new Date(selectedBooking.created_at), 'PPpp') : 'N/A'}
                    </Typography>
                  </Grid>
                  {selectedBooking.updated_at && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Updated At
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {format(new Date(selectedBooking.updated_at), 'PPpp')}
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
      </Container>
    </Layout>
  );
}

export default withAuth(Bookings, ['admin']);
