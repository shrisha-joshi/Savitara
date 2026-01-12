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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Rating,
} from '@mui/material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import { adminAPI } from '../src/services/api';

function Reviews() {
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPendingReviews();
  }, []);

  const loadPendingReviews = async () => {
    try {
      const response = await adminAPI.getPendingReviews();
      setPendingReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reviewId) => {
    try {
      await adminAPI.approveReview(reviewId);
      alert('Review approved');
      loadPendingReviews();
    } catch (error) {
      alert('Failed to approve review');
    }
  };

  const handleReject = async () => {
    try {
      await adminAPI.rejectReview(selectedReview._id, rejectReason);
      alert('Review rejected');
      setRejectDialog(false);
      loadPendingReviews();
    } catch (error) {
      alert('Failed to reject review');
    }
  };

  return (
    <Layout>
      <Head>
        <title>Reviews - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Typography variant="h4" gutterBottom>
          Pending Review Moderation
        </Typography>

        {loading ? (
          <Typography>Loading...</Typography>
        ) : pendingReviews.length === 0 ? (
          <Typography>No pending reviews</Typography>
        ) : (
          <Grid container spacing={3}>
            {pendingReviews.map((review) => (
              <Grid item xs={12} md={6} lg={4} key={review._id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">
                      {review.review_type === 'acharya' ? 'Acharya Review' :
                       review.review_type === 'pooja' ? 'Pooja Review' : 'Platform Review'}
                    </Typography>
                    <Typography color="text.secondary" gutterBottom>
                      By: {review.grihasta_name}
                    </Typography>
                    {review.acharya_name && (
                      <Typography variant="body2">
                        Acharya: {review.acharya_name}
                      </Typography>
                    )}
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <Rating value={review.rating} readOnly />
                    </div>
                    <Typography variant="body2">
                      <strong>Comment:</strong>
                    </Typography>
                    <Typography variant="body2">
                      {review.comment}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                      {new Date(review.created_at).toLocaleString()}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      onClick={() => handleApprove(review._id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedReview(review);
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
          <DialogTitle>Reject Review</DialogTitle>
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

export default withAuth(Reviews);
