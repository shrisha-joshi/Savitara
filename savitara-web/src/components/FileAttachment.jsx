import PropTypes from 'prop-types';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * FileAttachment - Displays file attachments in chat messages
 * Supports images, PDFs, and generic files
 */
const FileAttachment = ({ attachment, inMessage = true }) => {
  if (!attachment) return null;

  const { file_name, file_url, file_type, file_size } = attachment;
  
  const isImage = file_type?.startsWith('image/');
  const isPdf = file_type === 'application/pdf' || file_name?.endsWith('.pdf');
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file_url;
    link.download = file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isImage) {
    return (
      <Box
        sx={{
          position: 'relative',
          borderRadius: 1,
          overflow: 'hidden',
          maxWidth: inMessage ? 250 : 300,
          mb: inMessage ? 1 : 0
        }}
      >
        <img
          src={file_url}
          alt={file_name}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            cursor: 'pointer'
          }}
          onClick={() => window.open(file_url, '_blank')}
        />
        <IconButton
          size="small"
          onClick={handleDownload}
          aria-label="Download file"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)'
            }
          }}
        >
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Paper
      elevation={1}
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        maxWidth: inMessage ? 250 : 300,
        mb: inMessage ? 1 : 0,
        bgcolor: 'rgba(255, 255, 255, 0.1)',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.2)'
        }
      }}
      onClick={handleDownload}
    >
      {isPdf ? (
        <PictureAsPdfIcon sx={{ fontSize: 32, color: 'error.main' }} />
      ) : (
        <InsertDriveFileIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
      )}
      
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {file_name}
        </Typography>
        {file_size && (
          <Typography variant="caption" color="text.secondary">
            {formatFileSize(file_size)}
          </Typography>
        )}
      </Box>
      
      <IconButton size="small">
        <DownloadIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
};

FileAttachment.propTypes = {
  attachment: PropTypes.shape({
    file_name: PropTypes.string,
    file_url: PropTypes.string,
    file_type: PropTypes.string,
    file_size: PropTypes.number
  }),
  inMessage: PropTypes.bool
};

export default FileAttachment;
