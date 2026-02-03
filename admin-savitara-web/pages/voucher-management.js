/**
 * Admin Voucher Management Page
 * Create, view, edit, and manage vouchers
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Grid,
  Switch,
  FormControlLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Layout from '../src/components/Layout';

const VoucherManagement = () => {
  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'booking_discount',
    discount_type: 'percentage',
    discount_value: 0,
    max_discount: null,
    min_booking_amount: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '2026-12-31',
    total_quantity: 1000,
    per_user_limit: 1,
    applicable_for: ['all'],
    applicable_services: ['all'],
    is_active: true,
    terms_conditions: []
  });

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setVouchersLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/v1/vouchers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVouchers(data.vouchers || []);
      }
    } catch (error) {
      console.error('Failed to fetch vouchers:', error);
    } finally {
      setVouchersLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/v1/admin/vouchers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          valid_from: new Date(formData.valid_from).toISOString(),
          valid_until: new Date(formData.valid_until).toISOString()
        })
      });

      if (response.ok) {
        alert('Voucher created successfully!');
        setCreateDialog(false);
        fetchVouchers();
        resetForm();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to create voucher'}`);
      }
    } catch (error) {
      console.error('Error creating voucher:', error);
      alert('Failed to create voucher');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      category: 'booking_discount',
      discount_type: 'percentage',
      discount_value: 0,
      max_discount: null,
      min_booking_amount: 0,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '2026-12-31',
      total_quantity: 1000,
      per_user_limit: 1,
      applicable_for: ['all'],
      applicable_services: ['all'],
      is_active: true,
      terms_conditions: []
    });
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4">Voucher Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialog(true)}
          >
            Create Voucher
          </Button>
        </Box>

        {/* Vouchers Table */}
        {vouchersLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>Loading vouchers...</Typography>
          </Box>
        ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Used/Total</TableCell>
                <TableCell>Valid Until</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vouchers.map((voucher) => (
                <TableRow key={voucher._id}>
                  <TableCell>
                    <Chip label={voucher.code} color="primary" />
                  </TableCell>
                  <TableCell>{voucher.name}</TableCell>
                  <TableCell>{voucher.discount_type}</TableCell>
                  <TableCell>
                    {voucher.discount_type === 'percentage' 
                      ? `${voucher.discount_value}%` 
                      : `₹${voucher.discount_value}`}
                  </TableCell>
                  <TableCell>
                    <Chip label={voucher.category} size="small" />
                  </TableCell>
                  <TableCell>
                    {voucher.used_quantity}/{voucher.total_quantity}
                  </TableCell>
                  <TableCell>
                    {new Date(voucher.valid_until).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={voucher.is_active ? 'Active' : 'Inactive'}
                      color={voucher.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        )}

        {/* Create Voucher Dialog */}
        <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Voucher</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Voucher Code"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  placeholder="NEXT20"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Voucher Name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <MenuItem value="booking_discount">Booking Discount</MenuItem>
                    <MenuItem value="pooja_items">Pooja Items</MenuItem>
                    <MenuItem value="premium_features">Premium Features</MenuItem>
                    <MenuItem value="profile_boost">Profile Boost</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Discount Type</InputLabel>
                  <Select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                  >
                    <MenuItem value="percentage">Percentage</MenuItem>
                    <MenuItem value="fixed">Fixed Amount</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Discount Value"
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({...formData, discount_value: Number.parseFloat(e.target.value)})}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Discount (₹)"
                  type="number"
                  value={formData.max_discount || ''}
                  onChange={(e) => setFormData({...formData, max_discount: e.target.value ? Number.parseFloat(e.target.value) : null})}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Min Booking Amount"
                  type="number"
                  value={formData.min_booking_amount}
                  onChange={(e) => setFormData({...formData, min_booking_amount: Number.parseFloat(e.target.value)})}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Valid From"
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Valid Until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Total Quantity"
                  type="number"
                  value={formData.total_quantity}
                  onChange={(e) => setFormData({...formData, total_quantity: Number.parseInt(e.target.value, 10)})}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Per User Limit"
                  type="number"
                  value={formData.per_user_limit}
                  onChange={(e) => setFormData({...formData, per_user_limit: Number.parseInt(e.target.value, 10)})}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} variant="contained">
              Create Voucher
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default VoucherManagement;
