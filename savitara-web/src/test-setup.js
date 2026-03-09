import '@testing-library/jest-dom';

// Polyfill localStorage / sessionStorage for jsdom environments
// that mount without the --localstorage-file flag.
const storageMock = () => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
};

if (typeof globalThis !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: storageMock(), writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: storageMock(), writable: true });
}

