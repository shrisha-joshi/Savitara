import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  alpha,
  CircularProgress
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  CheckCircle,
  Error as ErrorIcon,
  Close
} from '@mui/icons-material';
import api from '../services/api';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export default function FileUpload({ 
  onUploadComplete, 
  onError, 
  maxFiles = MAX_FILES,
  acceptedTypes = ALLOWED_EXTENSIONS,
  uploadType = 'documents', // 'documents', 'profile-picture', 'booking-attachment'
  multiple = true,
  showPreview = true
}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!acceptedTypes.includes(fileExt)) {
      return {
        valid: false,
        error: `File type ${fileExt} not allowed. Accepted: ${acceptedTypes.join(', ')}`
      };
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`
      };
    }
    
    return { valid: true };
  };

  const handleFileSelect = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    
    if (!multiple && fileArray.length > 1) {
      onError?.('Only one file allowed');
      return;
    }
    
    if (files.length + fileArray.length > maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`);
      return;
    }
    
    const validatedFiles = fileArray.map((file, index) => {
      const validation = validateFile(file);
      return {
        id: Date.now() + index,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: validation.valid ? 'pending' : 'error',
        error: validation.error,
        progress: 0,
        url: null
      };
    });
    
    setFiles(prev => [...prev, ...validatedFiles]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const updateFileProgress = (percentCompleted) => {
    setFiles(prev => prev.map(f => 
      f.status === 'pending' 
        ? { ...f, progress: percentCompleted }
        : f
    ));
  };

  const updateFilesWithUrls = (uploadedUrls) => {
    setFiles(prev => {
      // Create index inside the updater so it resets on each invocation (important for Strict Mode)
      let pendingFileIndex = 0;
      return prev.map(f => {
        if (f.status === 'pending') {
          const url = uploadedUrls[pendingFileIndex];
          pendingFileIndex++;
          return { ...f, status: 'success', progress: 100, url: url };
        }
        return f;
      });
    });
  };

  const markFilesAsFailed = (errorMessage) => {
    setFiles(prev => prev.map(f => 
      f.status === 'pending'
        ? { ...f, status: 'error', error: errorMessage }
        : f
    ));
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      onError?.('No files to upload');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      pendingFiles.forEach(fileObj => {
        formData.append('files', fileObj.file);
      });
      
      // Upload with progress tracking
      const response = await api.post(`/upload/${uploadType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          updateFileProgress(percentCompleted);
        }
      });
      
      if (response.data.success) {
        const uploadedUrls = response.data.data.urls;
        updateFilesWithUrls(uploadedUrls);
        onUploadComplete?.(uploadedUrls);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.detail || 'Upload failed';
      markFilesAsFailed(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(ext)) {
      return file.url || URL.createObjectURL(file.file);
    }
    return null;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (file) => {
    switch(file.status) {
      case 'success': return <CheckCircle color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      case 'pending': return <InsertDriveFile />;
      default: return <InsertDriveFile />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Drop Zone */}
      <Paper
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 4,
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'divider',
          backgroundColor: dragActive ? alpha('#FF6B35', 0.05) : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          textAlign: 'center',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: alpha('#FF6B35', 0.02)
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {dragActive ? 'Drop files here' : 'Drag & drop files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Accepted: {acceptedTypes.join(', ')} • Max {maxFiles} files • 10MB per file
        </Typography>
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </Paper>

      {/* File List */}
      {files.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Selected Files ({files.length}/{maxFiles})
          </Typography>
          <List>
            {files.map((fileObj) => (
              <ListItem
                key={fileObj.id}
                sx={{
                  mb: 1,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <ListItemIcon>
                  {showPreview && getFileIcon(fileObj) ? (
                    <Box
                      component="img"
                      src={getFileIcon(fileObj)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    getStatusIcon(fileObj)
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {fileObj.name}
                      </Typography>
                      <Chip 
                        label={fileObj.status} 
                        size="small" 
                        color={getStatusColor(fileObj.status)}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(fileObj.size)}
                      </Typography>
                      {fileObj.error && (
                        <Typography variant="caption" color="error" display="block">
                          {fileObj.error}
                        </Typography>
                      )}
                      {fileObj.status === 'pending' && uploading && (
                        <LinearProgress 
                          variant="determinate" 
                          value={fileObj.progress} 
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {fileObj.status !== 'success' && (
                    <IconButton 
                      edge="end" 
                      onClick={() => removeFile(fileObj.id)}
                      disabled={uploading}
                    >
                      <Close />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          {/* Upload Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={uploadFiles}
            disabled={uploading || files.filter(f => f.status === 'pending').length === 0}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
            sx={{ mt: 2 }}
          >
            {uploading ? 'Uploading...' : `Upload ${files.filter(f => f.status === 'pending').length} File(s)`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

FileUpload.propTypes = {
  onUploadComplete: PropTypes.func,
  onError: PropTypes.func,
  maxFiles: PropTypes.number,
  acceptedTypes: PropTypes.arrayOf(PropTypes.string),
  uploadType: PropTypes.string,
  multiple: PropTypes.bool,
  showPreview: PropTypes.bool
};
