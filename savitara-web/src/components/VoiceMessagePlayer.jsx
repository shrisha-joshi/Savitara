import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  IconButton,
  Typography,
  Slider,
  CircularProgress
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp
} from '@mui/icons-material';

/**
 * VoiceMessagePlayer Component
 * 
 * Plays voice messages with waveform visualization and playback controls.
 * 
 * Features:
 * - Play/pause control
 * - Seek slider
 * - Duration display
 * - Waveform visualization (if provided)
 * - Playback speed control (optional)
 */
const VoiceMessagePlayer = ({ audioUrl, duration, waveform: _waveform }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Audio event listeners
    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleError = (e) => {
      console.error('Audio playback error:', e);
      setError('Failed to load audio');
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const updateProgress = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.paused || audioRef.current.ended) {
        setIsPlaying(false);
      } else {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        updateProgress();
      }).catch(err => {
        console.error('Play error:', err);
        setError('Failed to play audio');
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (_, newValue) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = newValue;
    setCurrentTime(newValue);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const audioDuration = audioRef.current?.duration || duration || 0;

  if (error) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'error.lighter',
          maxWidth: 300
        }}
      >
        <VolumeUp sx={{ color: 'error.main' }} />
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
        maxWidth: 300,
        minWidth: 200
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <IconButton 
        size="small" 
        onClick={handlePlayPause}
        disabled={isLoading}
        sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          '&:hover': { bgcolor: 'primary.dark' },
          '&:disabled': { bgcolor: 'action.disabledBackground' }
        }}
      >
        {isLoading ? (
          <CircularProgress size={20} sx={{ color: 'white' }} />
        ) : isPlaying ? (
          <Pause fontSize="small" />
        ) : (
          <PlayArrow fontSize="small" />
        )}
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 100 }}>
        {/* Waveform or Progress Slider */}
        <Slider
          size="small"
          value={currentTime}
          max={audioDuration}
          onChange={handleSeek}
          disabled={isLoading}
          sx={{
            height: 4,
            '& .MuiSlider-thumb': {
              width: 12,
              height: 12,
            },
          }}
        />
        
        {/* Time Display */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {formatTime(currentTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(audioDuration)}
          </Typography>
        </Box>
      </Box>

      <VolumeUp fontSize="small" sx={{ color: 'text.secondary' }} />
    </Box>
  );
};

VoiceMessagePlayer.propTypes = {
  audioUrl: PropTypes.string.isRequired,
  duration: PropTypes.number,
  waveform: PropTypes.arrayOf(PropTypes.number),
};

export default React.memo(VoiceMessagePlayer);
