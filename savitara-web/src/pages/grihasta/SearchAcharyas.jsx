import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Box, 
  Alert,
  Pagination,
  CircularProgress,
} from '@mui/material';
import Layout from '../../components/Layout';
import SearchFilters from '../../components/SearchFilters';
import AcharyaCard from '../../components/cards/AcharyaCard';
import api from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';

export default function SearchAcharyas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [acharyas, setAcharyas] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0
  });
  const [error, setError] = useState(null);
  
  const location = useLocation();

  // Parse URL parameters for initial filters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const serviceParam = params.get('service');
    
    if (serviceParam) {
      // Map service param to specialization format if needed, or pass directly
      // Assuming naive mapping for now (title casing might be needed matching the array in SearchFilters)
      // The array in SearchFilters is Title Case: 'Vedic Rituals', 'Astrology Consultation'
      // The param from Home is lowercase: 'astrology', 'vedic rituals' or similar.
      
    }
  }, [location.search]);

  // We actually need to pass these to SearchFilters.
  // Let's derive initialFilters from location ONCE or memoized.
  const getInitialFiltersFromUrl = () => {
    const params = new URLSearchParams(location.search);
    const service = params.get('service');
    const filters = {};
    
    if (service) {
      // Simple mapping attempt - this relies on the backend fuzzy search or specific mapping
      // If backend supports 'query', we can put it there.
      filters.query = service; 
      // If we want to map to specializations, we need the list. 
      // For now, putting it in query is the safest "search" behavior.
    }
    return filters;
  };
  
  const [initialFilters] = useState(getInitialFiltersFromUrl());

  const fetchAcharyas = useCallback(async (filters = {}, page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      // Map filters to backend query params
      const params = {
        page,
        limit: pagination.limit,
        query: filters.query || undefined,
        city: filters.city || undefined,
        state: filters.state || undefined,
        // Backend expects single string for these, but UI might send array
        specialization: filters.specializations?.length ? filters.specializations[0] : undefined,
        language: filters.languages?.length ? filters.languages[0] : undefined,
        min_rating: filters.minRating || 0,
        max_price: filters.maxPrice || undefined,
        sort_by: filters.sortBy || 'relevance'
      };

      // Remove undefined keys
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await api.get('/users/acharyas', { params });
      
      if (response.data?.success) {
        setAcharyas(response.data.data?.acharyas || []);
        const paginationData = response.data.data?.pagination;
        if (paginationData) {
          setPagination(prev => ({
            ...prev, 
            ...paginationData
          }));
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to load Acharyas. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  // Initial load is handled by the SearchFilters component's initial useEffect/interaction
  // or we can trigger it here if SearchFilters doesn't fire immediately.
  // SearchFilters has a debounce that fires onFiltersChange.
  

  // State to hold current filters for pagination
  const [currentFilters, setCurrentFilters] = useState({});

  const onFiltersAndUpdate = useCallback((filters) => {
    setCurrentFilters(filters);
    fetchAcharyas(filters, 1);
  }, [fetchAcharyas]);

  const onPageChangeWithFilters = (event, value) => {
    setPagination(prev => ({ ...prev, page: value }));
    fetchAcharyas(currentFilters, value);
  };

  return (
    <Layout>
      <Box sx={{ 
        background: 'linear-gradient(to bottom, #FFF3E0, #FFFFFF)',
        minHeight: '100vh',
        pb: 8
      }}>
        {/* Header Section */}
        <Box sx={{ 
          pt: 4, 
          pb: 6, 
          textAlign: 'center',
          background: 'rgba(255, 152, 0, 0.05)',
          mb: 4
        }}>
          <Container maxWidth="lg">
            <Typography variant="h3" component="h1" gutterBottom sx={{ 
              fontWeight: 700,
              color: 'var(--saffron-dark)'
            }}>
              Find Your Spiritual Guide
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 800, mx: 'auto' }}>
              Connect with verified Vedic Acharyas for personalized rituals, 
              ceremonies, and spiritual consultation.
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="xl">
          <Grid container spacing={3}>
            {/* Filters Section (Horizontal) */}
            <Grid item xs={12}>
              <Box sx={{ mb: 3 }}>
                <SearchFilters 
                  onFiltersChange={onFiltersAndUpdate} 
                  initialFilters={initialFilters}
                />
              </Box>
            </Grid>

            {/* Results Area */}
            <Grid item xs={12}>
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                  <CircularProgress color="primary" />
                </Box>
              )}
              {!loading && error && (
                <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
              )}
              {!loading && !error && (
                <>
                  <Grid container spacing={3}>
                    {acharyas.length > 0 ? (
                      acharyas.map((acharya) => (
                        <Grid item xs={12} sm={6} lg={4} key={acharya._id || acharya.id}>
                          <AcharyaCard 
                            acharya={acharya} 
                            onViewProfile={(id) => navigate(`/acharya/${id}`)}
                            onBook={(id, mode) => navigate(`/booking/create/${id}?mode=${mode || 'instant'}`)}
                            onChat={(id) => navigate(`/chat/u/${id}`)}
                          />
                        </Grid>
                      ))
                    ) : (
                      <Grid item xs={12}>
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                          <Typography variant="h6" color="text.secondary">
                            No Acharyas found matching your criteria.
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Try adjusting your filters or location.
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>

                  {/* Pagination */}
                  {acharyas.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                      <Pagination 
                        count={pagination.pages} 
                        page={pagination.page} 
                        onChange={onPageChangeWithFilters}
                        color="primary" 
                        size="large"
                      />
                    </Box>
                  )}
                </>
              )}
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Layout>
  )
}
