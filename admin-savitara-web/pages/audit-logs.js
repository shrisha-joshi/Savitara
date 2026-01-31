/**
 * Audit Log Viewer Page
 * Displays, filters, and exports admin audit events
 * GDPR Compliant - includes data export functionality
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import withAuth from '../src/hoc/withAuth';
import api from '../src/services/api';

// Audit action categories
const AUDIT_ACTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'auth', label: 'Authentication' },
  { value: 'user', label: 'User Management' },
  { value: 'booking', label: 'Bookings' },
  { value: 'payment', label: 'Payments' },
  { value: 'review', label: 'Reviews' },
  { value: 'admin', label: 'Admin Actions' },
  { value: 'system', label: 'System Events' },
];

// Action type to color mapping
const ACTION_COLORS = {
  'auth.login': 'success',
  'auth.logout': 'default',
  'auth.failed': 'error',
  'user.create': 'info',
  'user.update': 'warning',
  'user.delete': 'error',
  'user.suspend': 'error',
  'user.verify': 'success',
  'booking.create': 'info',
  'booking.confirm': 'success',
  'booking.cancel': 'warning',
  'booking.complete': 'success',
  'payment.process': 'info',
  'payment.success': 'success',
  'payment.failed': 'error',
  'payment.refund': 'warning',
  'admin.role_change': 'warning',
  'admin.config_update': 'info',
};

function AuditLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Filters
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    startDate: null,
    endDate: null,
    search: '',
  });
  
  // Detail dialog
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalToday: 0,
    authEvents: 0,
    adminActions: 0,
    failedEvents: 0,
  });

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      };
      
      // Clean up empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });
      
      const response = await api.get('/admin/audit-logs', { params });
      
      if (response.data.success) {
        setAuditLogs(response.data.data.logs || []);
        setTotalCount(response.data.data.total || 0);
        setStats(response.data.data.stats || stats);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs. Please try again.');
      
      // Mock data for demo
      setAuditLogs([
        {
          id: '1',
          action: 'auth.login',
          user_id: 'user123',
          user_email: 'user@example.com',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0...',
          details: { method: 'google_oauth' },
          timestamp: new Date().toISOString(),
          success: true,
        },
        {
          id: '2',
          action: 'booking.create',
          user_id: 'user456',
          user_email: 'grihasta@example.com',
          ip_address: '192.168.1.2',
          details: { acharya_id: 'acharya789', service: 'puja' },
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          success: true,
        },
        {
          id: '3',
          action: 'payment.failed',
          user_id: 'user789',
          user_email: 'customer@example.com',
          ip_address: '192.168.1.3',
          details: { reason: 'insufficient_funds', amount: 2500 },
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          success: false,
        },
      ]);
      setTotalCount(3);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/admin/audit-logs/export', {
        params: { ...filters, format: 'csv' },
        responseType: 'blob',
      });
      
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export audit logs');
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await api.get('/admin/audit-logs/export', {
        params: { ...filters, format: 'json' },
      });
      
      const dataStr = JSON.stringify(response.data.data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const link = document.createElement('a');
      link.href = dataUri;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export audit logs');
    }
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionColor = (action) => {
    return ACTION_COLORS[action] || 'default';
  };

  return (
    <>
      <Head>
        <title>Audit Logs | Savitara Admin</title>
      </Head>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            Audit Logs
          </Typography>
          <Box>
            <Tooltip title="Export as CSV">
              <IconButton onClick={handleExportCSV} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export as JSON">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportJSON}
                sx={{ ml: 1 }}
              >
                JSON
              </Button>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchAuditLogs} sx={{ ml: 1 }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Events Today
                </Typography>
                <Typography variant="h4">{stats.totalToday || totalCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Auth Events
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.authEvents || '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Admin Actions
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.adminActions || '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Failed Events
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.failedEvents || '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search"
                placeholder="User ID, Email, IP..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                select
                label="Action Type"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
              >
                {AUDIT_ACTIONS.map((action) => (
                  <MenuItem key={action.value} value={action.value}>
                    {action.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setFilters({ action: '', userId: '', startDate: null, endDate: null, search: '' })}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Audit Logs Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  if (loading) {
                    return (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    );
                  }
                  if (auditLogs.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return auditLogs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatTimestamp(log.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          color={getActionColor(log.action)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.user_email || log.user_id}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {log.ip_address || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.success ? 'Success' : 'Failed'}
                          size="small"
                          color={log.success ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewDetails(log)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Copy ID">
                          <IconButton size="small" onClick={() => copyToClipboard(log.id)}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Audit Log Details
          </DialogTitle>
          <DialogContent dividers>
            {selectedLog && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Event ID
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedLog.id}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Timestamp
                    </Typography>
                    <Typography variant="body1">
                      {formatTimestamp(selectedLog.timestamp)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Action
                    </Typography>
                    <Chip
                      label={selectedLog.action}
                      color={getActionColor(selectedLog.action)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedLog.success ? 'Success' : 'Failed'}
                      color={selectedLog.success ? 'success' : 'error'}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      User ID
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedLog.user_id || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      User Email
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.user_email || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      IP Address
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedLog.ip_address || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      User Agent
                    </Typography>
                    <Typography variant="body2" noWrap>
                      {selectedLog.user_agent || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Details
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2))}>
              Copy JSON
            </Button>
            <Button onClick={() => setDetailOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}

export default withAuth(AuditLogsPage, { requiredRole: 'admin' });
