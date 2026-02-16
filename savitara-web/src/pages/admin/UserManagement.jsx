import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Avatar,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  alpha
} from '@mui/material';
import {
  MoreVert,
  CheckCircle,
  Cancel,
  Block,
  Visibility,
  Search,
  People,
  VerifiedUser,
  PersonOff,
  Pending,
  Refresh
} from '@mui/icons-material';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const USER_STATUSES = ['all', 'active', 'pending', 'suspended', 'rejected'];
const USER_ROLES = ['all', 'grihasta', 'acharya', 'admin'];

export default function AdminUserManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Data
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Dialogs
  const [viewDialog, setViewDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionReason, setActionReason] = useState('');

  // Menu
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [statusFilter, roleFilter, searchQuery, page, rowsPerPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        skip: page * rowsPerPage,
        limit: rowsPerPage
      };

      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/admin/users', { params });

      if (response.data.success) {
        setUsers(response.data.data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/dashboard/analytics');
      if (response.data.success) {
        setStats(response.data.data.overview);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
    fetchStats();
  };

  const handleMenuOpen = (event, user) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewUser = () => {
    setViewDialog(true);
    handleMenuClose();
  };

  const handleApproveUser = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      const response = await api.post(`/admin/users/${selectedUser._id}/approve`, {
        verification_notes: actionReason || 'Approved by admin'
      });

      if (response.data.success) {
        setSuccess('User approved successfully');
        setActionDialog(false);
        setActionReason('');
        fetchUsers();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to approve user');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectUser = async () => {
    if (!selectedUser || !actionReason) {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/admin/users/${selectedUser._id}/reject`, {
        rejection_reason: actionReason
      });

      if (response.data.success) {
        setSuccess('User rejected successfully');
        setActionDialog(false);
        setActionReason('');
        fetchUsers();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to reject user');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser || !actionReason) {
      setError('Please provide a reason for suspension');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/admin/users/${selectedUser._id}/suspend`, {
        suspension_reason: actionReason
      });

      if (response.data.success) {
        setSuccess('User suspended successfully');
        setActionDialog(false);
        setActionReason('');
        fetchUsers();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to suspend user');
    } finally {
      setLoading(false);
    }
  };

  const openActionDialog = (type) => {
    setActionType(type);
    setActionDialog(true);
    handleMenuClose();
  };

  const executeAction = () => {
    switch(actionType) {
      case 'approve':
        handleApproveUser();
        break;
      case 'reject':
        handleRejectUser();
        break;
      case 'suspend':
        handleSuspendUser();
        break;
      default:
        break;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      case 'rejected': return 'default';
      default: return 'default';
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'acharya': return 'secondary';
      case 'grihasta': return 'primary';
      case 'admin': return 'error';
      default: return 'default';
    }
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

  if (loading && !users.length) {
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
              User Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage users, verify Acharyas, and moderate accounts
            </Typography>
          </Box>
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Stats Cards */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: alpha('#4ECDC4', 0.1), border: '1px solid', borderColor: alpha('#4ECDC4', 0.3) }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <People sx={{ fontSize: 40, color: '#4ECDC4' }} />
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.total_users || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Users</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: alpha('#667EEA', 0.1), border: '1px solid', borderColor: alpha('#667EEA', 0.3) }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <VerifiedUser sx={{ fontSize: 40, color: '#667EEA' }} />
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.active_acharyas || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Active Acharyas</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: alpha('#F7DC6F', 0.1), border: '1px solid', borderColor: alpha('#F7DC6F', 0.3) }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Pending sx={{ fontSize: 40, color: '#F39C12' }} />
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.pending_verifications || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Pending Verifications</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: alpha('#E74C3C', 0.1), border: '1px solid', borderColor: alpha('#E74C3C', 0.3) }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PersonOff sx={{ fontSize: 40, color: '#E74C3C' }} />
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.total_grihastas || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">Grihastas</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {USER_STATUSES.map(status => (
                  <MenuItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                {USER_ROLES.map(role => (
                  <MenuItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Paper>

        {/* Users Table */}
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((userItem) => (
                  <TableRow key={userItem._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={userItem.profile_image}>{userItem.full_name?.charAt(0) || 'U'}</Avatar>
                        <Typography variant="body2" fontWeight={600}>
                          {userItem.full_name || 'Unnamed User'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{userItem.email || 'N/A'}</TableCell>
                    <TableCell>{userItem.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={userItem.role} 
                        size="small" 
                        color={getRoleColor(userItem.role)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={userItem.status} 
                        size="small" 
                        color={getStatusColor(userItem.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(userItem.created_at).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuOpen(e, userItem)}>
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={-1}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>

        {/* Action Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleViewUser}>
            <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
            View Details
          </MenuItem>
          {selectedUser?.status === 'pending' && selectedUser?.role === 'acharya' && (
            <MenuItem onClick={() => openActionDialog('approve')}>
              <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
              Approve
            </MenuItem>
          )}
          {selectedUser?.status === 'pending' && (
            <MenuItem onClick={() => openActionDialog('reject')}>
              <ListItemIcon><Cancel fontSize="small" color="error" /></ListItemIcon>
              Reject
            </MenuItem>
          )}
          {selectedUser?.status === 'active' && (
            <MenuItem onClick={() => openActionDialog('suspend')}>
              <ListItemIcon><Block fontSize="small" color="warning" /></ListItemIcon>
              Suspend
            </MenuItem>
          )}
        </Menu>

        {/* View User Dialog */}
        <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>User Details</DialogTitle>
          <DialogContent>
            {selectedUser && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Full Name</Typography>
                    <Typography variant="body1" fontWeight={600}>{selectedUser.full_name || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Email</Typography>
                    <Typography variant="body1" fontWeight={600}>{selectedUser.email || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Phone</Typography>
                    <Typography variant="body1" fontWeight={600}>{selectedUser.phone || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Role</Typography>
                    <Typography variant="body1" fontWeight={600}>{selectedUser.role}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Chip label={selectedUser.status} color={getStatusColor(selectedUser.status)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Joined</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {new Date(selectedUser.created_at).toLocaleDateString('en-IN')}
                    </Typography>
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
          <DialogTitle>
            {actionType === 'approve' && 'Approve User'}
            {actionType === 'reject' && 'Reject User'}
            {actionType === 'suspend' && 'Suspend User'}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              rows={4}
              label={actionType === 'approve' ? 'Notes (Optional)' : 'Reason (Required)'}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              required={actionType !== 'approve'}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActionDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={executeAction}
              disabled={loading || (actionType !== 'approve' && !actionReason)}
              color={actionType === 'approve' ? 'success' : 'error'}
            >
              {loading ? <CircularProgress size={20} /> : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* CSS Animation */}
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
