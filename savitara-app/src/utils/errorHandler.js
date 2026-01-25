/**
 * Human-Readable Error Handler
 * Maps technical error codes/messages to user-friendly text as per Savitara UX guidelines.
 */
export const getErrorMessage = (error) => {
  if (!error) return null;

  // If error is already a string, check if we need to sanitize it further
  if (typeof error === 'string') {
      const lowerError = error.toLowerCase();
      if (lowerError.includes('network error') || lowerError.includes('network request failed')) {
          return "You seem to be offline. Check your connection.";
      }
      if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
          return "Incorrect mobile or password. Please try again.";
      }
      if (lowerError.includes('timeout')) {
          return "Taking too long to connect. Please pull down to refresh.";
      }
      return error;
  }

  const status = error.response?.status;
  // Get backend specific detail or fall back to generic message
  const backendMessage = error.response?.data?.detail 
                      || error.response?.data?.message
                      || error.message;

  // 1. Network / Connection Errors
  if (backendMessage === 'Network Error' || String(backendMessage).includes('Network request failed')) {
    return "You seem to be offline. Check your connection.";
  }
  
  if (backendMessage && String(backendMessage).toLowerCase().includes('timeout')) {
      return "Taking too long to connect. Please pull down to refresh.";
  }

  // 2. HTTP Status Codes mapping
  switch (status) {
    case 400:
        // Try to be specific if backend sends specific validation error
        if (typeof backendMessage === 'string' && backendMessage.length < 50) {
            return backendMessage; 
        }
        return "Please check the information you entered.";
    
    case 401:
      return "Incorrect mobile or password. Please try again.";
    
    case 403:
      return "Access denied. You don't have permission for this.";
    
    case 404:
      return "We couldn't find what you were looking for.";
    
    case 409:
      return "This mobile number/email is already registered. Try logging in?";
    
    case 422:
       return "Please fill in all required fields correctly.";
    
    case 429:
        return "Too many requests. Please wait a moment.";
    
    case 500:
    case 502:
    case 503:
    case 504:
      return "Something went wrong on our end. We're fixing it!";
      
    default:
      // Fallback for unexpected errors
      return "Something went wrong. Please try again.";
  }
};
