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
  Settings,
} from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

const DEFAULT_FORM = {
  key: '',
  category: 'booking_experience',
  label: '',
  description: '',
  visibility: 'both',
  is_active: true,
  valueText: '{\n  "example": true\n}',
};

const getGrowthConfigErrorMessage = (error, fallbackMessage) => error?.response?.data?.detail || fallbackMessage;

const getDeleteMessage = (config) => (config.is_system ? 'Config reset to default' : 'Custom config deleted');

function GrowthConfigurationsPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const sortedConfigs = useMemo(
    () => [...configs].sort((a, b) => `${a.category}-${a.label}`.localeCompare(`${b.category}-${b.label}`)),
    [configs]
  );

  const fetchConfigs = async () => {
    setLoading(true);
    const response = await adminAPI.listGrowthConfigs().catch((error) => {
      console.error('Failed to load growth configurations:', error);
      setSnackbar({
        open: true,
        message: getGrowthConfigErrorMessage(error, 'Failed to load growth configurations'),
        severity: 'error',
      });
      return null;
    });

    if (response) {
      setConfigs(response.data?.data?.configs || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const openCreateDialog = () => {
    setEditingConfig(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (config) => {
    setEditingConfig(config);
    setForm({
      key: config.key,
      category: config.category || 'booking_experience',
      label: config.label || '',
      description: config.description || '',
      visibility: config.visibility || 'both',
      is_active: Boolean(config.is_active),
      valueText: JSON.stringify(config.value ?? {}, null, 2),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const parsedValue = JSON.parse(form.valueText || '{}');
      const payload = {
        category: form.category,
        label: form.label,
        description: form.description,
        visibility: form.visibility,
        is_active: form.is_active,
        value: parsedValue,
      };
      await adminAPI.saveGrowthConfig(form.key, payload);
      setSnackbar({ open: true, message: 'Growth configuration saved', severity: 'success' });
      setDialogOpen(false);
      await fetchConfigs();
    } catch (error) {
      const isSyntaxError = error instanceof SyntaxError;
      if (!isSyntaxError) {
        console.error('Failed to save growth configuration:', error);
      }
      setSnackbar({
        open: true,
        message: isSyntaxError ? 'Value JSON is invalid' : getGrowthConfigErrorMessage(error, 'Failed to save growth configuration'),
        severity: 'error',
      });
    }
  };

  const handleDelete = async (config) => {
    const deleteResponse = await adminAPI.deleteGrowthConfig(config.key).catch((error) => {
      console.error('Failed to delete growth configuration:', error);
      setSnackbar({
        open: true,
        message: getGrowthConfigErrorMessage(error, 'Failed to delete configuration'),
        severity: 'error',
      });
      return null;
    });

    if (!deleteResponse) {
      return;
    }

    setSnackbar({
      open: true,
      message: getDeleteMessage(config),
      severity: 'success',
    });
    await fetchConfigs();
  };

  return (
    <Layout>
      <Head>
        <title>Growth Configurations - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">Growth Configurations</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Admin-controlled runtime settings for recurring rituals, pricing, checkout, concierge, and related growth features.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<Refresh />} onClick={fetchConfigs} disabled={loading}>Refresh</Button>
            <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>Add Config</Button>
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedConfigs.map((config) => (
                <TableRow key={config.key} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{config.key}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={500}>{config.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{config.description}</Typography>
                  </TableCell>
                  <TableCell>{config.category}</TableCell>
                  <TableCell>
                    <Chip size="small" label={config.visibility || 'both'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={config.is_active ? 'success' : 'default'} label={config.is_active ? 'Active' : 'Inactive'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={config.source || 'default'} />
                  </TableCell>
                  <TableCell>
                    {config.updated_at ? new Date(config.updated_at).toLocaleString() : 'Default'}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Edit />} onClick={() => openEditDialog(config)}>Edit</Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => handleDelete(config)}
                    >
                      {config.is_system ? 'Reset' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings fontSize="small" />
            {editingConfig ? `Edit ${editingConfig.label}` : 'Add Growth Configuration'}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              label="Config Key"
              value={form.key}
              disabled={Boolean(editingConfig)}
              onChange={(event) => setForm((current) => ({ ...current, key: event.target.value.trim().toLowerCase() }))}
              helperText="Use snake_case keys for custom configs"
            />
            <TextField
              fullWidth
              margin="normal"
              label="Label"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, mt: 1 }}>
              <TextField
                select
                label="Category"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              >
                <MenuItem value="booking_experience">booking_experience</MenuItem>
                <MenuItem value="retention">retention</MenuItem>
                <MenuItem value="concierge">concierge</MenuItem>
                <MenuItem value="custom">custom</MenuItem>
              </TextField>
              <TextField
                select
                label="Visibility"
                value={form.visibility}
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
              >
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="user">user</MenuItem>
                <MenuItem value="both">both</MenuItem>
              </TextField>
              <TextField
                select
                label="Status"
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'active' }))}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Box>
            <TextField
              fullWidth
              multiline
              minRows={16}
              margin="normal"
              label="Config Value (JSON)"
              value={form.valueText}
              onChange={(event) => setForm((current) => ({ ...current, valueText: event.target.value }))}
              helperText="This JSON is consumed directly by runtime APIs and frontend bootstrap endpoints."
              sx={{ fontFamily: 'monospace' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={!form.key || !form.label}>Save</Button>
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

export default withAuth(GrowthConfigurationsPage);
