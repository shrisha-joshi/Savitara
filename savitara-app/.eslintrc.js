// TEST-05: Real ESLint config for savitara-app (React Native + Expo)
// Replaces the stub "echo 'No linting configured yet'" script.
// Run: npm run lint
module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:react/recommended',
    'plugin:react-native/all',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['babel-preset-expo'],
    },
  },
  plugins: ['react', 'react-native'],
  env: {
    'react-native/react-native': true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Disallow raw console statements in production React Native code.
    // CQ-01: Replace with conditional __DEV__ logging.
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // React Native specific
    'react-native/no-unused-styles': 'warn',
    'react-native/no-color-literals': 'off', // too noisy for existing codebase
    'react-native/no-raw-text': 'off',       // too restrictive for existing JSX

    // Common React rules
    'react/prop-types': 'warn',
    'react/react-in-jsx-scope': 'off', // not required with React 17+ JSX transform

    // Allow TODO comments tracked in issues (reduce noise but make them visible)
    'no-warning-comments': ['warn', { terms: ['FIXME', 'HACK', 'XXX'], location: 'start' }],
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    '.expo/',
    'dist/',
    'build/',
    '*.config.js',
  ],
};
