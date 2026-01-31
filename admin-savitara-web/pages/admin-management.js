import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Container, Typography, Box, Paper, Button, TextField, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Alert, Chip, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, Tooltip, InputAdornment
} from '@mui/material';
import { 
  PersonAdd, Delete, Email, AdminPanelSettings, 
  Star, CheckCircle, Warning
} from '@mui/icons-material';
import withAuth from '../src/hoc/withAuth';
import Layout from '../src/components/Layout';
import { useAuth, SUPER_ADMIN_EMAIL } from '../src/context/AuthContext';
import { adminAuthAPI } from '../src/services/api';

function AdminManagement() {
  const { user, isSuperAdmin } = useAuth();
  const router = useRouter();
  
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Add admin dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState({ open: false, admin: null });
  const [deletingAdmin, setDeletingAdmin] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      router.push('/dashboard');
      return;
    }
    fetchAdmins();
  }, [isSuperAdmin, router]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminAuthAPI.listAdmins();
      setAdmins(response.data.admins || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    
    setAddingAdmin(true);
    setError('');
    
    try {
      await adminAuthAPI.addAdmin(newAdminEmail.trim());
      setSuccess(`Admin ${newAdminEmail} added successfully!`);
      setNewAdminEmail('');
      setOpenDialog(false);
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteDialog.admin) return;
    
    setDeletingAdmin(true);
    setError('');
    
    try {
      await adminAuthAPI.removeAdmin(deleteDialog.admin.email);
      setSuccess(`Admin ${deleteDialog.admin.email} removed successfully!`);
      setDeleteDialog({ open: false, admin: null });
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove admin');
    } finally {
      setDeletingAdmin(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Layout>
        <Container>
          <Alert severity="error">
            You do not have permission to access this page.
          </Alert>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              <AdminPanelSettings sx={{ mr: 1, verticalAlign: 'middle' }} />
              Admin Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Manage administrator access for the Savitara Admin Portal
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setOpenDialog(true)}
            sx={{ 
              background: 'linear-gradient(135deg, #E65C00 0%, #FF8533 100%)',
              borderRadius: 3
            }}
          >
            Add Admin
          </Button>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Admins Table */}
        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No admins found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.email} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Email fontSize="small" color="primary" />
                          <Typography variant="body2" fontWeight={500}>
                            {admin.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {admin.is_super_admin ? (
                          <Chip 
                            icon={<Star />} 
                            label="Super Admin" 
                            size="small" 
                            color="primary"
                            sx={{ fontWeight: 600 }}
                          />
                        ) : (
                          <Chip 
                            label="Admin" 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {admin.has_password ? (
                          <Chip 
                            icon={<CheckCircle />} 
                            label="Active" 
                            size="small" 
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip 
                            icon={<Warning />} 
                            label="Pending Setup" 
                            size="small" 
                            color="warning"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {admin.created_at 
                            ? new Date(admin.created_at).toLocaleDateString()
                            : '-'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {!admin.is_super_admin && (
                          <Tooltip title="Remove admin">
                            <IconButton 
                              color="error" 
                              onClick={() => setDeleteDialog({ open: true, admin })}
                            >
                              <Delete />
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
        </Paper>

        {/* Info Box */}
        <Paper sx={{ mt: 3, p: 3, bgcolor: 'primary.light', color: 'white', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            ℹ️ Admin Access Information
          </Typography>
          <Typography variant="body2">
            • <strong>Super Admin</strong> ({SUPER_ADMIN_EMAIL}) has full control over admin management<br/>
            • Newly added admins must set their password on first login<br/>
            • Admins can access the portal at <strong>/login</strong><br/>
            • Removed admins immediately lose access
          </Typography>
        </Paper>
      </Container>

      {/* Add Admin Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Admin</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the email address of the person you want to add as an admin.
            They will need to set their password on first login.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Admin Email"
            type="email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email color="primary" />
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddAdmin}
            disabled={addingAdmin || !newAdminEmail.trim()}
          >
            {addingAdmin ? <CircularProgress size={20} /> : 'Add Admin'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, admin: null })}>
        <DialogTitle>Remove Admin?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{deleteDialog.admin?.email}</strong> as an admin?
            They will immediately lose access to the admin portal.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, admin: null })}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleDeleteAdmin}
            disabled={deletingAdmin}
          >
            {deletingAdmin ? <CircularProgress size={20} /> : 'Remove Admin'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

export default withAuth(AdminManagement);
