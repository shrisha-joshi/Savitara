import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Refresh,
  ToggleOn,
} from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

const DEFAULT_FORM = {
  key: '',
  enabled: true,
  variant: 'on',
  rollout_percentage: 100,
  is_active: true,
  description: '',
  tenants: '',
  regions: '',
  languages: '',
  roles: '',
  cities: '',
};

const splitCsv = (value) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const joinCsv = (items) => (Array.isArray(items) ? items.join(', ') : '');

function FeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const sortedFlags = useMemo(
    () => [...flags].sort((a, b) => `${a.key}`.localeCompare(`${b.key}`)),
    [flags]
  );

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.listFeatureFlags();
      setFlags(response.data?.data?.flags || []);
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      setSnackbar({ open: true, message: 'Failed to load feature flags', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const openCreateDialog = () => {
    setEditingFlag(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (flag) => {
    setEditingFlag(flag);
    setForm({
      key: flag.key || '',
      enabled: Boolean(flag.enabled),
      variant: flag.variant || 'on',
      rollout_percentage: Number(flag.rollout_percentage ?? 100),
      is_active: Boolean(flag.is_active ?? true),
      description: flag.description || '',
      tenants: joinCsv(flag.cohorts?.tenants),
      regions: joinCsv(flag.cohorts?.regions),
      languages: joinCsv(flag.cohorts?.languages),
      roles: joinCsv(flag.cohorts?.roles),
      cities: joinCsv(flag.cohorts?.cities),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFlag(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    try {
      await adminAPI.saveFeatureFlag(form.key, {
        enabled: form.enabled,
        variant: form.variant,
        rollout_percentage: Number(form.rollout_percentage),
        is_active: form.is_active,
        description: form.description || null,
        cohorts: {
          tenants: splitCsv(form.tenants),
          regions: splitCsv(form.regions),
          languages: splitCsv(form.languages),
          roles: splitCsv(form.roles),
          cities: splitCsv(form.cities),
        },
      });
      setSnackbar({ open: true, message: 'Feature flag saved', severity: 'success' });
      closeDialog();
      fetchFlags();
    } catch (error) {
      console.error('Failed to save feature flag:', error);
      setSnackbar({ open: true, message: 'Failed to save feature flag', severity: 'error' });
    }
  };

  const handleDelete = async (flag) => {
    if (!globalThis.confirm(`Delete feature flag "${flag.key}"?`)) {
      return;
    }

    try {
      await adminAPI.deleteFeatureFlag(flag.key);
      setSnackbar({ open: true, message: 'Feature flag deleted', severity: 'success' });
      fetchFlags();
    } catch (error) {
      console.error('Failed to delete feature flag:', error);
      setSnackbar({ open: true, message: 'Failed to delete feature flag', severity: 'error' });
    }
  };

  return (
    <Layout>
      <Head>
        <title>Feature Flags - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">Feature Flags</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Control rollouts, cohort targeting, and operational toggles without redeploying the platform.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<Refresh />} onClick={fetchFlags} disabled={loading}>Refresh</Button>
            <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>Add Flag</Button>
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell>Rollout</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Cohorts</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedFlags.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No feature flags created yet
                  </TableCell>
                </TableRow>
              )}
              {sortedFlags.map((flag) => (
                <TableRow key={flag.key} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{flag.key}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{flag.description || 'No description set'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={flag.variant || 'on'} variant="outlined" />
                  </TableCell>
                  <TableCell>{flag.rollout_percentage ?? 100}%</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" color={flag.enabled ? 'success' : 'default'} label={flag.enabled ? 'Enabled' : 'Disabled'} />
                      <Chip size="small" color={flag.is_active ? 'primary' : 'default'} variant="outlined" label={flag.is_active ? 'Active' : 'Inactive'} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {[
                        flag.cohorts?.roles?.length ? `roles: ${flag.cohorts.roles.join(', ')}` : null,
                        flag.cohorts?.cities?.length ? `cities: ${flag.cohorts.cities.join(', ')}` : null,
                        flag.cohorts?.regions?.length ? `regions: ${flag.cohorts.regions.join(', ')}` : null,
                        flag.cohorts?.languages?.length ? `languages: ${flag.cohorts.languages.join(', ')}` : null,
                        flag.cohorts?.tenants?.length ? `tenants: ${flag.cohorts.tenants.join(', ')}` : null,
                      ].filter(Boolean).join(' • ') || 'All users'}
                    </Typography>
                  </TableCell>
                  <TableCell>{flag.updated_at ? new Date(flag.updated_at).toLocaleString() : '—'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Edit />} onClick={() => openEditDialog(flag)}>Edit</Button>
                    <Button size="small" color="error" startIcon={<Delete />} onClick={() => handleDelete(flag)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleOn fontSize="small" />
            {editingFlag ? `Edit ${editingFlag.key}` : 'Add Feature Flag'}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              label="Flag Key"
              value={form.key}
              disabled={Boolean(editingFlag)}
              onChange={(event) => setForm((current) => ({
                ...current,
                key: event.target.value.trim().toLowerCase().split(/\s+/).join('_'),
              }))}
              helperText="Use snake_case keys such as booking_sla_banner"
            />
            <TextField
              fullWidth
              margin="normal"
              label="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 2, mt: 1 }}>
              <TextField
                select
                label="Variant"
                value={form.variant}
                onChange={(event) => setForm((current) => ({ ...current, variant: event.target.value }))}
              >
                <MenuItem value="on">on</MenuItem>
                <MenuItem value="off">off</MenuItem>
                <MenuItem value="control">control</MenuItem>
                <MenuItem value="experiment_a">experiment_a</MenuItem>
                <MenuItem value="experiment_b">experiment_b</MenuItem>
              </TextField>
              <TextField
                type="number"
                label="Rollout %"
                value={form.rollout_percentage}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  rollout_percentage: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                }))}
                inputProps={{ min: 0, max: 100 }}
              />
              <TextField
                select
                label="Enabled"
                value={form.enabled ? 'enabled' : 'disabled'}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === 'enabled' }))}
              >
                <MenuItem value="enabled">Enabled</MenuItem>
                <MenuItem value="disabled">Disabled</MenuItem>
              </TextField>
              <TextField
                select
                label="Lifecycle"
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'active' }))}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Leave cohort fields empty to target all eligible users. Add comma-separated values to scope by cohort.
            </Alert>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Roles"
                value={form.roles}
                onChange={(event) => setForm((current) => ({ ...current, roles: event.target.value }))}
                helperText="Example: grihasta, acharya"
              />
              <TextField
                fullWidth
                margin="normal"
                label="Cities"
                value={form.cities}
                onChange={(event) => setForm((current) => ({ ...current, cities: event.target.value }))}
                helperText="Example: Mumbai, Bengaluru"
              />
              <TextField
                fullWidth
                margin="normal"
                label="Regions"
                value={form.regions}
                onChange={(event) => setForm((current) => ({ ...current, regions: event.target.value }))}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Languages"
                value={form.languages}
                onChange={(event) => setForm((current) => ({ ...current, languages: event.target.value }))}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Tenants"
                value={form.tenants}
                onChange={(event) => setForm((current) => ({ ...current, tenants: event.target.value }))}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={!form.key}>Save</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((current) => ({ ...current, open: false }))}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((current) => ({ ...current, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
}

export default withAuth(FeatureFlagsPage);
