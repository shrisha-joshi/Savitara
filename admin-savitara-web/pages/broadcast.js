import { useState } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Box,
  Alert,
  Snackbar,
  Card,
  CardContent,
} from '@mui/material';
import { Send, Notifications } from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Broadcast() {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    target_role: 'all',
  });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleSend = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.sendBroadcast(formData);
      const data = response.data?.data || response.data;
      setSnackbar({
        open: true,
        message: `Notification sent successfully to ${data.recipients_count || 'all'} users!`,
        severity: 'success'
      });
      setFormData({ title: '', body: '', target_role: 'all' });
    } catch (error) {
      console.error('Broadcast error:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to send notification. Please check if you are authenticated.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Broadcast - Savitara Admin</title>
      </Head>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" fontWeight={700} color="primary.main" gutterBottom>
            Broadcast Notification
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Send push notifications to users across the platform
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Notifications sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Create Notification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fill in the details below to send a notification
                </Typography>
              </Box>
            </Box>

            <TextField
              fullWidth
              label="Notification Title"
              placeholder="Enter a catchy title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              sx={{ mb: 3 }}
              required
            />

            <TextField
              fullWidth
              label="Message"
              placeholder="Type your message here..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              multiline
              rows={6}
              sx={{ mb: 3 }}
              required
            />

            <FormControl component="fieldset" sx={{ mb: 4 }}>
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
                Target Audience
              </FormLabel>
              <RadioGroup
                value={formData.target_role}
                onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
              >
                <FormControlLabel 
                  value="all" 
                  control={<Radio />} 
                  label="All Users (Grihastas + Acharyas)" 
                />
                <FormControlLabel 
                  value="grihasta" 
                  control={<Radio />} 
                  label="Grihastas Only" 
                />
                <FormControlLabel 
                  value="acharya" 
                  control={<Radio />} 
                  label="Acharyas Only" 
                />
              </RadioGroup>
            </FormControl>

            {formData.title && formData.body && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Preview: <strong>{formData.title}</strong><br />
                {formData.body}
              </Alert>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<Send />}
              onClick={handleSend}
              disabled={loading || !formData.title || !formData.body}
              sx={{ py: 1.5 }}
            >
              {loading ? 'Sending...' : 'Send Notification'}
            </Button>
          </CardContent>
        </Card>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
}

export default withAuth(Broadcast);
