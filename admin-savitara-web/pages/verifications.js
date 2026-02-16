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
  Box,
  Avatar,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  LocationOn as LocationOnIcon,
  Star as StarIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Verifications() {
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [selectedAcharya, setSelectedAcharya] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadPendingVerifications();
  }, []);

  const loadPendingVerifications = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPendingVerifications();
      const data = response.data?.data || response.data;
      setPendingVerifications(data?.acharyas || []);
    } catch (error) {
      console.error('Failed to load verifications:', error);
      setSnackbar({ open: true, message: 'Failed to load verifications', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (acharyaId) => {
    try {
      setActionLoading(true);
      await adminAPI.verifyAcharya(acharyaId);
      setSnackbar({ open: true, message: 'Acharya verified successfully!', severity: 'success' });
      loadPendingVerifications();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to verify acharya', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setSnackbar({ open: true, message: 'Please provide a reason for rejection', severity: 'warning' });
      return;
    }
    try {
      setActionLoading(true);
      await adminAPI.rejectAcharya(selectedAcharya._id, rejectReason);
      setSnackbar({ open: true, message: 'Verification rejected', severity: 'info' });
      setRejectDialog(false);
      setRejectReason('');
      loadPendingVerifications();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to reject verification', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Acharya Verifications - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            Acharya Verifications
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Review and approve new Acharya registrations to make them visible to users
          </Typography>
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        )}
        
        {!loading && pendingVerifications.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              All Caught Up!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No pending Acharya verifications at the moment
            </Typography>
          </Paper>
        )}
        
        {!loading && pendingVerifications.length > 0 && (
          <Grid container spacing={3}>
            {pendingVerifications.map((acharya) => (
              <Grid item xs={12} md={6} key={acharya._id}>
                <Card 
                  elevation={3}
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': { boxShadow: 6 }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6">{acharya.profile?.name || 'N/A'}</Typography>
                        <Chip label="PENDING" size="small" color="warning" />
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Stack spacing={1.5}>
                      <Box display="flex" alignItems="center">
                        <EmailIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Typography variant="body2">{acharya.email || 'N/A'}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center">
                        <PhoneIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Typography variant="body2">{acharya.profile?.phone || 'N/A'}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center">
                        <LocationOnIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {acharya.profile?.location?.city || 'N/A'}, {acharya.profile?.location?.state || 'N/A'}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center">
                        <StarIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {acharya.profile?.experience_years || 0} years experience
                        </Typography>
                      </Box>
                    </Stack>

                    <Box mt={2}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Parampara:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {acharya.profile?.parampara || 'N/A'}
                      </Typography>
                    </Box>

                    <Box mt={2}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Gotra:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {acharya.profile?.gotra || 'N/A'}
                      </Typography>
                    </Box>

                    <Box mt={2}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Study Place:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {acharya.profile?.study_place || 'N/A'}
                      </Typography>
                    </Box>

                    <Box mt={2}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Specializations:
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {acharya.profile?.specializations && acharya.profile.specializations.length > 0 ? (
                          acharya.profile.specializations.slice(0, 5).map((spec) => (
                            <Chip key={`spec-${acharya._id}-${spec}`} label={spec} size="small" color="primary" variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">N/A</Typography>
                        )}
                      </Box>
                    </Box>

                    <Box mt={2}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Languages:
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {acharya.profile?.languages && acharya.profile.languages.length > 0 ? (
                          acharya.profile.languages.slice(0, 5).map((lang) => (
                            <Chip key={`lang-${acharya._id}-${lang}`} label={lang} size="small" />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">N/A</Typography>
                        )}
                      </Box>
                    </Box>

                    {acharya.profile?.referred_by && (
                      <Box mt={2}>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                          Referred By:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {acharya.profile.referred_by}
                        </Typography>
                      </Box>
                    )}

                    {acharya.profile?.referral_code && (
                      <Box mt={2}>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                          Referral Code:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {acharya.profile.referral_code}
                        </Typography>
                      </Box>
                    )}

                    {acharya.profile?.verification_documents && acharya.profile.verification_documents.length > 0 && (
                      <Box mt={2}>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                          Uploaded Documents:
                        </Typography>
                        <Stack spacing={0.5}>
                          {acharya.profile.verification_documents.map((doc, idx) => (
                            <Button
                              key={`doc-${acharya._id}-${idx}-${doc.substring(doc.length - 10)}`}
                              size="small"
                              variant="outlined"
                              href={doc}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ justifyContent: 'flex-start' }}
                            >
                              📄 Document {idx + 1}
                            </Button>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {acharya.profile?.bio && (
                      <Box mt={2}>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                          Bio:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {acharya.profile.bio.substring(0, 150)}
                          {acharya.profile.bio.length > 150 ? '...' : ''}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleVerify(acharya._id)}
                      disabled={actionLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => {
                        setSelectedAcharya(acharya);
                        setRejectDialog(true);
                      }}
                      disabled={actionLoading}
                    >
                      Reject
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Dialog 
          open={rejectDialog} 
          onClose={() => !actionLoading && setRejectDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6">Reject Verification</Typography>
            <Typography variant="body2" color="text.secondary">
              Please provide a reason for rejecting this Acharya&apos;s verification
            </Typography>
          </DialogTitle>
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
              placeholder="E.g., Incomplete documentation, invalid credentials..."
              disabled={actionLoading}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setRejectDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              onClick={handleReject} 
              variant="contained"
              color="error"
              disabled={actionLoading || !rejectReason.trim()}
            >
              {actionLoading ? <CircularProgress size={24} /> : 'Confirm Rejection'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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

export default withAuth(Verifications);
