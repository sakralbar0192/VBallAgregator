import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config: TypeScript (syntax-based recommended) + Node globals.
 * Строгая проверка типов — `npm run typecheck` (tsc --noEmit).
 */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'coverage-e2e/**',
      'documentation/**',
      '**/*.md',
      '.cursor/**',
      '*.config.js',
      'eslint.config.js',
      'scripts/**',
      'packages/core/prisma/migrations/**',
      // Не входит в tsconfig.json; конфиг Prisma отдельно от приложения
      'prisma.config.ts',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{ts,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'no-useless-assignment': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  }
);
