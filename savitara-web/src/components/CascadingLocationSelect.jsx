import { useState, useEffect } from 'react';
import { Autocomplete, TextField, Box, InputAdornment, Typography } from '@mui/material';
import { Country, State, City } from 'country-state-city';

const CascadingLocationSelect = ({
  country,
  state,
  city,
  phone,
  onLocationChange,
  onPhoneChange,
  disabled = false,
  required = true,
  sx = {}
}) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [phoneError, setPhoneError] = useState('');

  const countries = Country.getAllCountries();
  const states = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];
  const cities = selectedState ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode) : [];

  // Initialize with provided values
  useEffect(() => {
    if (country && !selectedCountry) {
      const foundCountry = countries.find(c => c.name === country);
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }
    }
  }, [country, countries, selectedCountry]);

  useEffect(() => {
    if (state && selectedCountry && !selectedState) {
      const foundState = states.find(s => s.name === state);
      if (foundState) {
        setSelectedState(foundState);
      }
    }
  }, [state, states, selectedState, selectedCountry]);

  useEffect(() => {
    if (city && selectedState && !selectedCity) {
      const foundCity = cities.find(c => c.name === city);
      if (foundCity) {
        setSelectedCity(foundCity);
      }
    }
  }, [city, cities, selectedCity, selectedState]);

  // Extract just the phone digits from the stored phone value
  const getPhoneDigitsOnly = (fullPhone) => {
    if (!fullPhone) return '';
    // Remove the country code prefix if present
    const countryCode = selectedCountry ? `+${selectedCountry.phonecode}` : '';
    if (fullPhone.startsWith(countryCode)) {
      return fullPhone.substring(countryCode.length);
    }
    // Also handle case where +91 or similar might be at the start
    return fullPhone.replace(/^\+\d+/, '');
  };

  const handleCountryChange = (event, newValue) => {
    setSelectedCountry(newValue);
    setSelectedState(null);
    setSelectedCity(null);
    
    const countryCode = newValue ? `+${newValue.phonecode}` : '';
    onLocationChange({
      country: newValue?.name || '',
      state: '',
      city: ''
    });
    
    if (onPhoneChange) {
      // Update phone with new country code, preserving existing digits only
      const existingDigits = getPhoneDigitsOnly(phone);
      onPhoneChange(countryCode + existingDigits);
    }
  };

  const handleStateChange = (event, newValue) => {
    setSelectedState(newValue);
    setSelectedCity(null);
    onLocationChange({
      country: selectedCountry?.name || '',
      state: newValue?.name || '',
      city: ''
    });
  };

  const handleCityChange = (event, newValue) => {
    setSelectedCity(newValue);
    onLocationChange({
      country: selectedCountry?.name || '',
      state: selectedState?.name || '',
      city: newValue?.name || ''
    });
  };

  const handlePhoneChange = (event) => {
    const inputValue = event.target.value;
    
    // Only allow digits in the input
    const digitsOnly = inputValue.replace(/\D/g, '');
    
    // Validate: exactly 10 digits for mobile number
    if (digitsOnly.length > 10) {
      setPhoneError('Phone number cannot exceed 10 digits');
      return; // Don't allow more than 10 digits
    } else if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      setPhoneError('Phone number must be exactly 10 digits');
    } else if (digitsOnly.length === 10) {
      setPhoneError('');
    } else {
      setPhoneError('');
    }
    
    // Store with country code prefix
    const countryCode = selectedCountry ? `+${selectedCountry.phonecode}` : '';
    onPhoneChange(countryCode + digitsOnly);
  };

  // Get the digits-only value for display in the text field
  const displayPhoneValue = getPhoneDigitsOnly(phone);

  return (
    <Box sx={sx}>
      {/* Country Selection */}
      <Autocomplete
        options={countries}
        getOptionLabel={(option) => option.name}
        value={selectedCountry}
        onChange={handleCountryChange}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Country"
            required={required}
            sx={{ mb: 2 }}
            InputProps={{
              ...params.InputProps,
              startAdornment: selectedCountry && (
                <InputAdornment position="start">
                  <Typography variant="body2" sx={{ fontSize: '1.2em' }}>
                    {selectedCountry.flag}
                  </Typography>
                </InputAdornment>
              ),
            }}
          />
        )}
        isOptionEqualToValue={(option, value) => option.isoCode === value?.isoCode}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Typography sx={{ mr: 1, fontSize: '1.2em' }}>{option.flag}</Typography>
            {option.name}
          </Box>
        )}
      />

      {/* State Selection */}
      <Autocomplete
        options={states}
        getOptionLabel={(option) => option.name}
        value={selectedState}
        onChange={handleStateChange}
        disabled={disabled || !selectedCountry}
        renderInput={(params) => (
          <TextField
            {...params}
            label="State"
            required={required}
            sx={{ mb: 2 }}
          />
        )}
        isOptionEqualToValue={(option, value) => option.isoCode === value?.isoCode}
      />

      {/* City Selection */}
      <Autocomplete
        options={cities}
        getOptionLabel={(option) => option.name}
        value={selectedCity}
        onChange={handleCityChange}
        disabled={disabled || !selectedState}
        renderInput={(params) => (
          <TextField
            {...params}
            label="City"
            required={required}
            sx={{ mb: 2 }}
          />
        )}
        isOptionEqualToValue={(option, value) => option.name === value?.name}
      />

      {/* Phone Input with country code (displayed separately) */}
      {onPhoneChange && (
        <TextField
          fullWidth
          label="Phone Number"
          value={displayPhoneValue}
          onChange={handlePhoneChange}
          disabled={disabled}
          required={required}
          placeholder="Enter 10-digit mobile number"
          autoComplete="tel"
          error={!!phoneError}
          helperText={phoneError || 'Enter exactly 10 digits (without country code)'}
          inputProps={{
            maxLength: 10,
            inputMode: 'numeric',
            pattern: '[0-9]*'
          }}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: selectedCountry && (
              <InputAdornment position="start">
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary', 
                    minWidth: '70px',
                    fontWeight: 'medium',
                    backgroundColor: 'grey.100',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    mr: 1
                  }}
                >
                  {selectedCountry.flag} +{selectedCountry.phonecode}
                </Typography>
              </InputAdornment>
            ),
          }}
        />
      )}
    </Box>
  );
};

export default CascadingLocationSelect;