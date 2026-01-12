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
} from '@mui/material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    loadUsers();
  }, [search]);

  const loadUsers = async () => {
    try {
      const response = await adminAPI.searchUsers({ search, limit: 50 });
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    try {
      await adminAPI.suspendUser(selectedUser._id, suspendReason);
      alert('User suspended successfully');
      setSuspendDialog(false);
      loadUsers();
    } catch (error) {
      alert('Failed to suspend user');
    }
  };

  const handleUnsuspend = async (userId) => {
    try {
      await adminAPI.unsuspendUser(userId);
      alert('User unsuspended successfully');
      loadUsers();
    } catch (error) {
      alert('Failed to unsuspend user');
    }
  };

  return (
    <Layout>
      <Head>
        <title>Users - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Typography variant="h4" gutterBottom>
          User Management
        </Typography>

        <TextField
          fullWidth
          label="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 3 }}
        />

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>Loading...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No users found</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip label={user.role} size="small" />
                    </TableCell>
                    <TableCell>{user.phone_number || '-'}</TableCell>
                    <TableCell>{user.location || '-'}</TableCell>
                    <TableCell>
                      {user.is_suspended ? (
                        <Chip label="Suspended" color="error" size="small" />
                      ) : (
                        <Chip label="Active" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {user.is_suspended ? (
                        <Button
                          size="small"
                          onClick={() => handleUnsuspend(user._id)}
                        >
                          Unsuspend
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedUser(user);
                            setSuspendDialog(true);
                          }}
                        >
                          Suspend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={suspendDialog} onClose={() => setSuspendDialog(false)}>
          <DialogTitle>Suspend User</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Reason for suspension"
              fullWidth
              multiline
              rows={4}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSuspendDialog(false)}>Cancel</Button>
            <Button onClick={handleSuspend} color="error">
              Suspend
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}

export default withAuth(Users);
