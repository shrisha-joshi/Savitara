import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress,
  Paper,
  LinearProgress,
  Alert,
  AlertTitle,
  Button
} from '@mui/material';
import {
  Mic,
  Stop,
  Send,
  Close,
  PlayArrow,
  Pause,
  Delete
} from '@mui/icons-material';
import api from '../services/api';
import { checkMediaRecorderSupport, getBrowserInfo } from '../utils/browserCompat';

const MAX_DURATION_SECONDS = 90;
const WAVEFORM_SAMPLES = 50;

/**
 * VoiceRecorder Component
 * 
 * Records voice messages up to 90 seconds with waveform visualization,
 * preview playback, and upload to backend.
 * 
 * Features:
 * - MediaRecorder API with WebM/Opus codec
 * - Real-time duration timer
 * - Waveform visualization during recording
 * - Preview playback before sending
 * - Permission handling
 * - Accessible with ARIA labels and keyboard navigation
 */
const VoiceRecorder = ({ conversationId, onSend, onCancel }) => {
  const [state, setState] = useState('idle'); // idle | recording | preview | uploading | error | unsupported
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [waveform, setWaveform] = useState(new Array(WAVEFORM_SAMPLES).fill(0));
  const [browserSupport, setBrowserSupport] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioElementRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Check browser compatibility on mount
  useEffect(() => {
    const support = checkMediaRecorderSupport();
    const browser = getBrowserInfo();
    setBrowserSupport({ ...support, browser });
    
    if (!support.supported) {
      setState('unsupported');
      setErrorMessage(support.message);
    }
  }, []);

  const cleanupResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      cleanupResources();
    };
  }, [cleanupResources]);

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      audioStreamRef.current = stream;

      // Check for supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128kbps
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Setup audio analyzer for waveform
      setupAudioAnalyzer(stream);

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        setState('preview');
        
        // Stop waveform visualization
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      // Start recording with 250ms data chunks
      mediaRecorder.start(250);
      setState('recording');

      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setDuration(seconds);

        // Auto-stop at max duration
        if (seconds >= MAX_DURATION_SECONDS) {
          stopRecording();
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      let message = 'Failed to access microphone';
      
      if (error.name === 'NotAllowedError') {
        message = 'Microphone permission denied';
      } else if (error.name === 'NotFoundError') {
        message = 'No microphone found';
      } else if (error.name === 'NotSupportedError') {
        message = 'Voice recording not supported in this browser';
      }
      
      setErrorMessage(message);
      setState('error');
      cleanupResources();
    }
  };

  const setupAudioAnalyzer = (stream) => {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    
    analyserRef.current = { analyser, audioContext };
    
    // Start waveform visualization
    visualizeWaveform();
  };

  const visualizeWaveform = () => {
    if (!analyserRef.current) return;
    
    const { analyser } = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (state !== 'recording') return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Sample the frequency data to create waveform
      const samples = [];
      const step = Math.floor(bufferLength / WAVEFORM_SAMPLES);
      
      for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
        const value = dataArray[i * step] / 255; // Normalize to 0-1
        samples.push(value);
      }
      
      setWaveform(samples);
      animationFrameRef.current = requestAnimationFrame(draw);
    };
    
    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const togglePreviewPlayback = () => {
    const audio = audioElementRef.current;
    
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
      };
    }
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    try {
      setState('uploading');

      // Step 1: Request upload URL from backend
      const uploadResponse = await api.post('/voice/upload', {
        mime_type: audioBlob.type,
        file_size_bytes: audioBlob.size,
      });

      const { upload_url, storage_key, upload_token } = uploadResponse.data.data;

      // Step 2: Upload to S3 or local storage
      let uploadSuccess = false;

      if (upload_url) {
        // S3 presigned URL upload
        const s3Response = await fetch(upload_url, {
          method: 'PUT',
          body: audioBlob,
          headers: {
            'Content-Type': audioBlob.type,
          },
        });
        uploadSuccess = s3Response.ok;
      } else if (upload_token) {
        // Local storage upload
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice.webm');
        
        const localResponse = await api.post(`/voice/upload/${upload_token}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        uploadSuccess = localResponse.status === 200;
      }

      if (!uploadSuccess) {
        throw new Error('Upload failed');
      }

      // Step 3: Create voice message record
      const messageResponse = await api.post(`/conversations/${conversationId}/voice`, {
        storage_key,
        duration_s: Math.floor(duration),
        waveform: calculateStaticWaveform(audioBlob),
      });

      // Step 4: Notify parent component
      if (onSend) {
        onSend(messageResponse.data.data);
      }

      // Reset state
      cleanupResources();
      setState('idle');
      setDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);

    } catch (error) {
      console.error('Failed to send voice message:', error);
      setErrorMessage('Failed to send voice message. Please try again.');
      setState('error');
    }
  };

  const calculateStaticWaveform = (_blob) => {
    // For now, return the recorded waveform
    // In production, you'd extract this from the audio file server-side
    return waveform.map(v => Math.round(v * 100) / 100);
  };

  const handleCancel = () => {
    if (state === 'recording') {
      stopRecording();
    }
    
    cleanupResources();
    setState('idle');
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setErrorMessage('');
    
    if (onCancel) {
      onCancel();
    }
  };

  const handleDelete = () => {
    cleanupResources();
    setState('idle');
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render different UI based on state
  if (state === 'idle') {
    return (
      <Tooltip title="Record voice message">
        <IconButton
          onClick={startRecording}
          aria-label="Record voice message"
          sx={{
            color: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.light',
              opacity: 0.1,
            }
          }}
        >
          <Mic />
        </IconButton>
      </Tooltip>
    );
  }

  if (state === 'error') {
    return (
      <Paper 
        sx={{ 
          p: 2, 
          bgcolor: 'error.light',
          color: 'error.contrastText',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
        role="alert"
      >
        <Typography variant="body2">{errorMessage}</Typography>
        <IconButton size="small" onClick={handleCancel} aria-label="Close error">
          <Close fontSize="small" />
        </IconButton>
      </Paper>
    );
  }
  // Render unsupported browser UI
  if (state === 'unsupported') {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          borderRadius: 2,
        }}
      >
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Voice Recording Not Supported</AlertTitle>
          {errorMessage}
          {browserSupport?.browser && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Browser: {browserSupport.browser.name} {browserSupport.browser.version}
            </Typography>
          )}
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button 
            variant="outlined" 
            startIcon={<Close />}
            onClick={onCancel}
          >
            Close
          </Button>
        </Box>
      </Paper>
    );
  }
  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
      }}
      role="region"
      aria-label="Voice recorder"
    >
      {/* Timer Display */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography 
          variant="h6" 
          aria-live="polite"
          aria-atomic="true"
        >
          {formatDuration(duration)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {state === 'recording' && `Max ${MAX_DURATION_SECONDS}s`}
          {state === 'preview' && 'Preview'}
          {state === 'uploading' && 'Sending...'}
        </Typography>
      </Box>

      {/* Waveform Visualization */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-around',
          height: 60,
          gap: 0.5,
        }}
        aria-label="Audio waveform visualization"
        role="img"
      >
        {waveform.map((value, index) => (
          <Box
            key={`wave-bar-${index}-${Math.round(value * 100)}`}
            sx={{
              width: 3,
              height: `${Math.max(value * 100, 5)}%`,
              bgcolor: state === 'recording' ? 'error.main' : 'primary.main',
              borderRadius: 1,
              transition: 'height 0.1s ease',
            }}
          />
        ))}
      </Box>

      {/* Upload Progress */}
      {state === 'uploading' && (
        <LinearProgress sx={{ width: '100%' }} />
      )}

      {/* Audio Preview Element (hidden) */}
      {audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          style={{ display: 'none' }}
          aria-label="Voice message preview"
        >
          <track kind="captions" />
        </audio>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {state === 'recording' && (
          <>
            <Tooltip title="Stop recording">
              <IconButton
                onClick={stopRecording}
                aria-label="Stop recording"
                color="error"
                size="large"
              >
                <Stop fontSize="large" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancel">
              <IconButton
                onClick={handleCancel}
                aria-label="Cancel recording"
              >
                <Close />
              </IconButton>
            </Tooltip>
          </>
        )}

        {state === 'preview' && (
          <>
            <Tooltip title={isPlaying ? 'Pause' : 'Play preview'}>
              <IconButton
                onClick={togglePreviewPlayback}
                aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                aria-pressed={isPlaying}
                color="primary"
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete and re-record">
              <IconButton
                onClick={handleDelete}
                aria-label="Delete recording"
              >
                <Delete />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send voice message">
              <IconButton
                onClick={handleSend}
                aria-label="Send voice message"
                color="success"
                size="large"
              >
                <Send fontSize="large" />
              </IconButton>
            </Tooltip>
          </>
        )}

        {state === 'uploading' && (
          <CircularProgress size={24} />
        )}
      </Box>
    </Paper>
  );
};

VoiceRecorder.propTypes = {
  conversationId: PropTypes.string.isRequired,
  onSend: PropTypes.func,
  onCancel: PropTypes.func,
};

export default VoiceRecorder;
