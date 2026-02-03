/**
 * Admin Coupon Management Page
 * Create, view, edit, and manage coupon codes
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
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
  FormControlLabel,
  Tabs,
  Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BarChartIcon from '@mui/icons-material/BarChart';
import Layout from '../src/components/Layout';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    max_discount: null,
    min_booking_amount: 0,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '2026-12-31',
    usage_limit: null,
    per_user_limit: 1,
    applicable_for: ['all'],
    applicable_services: ['all'],
    first_booking_only: false,
    can_combine_offers: false,
    is_active: true,
    terms_conditions: []
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      // In a real app, this would fetch from API
      // For now, we'll use mock data
      const response = await fetch('/api/v1/coupons', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCoupons(data.coupons || []);
      }
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/v1/admin/coupons/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          valid_from: new Date(formData.valid_from).toISOString(),
          valid_until: new Date(formData.valid_until).toISOString(),
          usage_limit: formData.usage_limit || null
        })
      });

      if (response.ok) {
        alert('Coupon created successfully!');
        setCreateDialog(false);
        fetchCoupons();
        resetForm();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to create coupon'}`);
      }
    } catch (error) {
      console.error('Error creating coupon:', error);
      alert('Failed to create coupon');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      max_discount: null,
      min_booking_amount: 0,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '2026-12-31',
      usage_limit: null,
      per_user_limit: 1,
      applicable_for: ['all'],
      applicable_services: ['all'],
      first_booking_only: false,
      can_combine_offers: false,
      is_active: true,
      terms_conditions: []
    });
  };

  const getFilteredCoupons = () => {
    switch(activeTab) {
      case 0: return coupons.filter(c => c.is_active);
      case 1: return coupons.filter(c => !c.is_active);
      case 2: return coupons.filter(c => c.first_booking_only);
      default: return coupons;
    }
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4">Coupon Management</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialog(true)}
          >
            Create Coupon
          </Button>
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Active Coupons" />
          <Tab label="Inactive" />
          <Tab label="First Booking Only" />
          <Tab label="All Coupons" />
        </Tabs>

        {/* Coupons Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Used Count</TableCell>
                <TableCell>Valid Until</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getFilteredCoupons().map((coupon) => (
                <TableRow key={coupon._id || coupon.code}>
                  <TableCell>
                    <Chip label={coupon.code} color="secondary" />
                  </TableCell>
                  <TableCell>{coupon.name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={coupon.discount_type} 
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {coupon.discount_type === 'percentage' 
                      ? `${coupon.discount_value}%` 
                      : `₹${coupon.discount_value}`}
                    {coupon.max_discount && ` (max ₹${coupon.max_discount})`}
                  </TableCell>
                  <TableCell>
                    {coupon.used_count || 0}
                    {coupon.usage_limit && ` / ${coupon.usage_limit}`}
                  </TableCell>
                  <TableCell>
                    {new Date(coupon.valid_until).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={coupon.is_active ? 'Active' : 'Inactive'}
                      color={coupon.is_active ? 'success' : 'default'}
                      size="small"
                    />
                    {coupon.first_booking_only && (
                      <Chip label="1st Booking" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <BarChartIcon />
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

        {/* Create Coupon Dialog */}
        <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Coupon Code</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Coupon Code"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  placeholder="FIRST50"
                  helperText="Use uppercase letters and numbers"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Coupon Name"
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
                  <InputLabel>Discount Type</InputLabel>
                  <Select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                  >
                    <MenuItem value="percentage">Percentage (%)</MenuItem>
                    <MenuItem value="fixed">Fixed Amount (₹)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={`Discount Value ${formData.discount_type === 'percentage' ? '(%)' : '(₹)'}`}
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({...formData, discount_value: parseFloat(e.target.value)})}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Max Discount (₹)"
                  type="number"
                  value={formData.max_discount || ''}
                  onChange={(e) => setFormData({...formData, max_discount: e.target.value ? parseFloat(e.target.value) : null})}
                  helperText="Leave empty for no limit"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Min Booking Amount (₹)"
                  type="number"
                  value={formData.min_booking_amount}
                  onChange={(e) => setFormData({...formData, min_booking_amount: parseFloat(e.target.value)})}
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
                  label="Total Usage Limit"
                  type="number"
                  value={formData.usage_limit || ''}
                  onChange={(e) => setFormData({...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null})}
                  helperText="Leave empty for unlimited"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Per User Limit"
                  type="number"
                  value={formData.per_user_limit}
                  onChange={(e) => setFormData({...formData, per_user_limit: parseInt(e.target.value)})}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.first_booking_only}
                      onChange={(e) => setFormData({...formData, first_booking_only: e.target.checked})}
                    />
                  }
                  label="First Booking Only"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.can_combine_offers}
                      onChange={(e) => setFormData({...formData, can_combine_offers: e.target.checked})}
                    />
                  }
                  label="Can Combine with Other Offers"
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
              Create Coupon
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default CouponManagement;
