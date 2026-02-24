import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Box, CircularProgress, Skeleton } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';

/**
 * LazyImage Component
 * 
 * Lazy loads images using IntersectionObserver for better performance
 * in chat messages with many images. Only loads images when they're
 * near the viewport.
 * 
 * Features:
 * - IntersectionObserver for efficient lazy loading
 * - Loading skeleton while image loads
 * - Error state with fallback icon
 * - Automatic retry on failure
 * - Maintains aspect ratio
 */
const LazyImage = ({
  src,
  alt = '',
  width = '100%',
  height = 'auto',
  maxWidth = '300px',
  maxHeight = '300px',
  borderRadius = '8px',
  onLoad,
  onError,
  className = '',
  style = {},
  threshold = 0.1,
  rootMargin = '50px',
  retryAttempts = 2
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    // Create IntersectionObserver to detect when image enters viewport
    const options = {
      root: null, // viewport
      rootMargin, // Load images slightly before they enter viewport
      threshold // Trigger when 10% of image is visible
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
          // Disconnect observer after image is in view (only load once)
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
        }
      });
    }, options);

    // Start observing the image element
    if (imgRef.current && observerRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isInView, rootMargin, threshold]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
    if (onLoad) {
      onLoad();
    }
  };

  const handleImageError = () => {
    setIsLoading(false);
    
    // Retry loading if attempts remain
    if (retryCount < retryAttempts) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setHasError(false);
        setIsLoading(true);
      }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s, 3s...
    } else {
      setHasError(true);
      if (onError) {
        onError();
      }
    }
  };

  const containerStyle = {
    position: 'relative',
    width,
    height,
    maxWidth,
    maxHeight,
    borderRadius,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius,
    display: isLoading ? 'none' : 'block'
  };

  return (
    <Box ref={imgRef} sx={containerStyle} className={className}>
      {/* Show loading skeleton while image is loading */}
      {isLoading && !hasError && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
          sx={{ borderRadius, position: 'absolute', top: 0, left: 0 }}
        />
      )}

      {/* Show error state if image failed to load */}
      {hasError && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            gap: 1
          }}
        >
          <ImageIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Box sx={{ fontSize: '0.75rem', textAlign: 'center' }}>
            Image unavailable
          </Box>
        </Box>
      )}

      {/* Only load actual image when it's in viewport */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          style={imageStyle}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy" // Browser-native lazy loading as fallback
        />
      )}

      {/* Show spinner during initial load */}
      {isLoading && !hasError && isInView && (
        <CircularProgress
          size={30}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-15px',
            marginLeft: '-15px'
          }}
        />
      )}
    </Box>
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  maxHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  borderRadius: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  threshold: PropTypes.number,
  rootMargin: PropTypes.string,
  retryAttempts: PropTypes.number
};

export default LazyImage;
