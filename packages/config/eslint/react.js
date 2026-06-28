import base from './base.js';
import globals from 'globals';

/** Shared flat ESLint config for React / React Native packages. */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
