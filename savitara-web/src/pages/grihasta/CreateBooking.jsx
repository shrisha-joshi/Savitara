import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Autocomplete
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
  const mode = searchParams.get('mode') || 'instant';

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
  const [serviceInput, setServiceInput] = useState('');
  const [bookingType, setBookingType] = useState('only');
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [requirements, setRequirements] = useState('');

  const effectiveMode = selectedPooja ? mode : 'request';

  useEffect(() => {
    const fetchDetails = async () => {
      // Handle invalid ID explicitly to prevent bad API calls
      if (!acharyaId || acharyaId === 'undefined') {
        console.warn('CreateBooking: Invalid acharyaId:', acharyaId);
        setError('Invalid Acharya ID provided.');
        setLoading(false);
        return;
      }

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
            if (found) {
              setSelectedPooja(found._id || found.id);
              setServiceInput(found.name || '');
            }
          }
        }
      } catch (err) {
        console.error('Fetch failed:', err);
        setError('Failed to load booking details.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetails();
  }, [acharyaId, preSelectedPoojaId]);

  const handleNext = () => {
    if (activeStep === 0 && !serviceInput.trim()) {
      setError('Please enter or select a pooja service');
      return;
    }
    if (activeStep === 1) {
      if (!date || !time) {
        setError('Please select date and time');
        return;
      }
      // Validate date and time are in the future
      const selectedDateTime = new Date(date);
      const [hours, minutes] = time.toTimeString().split(':').map(Number);
      selectedDateTime.setHours(hours, minutes, 0, 0);
      
      const now = new Date();
      if (selectedDateTime <= now) {
        setError('Please select a future date and time');
        return;
      }
      
      // Check if date is too far in the future (optional, e.g., max 90 days)
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      if (selectedDateTime > maxDate) {
        setError('Booking date cannot be more than 90 days in advance');
        return;
      }
    }
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const validateSubmission = () => {
    if (!acharyaId || acharyaId === 'undefined') {
      return 'Invalid Acharya selected';
    }
    if (!date || !time) {
      return 'Please select date and time';
    }
    return null;
  };

  const buildPayload = () => {
    const payload = {
      acharya_id: acharyaId,
      booking_type: bookingType,
      booking_mode: effectiveMode,
      date: format(date, 'yyyy-MM-dd'),
      time: format(time, 'HH:mm')
    };

    // Ensure we have either pooja_id or service_name
    if (selectedPooja) {
      payload.pooja_id = selectedPooja;
    } else if (serviceInput && serviceInput.trim()) {
      // Only add service_name if we don't have pooja_id
      payload.service_name = serviceInput.trim();
    }
    
    // Debug logging
    console.log('Build payload - selectedPooja:', selectedPooja);
    console.log('Build payload - serviceInput:', serviceInput);
    console.log('Build payload - bookingType:', bookingType);
    
    if (effectiveMode === 'request' && requirements) {
      payload.requirements = requirements;
    }
    
    if (notes) {
      payload.notes = notes;
    }
    
    return payload;
  };

  const getErrorMessage = (err) => {
    if (err.response?.data?.error?.message) {
      return err.response.data.error.message;
    }
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    if (err.response?.status === 400) {
      return 'Invalid booking details. Please check your inputs.';
    }
    if (err.response?.status === 404) {
      return 'Acharya or service not found. Please try again.';
    }
    if (err.response?.status === 409) {
      return 'This time slot is no longer available. Please select another time.';
    }
    if (err.response?.status === 500) {
      return 'Server error. Please try again later.';
    }
    if (!err.response) {
      return 'Network error. Please check your internet connection.';
    }
    return 'Booking failed. Please try again.';
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const validationError = validateSubmission();
      if (validationError) {
        setError(validationError);
        setSubmitting(false);
        return;
      }

      const payload = buildPayload();
      console.log('Submitting booking payload:', payload);

      const response = await api.post('/bookings', payload);
      console.log('Booking response:', response.data);
      
      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
           const bookingId = response.data.data.booking_id || response.data.data.id;
           if (effectiveMode === 'request') {
             navigate('/bookings'); 
           } else {
             navigate(`/booking/${bookingId}/payment`);
           }
        }, 2000);
      }
    } catch (err) {
      console.error('Booking failed:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const getPoojaDetails = () => poojas.find(p => p._id === selectedPooja || p.id === selectedPooja);
  const selectedServiceName = serviceInput || getPoojaDetails()?.name || '';

  if (loading) {
    return <Layout><Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box></Layout>;
  }

  // Guard against invalid acharyaId after loading
  if (!acharyaId || acharyaId === 'undefined') {
    return (
      <Layout>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Error: Invalid acharya selected. Please go back and select again.
          </Typography>
          <Button variant="contained" component={Link} to="/acharyas" sx={{ mt: 2 }}>
            Back to List
          </Button>
        </Box>
      </Layout>
    );
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
                 <Typography variant="h5" mt={2}>
                   {effectiveMode === 'request' ? 'Request Sent Successfully!' : 'Booking Initiated Successfully!'}
                 </Typography>
                 <Typography color="text.secondary">
                   {effectiveMode === 'request' ? 'Waiting for Acharya approval...' : 'Redirecting to payment...'}
                 </Typography>
               </Box>
            ) : (
              <>
                {/* Step 1: Service Selection */}
                {activeStep === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>Select Service Details</Typography>
                    <Typography gutterBottom>Booking with: <b>{acharya?.name}</b></Typography>
                    
                    <Autocomplete
                      fullWidth
                      freeSolo
                      selectOnFocus
                      handleHomeEndKeys
                      options={poojas}
                      getOptionLabel={(pooja) => `${pooja.name} - ₹${pooja.base_price} (${pooja.duration_hours}h)`}
                      value={poojas.find(p => p._id === selectedPooja || p.id === selectedPooja) || null}
                      inputValue={serviceInput}
                      onChange={(event, newValue) => {
                        if (newValue) {
                          setSelectedPooja(newValue._id || newValue.id || '');
                          setServiceInput(newValue.name || '');
                        } else {
                          setSelectedPooja('');
                        }
                      }}
                      onInputChange={(event, newInputValue) => {
                        setServiceInput(newInputValue);
                        if (!newInputValue) {
                          setSelectedPooja('');
                        }
                      }}
                      filterOptions={(options, state) => {
                        const inputValue = state.inputValue.toLowerCase();
                        return options.filter(
                          (option) =>
                            option.name.toLowerCase().includes(inputValue) ||
                            `${option.base_price}`.includes(inputValue) ||
                            `${option.duration_hours}`.includes(inputValue)
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          id="pooja-select"
                          name="pooja"
                          label="Search & Select Pooja Service"
                          placeholder="Type to search by name, price, or duration..."
                          sx={{ mt: 2, mb: 3 }}
                        />
                      )}
                      noOptionsText="No poojas found"
                      renderOption={(props, pooja) => (
                        <li {...props}>
                          <Box sx={{ width: '100%' }}>
                            <Typography variant="subtitle2">{pooja.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              ₹{pooja.base_price} • {pooja.duration_hours}h duration
                            </Typography>
                          </Box>
                        </li>
                      )}
                    />
                    
                    {selectedServiceName && (
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffbf2' }}>
                        <Typography variant="subtitle2">Description:</Typography>
                        <Typography variant="body2">
                          {getPoojaDetails()?.description || 'Custom request will be reviewed by the Acharya.'}
                        </Typography>
                      </Paper>
                    )}

                    <FormControl sx={{ mt: 3 }} component="fieldset">
                      <FormLabel component="legend" id="booking-type-label">Booking Type</FormLabel>
                      <RadioGroup
                        row
                        name="booking-type"
                        aria-labelledby="booking-type-label"
                        value={bookingType}
                        onChange={(e) => setBookingType(e.target.value)}
                      >
                        <FormControlLabel value="only" control={<Radio inputProps={{ 'aria-label': 'Pooja Only' }} />} label="Pooja Only" />
                        <FormControlLabel value="with_samagri" control={<Radio inputProps={{ 'aria-label': 'With Samagri' }} />} label="With Samagri (Materials)" />
                      </RadioGroup>
                    </FormControl>
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
                             slotProps={{ textField: { id: "date-picker", fullWidth: true, name: "date" } }}
                           />
                         </Grid>
                         <Grid item xs={12} sm={6}>
                           <TimePicker
                             label="Time"
                             value={time}
                             onChange={(newTime) => setTime(newTime)}
                             slotProps={{ textField: { id: "time-picker", fullWidth: true, name: "time" } }}
                           />
                         </Grid>
                       </Grid>
                     </LocalizationProvider>
                     <TextField
                        id="booking-notes"
                        name="notes"
                        fullWidth
                        multiline
                        rows={3}
                        label="Special Notes / Requests"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        sx={{ mt: 3 }}
                     />
                     {effectiveMode === 'request' && (
                       <TextField
                          id="booking-requirements"
                          name="requirements"
                          fullWidth
                          multiline
                          rows={3}
                          label="Additional Requirements / Questions"
                          placeholder="List any specific samagri or questions you have..."
                          value={requirements}
                          onChange={(e) => setRequirements(e.target.value)}
                          sx={{ mt: 3 }}
                       />
                     )}
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
                        <Grid item xs={6}><Typography fontWeight="bold">{selectedServiceName}</Typography></Grid>
                        
                        <Grid item xs={6}><Typography color="text.secondary">Type:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{bookingType === 'with_samagri' ? 'With Samagri' : 'Pooja Only'}</Typography></Grid>
                        
                        <Grid item xs={6}><Typography color="text.secondary">Date:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{date && format(date, 'PPP')}</Typography></Grid>
                        
                        <Grid item xs={6}><Typography color="text.secondary">Time:</Typography></Grid>
                        <Grid item xs={6}><Typography fontWeight="bold">{time && format(time, 'p')}</Typography></Grid>
                      </Grid>
                    </Paper>

                    {/* Gamification Pricing Display */}
                    {selectedPooja ? (
                      <PricingDisplay 
                        baseAmount={getPoojaDetails()?.base_price || 0}
                        serviceId={selectedPooja}
                        onPriceCalculated={() => {}}
                      />
                    ) : (
                      <Alert severity="info">
                        Once the Acharya reviews your custom service request, they will share pricing details.
                      </Alert>
                    )}
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
                      {(() => {
                        if (submitting) return 'Processing...';
                        if (mode === 'request') return 'Submit Request';
                        return 'Confirm & Pay';
                      })()}
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
