import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Download,
  Delete
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../services/api';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function WaveformBars({ normalizedWaveform, playbackProgress, messageId, isSender }) {
  return normalizedWaveform.map((value, index) => {
    const isPlayed = (index / normalizedWaveform.length) * 100 < playbackProgress;
    let barColor;
    if (isPlayed && isSender) {
      barColor = 'primary.dark';
    } else if (isPlayed) {
      barColor = 'primary.main';
    } else if (isSender) {
      barColor = 'primary.lighter';
    } else {
      barColor = 'grey.300';
    }
    return (
      <Box
        key={`waveform-${messageId}-${index}`}
        sx={{
          flex: 1,
          height: `${Math.max(value * 100, 10)}%`,
          bgcolor: barColor,
          borderRadius: 0.5,
          transition: 'all 0.2s ease',
        }}
      />
    );
  });
}
WaveformBars.propTypes = {
  normalizedWaveform: PropTypes.arrayOf(PropTypes.number).isRequired,
  playbackProgress: PropTypes.number.isRequired,
  messageId: PropTypes.string.isRequired,
  isSender: PropTypes.bool.isRequired,
};

async function downloadVoiceMessage(playbackUrl, messageId) {
  try {
    const response = await fetch(playbackUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice_message_${messageId}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
  }
}

async function deleteVoiceMessage(messageId, onDelete) {
  try {
    await api.delete(`/messages/${messageId}`);
    onDelete(messageId);
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

function useAudioPlayback(audioRef, messageId, playbackUrl, duration) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState('');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const handleError = (e) => {
      console.error('Audio playback error:', e);
      setAudioError('Failed to play voice message');
      setIsPlaying(false);
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioRef]);

  const trackPlayback = useCallback(async () => {
    try {
      await api.post(`/messages/${messageId}/playback`, {
        duration_listened_s: 0,
        completion_percentage: 0,
      });
    } catch (err) {
      console.warn('Failed to track playback:', err);
    }
  }, [messageId]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !playbackUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => { setIsPlaying(true); trackPlayback(); })
        .catch((err) => { console.error('Playback failed:', err); setAudioError('Playback failed'); });
    }
  }, [audioRef, playbackUrl, isPlaying, trackPlayback]);

  const playbackProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  return { isPlaying, currentTime, audioError, togglePlayback, playbackProgress };
}


const PlaybackControls = ({ isLoading, isPlaying, onToggle, isSender, hasUrl }) => {
  if (isLoading) {
    return <CircularProgress size={32} />;
  }
  return (
    <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
      <IconButton
        onClick={onToggle}
        disabled={!hasUrl}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        aria-pressed={isPlaying}
        sx={{
          bgcolor: isSender ? 'primary.main' : 'grey.300',
          color: isSender ? 'white' : 'grey.700',
          '&:hover': {
            bgcolor: isSender ? 'primary.dark' : 'grey.400',
          },
        }}
      >
        {isPlaying ? <Pause /> : <PlayArrow />}
      </IconButton>
    </Tooltip>
  );
};

PlaybackControls.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  isPlaying: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  isSender: PropTypes.bool.isRequired,
  hasUrl: PropTypes.any, // Accepts boolean or object
};

const ActionButtons = ({ playbackUrl, messageId, isSender, onDelete }) => (
  <Box sx={{ display: 'flex', gap: 0.5 }}>
    <Tooltip title="Download">
      <span>
        <IconButton
          size="small"
          onClick={() => downloadVoiceMessage(playbackUrl, messageId)}
          disabled={!playbackUrl}
          aria-label="Download voice message"
        >
          <Download fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>

    {isSender && onDelete && (
      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={() => deleteVoiceMessage(messageId, onDelete)}
          aria-label="Delete voice message"
        >
          <Delete fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
  </Box>
);

ActionButtons.propTypes = {
  playbackUrl: PropTypes.string,
  messageId: PropTypes.string.isRequired,
  isSender: PropTypes.bool.isRequired,
  onDelete: PropTypes.func,
};


const MessageProgress = ({ isPlaying, playbackProgress, isSender }) => {
  if (!isPlaying) return null;
  return (
    <LinearProgress
      variant="determinate"
      value={playbackProgress}
      sx={{
        height: 2,
        borderRadius: 1,
        bgcolor: isSender ? 'primary.lighter' : 'grey.200',
        '& .MuiLinearProgress-bar': {
          bgcolor: isSender ? 'primary.dark' : 'primary.main',
        },
      }}
      aria-label={`Playback progress: ${Math.round(playbackProgress)}%`}
    />
  );
};
MessageProgress.propTypes = {
  isPlaying: PropTypes.bool.isRequired,
  playbackProgress: PropTypes.number.isRequired,
  isSender: PropTypes.bool.isRequired,
};

const TimestampDisplay = ({ createdAt, isSender }) => {
  if (!createdAt) return null;
  return (
    <Typography
      variant="caption"
      sx={{ opacity: 0.7, textAlign: isSender ? 'right' : 'left' }}
    >
      {format(new Date(createdAt), 'p')}
    </Typography>
  );
};
TimestampDisplay.propTypes = {
  createdAt: PropTypes.string,
  isSender: PropTypes.bool.isRequired,
};

/**
 * VoiceMessage Component
 *
 * Displays a voice message with playback controls, waveform visualization,
 * and playback progress tracking.
 */
const VoiceMessage = ({
  messageId,
  duration,
  waveform = [],
  mediaUrl,
  createdAt,
  isSender = false,
  onDelete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState(mediaUrl || null);
  const [fetchError, setFetchError] = useState('');
  const audioRef = useRef(null);

  const { isPlaying, currentTime, audioError, togglePlayback, playbackProgress } =
    useAudioPlayback(audioRef, messageId, playbackUrl, duration);

  const error = fetchError || audioError;

  const fetchPlaybackUrl = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/messages/${messageId}/media`);
      if (response.data.success) {
        setPlaybackUrl(response.data.data.playback_url);
      }
    } catch (err) {
      console.error('Failed to fetch playback URL:', err);
      setFetchError('Failed to load voice message');
    } finally {
      setIsLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    if (!playbackUrl && messageId) {
      fetchPlaybackUrl();
    }
  }, [messageId, playbackUrl, fetchPlaybackUrl]);

  const normalizedWaveform = waveform.length > 0 ? waveform : new Array(30).fill(0.3);

  if (error) {
    return (
      <Box
        sx={{ p: 2, bgcolor: 'error.light', borderRadius: 2, maxWidth: 280 }}
        role="alert"
      >
        <Typography variant="caption" color="error.dark">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 1.5,
        borderRadius: 2,
        bgcolor: isSender ? 'primary.light' : 'grey.100',
        maxWidth: 320,
        minWidth: 250,
      }}
      role="region"
      aria-label="Voice message"
    >
      {/* Playback URL Audio Element */}
      {playbackUrl && (
        <audio
          ref={audioRef}
          src={playbackUrl}
          preload="metadata"
          style={{ display: 'none' }}
        >
          <track kind="captions" />
        </audio>
      )}

      {/* Controls and Duration */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PlaybackControls
          isLoading={isLoading}
          isPlaying={isPlaying}
          onToggle={togglePlayback}
          isSender={isSender}
          hasUrl={playbackUrl}
        />

        <Box sx={{ flex: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 40, position: 'relative' }}
            role="img"
            aria-label="Audio waveform"
          >
            <WaveformBars
              normalizedWaveform={normalizedWaveform}
              playbackProgress={playbackProgress}
              messageId={messageId}
              isSender={isSender}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {formatTime(duration)}
            </Typography>
          </Box>
        </Box>

        <ActionButtons
          playbackUrl={playbackUrl}
          messageId={messageId}
          isSender={isSender}
          onDelete={onDelete}
        />
      </Box>

      <MessageProgress
        isPlaying={isPlaying}
        playbackProgress={playbackProgress}
        isSender={isSender}
      />

      <TimestampDisplay
        createdAt={createdAt}
        isSender={isSender}
      />
    </Box>
  );
};

VoiceMessage.propTypes = {
  messageId: PropTypes.string.isRequired,
  duration: PropTypes.number.isRequired,
  waveform: PropTypes.arrayOf(PropTypes.number),
  mediaUrl: PropTypes.string,
  createdAt: PropTypes.string,
  isSender: PropTypes.bool,
  onDelete: PropTypes.func,
};

export default VoiceMessage;
