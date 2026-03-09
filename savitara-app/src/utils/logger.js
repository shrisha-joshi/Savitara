/* eslint-disable no-console */
/**
 * Development-only logger utility.
 * In production builds, log() is a no-op.
 * warn() and error() are always active for operational visibility.
 */
const logger = {
  log: (...args) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default logger;
