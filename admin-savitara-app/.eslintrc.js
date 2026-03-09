// Lint config for admin-savitara-app (React Native + Expo admin interface)
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
    react: { version: 'detect' },
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react-native/no-unused-styles': 'warn',
    'react-native/no-color-literals': 'off',
    'react-native/no-raw-text': 'off',
    'react/prop-types': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    '.expo/',
    '*.config.js',
  ],
};
