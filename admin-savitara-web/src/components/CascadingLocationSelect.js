import React, { useState, useEffect, useMemo } from 'react';
import { Autocomplete, TextField, Box, InputAdornment, Typography, Chip } from '@mui/material';
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
  sx = {},
  variant = 'outlined',
  size = 'medium'
}) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const countries = Country.getAllCountries();
  const states = useMemo(() => 
    selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [],
    [selectedCountry]
  );
  const cities = useMemo(() => 
    selectedState ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode) : [],
    [selectedCountry, selectedState]
  );

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
      const existingNumber = phone ? phone.replace(/^\+\d+/, '') : '';
      onPhoneChange(countryCode + existingNumber);
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
    const countryCode = selectedCountry ? `+${selectedCountry.phonecode}` : '';
    const phoneNumber = event.target.value;
    
    if (!phoneNumber.startsWith(countryCode)) {
      onPhoneChange(countryCode + phoneNumber.replace(/^\+\d+/, ''));
    } else {
      onPhoneChange(phoneNumber);
    }
  };

  return (
    <Box sx={sx}>
      {/* Country Selection */}
      <Autocomplete
        options={countries}
        getOptionLabel={(option) => option.name}
        value={selectedCountry}
        onChange={handleCountryChange}
        disabled={disabled}
        size={size}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Country"
            required={required}
            variant={variant}
            sx={{ mb: 2 }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  {selectedCountry && (
                    <InputAdornment position="start">
                      <Typography variant="body2" sx={{ fontSize: '1.2em', mr: 1 }}>
                        {selectedCountry.flag}
                      </Typography>
                    </InputAdornment>
                  )}
                  {params.InputProps.startAdornment}
                </>
              ),
            }}
          />
        )}
        isOptionEqualToValue={(option, value) => option.isoCode === value?.isoCode}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ mr: 2, fontSize: '1.2em' }}>{option.flag}</Typography>
            <Box>
              <Typography variant="body2" fontWeight="medium">{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                +{option.phonecode}
              </Typography>
            </Box>
          </Box>
        )}
        filterOptions={(options, { inputValue }) =>
          options.filter(option =>
            option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
            option.phonecode.includes(inputValue)
          )
        }
      />

      {/* State Selection */}
      <Autocomplete
        options={states}
        getOptionLabel={(option) => option.name}
        value={selectedState}
        onChange={handleStateChange}
        disabled={disabled || !selectedCountry}
        size={size}
        renderInput={(params) => (
          <TextField
            {...params}
            label="State"
            required={required}
            variant={variant}
            sx={{ mb: 2 }}
            helperText={!selectedCountry ? 'Select a country first' : ''}
          />
        )}
        isOptionEqualToValue={(option, value) => option.isoCode === value?.isoCode}
        noOptionsText={!selectedCountry ? 'Select a country first' : 'No states found'}
      />

      {/* City Selection */}
      <Autocomplete
        options={cities}
        getOptionLabel={(option) => option.name}
        value={selectedCity}
        onChange={handleCityChange}
        disabled={disabled || !selectedState}
        size={size}
        renderInput={(params) => (
          <TextField
            {...params}
            label="City"
            required={required}
            variant={variant}
            sx={{ mb: 2 }}
            helperText={!selectedState ? 'Select a state first' : ''}
          />
        )}
        isOptionEqualToValue={(option, value) => option.name === value?.name}
        noOptionsText={!selectedState ? 'Select a state first' : 'No cities found'}
      />

      {/* Phone Input with country code */}
      {onPhoneChange && (
        <TextField
          fullWidth
          label="Phone Number"
          value={phone || ''}
          onChange={handlePhoneChange}
          disabled={disabled}
          required={required}
          placeholder="Enter mobile number"
          autoComplete="tel"
          variant={variant}
          size={size}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: selectedCountry && (
              <InputAdornment position="start">
                <Chip 
                  label={`${selectedCountry.flag} +${selectedCountry.phonecode}`} 
                  size="small"
                  sx={{ 
                    backgroundColor: '#FF6B35',
                    color: 'white',
                    fontWeight: 'medium',
                    '& .MuiChip-label': {
                      px: 1
                    }
                  }}
                />
              </InputAdornment>
            ),
          }}
          helperText={!selectedCountry ? 'Select a country to get the phone code' : ''}
        />
      )}
    </Box>
  );
};

export default CascadingLocationSelect;