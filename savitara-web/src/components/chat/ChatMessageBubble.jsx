import AttachFileIcon from '@mui/icons-material/AttachFile'
import DoneIcon from '@mui/icons-material/Done'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import ReplayIcon from '@mui/icons-material/Replay'
import {
  Box,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material'
import PropTypes from 'prop-types'

import EmojiPickerButton from '../EmojiPickerButton'
import MessageReactions from '../MessageReactions'
import VoiceMessagePlayer from '../VoiceMessagePlayer'
import { formatLocalTime } from '../../utils/timeFormat'

function renderMessageContent(msg, isMe) {
  if (msg.message_type === 'voice') {
    return (
      <VoiceMessagePlayer
        audioUrl={msg.media_url}
        duration={msg.duration_s}
        waveform={msg.waveform}
      />
    )
  }

  if (msg.message_type === 'image') {
    return (
      <Box
        component="img"
        src={msg.media_url}
        alt="Image message"
        sx={{
          maxWidth: '100%',
          borderRadius: 1,
          cursor: 'pointer',
          '&:hover': { opacity: 0.9 },
        }}
        onClick={() => window.open(msg.media_url, '_blank')}
      />
    )
  }

  if (msg.message_type === 'file') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AttachFileIcon fontSize="small" />
        <Typography
          variant="body2"
          component="a"
          href={msg.media_url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: isMe ? 'white' : 'primary.main',
            textDecoration: 'underline',
          }}
        >
          {msg.file_name || 'Download File'}
        </Typography>
      </Box>
    )
  }

  return (
    <>
      {msg.forwarded_from && (
        <Box
          sx={{
            borderLeft: 2,
            borderColor: isMe ? 'rgba(255,255,255,0.5)' : 'primary.main',
            pl: 1,
            mb: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Forwarded from {msg.forwarded_from?.name || 'Unknown'}
          </Typography>
        </Box>
      )}
      <Typography variant="body1">{msg.content}</Typography>
    </>
  )
}

export default function ChatMessageBubble({
  msg,
  currentUserId,
  timezone,
  onContextMenu,
  onReact,
  onUnreact,
  onRetryFailed,
}) {
  const isMe = msg.sender_id === currentUserId
  const msgTime = msg.created_at || msg.timestamp
  const msgId = msg.id || msg._id

  return (
    <Box
      key={msgId || `${msg.sender_id}-${msgTime}`}
      onContextMenu={(e) => onContextMenu(e, msg)}
      sx={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '70%',
        mb: 1.5,
        p: 1.5,
        bgcolor: isMe ? 'primary.main' : 'white',
        color: isMe ? 'white' : 'text.primary',
        borderRadius: 2,
        boxShadow: 1,
        cursor: 'context-menu',
        position: 'relative',
        '&:hover .emoji-picker': {
          opacity: 1,
        },
      }}
    >
      {renderMessageContent(msg, isMe)}

      {msg.reactions && msg.reactions.length > 0 && (
        <MessageReactions
          reactions={msg.reactions}
          currentUserId={currentUserId}
          onReact={(emoji) => onReact(msgId, emoji)}
          onUnreact={(emoji) => onUnreact(msgId, emoji)}
        />
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 0.5,
          gap: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {msgTime ? formatLocalTime(msgTime, timezone) : ''}
          </Typography>
          {isMe && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {msg.status === 'read' && (
                <DoneAllIcon sx={{ fontSize: 14, color: '#4fc3f7' }} />
              )}
              {msg.status === 'delivered' && (
                <DoneAllIcon sx={{ fontSize: 14, opacity: 0.7 }} />
              )}
              {msg.status === 'sent' && (
                <DoneIcon sx={{ fontSize: 14, opacity: 0.7 }} />
              )}
              {msg.status === 'sending' && (
                <CircularProgress
                  size={10}
                  sx={{ color: 'rgba(255,255,255,0.65)' }}
                />
              )}
              {msg.status === 'failed' && (
                <IconButton
                  size="small"
                  onClick={() => onRetryFailed(msg._tempId)}
                  title="Send failed — tap to retry"
                  sx={{ p: 0, color: '#ff5252', '&:hover': { color: '#ff1744' } }}
                >
                  <ReplayIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
              {!msg.status && <DoneIcon sx={{ fontSize: 14, opacity: 0.4 }} />}
            </Box>
          )}
        </Box>

        <Box className="emoji-picker" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
          <EmojiPickerButton onSelect={(emoji) => onReact(msgId, emoji)} size="small" />
        </Box>
      </Box>
    </Box>
  )
}

ChatMessageBubble.propTypes = {
  msg: PropTypes.object.isRequired,
  currentUserId: PropTypes.string,
  timezone: PropTypes.string,
  onContextMenu: PropTypes.func.isRequired,
  onReact: PropTypes.func.isRequired,
  onUnreact: PropTypes.func.isRequired,
  onRetryFailed: PropTypes.func.isRequired,
}
