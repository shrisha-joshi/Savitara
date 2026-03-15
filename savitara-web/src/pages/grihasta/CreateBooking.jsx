import {
    Alert,
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Container,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    Paper,
    Radio,
    RadioGroup,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography
} from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import PricingDisplay from '../../components/PricingDisplay';
import api from '../../services/api';
import logger from '../../utils/logger';

const steps = ['Service Details', 'Schedule', 'Confirm'];

const isInvalidAcharyaId = (id) => !id || id === 'undefined';

const buildSelectedDateTime = (dateValue, timeValue) => {
  const selectedDateTime = new Date(dateValue);
  const [hours, minutes] = timeValue.toTimeString().split(':').map(Number);
  selectedDateTime.setHours(hours, minutes, 0, 0);
  return selectedDateTime;
};

const validateSchedule = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) {
    return { error: 'Please select date and time' };
  }

  const selectedDateTime = buildSelectedDateTime(dateValue, timeValue);
  if (selectedDateTime <= new Date()) {
    return { error: 'Please select a future date and time' };
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  if (selectedDateTime > maxDate) {
    return { error: 'Booking date cannot be more than 90 days in advance' };
  }

  return { selectedDateTime };
};

const generateIdempotencyKey = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const ServiceStep = ({
  acharya,
  poojas,
  selectedPooja,
  serviceInput,
  setSelectedPooja,
  setServiceInput,
  bookingType,
  setBookingType,
  selectedServiceName,
  getPoojaDetails,
}) => (
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
);

ServiceStep.propTypes = {
  acharya: PropTypes.object,
  poojas: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedPooja: PropTypes.string.isRequired,
  serviceInput: PropTypes.string.isRequired,
  setSelectedPooja: PropTypes.func.isRequired,
  setServiceInput: PropTypes.func.isRequired,
  bookingType: PropTypes.string.isRequired,
  setBookingType: PropTypes.func.isRequired,
  selectedServiceName: PropTypes.string.isRequired,
  getPoojaDetails: PropTypes.func.isRequired,
};

ServiceStep.defaultProps = {
  acharya: null,
};

const ScheduleStep = ({
  date,
  time,
  setDate,
  setTime,
  notes,
  setNotes,
  requirements,
  setRequirements,
  effectiveMode,
}) => (
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
);

ScheduleStep.propTypes = {
  date: PropTypes.instanceOf(Date),
  time: PropTypes.instanceOf(Date),
  setDate: PropTypes.func.isRequired,
  setTime: PropTypes.func.isRequired,
  notes: PropTypes.string.isRequired,
  setNotes: PropTypes.func.isRequired,
  requirements: PropTypes.string.isRequired,
  setRequirements: PropTypes.func.isRequired,
  effectiveMode: PropTypes.string.isRequired,
};

ScheduleStep.defaultProps = {
  date: null,
  time: null,
};

const ConfirmStep = ({
  acharya,
  selectedServiceName,
  bookingType,
  date,
  time,
  selectedPooja,
  getPoojaDetails,
}) => (
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
);

ConfirmStep.propTypes = {
  acharya: PropTypes.object,
  selectedServiceName: PropTypes.string.isRequired,
  bookingType: PropTypes.string.isRequired,
  date: PropTypes.instanceOf(Date),
  time: PropTypes.instanceOf(Date),
  selectedPooja: PropTypes.string.isRequired,
  getPoojaDetails: PropTypes.func.isRequired,
};

ConfirmStep.defaultProps = {
  acharya: null,
  date: null,
  time: null,
};

const SuccessPanel = ({ effectiveMode }) => (
  <Box textAlign="center" py={4}>
    <FaCheckCircle size={64} color="green" />
    <Typography variant="h5" mt={2}>
      {effectiveMode === 'request' ? 'Request Sent Successfully!' : 'Booking Initiated Successfully!'}
    </Typography>
    <Typography color="text.secondary">
      {effectiveMode === 'request' ? 'Waiting for Acharya approval...' : 'Redirecting to payment...'}
    </Typography>
  </Box>
);

SuccessPanel.propTypes = {
  effectiveMode: PropTypes.string.isRequired,
};

const StepContent = ({
  activeStep,
  acharya,
  poojas,
  selectedPooja,
  serviceInput,
  setSelectedPooja,
  setServiceInput,
  bookingType,
  setBookingType,
  selectedServiceName,
  getPoojaDetails,
  date,
  time,
  setDate,
  setTime,
  notes,
  setNotes,
  requirements,
  setRequirements,
  effectiveMode,
}) => {
  if (activeStep === 0) {
    return (
      <ServiceStep
        acharya={acharya}
        poojas={poojas}
        selectedPooja={selectedPooja}
        serviceInput={serviceInput}
        setSelectedPooja={setSelectedPooja}
        setServiceInput={setServiceInput}
        bookingType={bookingType}
        setBookingType={setBookingType}
        selectedServiceName={selectedServiceName}
        getPoojaDetails={getPoojaDetails}
      />
    );
  }

  if (activeStep === 1) {
    return (
      <ScheduleStep
        date={date}
        time={time}
        setDate={setDate}
        setTime={setTime}
        notes={notes}
        setNotes={setNotes}
        requirements={requirements}
        setRequirements={setRequirements}
        effectiveMode={effectiveMode}
      />
    );
  }

  return (
    <ConfirmStep
      acharya={acharya}
      selectedServiceName={selectedServiceName}
      bookingType={bookingType}
      date={date}
      time={time}
      selectedPooja={selectedPooja}
      getPoojaDetails={getPoojaDetails}
    />
  );
};

StepContent.propTypes = {
  activeStep: PropTypes.number.isRequired,
  acharya: PropTypes.object,
  poojas: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedPooja: PropTypes.string.isRequired,
  serviceInput: PropTypes.string.isRequired,
  setSelectedPooja: PropTypes.func.isRequired,
  setServiceInput: PropTypes.func.isRequired,
  bookingType: PropTypes.string.isRequired,
  setBookingType: PropTypes.func.isRequired,
  selectedServiceName: PropTypes.string.isRequired,
  getPoojaDetails: PropTypes.func.isRequired,
  date: PropTypes.instanceOf(Date),
  time: PropTypes.instanceOf(Date),
  setDate: PropTypes.func.isRequired,
  setTime: PropTypes.func.isRequired,
  notes: PropTypes.string.isRequired,
  setNotes: PropTypes.func.isRequired,
  requirements: PropTypes.string.isRequired,
  setRequirements: PropTypes.func.isRequired,
  effectiveMode: PropTypes.string.isRequired,
};

StepContent.defaultProps = {
  acharya: null,
  date: null,
  time: null,
};

export default function CreateBooking() {
  const { acharyaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingTheme = useMuiTheme();
  const preSelectedPoojaId = searchParams.get('poojaId');
  const mode = searchParams.get('mode') || 'instant';

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
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

  const loadDetails = async () => {
    if (isInvalidAcharyaId(acharyaId)) {
      console.warn('CreateBooking: Invalid acharyaId:', acharyaId);
      setError('Invalid Acharya ID provided.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/users/acharyas/${acharyaId}`);
      if (!response.data.success) return;

      const profile = response.data.data.profile;
      const poojaList = response.data.data.poojas || [];
      setAcharya(profile);
      setPoojas(poojaList);

      const found = preSelectedPoojaId
        ? poojaList.find((p) => p._id === preSelectedPoojaId || p.id === preSelectedPoojaId)
        : null;
      if (found) {
        setSelectedPooja(found._id || found.id);
        setServiceInput(found.name || '');
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      setError('Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [acharyaId, preSelectedPoojaId]);

  const checkAvailability = async (selectedDateTime) => {
    if (effectiveMode !== 'instant' || !acharyaId) return null;

    try {
      setCheckingAvailability(true);
      setError(null);
      const durationHours = getPoojaDetails()?.duration_hours || 2;
      const dateTimeIso = selectedDateTime.toISOString();
      const response = await api.get('/bookings/check-availability', {
        params: { acharya_id: acharyaId, date_time: dateTimeIso, duration: durationHours },
      });
      if (response.data.success && !response.data.data?.available) {
        const next = response.data.data?.next_available_slot;
        const hint = next ? ` Next available: ${new Date(next).toLocaleString()}.` : '';
        return `This time slot is not available for the selected Acharya.${hint}`;
      }
      return null;
    } catch (availErr) {
      console.warn('Availability check failed, proceeding:', availErr);
      return null;
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleNext = async () => {
    if (activeStep === 0 && !serviceInput.trim()) {
      setError('Please enter or select a pooja service');
      return;
    }
    if (activeStep === 1) {
      const { error: scheduleError, selectedDateTime } = validateSchedule(date, time);
      if (scheduleError) {
        setError(scheduleError);
        return;
      }
      const availabilityError = await checkAvailability(selectedDateTime);
      if (availabilityError) {
        setError(availabilityError);
        return;
      }
    }
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const validateSubmission = () => {
    if (isInvalidAcharyaId(acharyaId)) {
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
    } else if (serviceInput?.trim()) {
      // Only add service_name if we don't have pooja_id
      payload.service_name = serviceInput.trim();
    }
    
    // Debug logging
    logger.log('Build payload - selectedPooja:', selectedPooja);
    logger.log('Build payload - serviceInput:', serviceInput);
    logger.log('Build payload - bookingType:', bookingType);
    
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
      logger.log('Submitting booking payload:', payload);

      const idempotencyKey = generateIdempotencyKey();
      logger.log('Submitting booking with idempotency key:', idempotencyKey);

      const response = await api.post('/bookings', payload, {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
      });
      logger.log('Booking response:', response.data);
      
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

  const renderContent = () => {
    if (loading) {
      return (
        <Box p={4} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      );
    }

    if (isInvalidAcharyaId(acharyaId)) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Error: Invalid acharya selected. Please go back and select again.
          </Typography>
          <Button variant="contained" component={Link} to="/acharyas" sx={{ mt: 2 }}>
            Back to List
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ bgcolor: bookingTheme.palette.mode === 'dark' ? 'background.default' : '#f5f5f5', minHeight: 'calc(100vh - 64px)', py: 4 }}>
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
              <SuccessPanel effectiveMode={effectiveMode} />
            ) : (
              <>
                <StepContent
                  activeStep={activeStep}
                  acharya={acharya}
                  poojas={poojas}
                  selectedPooja={selectedPooja}
                  serviceInput={serviceInput}
                  setSelectedPooja={setSelectedPooja}
                  setServiceInput={setServiceInput}
                  bookingType={bookingType}
                  setBookingType={setBookingType}
                  selectedServiceName={selectedServiceName}
                  getPoojaDetails={getPoojaDetails}
                  date={date}
                  time={time}
                  setDate={setDate}
                  setTime={setTime}
                  notes={notes}
                  setNotes={setNotes}
                  requirements={requirements}
                  setRequirements={setRequirements}
                  effectiveMode={effectiveMode}
                />

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
                    <Button variant="contained" onClick={handleNext} disabled={checkingAvailability}>
                      {checkingAvailability ? (
                        <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />Checking…</>
                      ) : 'Next'}
                    </Button>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Container>
      </Box>
    );
  };

  return (
    <Layout>
      {renderContent()}
    </Layout>
  );
}
