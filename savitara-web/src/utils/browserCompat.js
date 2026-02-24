/**
 * Browser Compatibility Utilities
 * 
 * Detects browser features for graceful degradation
 * and provides user-friendly messages for unsupported browsers.
 */

/**
 * Check if MediaRecorder API is supported
 * @returns {Object} Support status and details
 */
export const checkMediaRecorderSupport = () => {
  const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  
  if (!hasMediaDevices) {
    return {
      supported: false,
      reason: 'no_media_devices',
      message: 'Your browser does not support microphone access. Please use Chrome, Firefox, Safari 14+, or Edge.',
      canFallback: false
    };
  }
  
  if (!hasMediaRecorder) {
    return {
      supported: false,
      reason: 'no_media_recorder',
      message: 'Voice recording is not supported in your browser. Please update to the latest version or use Chrome/Firefox.',
      canFallback: false
    };
  }
  
  // Check for supported MIME types
  const supportedCodecs = [];
  const codecs = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/ogg',
    'audio/mp4'
  ];
  
  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      supportedCodecs.push(codec);
    }
  }
  
  if (supportedCodecs.length === 0) {
    return {
      supported: false,
      reason: 'no_codecs',
      message: 'No supported audio codecs found. Please update your browser.',
      canFallback: false
    };
  }
  
  return {
    supported: true,
    codecs: supportedCodecs,
    preferredCodec: supportedCodecs[0],
    message: 'Voice recording is fully supported'
  };
};

/**
 * Check WebSocket support
 * @returns {boolean} True if WebSocket is supported
 */
export const checkWebSocketSupport = () => {
  return typeof WebSocket !== 'undefined';
};

/**
 * Check Notification API support
 * @returns {Object} Support status and permission
 */
export const checkNotificationSupport = () => {
  if (!('Notification' in window)) {
    return {
      supported: false,
      permission: 'denied',
      message: 'Browser notifications are not supported'
    };
  }
  
  return {
    supported: true,
    permission: Notification.permission,
    message: Notification.permission === 'granted' 
      ? 'Notifications enabled' 
      : 'Notifications need permission'
  };
};

/**
 * Check IndexedDB support (for offline storage)
 * @returns {boolean} True if IndexedDB is supported
 */
export const checkIndexedDBSupport = () => {
  return typeof indexedDB !== 'undefined';
};

/**
 * Detect browser and version
 * @returns {Object} Browser name and version
 */
export const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browserName = 'Unknown';
  let browserVersion = 'Unknown';
  let isSupported = true;
  let warnings = [];
  
  // Chrome
  if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
    browserName = 'Chrome';
    const match = ua.match(/Chrome\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
    if (parseInt(browserVersion) < 49) {
      isSupported = false;
      warnings.push('Chrome 49+ is required for full functionality');
    }
  }
  // Edge
  else if (ua.indexOf('Edg') > -1) {
    browserName = 'Edge';
    const match = ua.match(/Edg\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
    if (parseInt(browserVersion) < 79) {
      isSupported = false;
      warnings.push('Edge 79+ is required for full functionality');
    }
  }
  // Firefox
  else if (ua.indexOf('Firefox') > -1) {
    browserName = 'Firefox';
    const match = ua.match(/Firefox\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
    if (parseInt(browserVersion) < 25) {
      isSupported = false;
      warnings.push('Firefox 25+ is required for full functionality');
    }
  }
  // Safari
  else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
    browserName = 'Safari';
    const match = ua.match(/Version\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
    if (parseInt(browserVersion) < 14) {
      warnings.push('Safari 14.1+ recommended for best experience');
    }
  }
  // Opera
  else if (ua.indexOf('OPR') > -1) {
    browserName = 'Opera';
    const match = ua.match(/OPR\/(\d+)/);
    browserVersion = match ? match[1] : 'Unknown';
  }
  
  return {
    name: browserName,
    version: browserVersion,
    isSupported,
    warnings,
    userAgent: ua
  };
};

/**
 * Comprehensive compatibility check
 * @returns {Object} All compatibility checks
 */
export const checkAllCompatibility = () => {
  const mediaRecorder = checkMediaRecorderSupport();
  const webSocket = checkWebSocketSupport();
  const notifications = checkNotificationSupport();
  const indexedDB = checkIndexedDBSupport();
  const browser = getBrowserInfo();
  
  const allSupported = 
    mediaRecorder.supported &&
    webSocket &&
    indexedDB &&
    browser.isSupported;
  
  return {
    mediaRecorder,
    webSocket,
    notifications,
    indexedDB,
    browser,
    allSupported,
    summary: allSupported 
      ? 'All features supported ✅'
      : 'Some features may not work in this browser ⚠️'
  };
};

/**
 * Request microphone permission
 * @returns {Promise<Object>} Permission status
 */
export const requestMicrophonePermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());
    
    return {
      granted: true,
      stream: null,
      message: 'Microphone access granted'
    };
  } catch (error) {
    let message = 'Microphone access denied';
    
    if (error.name === 'NotAllowedError') {
      message = 'Please allow microphone access in your browser settings';
    } else if (error.name === 'NotFoundError') {
      message = 'No microphone found. Please connect a microphone and try again';
    } else if (error.name === 'NotReadableError') {
      message = 'Microphone is being used by another application';
    }
    
    return {
      granted: false,
      error: error.name,
      message
    };
  }
};

/**
 * Check if on HTTPS (required for some features in production)
 * @returns {Object} HTTPS status
 */
export const checkHTTPS = () => {
  const isSecure = window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1';
  
  return {
    isSecure,
    protocol: window.location.protocol,
    message: isSecure 
      ? 'Secure connection ✅'
      : '⚠️ Some features require HTTPS in production'
  };
};

export default {
  checkMediaRecorderSupport,
  checkWebSocketSupport,
  checkNotificationSupport,
  checkIndexedDBSupport,
  getBrowserInfo,
  checkAllCompatibility,
  requestMicrophonePermission,
  checkHTTPS
};
