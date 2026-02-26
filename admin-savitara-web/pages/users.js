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
  Tabs,
  Tab,
  Avatar,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Visibility,
  Block,
  CheckCircle,
  Person,
  Email,
  Phone,
  LocationOn,
  Refresh,
} from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Users() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    acharyas: 0,
    grihastas: 0,
    admins: 0,
    pending: 0,
    active: 0,
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all users
      const response = await adminAPI.searchUsers({ limit: 1000 });
      const data = response.data?.data || response.data;
      const userList = data?.users || data || [];
      setUsers(userList);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterUsers = useCallback(() => {
    let filtered = [...users];

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone?.includes(search) ||
        u.phone_number?.includes(search)
      );
    }

    setFilteredUsers(filtered);
  }, [users, roleFilter, search]);

  const calculateStats = useCallback(() => {
    setStats({
      total: users.length,
      acharyas: users.filter(u => u.role === 'acharya').length,
      grihastas: users.filter(u => u.role === 'grihasta').length,
      admins: users.filter(u => u.role === 'admin').length,
      pending: users.filter(u => u.status === 'pending').length,
      active: users.filter(u => u.status === 'active').length,
    });
  }, [users]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    filterUsers();
    calculateStats();
  }, [filterUsers, calculateStats]);

  const handleViewUser = async (user) => {
    try {
      // Fetch full user details including profile
      const response = await adminAPI.getUserById(user._id || user.id);
      const fullUserData = response.data?.data || response.data;
      setSelectedUser(fullUserData);
      setViewDialog(true);
    } catch (error) {
      console.error('Failed to load user details:', error);
      setSelectedUser(user);
      setViewDialog(true);
    }
  };

  const handleSuspend = async () => {
    try {
      await adminAPI.suspendUser(selectedUser._id || selectedUser.id, suspendReason);
      alert('User suspended successfully');
      setSuspendDialog(false);
      setSuspendReason('');
      loadUsers();
    } catch (error) {
      alert('Failed to suspend user: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleUnsuspend = async (userId) => {
    try {
      await adminAPI.unsuspendUser(userId);
      alert('User unsuspended successfully');
      loadUsers();
    } catch (error) {
      alert('Failed to unsuspend user: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <Layout>
      <Head>
        <title>Users - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} color="primary.main" gutterBottom>
              User Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage all users, verify Acharyas, and monitor activity
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadUsers}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{stats.total}</Typography>
                <Typography variant="body2">Total Users</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{stats.acharyas}</Typography>
                <Typography variant="body2">Acharyas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{stats.grihastas}</Typography>
                <Typography variant="body2">Grihastas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{stats.admins}</Typography>
                <Typography variant="body2">Admins</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ background: 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{stats.pending}</Typography>
                <Typography variant="body2">Pending</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h4" fontWeight={700}>{stats.active}</Typography>
                <Typography variant="body2">Active</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={roleFilter}
            onChange={(e, newValue) => setRoleFilter(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={`All (${users.length})`} value="all" />
            <Tab label={`Acharyas (${stats.acharyas})`} value="acharya" />
            <Tab label={`Grihastas (${stats.grihastas})`} value="grihasta" />
            <Tab label={`Admins (${stats.admins})`} value="admin" />
          </Tabs>
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Paper>

        {/* Users Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No users found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user._id || user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {(user.name || user.full_name || user.email || 'U')[0].toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={500}>
                          {user.name || user.full_name || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role?.toUpperCase()}
                        size="small"
                        color={user.role === 'acharya' ? 'primary' : user.role === 'admin' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{user.phone || user.phone_number || '-'}</TableCell>
                    <TableCell>
                      {user.location?.city || user.city
                        ? `${user.location?.city || user.city}, ${user.location?.state || user.state || ''}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {user.status === 'suspended' || user.is_suspended ? (
                        <Chip label="Suspended" color="error" size="small" />
                      ) : user.status === 'pending' ? (
                        <Chip label="Pending" color="warning" size="small" />
                      ) : (
                        <Chip label="Active" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewUser(user)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      {user.status === 'suspended' || user.is_suspended ? (
                        <Tooltip title="Unsuspend User">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleUnsuspend(user._id || user.id)}
                          >
                            <CheckCircle />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Suspend User">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSelectedUser(user);
                              setSuspendDialog(true);
                            }}
                          >
                            <Block />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* View User Dialog */}
        <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <Person />
              </Avatar>
              <Box>
                <Typography variant="h6">
                  {selectedUser?.name || selectedUser?.full_name || 'User Details'}
                </Typography>
                <Chip
                  label={selectedUser?.role?.toUpperCase()}
                  size="small"
                  color={selectedUser?.role === 'acharya' ? 'primary' : 'default'}
                />
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedUser && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Email color="action" />
                    <Typography variant="body2" color="text.secondary">Email:</Typography>
                  </Box>
                  <Typography variant="body1">{selectedUser.email || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Phone color="action" />
                    <Typography variant="body2" color="text.secondary">Phone:</Typography>
                  </Box>
                  <Typography variant="body1">{selectedUser.phone || selectedUser.phone_number || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LocationOn color="action" />
                    <Typography variant="body2" color="text.secondary">Location:</Typography>
                  </Box>
                  <Typography variant="body1">
                    {selectedUser.location?.city || selectedUser.city
                      ? `${selectedUser.location?.city || selectedUser.city}, ${selectedUser.location?.state || selectedUser.state || ''}, ${selectedUser.location?.country || selectedUser.country || 'India'}`
                      : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Status:</Typography>
                  <Chip
                    label={selectedUser.status?.toUpperCase() || 'UNKNOWN'}
                    color={selectedUser.status === 'active' ? 'success' : selectedUser.status === 'pending' ? 'warning' : 'default'}
                  />
                </Grid>
                {selectedUser.role === 'acharya' && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>Parampara:</Typography>
                      <Typography variant="body1">{selectedUser.parampara || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>Experience:</Typography>
                      <Typography variant="body1">{selectedUser.experience_years || '0'} years</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>Study Place:</Typography>
                      <Typography variant="body1">{selectedUser.study_place || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>Languages:</Typography>
                      <Typography variant="body1">
                        {selectedUser.languages?.join(', ') || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>Specializations:</Typography>
                      <Typography variant="body1">
                        {selectedUser.specializations?.join(', ') || '-'}
                      </Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Created At:</Typography>
                  <Typography variant="body1">
                    {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : '-'}
                  </Typography>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Suspend User Dialog */}
        <Dialog open={suspendDialog} onClose={() => setSuspendDialog(false)}>
          <DialogTitle>Suspend User</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Are you sure you want to suspend this user?
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Reason for suspension"
              fullWidth
              multiline
              rows={4}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSuspendDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSuspend}
              color="error"
              variant="contained"
              disabled={!suspendReason.trim()}
            >
              Suspend
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}

export default withAuth(Users);
