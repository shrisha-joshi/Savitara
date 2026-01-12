import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Grid,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Verifications() {
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [selectedAcharya, setSelectedAcharya] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPendingVerifications();
  }, []);

  const loadPendingVerifications = async () => {
    try {
      const response = await adminAPI.getPendingVerifications();
      setPendingVerifications(response.data.acharyas || []);
    } catch (error) {
      console.error('Failed to load verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (acharyaId) => {
    try {
      await adminAPI.verifyAcharya(acharyaId);
      alert('Acharya verified successfully');
      loadPendingVerifications();
    } catch (error) {
      alert('Failed to verify acharya');
    }
  };

  const handleReject = async () => {
    try {
      await adminAPI.rejectAcharya(selectedAcharya._id, rejectReason);
      alert('Verification rejected');
      setRejectDialog(false);
      loadPendingVerifications();
    } catch (error) {
      alert('Failed to reject verification');
    }
  };

  return (
    <Layout>
      <Head>
        <title>Verifications - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Typography variant="h4" gutterBottom>
          Pending Acharya Verifications
        </Typography>

        {loading ? (
          <Typography>Loading...</Typography>
        ) : pendingVerifications.length === 0 ? (
          <Typography>No pending verifications</Typography>
        ) : (
          <Grid container spacing={3}>
            {pendingVerifications.map((acharya) => (
              <Grid item xs={12} md={6} lg={4} key={acharya._id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">{acharya.full_name}</Typography>
                    <Typography color="text.secondary" gutterBottom>
                      {acharya.email}
                    </Typography>
                    <Typography variant="body2">
                      Phone: {acharya.phone_number}
                    </Typography>
                    <Typography variant="body2">
                      Location: {acharya.location}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      <strong>Specializations:</strong>
                    </Typography>
                    <div style={{ marginTop: 8 }}>
                      {acharya.acharya_profile?.specializations?.map((spec, idx) => (
                        <Chip key={idx} label={spec} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </div>
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      <strong>Languages:</strong>
                    </Typography>
                    <div style={{ marginTop: 8 }}>
                      {acharya.acharya_profile?.languages?.map((lang, idx) => (
                        <Chip key={idx} label={lang} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </div>
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      Experience: {acharya.acharya_profile?.experience_years} years
                    </Typography>
                    <Typography variant="body2">
                      Rate: ₹{acharya.acharya_profile?.hourly_rate}/hr
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      <strong>Bio:</strong>
                    </Typography>
                    <Typography variant="body2">
                      {acharya.acharya_profile?.bio}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      onClick={() => handleVerify(acharya._id)}
                    >
                      Verify
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedAcharya(acharya);
                        setRejectDialog(true);
                      }}
                    >
                      Reject
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)}>
          <DialogTitle>Reject Verification</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Reason for rejection"
              fullWidth
              multiline
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialog(false)}>Cancel</Button>
            <Button onClick={handleReject} color="error">
              Reject
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}

export default withAuth(Verifications);
