module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:svelte/recommended'
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  rules: {
    // Warn about console.log
    'no-console': 'warn',
    
    // Require const instead of let when possible
    'prefer-const': 'error',
    
    // No unused variables
    'no-unused-vars': 'warn'
  }
};