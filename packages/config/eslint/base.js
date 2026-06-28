import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** Shared flat ESLint config for TypeScript packages. */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'build/**', '.next/**', 'coverage/**', 'node_modules/**'],
  },
  prettier,
);
