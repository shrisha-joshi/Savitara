import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Rating,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import { FaArrowLeft } from 'react-icons/fa'
import Layout from '../../components/Layout'
import api from '../../services/api'

const REVIEW_TYPES = [
  { value: 'acharya', label: 'Acharya Service' },
  { value: 'pooja', label: 'Pooja Quality' },
  { value: 'platform', label: 'Platform Experience' },
]

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

export default function SubmitReview() {
  const { bookingId } = useParams()
  const navigate = useNavigate()

  const [reviewType, setReviewType] = useState('acharya')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(-1)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!rating) {
      setError('Please select a rating before submitting.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const response = await api.post('/reviews', {
        booking_id: bookingId,
        rating,
        comment: comment.trim() || undefined,
        review_type: reviewType,
      })
      if (response.data.success) {
        setSubmitted(true)
      }
    } catch (err) {
      console.error('Failed to submit review:', err)
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : 'Failed to submit review. You may have already reviewed this booking.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Layout>
        <Container maxWidth="sm" sx={{ py: 6 }}>
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom>🙏 Thank You!</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Your review has been submitted and is pending approval.
              Your feedback helps the Savitara community.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/bookings')}>
              Back to My Bookings
            </Button>
          </Paper>
        </Container>
      </Layout>
    )
  }

  const displayRating = hoverRating !== -1 ? hoverRating : rating

  return (
    <Layout>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Button
          startIcon={<FaArrowLeft />}
          onClick={() => navigate(`/booking/${bookingId}`)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>

        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Submit Review
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Share your experience to help others in the Savitara community.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {/* Review Type */}
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            What would you like to review?
          </Typography>
          <ToggleButtonGroup
            value={reviewType}
            exclusive
            onChange={(_, val) => { if (val) setReviewType(val) }}
            sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}
          >
            {REVIEW_TYPES.map((rt) => (
              <ToggleButton key={rt.value} value={rt.value} sx={{ textTransform: 'none', px: 2 }}>
                {rt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Divider sx={{ mb: 3 }} />

          {/* Star Rating */}
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Your Rating *
          </Typography>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Rating
              value={rating}
              onChange={(_, val) => setRating(val)}
              onChangeActive={(_, val) => setHoverRating(val)}
              size="large"
              emptyIcon={<StarIcon fontSize="inherit" style={{ opacity: 0.4 }} />}
            />
            <Typography variant="body1" color="text.secondary" sx={{ minWidth: 80 }}>
              {displayRating > 0 ? RATING_LABELS[displayRating] : ''}
            </Typography>
          </Box>

          {/* Comment */}
          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
            Your Comment (optional)
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Share your experience in detail..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            inputProps={{ maxLength: 1000 }}
            helperText={`${comment.length}/1000`}
            sx={{ mb: 3 }}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={submitting || !rating}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ py: 1.5, fontWeight: 600 }}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </Paper>
      </Container>
    </Layout>
  )
}

