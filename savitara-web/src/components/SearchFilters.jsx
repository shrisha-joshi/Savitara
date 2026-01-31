import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Slider, FormControl, InputLabel,
  Select, MenuItem, Chip, Button, TextField, Rating, Grid,
  Accordion, AccordionSummary, AccordionDetails, Switch,
  FormControlLabel, InputAdornment, IconButton
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TextField as MuiTextField } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';

const SearchFilters = ({ onFiltersChange, initialFilters = {}, onSearch }) => {
  const [filters, setFilters] = useState({
    query: '',
    specializations: [],
    minRating: 0,
    maxPrice: 5000,
    minPrice: 0,
    city: '',
    state: '',
    languages: [],
    date: null,
    timeSlot: '',
    minExperience: 0,
    isVerified: false,
    sortBy: 'relevance',
    ...initialFilters
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const specializations = [
    'Vedic Rituals',
    'Marriage Ceremony',
    'Naming Ceremony',
    'House Warming',
    'Funeral Rites',
    'Astrology Consultation',
    'Puja Services',
    'Havana',
    'Satyanarayan Puja',
    'Rudra Abhishek'
  ];

  const languages = [
    'Hindi',
    'Sanskrit',
    'English',
    'Tamil',
    'Telugu',
    'Kannada',
    'Malayalam',
    'Bengali',
    'Marathi',
    'Gujarati'
  ];

  const cities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad',
    'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'
  ];

  const states = [
    'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana',
    'West Bengal', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Kerala'
  ];

  useEffect(() => {
    // Debounce filter changes
    const timeoutId = setTimeout(() => {
      onFiltersChange(filters);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters, onFiltersChange]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSpecializationToggle = (spec) => {
    const newSpecs = filters.specializations.includes(spec)
      ? filters.specializations.filter(s => s !== spec)
      : [...filters.specializations, spec];
    handleFilterChange('specializations', newSpecs);
  };

  const handleLanguageToggle = (lang) => {
    const newLangs = filters.languages.includes(lang)
      ? filters.languages.filter(l => l !== lang)
      : [...filters.languages, lang];
    handleFilterChange('languages', newLangs);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      query: '',
      specializations: [],
      minRating: 0,
      maxPrice: 5000,
      minPrice: 0,
      city: '',
      state: '',
      languages: [],
      date: null,
      timeSlot: '',
      minExperience: 0,
      isVerified: false,
      sortBy: 'relevance'
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const activeFiltersCount = Object.values(filters).filter(val => {
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val !== '';
    if (typeof val === 'number') return val > 0;
    if (typeof val === 'boolean') return val;
    return false;
  }).length - 1; // Subtract query which is always visible

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterListIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Search & Filter Acharyas
            {activeFiltersCount > 0 && (
              <Chip 
                label={`${activeFiltersCount} active`} 
                size="small" 
                color="primary" 
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>

        {/* Main Search */}
        <TextField
          fullWidth
          label="Search"
          value={filters.query}
          onChange={(e) => handleFilterChange('query', e.target.value)}
          placeholder="Name, specialization, location..."
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: filters.query && (
              <InputAdornment position="end">
                <IconButton onClick={() => handleFilterChange('query', '')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && onSearch) {
              onSearch(filters);
            }
          }}
        />

        {/* Quick Filters */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>City</InputLabel>
              <Select
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
              >
                <MenuItem value="">All Cities</MenuItem>
                {cities.map(city => (
                  <MenuItem key={city} value={city}>{city}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                <MenuItem value="relevance">Relevance</MenuItem>
                <MenuItem value="rating">Highest Rated</MenuItem>
                <MenuItem value="price_low">Price: Low to High</MenuItem>
                <MenuItem value="price_high">Price: High to Low</MenuItem>
                <MenuItem value="experience">Most Experienced</MenuItem>
                <MenuItem value="bookings">Most Popular</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography gutterBottom>Minimum Rating</Typography>
              <Rating
                value={filters.minRating}
                onChange={(e, value) => handleFilterChange('minRating', value || 0)}
                precision={0.5}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.isVerified}
                  onChange={(e) => handleFilterChange('isVerified', e.target.checked)}
                  color="primary"
                />
              }
              label="Verified Only"
            />
          </Grid>
        </Grid>

        {/* Advanced Filters Accordion */}
        <Accordion 
          expanded={showAdvanced}
          onChange={() => setShowAdvanced(!showAdvanced)}
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography color="primary">
              Advanced Filters {!showAdvanced && activeFiltersCount > 2 && `(${activeFiltersCount - 2} more)`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Specializations */}
              <Grid item xs={12}>
                <Typography gutterBottom fontWeight="bold">Specializations</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {specializations.map(spec => (
                    <Chip
                      key={spec}
                      label={spec}
                      onClick={() => handleSpecializationToggle(spec)}
                      color={filters.specializations.includes(spec) ? 'primary' : 'default'}
                      variant={filters.specializations.includes(spec) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Languages */}
              <Grid item xs={12}>
                <Typography gutterBottom fontWeight="bold">Languages</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {languages.map(lang => (
                    <Chip
                      key={lang}
                      label={lang}
                      onClick={() => handleLanguageToggle(lang)}
                      color={filters.languages.includes(lang) ? 'secondary' : 'default'}
                      variant={filters.languages.includes(lang) ? 'filled' : 'outlined'}
                      size="small"
                    />
                  ))}
                </Box>
              </Grid>

              {/* Price Range */}
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>
                  Price Range: ₹{filters.minPrice} - ₹{filters.maxPrice}
                </Typography>
                <Slider
                  value={[filters.minPrice, filters.maxPrice]}
                  onChange={(e, value) => {
                    handleFilterChange('minPrice', value[0]);
                    handleFilterChange('maxPrice', value[1]);
                  }}
                  valueLabelDisplay="auto"
                  min={0}
                  max={10000}
                  step={100}
                  marks={[
                    { value: 0, label: '₹0' },
                    { value: 5000, label: '₹5k' },
                    { value: 10000, label: '₹10k' }
                  ]}
                />
              </Grid>

              {/* Experience */}
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>
                  Minimum Experience: {filters.minExperience} years
                </Typography>
                <Slider
                  value={filters.minExperience}
                  onChange={(e, value) => handleFilterChange('minExperience', value)}
                  valueLabelDisplay="auto"
                  min={0}
                  max={30}
                  step={1}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 15, label: '15' },
                    { value: 30, label: '30+' }
                  ]}
                />
              </Grid>

              {/* Location Details */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>State</InputLabel>
                  <Select
                    value={filters.state}
                    onChange={(e) => handleFilterChange('state', e.target.value)}
                  >
                    <MenuItem value="">All States</MenuItem>
                    {states.map(state => (
                      <MenuItem key={state} value={state}>{state}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Availability */}
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Preferred Date"
                  value={filters.date}
                  onChange={(date) => handleFilterChange('date', date)}
                  minDate={new Date()}
                  enableAccessibleFieldDOMStructure={false}
                  slots={{ textField: MuiTextField }}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Time Slot</InputLabel>
                  <Select
                    value={filters.timeSlot}
                    onChange={(e) => handleFilterChange('timeSlot', e.target.value)}
                  >
                    <MenuItem value="">Any Time</MenuItem>
                    <MenuItem value="morning">Morning (6AM-12PM)</MenuItem>
                    <MenuItem value="afternoon">Afternoon (12PM-6PM)</MenuItem>
                    <MenuItem value="evening">Evening (6PM-10PM)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={() => onSearch && onSearch(filters)}
            startIcon={<SearchIcon />}
            size="large"
          >
            Search
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearFilters}
            startIcon={<ClearIcon />}
          >
            Clear All Filters
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {activeFiltersCount} active filter{activeFiltersCount !== 1 && 's'}
          </Typography>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
};

export default SearchFilters;
