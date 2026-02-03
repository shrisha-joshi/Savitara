import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  TextField,
  MenuItem,
  Button,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert
} from '@mui/material';
import { DatePicker, TimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { FaCheckCircle } from 'react-icons/fa';
import PricingDisplay from '../../components/PricingDisplay';

const steps = ['Service Details', 'Schedule', 'Confirm'];

export default function CreateBooking() {
  const { acharyaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preSelectedPoojaId = searchParams.get('poojaId');

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Data
  const [acharya, setAcharya] = useState(null);
  const [poojas, setPoojas] = useState([]);

  // Form State
  const [selectedPooja, setSelectedPooja] = useState('');
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        // We reuse the profile endpoint to get Acharya details and their poojas
        const response = await api.get(`/users/acharyas/${acharyaId}`);
        if (response.data.success) {
          setAcharya(response.data.data.profile);
          setPoojas(response.data.data.poojas || []);
          
          // Pre-select pooja if valid
          if (preSelectedPoojaId) {
            const found = (response.data.data.poojas || []).find(p => p._id === preSelectedPoojaId || p.id === preSelectedPoojaId);
            if (found) setSelectedPooja(found._id || found.id);
          }
        }
      } catch (err) {
        console.error('Fetch failed:', err);
        setError('Failed to load booking details.');
      } finally {
        setLoading(false);
      }
    };
    if (acharyaId) fetchDetails();
  }, [acharyaId, preSelectedPoojaId]);

  const handleNext = () => {
    if (activeStep === 0 && !selectedPooja) {
      setError('Please select a pooja service');
      return;
    }
    if (activeStep === 1 && (!date || !time)) {
      setError('Please select date and time');
      return;
    }
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        acharya_id: acharyaId,
        pooja_id: selectedPooja,
        date: format(date, 'yyyy-MM-dd'),
        time: format(time, 'HH:mm'),
        notes: notes
      };

      const response = await api.post('/bookings', payload);
      
      if (response.data.success) {
        setSuccess(true);
        // Navigate to payment or confirmation after short delay
        setTimeout(() => {
           // Assuming response contains booking_id or similar
           const bookingId = response.data.data.booking_id || response.data.data.id;
           navigate(`/booking/${bookingId}/payment`);
        }, 2000);
      }
    } catch (err) {
      console.error('Booking failed:', err);
      // Handle backend specific errors (e.g. slot not available)
      const msg = err.response?.data?.error?.message || 'Booking failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getPoojaDetails = () => poojas.find(p => p._id === selectedPooja || p.id === selectedPooja);

  if (loading) {
    return <Layout><Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box></Layout>;
  }

  return (
    <Layout>
      <Box sx={{ background: '#f5f5f5', minHeight: 'calc(100vh - 64px)', py: 4 }}>
        <Container maxWidth="md">
          <Paper sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom align="center" sx={{ mb: 4, color: 'var(--saffron-dark)' }}>
              Book Your Pooja
            </Typography>

            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 6 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            
            {success ? (
               <Box textAlign="center" py={4}>
                 <FaCheckCircle size={64} color="green" />
                 <Typography variant="h5" mt={2}>Booking Initiated Successfully!</Typography>
                 <Typography color="text.secondary">Redirecting to payment...</Typography>
               </Box>
            ) : (
              <>
                {/* Step 1: Service Selection */}
                {activeStep === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>Select Service Details</Typography>
                    <Typography gutterBottom>Booking with: <b>{acharya?.name}</b></Typography>
                    
                    <TextField
                      select
                      fullWidth
                      label="Select Pooja Service"
                      value={selectedPooja}
                      onChange={(e) => setSelectedPooja(e.target.value)}
                      sx={{ mt: 2, mb: 3 }}
                    >
                      {poojas.map((pooja) => (
                        <MenuItem key={pooja._id || pooja.id} value={pooja._id || pooja.id}>
                          {pooja.name} - ₹{pooja.base_price} ({pooja.duration_hours}h)
                        </MenuItem>
                      ))}
                    </TextField>
                    
                    {getPoojaDetails() && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffbf2' }}>
                        <Typography variant="subtitle2">Description:</Typography>
                        <Typography variant="body2">{getPoojaDetails().description}</Typography>
                      </Paper>
                    )}
                  </Box>
                )}

                {/* Step 2: Scheduling */}
                {activeStep === 1 && (
                  <Box>
                     <Typography variant="h6" gutterBottom>Select Date & Time</Typography>
                     <LocalizationProvider dateAdapter={AdapterDateFns}>
                       <Grid container spacing={3} sx={{ mt: 1 }}>
                         <Grid item xs={12} sm={6}>
                           <DatePicker
                             label="Date"
                             value={date}
                             onChange={(newDate) => setDate(newDate)}
                             disablePast
                             slotProps={{ textField: { fullWidth: true } }}
                           />
                         </Grid>
                         <Grid item xs={12} sm={6}>
                           <TimePicker
                             label="Time"
                             value={time}
                             onChange={(newTime) => setTime(newTime)}
                             slotProps={{ textField: { fullWidth: true } }}
                           />
                         </Grid>
                       </Grid>
                     </LocalizationProvider>
                     <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Special Notes / Requests"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        sx={{ mt: 3 }}
                     />
                  </Box>
                )}

                {/* Step 3: Confirmation */}
                {activeStep === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>Confirm Booking Details</Typography>
                    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}><Typography color="text.secondary">Acharya:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{acharya?.name}</Typography></Grid>
                        
                        <Grid item xs={6}><Typography color="text.secondary">Service:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{getPoojaDetails()?.name}</Typography></Grid>
                        
                        <Grid item xs={6}><Typography color="text.secondary">Date:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{date && format(date, 'PPP')}</Typography></Grid>
                        
                        <Grid item xs={6}><Typography color="text.secondary">Time:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{time && format(time, 'p')}</Typography></Grid>
                      </Grid>
                    </Paper>

                    {/* Gamification Pricing Display */}
                    <PricingDisplay 
                      baseAmount={getPoojaDetails()?.base_price || 0}
                      serviceId={selectedPooja}
                      onPriceCalculated={() => {}}
                    />
                  </Box>
                )}

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4, gap: 2 }}>
                  <Button
                    disabled={activeStep === 0 || submitting}
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                  {activeStep === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={submitting}
                      startIcon={submitting && <CircularProgress size={20} color="inherit" />}
                    >
                      {submitting ? 'Processing...' : 'Confirm & Pay'}
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={handleNext}>
                      Next
                    </Button>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Container>
      </Box>
    </Layout>
  );
}
