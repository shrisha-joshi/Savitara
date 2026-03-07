// Shim: date-fns@3 changed _lib/format/longFormatters to named exports, but
// @mui/x-date-pickers@6 still uses `import longFormatters from '...longFormatters'`
// (a default import). This file re-exports the named export as a default so
// Vite 6 strict-exports resolution can satisfy the import.
export { longFormatters as default } from '../../node_modules/date-fns/_lib/format/longFormatters.mjs';

