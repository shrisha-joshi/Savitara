/* eslint-disable no-console */
/**
 * Development-only logger utility.
 * In production builds, log() is a no-op.
 * warn() and error() are always active for operational visibility.
 */
const isDev = import.meta.env.DEV;

const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default logger;
