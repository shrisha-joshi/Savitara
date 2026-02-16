import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Switch,
  FormControlLabel,
  MenuItem
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh
} from '@mui/icons-material';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminServiceManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialogs
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name_english: '',
    name_sanskrit: '',
    description: '',
    category_id: '',
    icon: '',
    muhurta_consultation_price: '',
    full_service_base_price: '',
    custom_acharya_base_price: '',
    included_items: '',
    requirements_from_user: '',
    duration_minutes: '',
    is_active: true
  });

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, [page, rowsPerPage]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/api/v1/services', {
        params: {
          skip: page * rowsPerPage,
          limit: rowsPerPage
        }
      });

      if (response.data.success) {
        setServices(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setError('Failed to load services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/v1/services/categories');
      if (response.data.success) {
        setCategories(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name_english: '',
      name_sanskrit: '',
      description: '',
      category_id: '',
      icon: '',
      muhurta_consultation_price: '',
      full_service_base_price: '',
      custom_acharya_base_price: '',
      included_items: '',
      requirements_from_user: '',
      duration_minutes: '',
      is_active: true
    });
  };

  const renderButtonText = () => {
    if (createDialog) {
        return 'Create';
    }
    return 'Update';
  }

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = {
        ...formData,
        muhurta_consultation_price: Number.parseFloat(formData.muhurta_consultation_price),
        full_service_base_price: Number.parseFloat(formData.full_service_base_price),
        custom_acharya_base_price: Number.parseFloat(formData.custom_acharya_base_price),
        duration_minutes: Number.parseInt(formData.duration_minutes, 10),
        included_items: formData.included_items.split('\n').filter(item => item.trim() !== ''),
        requirements_from_user: formData.requirements_from_user.split('\n').filter(item => item.trim() !== '')
      };

      const response = await api.post('/api/v1/admin/services', payload);

      if (response.data.success) {
        setSuccess('Service created successfully');
        setCreateDialog(false);
        resetForm();
        fetchServices();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = {
        ...formData,
        muhurta_consultation_price: Number.parseFloat(formData.muhurta_consultation_price),
        full_service_base_price: Number.parseFloat(formData.full_service_base_price),
        custom_acharya_base_price: Number.parseFloat(formData.custom_acharya_base_price),
        duration_minutes: Number.parseInt(formData.duration_minutes, 10),
        included_items: formData.included_items.split('\n').filter(item => item.trim() !== ''),
        requirements_from_user: formData.requirements_from_user.split('\n').filter(item => item.trim() !== '')
      };

      const response = await api.put(`/api/v1/admin/services/${selectedService._id}`, payload);

      if (response.data.success) {
        setSuccess('Service updated successfully');
        setEditDialog(false);
        resetForm();
        setSelectedService(null);
        fetchServices();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update service');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.delete(`/api/v1/admin/services/${selectedService._id}`);

      if (response.data.success) {
        setSuccess('Service deleted successfully');
        setDeleteDialog(false);
        setSelectedService(null);
        fetchServices();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete service');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (service) => {
    setSelectedService(service);
    setFormData({
      name_english: service.name_english || '',
      name_sanskrit: service.name_sanskrit || '',
      description: service.description || '',
      category_id: service.category_id || '',
      icon: service.icon || '',
      muhurta_consultation_price: service.muhurta_consultation_price || '',
      full_service_base_price: service.full_service_base_price || '',
      custom_acharya_base_price: service.custom_acharya_base_price || '',
      included_items: service.included_items?.join('\n') || '',
      requirements_from_user: service.requirements_from_user?.join('\n') || '',
      duration_minutes: service.duration_minutes || '',
      is_active: service.is_active !== false
    });
    setEditDialog(true);
  };

  const openDeleteDialog = (service) => {
    setSelectedService(service);
    setDeleteDialog(true);
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

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Service Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage spiritual services catalog
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetForm();
                setCreateDialog(true);
              }}
            >
              Add Service
            </Button>
          </Box>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Services Table */}
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Service Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell align="right">Muhurta Price</TableCell>
                  <TableCell align="right">Full Service</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && services.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                )}
                
                {!loading && services.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No services found
                    </TableCell>
                  </TableRow>
                )}

                {services.map((service) => (
                  <TableRow key={service._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {service.name_english}
                      </Typography>
                      {service.name_sanskrit && (
                        <Typography variant="caption" color="text.secondary">
                          {service.name_sanskrit}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={service.category?.name || 'N/A'} size="small" />
                    </TableCell>
                      <TableCell>{service.duration_minutes} min</TableCell>
                      <TableCell align="right">₹{service.muhurta_consultation_price}</TableCell>
                      <TableCell align="right">₹{service.full_service_base_price}</TableCell>
                      <TableCell>
                        <Chip
                          label={service.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          color={service.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEditDialog(service)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => openDeleteDialog(service)} color="error">
                          <Delete fontSize="small" />
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
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>

        {/* Create/Edit Dialog */}
        <Dialog 
          open={createDialog || editDialog} 
          onClose={() => {
            setCreateDialog(false);
            setEditDialog(false);
            resetForm();
          }} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>{createDialog ? 'Create New Service' : 'Edit Service'}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Service Name (English)"
                    value={formData.name_english}
                    onChange={(e) => handleFormChange('name_english', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Service Name (Sanskrit)"
                    value={formData.name_sanskrit}
                    onChange={(e) => handleFormChange('name_sanskrit', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Category"
                    value={formData.category_id}
                    onChange={(e) => handleFormChange('category_id', e.target.value)}
                    required
                  >
                    {categories.map(cat => (
                      <MenuItem key={cat._id} value={cat._id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Duration (minutes)"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => handleFormChange('duration_minutes', e.target.value)}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Muhurta Price"
                    type="number"
                    value={formData.muhurta_consultation_price}
                    onChange={(e) => handleFormChange('muhurta_consultation_price', e.target.value)}
                    required
                    InputProps={{ startAdornment: '₹' }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Full Service Price"
                    type="number"
                    value={formData.full_service_base_price}
                    onChange={(e) => handleFormChange('full_service_base_price', e.target.value)}
                    required
                    InputProps={{ startAdornment: '₹' }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Custom Acharya Price"
                    type="number"
                    value={formData.custom_acharya_base_price}
                    onChange={(e) => handleFormChange('custom_acharya_base_price', e.target.value)}
                    required
                    InputProps={{ startAdornment: '₹' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Included Items (one per line)"
                    value={formData.included_items}
                    onChange={(e) => handleFormChange('included_items', e.target.value)}
                    placeholder="Item 1&#10;Item 2&#10;Item 3"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Requirements from User (one per line)"
                    value={formData.requirements_from_user}
                    onChange={(e) => handleFormChange('requirements_from_user', e.target.value)}
                    placeholder="Requirement 1&#10;Requirement 2&#10;Requirement 3"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_active}
                        onChange={(e) => handleFormChange('is_active', e.target.checked)}
                      />
                    }
                    label="Active"
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCreateDialog(false);
              setEditDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={createDialog ? handleCreate : handleUpdate}
              disabled={loading || !formData.name_english || !formData.description || !formData.category_id}
            >
              {loading ? (
                <CircularProgress size={20} />
              ) : (
                renderButtonText()
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Service</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "<strong>{selectedService?.name_english}</strong>"?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Delete'}
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
