import config from '@splitsmart/config/eslint';

export default [
  ...config,
  {
    rules: {
      // Nest relies heavily on decorators and class metadata.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
