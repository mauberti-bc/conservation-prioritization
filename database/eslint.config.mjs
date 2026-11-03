import eslintJs from '@eslint/js';
import vitestEslintPlugin from '@vitest/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'src/**/*.d.ts',
      'coverage/**/*',
      'build/**/*',
      'dist/**/*',
      '.pipeline/**/*',
      '.docker/**/*',
      'node_modules/**/*'
    ]
  },

  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...vitestEslintPlugin.configs.env.languageOptions.globals
      }
    },

    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
      prettier: eslintPluginPrettier,
      vitest: vitestEslintPlugin
    },

    rules: {
      // Base ESLint rules
      ...eslintJs.configs.recommended.rules,

      // TypeScript rules
      ...typescriptEslint.configs.recommended.rules,

      // Vitest recommended rules
      ...vitestEslintPlugin.configs.recommended.rules,

      // Disable formatting rules (Prettier manages formatting)
      ...eslintConfigPrettier.rules,

      // Prettier integration
      'prettier/prettier': ['warn'],

      // TS Overrides
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': false,
          'ts-ignore': false,
          'ts-nocheck': false,
          'ts-check': false
        }
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      '@typescript-eslint/no-redeclare': 'off',

      // JS Overrides
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',

      // Style rules
      'no-var': 'error',
      'no-lonely-if': 'error',
      curly: 'error'
    }
  }
];
