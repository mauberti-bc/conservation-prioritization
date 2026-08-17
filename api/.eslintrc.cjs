module.exports = {
  root: true,
  env: {
    es2022: true,
    mocha: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: [
    'src/**/*.d.ts',
    'coverage',
    'build',
    'dist',
    '.pipeline',
    '.docker',
    '.cache',
    'node_modules'
  ],
  rules: {
    '@typescript-eslint/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': false,
        'ts-ignore': false,
        'ts-nocheck': false,
        'ts-check': false
      }
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-redeclare': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }
    ],
    curly: 'error',
    'no-lonely-if': 'error',
    'no-redeclare': 'off',
    'no-undef': 'off',
    'no-unused-vars': 'off',
    'no-var': 'error',
    'prettier/prettier': 'warn'
  }
};
