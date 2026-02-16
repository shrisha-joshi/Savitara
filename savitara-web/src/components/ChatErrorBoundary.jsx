import { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Paper,
} from '@mui/material';
import { RefreshRounded, ErrorOutline } from '@mui/icons-material';

class ChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Chat Error Boundary Caught:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // You can also log the error to an error reporting service here
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: true,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Reload the page if errors persist
    if (this.state.errorCount > 2) {
      globalThis.location.reload();
    }
  };

  handleGoHome = () => {
    globalThis.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <ErrorOutline
                sx={{
                  fontSize: 80,
                  color: 'error.main',
                }}
              />
              
              <Typography variant="h4" color="error" gutterBottom>
                Oops! Something went wrong
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                We encountered an unexpected error in the chat. Don&apos;t worry, your messages are safe.
              </Typography>

              <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
                <AlertTitle>Error Details</AlertTitle>
                {this.state.error && this.state.error.toString()}
              </Alert>

              {this.state.errorCount > 2 && (
                <Alert severity="warning" sx={{ width: '100%' }}>
                  Multiple errors detected. Clicking retry will reload the page.
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshRounded />}
                  onClick={this.handleRetry}
                  size="large"
                >
                  {this.state.errorCount > 2 ? 'Reload Page' : 'Try Again'}
                </Button>
                
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Go to Home
                </Button>
              </Box>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    width: '100%',
                    textAlign: 'left',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  <Typography variant="caption" component="pre" sx={{ fontSize: 11 }}>
                    {this.state.errorInfo.componentStack}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

ChatErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ChatErrorBoundary;
