import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControlLabel,
  Grid,
  Paper,
  Slider,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Build,
  Refresh,
  Save,
  WarningAmber,
} from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

const DEFAULT_CONTROLS = {
  payments_enabled: true,
  chat_enabled: true,
  recommendations_enabled: true,
  incident_mode: false,
  incident_throttle_multiplier: 0.5,
};

function ReliabilityControlsPage() {
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const closeSnackbar = () =>
    setSnackbar((current) => ({ ...current, open: false }));

  const fetchControls = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getKillSwitches();
      const payload = response?.data?.data || response?.data || {};
      setControls((current) => ({ ...current, ...payload }));
    } catch (error) {
      console.error('Failed to load reliability controls:', error);
      showSnackbar('Failed to load reliability controls', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const handleToggle = (key) => (event) => {
    const checked = event.target.checked;
    setControls((current) => ({ ...current, [key]: checked }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        payments_enabled: Boolean(controls.payments_enabled),
        chat_enabled: Boolean(controls.chat_enabled),
        recommendations_enabled: Boolean(controls.recommendations_enabled),
        incident_mode: Boolean(controls.incident_mode),
        incident_throttle_multiplier: Number(controls.incident_throttle_multiplier),
      };
      await adminAPI.updateKillSwitches(payload);
      showSnackbar('Reliability controls updated');
      fetchControls();
    } catch (error) {
      console.error('Failed to update reliability controls:', error);
      showSnackbar('Failed to update reliability controls', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Reliability Controls - Savitara Admin</title>
      </Head>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Build /> Reliability & Kill-Switch Controls
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Emergency control-plane toggles for payments, chat, recommendations, and incident throttling.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={fetchControls} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving || loading}>
            Save Controls
          </Button>
        </Stack>

        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Capability Switches
                </Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={<Switch checked={Boolean(controls.payments_enabled)} onChange={handleToggle('payments_enabled')} />}
                    label="Payments enabled"
                  />
                  <FormControlLabel
                    control={<Switch checked={Boolean(controls.chat_enabled)} onChange={handleToggle('chat_enabled')} />}
                    label="Chat enabled"
                  />
                  <FormControlLabel
                    control={<Switch checked={Boolean(controls.recommendations_enabled)} onChange={handleToggle('recommendations_enabled')} />}
                    label="Recommendations enabled"
                  />
                  <FormControlLabel
                    control={<Switch checked={Boolean(controls.incident_mode)} onChange={handleToggle('incident_mode')} />}
                    label="Incident mode enabled"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Incident Throttle
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Request throughput multiplier while incident mode is active.
                </Typography>
                <Box sx={{ px: 1, pt: 1 }}>
                  <Slider
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={Number(controls.incident_throttle_multiplier || 0.5)}
                    onChange={(_, value) => setControls((current) => ({
                      ...current,
                      incident_throttle_multiplier: Number(value),
                    }))}
                    valueLabelDisplay="auto"
                  />
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  label="Throttle Multiplier"
                  value={Number(controls.incident_throttle_multiplier || 0.5)}
                  onChange={(event) => {
                    const next = Number.parseFloat(event.target.value);
                    if (Number.isNaN(next)) {
                      return;
                    }
                    const clamped = Math.min(1, Math.max(0.1, next));
                    setControls((current) => ({ ...current, incident_throttle_multiplier: clamped }));
                  }}
                  inputProps={{ min: 0.1, max: 1, step: 0.05 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {controls.incident_mode && (
          <Paper sx={{ p: 2, mt: 3, border: '1px solid', borderColor: 'warning.main', bgcolor: 'warning.50' }}>
            <Alert icon={<WarningAmber />} severity="warning">
              Incident mode is active. Ensure this is intentional and communicate to support/ops teams.
            </Alert>
          </Paper>
        )}

        <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={closeSnackbar}>
          <Alert onClose={closeSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
}

export default withAuth(ReliabilityControlsPage, { requireAdmin: true });
