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
} from '@mui/material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Broadcast() {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    recipient_type: 'all',
  });
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    try {
      setLoading(true);
      await adminAPI.sendBroadcast(formData);
      alert('Notification sent successfully');
      setFormData({ title: '', body: '', recipient_type: 'all' });
    } catch (error) {
      alert('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Broadcast - Savitara Admin</title>
      </Head>

      <Container maxWidth="md">
        <Typography variant="h4" gutterBottom>
          Broadcast Notification
        </Typography>

        <Paper sx={{ p: 3 }}>
          <TextField
            fullWidth
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Message"
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            multiline
            rows={6}
            sx={{ mb: 3 }}
          />

          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend">Send to:</FormLabel>
            <RadioGroup
              value={formData.recipient_type}
              onChange={(e) => setFormData({ ...formData, recipient_type: e.target.value })}
            >
              <FormControlLabel value="all" control={<Radio />} label="All Users" />
              <FormControlLabel value="grihastas" control={<Radio />} label="Grihastas Only" />
              <FormControlLabel value="acharyas" control={<Radio />} label="Acharyas Only" />
            </RadioGroup>
          </FormControl>

          <Button
            variant="contained"
            size="large"
            onClick={handleSend}
            disabled={loading || !formData.title || !formData.body}
          >
            Send Notification
          </Button>
        </Paper>
      </Container>
    </Layout>
  );
}

export default withAuth(Broadcast);
